import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Result } from '../result.js';
import { ok, err } from '../result.js';
import type { ProcessFailureCode, ProcessOutput, ProcessRunner, RunProcessOptions } from '../process/run-process.js';
import { runProcess } from '../process/run-process.js';
import type { GitReadOptions, TreeEntry } from './reader.js';
import {
  POLICY_DIRECTORY,
  isObjectId,
  inertGitEnv,
  resolveCommit,
  readPolicyTreeId,
  listTree,
  findTreeEntry,
  readBlob,
} from './reader.js';

interface RecordedCall {
  readonly binary: string;
  readonly args: readonly string[];
  readonly options: RunProcessOptions;
}

type ScriptedResult = Result<ProcessOutput, ProcessFailureCode>;
type Scripter = (args: readonly string[]) => ScriptedResult;

function makeFakeRunner(scripter: Scripter): { runner: ProcessRunner; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const runner: ProcessRunner = async (binary, args, options) => {
    calls.push({ binary, args, options });
    return scripter(args);
  };
  return { runner, calls };
}

function processOk(exitCode: number, stdout: string, stderr = ''): ScriptedResult {
  return ok({ exitCode, stdout: Buffer.from(stdout, 'utf-8'), stderr: Buffer.from(stderr, 'utf-8') });
}

const SHA1_A = 'a'.repeat(40);
const SHA1_B = 'b'.repeat(40);
const SHA1_C = 'c'.repeat(40);
const SHA1_D = 'd'.repeat(40);
const SHA1_E = 'e'.repeat(40);

function baseOptions(runner: ProcessRunner): GitReadOptions {
  return { repoDir: os.tmpdir(), timeoutMs: 5000, maxOutputBytes: 65536, runner };
}

describe('resolveCommit', () => {
  it('returns the 40-hex id, stripping a trailing newline', async () => {
    const { runner, calls } = makeFakeRunner((args) => {
      if (args[0] === 'rev-parse' && args[1] === '--git-dir') {
        return processOk(0, '.git\n');
      }
      return processOk(0, `${SHA1_A}\n`);
    });
    const result = await resolveCommit(baseOptions(runner), 'main');
    expect(result).toEqual(ok(SHA1_A));
    const verifyCall = calls.find((c) => c.args[0] === 'rev-parse' && c.args[1] === '--verify');
    expect(verifyCall?.args).toEqual(['rev-parse', '--verify', '--quiet', '--end-of-options', 'main^{commit}']);
  });

  it('returns the 40-hex id, stripping a trailing CRLF', async () => {
    const { runner } = makeFakeRunner((args) => {
      if (args[0] === 'rev-parse' && args[1] === '--git-dir') {
        return processOk(0, '.git\n');
      }
      return processOk(0, `${SHA1_A}\r\n`);
    });
    const result = await resolveCommit(baseOptions(runner), 'main');
    expect(result).toEqual(ok(SHA1_A));
  });

  it.each(['-x', '', 'a\nb'])('rejects invalid ref %s with no runner call', async (ref) => {
    const { runner, calls } = makeFakeRunner(() => processOk(0, ''));
    const result = await resolveCommit(baseOptions(runner), ref);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('git.invalid-ref');
    }
    expect(calls.length).toBe(0);
  });

  it('maps a failing --git-dir check to git.not-a-repository', async () => {
    const { runner } = makeFakeRunner((args) => {
      if (args[0] === 'rev-parse' && args[1] === '--git-dir') {
        return processOk(128, '', 'fatal');
      }
      return processOk(0, `${SHA1_A}\n`);
    });
    const result = await resolveCommit(baseOptions(runner), 'main');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('git.not-a-repository');
    }
  });

  it('maps verify exit 1 to git.ref-unresolvable', async () => {
    const { runner } = makeFakeRunner((args) => {
      if (args[0] === 'rev-parse' && args[1] === '--git-dir') {
        return processOk(0, '.git\n');
      }
      return processOk(1, '');
    });
    const result = await resolveCommit(baseOptions(runner), 'main');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('git.ref-unresolvable');
    }
  });

  it('maps a non-object-id stdout to git.malformed-output', async () => {
    const { runner } = makeFakeRunner((args) => {
      if (args[0] === 'rev-parse' && args[1] === '--git-dir') {
        return processOk(0, '.git\n');
      }
      return processOk(0, 'not-a-sha\n');
    });
    const result = await resolveCommit(baseOptions(runner), 'main');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('git.malformed-output');
    }
  });

  it('maps a missing repoDir to git.not-a-repository', async () => {
    const { runner } = makeFakeRunner(() => processOk(0, `${SHA1_A}\n`));
    const options: GitReadOptions = {
      repoDir: path.join(os.tmpdir(), 'no-such-dir-for-reader-test'),
      timeoutMs: 5000,
      maxOutputBytes: 65536,
      runner,
    };
    const result = await resolveCommit(options, 'main');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('git.not-a-repository');
    }
  });

  it('injected failure: missing binary', async () => {
    const options: GitReadOptions = {
      repoDir: os.tmpdir(),
      timeoutMs: 5000,
      maxOutputBytes: 65536,
      gitBinary: path.join(os.tmpdir(), 'no-such-git-binary-for-reader-test'),
      runner: runProcess,
    };
    const result = await resolveCommit(options, 'HEAD');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('git.unavailable');
    }
  });

  it('injected failure: non-zero exit', async () => {
    const { runner: verifyRunner } = makeFakeRunner((args) => {
      if (args[0] === 'rev-parse' && args[1] === '--git-dir') {
        return processOk(0, '.git\n');
      }
      return processOk(128, '', 'fatal');
    });
    const verifyResult = await resolveCommit(baseOptions(verifyRunner), 'main');
    expect(verifyResult.ok).toBe(false);
    if (!verifyResult.ok) {
      expect(verifyResult.failure.code).toBe('git.failed');
    }

    const { runner: lsTreeRunner } = makeFakeRunner(() => processOk(128, '', 'fatal'));
    const lsTreeResult = await readPolicyTreeId(baseOptions(lsTreeRunner), SHA1_A);
    expect(lsTreeResult.ok).toBe(false);
    if (!lsTreeResult.ok) {
      expect(lsTreeResult.failure.code).toBe('git.failed');
    }
  });

  it('injected failure: timeout', async () => {
    const { runner } = makeFakeRunner(() => err('process.timeout', 'infrastructure', 'x'));
    const result = await resolveCommit(baseOptions(runner), 'main');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('git.timeout');
    }
  });

  it('every failure has outcome inconclusive and a listed cause', async () => {
    const { runner } = makeFakeRunner(() => processOk(1, ''));
    const result = await resolveCommit(baseOptions(runner), '-x');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.outcome).toBe('inconclusive');
      expect(['infrastructure', 'policy-unavailable', 'policy-invalid', 'steward-defect']).toContain(result.failure.cause);
    }
  });

  it('passes GIT_TERMINAL_PROMPT to the runner', async () => {
    const { runner, calls } = makeFakeRunner((args) => {
      if (args[0] === 'rev-parse' && args[1] === '--git-dir') {
        return processOk(0, '.git\n');
      }
      return processOk(0, `${SHA1_A}\n`);
    });
    await resolveCommit(baseOptions(runner), 'main');
    for (const call of calls) {
      expect(call.options.env['GIT_TERMINAL_PROMPT']).toBe('0');
    }
  });
});

describe('readPolicyTreeId', () => {
  it('returns the tree id for a tree record', async () => {
    const { runner, calls } = makeFakeRunner(() => processOk(0, `040000 tree ${SHA1_B}\t${POLICY_DIRECTORY}\0`));
    const result = await readPolicyTreeId(baseOptions(runner), SHA1_A);
    expect(result).toEqual(ok(SHA1_B));
    expect(calls[0]?.args).toEqual(['ls-tree', '-z', '--full-tree', SHA1_A, '--', POLICY_DIRECTORY]);
  });

  it('injected failure: empty stdout means policy-directory-missing', async () => {
    const { runner } = makeFakeRunner(() => processOk(0, ''));
    const result = await readPolicyTreeId(baseOptions(runner), SHA1_A);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('git.policy-directory-missing');
    }
  });

  it('maps a blob record to git.not-a-directory', async () => {
    const { runner } = makeFakeRunner(() => processOk(0, `100644 blob ${SHA1_B}\t${POLICY_DIRECTORY}\0`));
    const result = await readPolicyTreeId(baseOptions(runner), SHA1_A);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('git.not-a-directory');
    }
  });

  it('maps a gitlink record to git.not-a-directory', async () => {
    const { runner } = makeFakeRunner(() => processOk(0, `160000 commit ${SHA1_B}\t${POLICY_DIRECTORY}\0`));
    const result = await readPolicyTreeId(baseOptions(runner), SHA1_A);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('git.not-a-directory');
    }
  });

  it('maps two records to git.malformed-output', async () => {
    const record1 = `040000 tree ${SHA1_B}\t${POLICY_DIRECTORY}`;
    const record2 = `040000 tree ${SHA1_C}\t${POLICY_DIRECTORY}`;
    const { runner } = makeFakeRunner(() => processOk(0, `${record1}\0${record2}\0`));
    const result = await readPolicyTreeId(baseOptions(runner), SHA1_A);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('git.malformed-output');
    }
  });

  it('rejects an invalid commit object id with no runner call', async () => {
    const { runner, calls } = makeFakeRunner(() => processOk(0, ''));
    const result = await readPolicyTreeId(baseOptions(runner), 'HEAD');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('git.invalid-object-id');
    }
    expect(calls.length).toBe(0);
  });
});

describe('listTree', () => {
  it('parses a sample with all mode/type combinations, including spaces in paths', async () => {
    const stdout =
      [
        `100644 blob ${SHA1_A}      11\tpolicy.yml`,
        `100755 blob ${SHA1_B}       5\trunner/entry.sh`,
        `120000 blob ${SHA1_C}       3\tlink to file`,
        `160000 commit ${SHA1_D}       -\tsubmodule dir`,
      ].join('\0') + '\0';
    const { runner } = makeFakeRunner(() => processOk(0, stdout));
    const result = await listTree(baseOptions(runner), SHA1_E);
    expect(result).toEqual(
      ok<readonly TreeEntry[]>([
        { path: 'policy.yml', mode: '100644', type: 'blob', id: SHA1_A, size: 11 },
        { path: 'runner/entry.sh', mode: '100755', type: 'blob', id: SHA1_B, size: 5 },
        { path: 'link to file', mode: '120000', type: 'blob', id: SHA1_C, size: 3 },
        { path: 'submodule dir', mode: '160000', type: 'commit', id: SHA1_D, size: null },
      ]),
    );
  });

  it('injected failure: oversize output', async () => {
    const { runner } = makeFakeRunner(() => err('process.output-too-large', 'infrastructure', 'x'));
    const result = await listTree(baseOptions(runner), SHA1_A);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('git.output-too-large');
    }
  });

  it('injected failure: malformed ls-tree line', async () => {
    const { runner: garbageRunner } = makeFakeRunner(() => processOk(0, 'garbage\0'));
    const garbageResult = await listTree(baseOptions(garbageRunner), SHA1_A);
    expect(garbageResult.ok).toBe(false);
    if (!garbageResult.ok) {
      expect(garbageResult.failure.code).toBe('git.malformed-output');
    }

    const { runner: noNulRunner } = makeFakeRunner(() => processOk(0, `100644 blob ${SHA1_A}      11\tpolicy.yml`));
    const noNulResult = await listTree(baseOptions(noNulRunner), SHA1_A);
    expect(noNulResult.ok).toBe(false);
    if (!noNulResult.ok) {
      expect(noNulResult.failure.code).toBe('git.malformed-output');
    }

    const { runner: gitlinkBlobRunner } = makeFakeRunner(() => processOk(0, `160000 blob ${SHA1_A}       -\tsubmodule\0`));
    const gitlinkBlobResult = await listTree(baseOptions(gitlinkBlobRunner), SHA1_A);
    expect(gitlinkBlobResult.ok).toBe(false);
    if (!gitlinkBlobResult.ok) {
      expect(gitlinkBlobResult.failure.code).toBe('git.malformed-output');
    }

    const { runner: nonNumericSizeRunner } = makeFakeRunner(() => processOk(0, `100644 blob ${SHA1_A}      xx\tpolicy.yml\0`));
    const nonNumericSizeResult = await listTree(baseOptions(nonNumericSizeRunner), SHA1_A);
    expect(nonNumericSizeResult.ok).toBe(false);
    if (!nonNumericSizeResult.ok) {
      expect(nonNumericSizeResult.failure.code).toBe('git.malformed-output');
    }
  });

  it('rejects an invalid tree object id with no runner call', async () => {
    const { runner, calls } = makeFakeRunner(() => processOk(0, ''));
    const result = await listTree(baseOptions(runner), 'HEAD');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('git.invalid-object-id');
    }
    expect(calls.length).toBe(0);
  });
});

describe('findTreeEntry', () => {
  const entries: readonly TreeEntry[] = [{ path: 'policy.yml', mode: '100644', type: 'blob', id: SHA1_A, size: 11 }];

  it('finds an exact match', () => {
    expect(findTreeEntry(entries, 'policy.yml')).toEqual(ok(entries[0]));
  });

  it('injected failure: missing blob', async () => {
    const missingResult = findTreeEntry(entries, 'missing.yml');
    expect(missingResult.ok).toBe(false);
    if (!missingResult.ok) {
      expect(missingResult.failure.code).toBe('git.entry-missing');
    }

    const { runner } = makeFakeRunner(() => processOk(128, '', 'fatal'));
    const catResult = await readBlob(baseOptions(runner), entries[0] as TreeEntry, 65536);
    expect(catResult.ok).toBe(false);
    if (!catResult.ok) {
      expect(catResult.failure.code).toBe('git.object-missing');
    }
  });
});

describe('readBlob', () => {
  it('returns the exact bytes for a matching size', async () => {
    const entry: TreeEntry = { path: 'policy.yml', mode: '100644', type: 'blob', id: SHA1_A, size: 5 };
    const { runner, calls } = makeFakeRunner(() => processOk(0, 'hello'));
    const result = await readBlob(baseOptions(runner), entry, 65536);
    expect(result).toEqual(ok(Buffer.from('hello', 'utf-8')));
    expect(calls[0]?.args).toEqual(['cat-file', 'blob', SHA1_A]);
  });

  it('maps a size mismatch to git.malformed-output', async () => {
    const entry: TreeEntry = { path: 'policy.yml', mode: '100644', type: 'blob', id: SHA1_A, size: 999 };
    const { runner } = makeFakeRunner(() => processOk(0, 'hello'));
    const result = await readBlob(baseOptions(runner), entry, 65536);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('git.malformed-output');
    }
  });

  it('injected failure: oversize blob', async () => {
    const bigEntry: TreeEntry = { path: 'policy.yml', mode: '100644', type: 'blob', id: SHA1_A, size: 100 };
    const { runner, calls } = makeFakeRunner(() => processOk(0, 'hello'));
    const preCheckResult = await readBlob(baseOptions(runner), bigEntry, 10);
    expect(preCheckResult.ok).toBe(false);
    if (!preCheckResult.ok) {
      expect(preCheckResult.failure.code).toBe('git.blob-too-large');
    }
    expect(calls.length).toBe(0);

    const smallEntry: TreeEntry = { path: 'policy.yml', mode: '100644', type: 'blob', id: SHA1_A, size: 5 };
    const { runner: oversizeRunner } = makeFakeRunner(() => err('process.output-too-large', 'infrastructure', 'x'));
    const runtimeResult = await readBlob(baseOptions(oversizeRunner), smallEntry, 65536);
    expect(runtimeResult.ok).toBe(false);
    if (!runtimeResult.ok) {
      expect(runtimeResult.failure.code).toBe('git.blob-too-large');
    }
  });

  it('injected failure: symlink entry', async () => {
    const entry: TreeEntry = { path: 'link', mode: '120000', type: 'blob', id: SHA1_A, size: 3 };
    const { runner, calls } = makeFakeRunner(() => processOk(0, ''));
    const result = await readBlob(baseOptions(runner), entry, 65536);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('git.entry-not-regular');
    }
    expect(calls.length).toBe(0);
  });

  it('injected failure: gitlink entry', async () => {
    const entry: TreeEntry = { path: 'submodule', mode: '160000', type: 'commit', id: SHA1_A, size: null };
    const { runner, calls } = makeFakeRunner(() => processOk(0, ''));
    const result = await readBlob(baseOptions(runner), entry, 65536);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('git.entry-not-regular');
    }
    expect(calls.length).toBe(0);
  });
});

describe('isObjectId', () => {
  it('accepts SHA-1 and SHA-256 hex ids', () => {
    expect(isObjectId(SHA1_A)).toBe(true);
    expect(isObjectId('a'.repeat(64))).toBe(true);
    expect(isObjectId('not-a-sha')).toBe(false);
  });
});

describe('inertGitEnv', () => {
  it('strips GIT_-prefixed keys, undefined values, and sets inert flags', () => {
    const result = inertGitEnv({ PATH: 'p', GIT_DIR: 'd', git_work_tree: 'w', GIT_CONFIG_PARAMETERS: 'c', X: undefined });
    expect(result).toEqual({
      PATH: 'p',
      GIT_TERMINAL_PROMPT: '0',
      GIT_OPTIONAL_LOCKS: '0',
      GIT_NO_REPLACE_OBJECTS: '1',
    });
  });
});
