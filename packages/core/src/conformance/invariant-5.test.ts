import { readFileSync } from 'node:fs';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as core from '../index.js';
import type { ProcessRunner, ProcessOutput } from '../index.js';
import { ok, FAILURE_CAUSES, loadPolicy, resolvedPolicySchema, policyRevisionRecord } from '../index.js';

const templateBytes = readFileSync(fileURLToPath(new URL('../../../../templates/policy/policy.yml', import.meta.url)));

const commit = 'a'.repeat(40);
const treeId = 'b'.repeat(40);
const blobId = 'c'.repeat(40);

function defaultLsRoot(): ProcessOutput {
  return { exitCode: 0, stdout: Buffer.from(`040000 tree ${treeId}\t.github/patch-steward\u0000`), stderr: Buffer.alloc(0) };
}

function defaultLsRec(policyBytes: Buffer): ProcessOutput {
  return {
    exitCode: 0,
    stdout: Buffer.from(`100644 blob ${blobId} ${policyBytes.length}\tpolicy.yml\u0000`),
    stderr: Buffer.alloc(0),
  };
}

function makeRunner(overrides: Partial<Record<'gitDir' | 'verify' | 'lsRoot' | 'lsRec' | 'cat', ProcessOutput>>): ProcessRunner {
  const runner: ProcessRunner = async (_binary, args) => {
    if (args[0] === 'rev-parse' && args[1] === '--git-dir') {
      return ok(overrides.gitDir ?? { exitCode: 0, stdout: Buffer.from('.git\n'), stderr: Buffer.alloc(0) });
    }
    if (args[0] === 'rev-parse' && args[1] === '--verify') {
      return ok(overrides.verify ?? { exitCode: 0, stdout: Buffer.from(`${commit}\n`), stderr: Buffer.alloc(0) });
    }
    if (args[0] === 'ls-tree' && args.includes('.github/patch-steward')) {
      return ok(overrides.lsRoot ?? defaultLsRoot());
    }
    if (args[0] === 'ls-tree' && args.includes('-r')) {
      return ok(overrides.lsRec ?? defaultLsRec(templateBytes));
    }
    if (args[0] === 'cat-file') {
      return ok(overrides.cat ?? { exitCode: 0, stdout: templateBytes, stderr: Buffer.alloc(0) });
    }
    throw new Error(`unexpected git invocation: ${args.join(' ')}`);
  };
  return runner;
}

const malformedCases: readonly [string, Partial<Record<'gitDir' | 'verify' | 'lsRoot' | 'lsRec' | 'cat', ProcessOutput>>][] = [
  ['rev-parse commit id', { verify: { exitCode: 0, stdout: Buffer.from('not-a-commit\n'), stderr: Buffer.alloc(0) } }],
  [
    'ls-tree root without NUL terminator',
    { lsRoot: { exitCode: 0, stdout: Buffer.from(`040000 tree ${treeId}\t.github/patch-steward`), stderr: Buffer.alloc(0) } },
  ],
  [
    'ls-tree root with two records',
    {
      lsRoot: {
        exitCode: 0,
        stdout: Buffer.concat([
          Buffer.from(`040000 tree ${treeId}\t.github/patch-steward\u0000`),
          Buffer.from(`040000 tree ${treeId}\t.github/patch-steward\u0000`),
        ]),
        stderr: Buffer.alloc(0),
      },
    },
  ],
  [
    'ls-tree root for another path',
    { lsRoot: { exitCode: 0, stdout: Buffer.from(`040000 tree ${treeId}\tother\u0000`), stderr: Buffer.alloc(0) } },
  ],
  ['ls-tree listing record', { lsRec: { exitCode: 0, stdout: Buffer.from('garbage\u0000'), stderr: Buffer.alloc(0) } }],
  [
    'ls-tree listing unknown mode',
    { lsRec: { exitCode: 0, stdout: Buffer.from(`100600 blob ${blobId} 7\tpolicy.yml\u0000`), stderr: Buffer.alloc(0) } },
  ],
  [
    'ls-tree listing without NUL terminator',
    {
      lsRec: {
        exitCode: 0,
        stdout: Buffer.from(`100644 blob ${blobId} ${templateBytes.length}\tpolicy.yml`),
        stderr: Buffer.alloc(0),
      },
    },
  ],
  [
    'cat-file size mismatch',
    {
      lsRec: {
        exitCode: 0,
        stdout: Buffer.from(`100644 blob ${blobId} ${templateBytes.length + 1}\tpolicy.yml\u0000`),
        stderr: Buffer.alloc(0),
      },
    },
  ],
  ['invalid UTF-8 output', { lsRoot: { exitCode: 0, stdout: Buffer.from([0xff, 0xfe, 0x00]), stderr: Buffer.alloc(0) } }],
];

describe('invariant 5 conformance', () => {
  it.each(malformedCases.map(([name]) => name))('invariant 5: malformed git output is rejected: %s', async (name) => {
    const overrides = malformedCases.find(([caseName]) => caseName === name)?.[1];
    const runner = makeRunner(overrides ?? {});
    const result = await loadPolicy({ kind: 'git', repoDir: os.tmpdir(), ref: 'main' }, { runner });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('git.malformed-output');
      expect(result.failure.outcome).toBe('inconclusive');
    }
    expect('value' in result).toBe(false);
  });

  it('invariant 5: loaded policies re-validate against the resolved schema', async () => {
    const dir = os.tmpdir();
    const filePath = fileURLToPath(new URL('../../../../templates/policy/policy.yml', import.meta.url));
    const fileResult = await loadPolicy({ kind: 'file', path: filePath });
    expect(fileResult.ok).toBe(true);
    if (fileResult.ok) {
      expect(resolvedPolicySchema.safeParse(fileResult.value.policy).success).toBe(true);
      const record = policyRevisionRecord(fileResult.value, { stewardVersion: '0.0.2', loadedAt: '2026-09-26T12:00:00Z' });
      expect(record.ok).toBe(true);
    }

    const runner = makeRunner({});
    const gitResult = await loadPolicy({ kind: 'git', repoDir: dir, ref: 'main' }, { runner });
    expect(gitResult.ok).toBe(true);
    if (gitResult.ok) {
      expect(resolvedPolicySchema.safeParse(gitResult.value.policy).success).toBe(true);
      const record = policyRevisionRecord(gitResult.value, { stewardVersion: '0.0.2', loadedAt: '2026-09-26T12:00:00Z' });
      expect(record.ok).toBe(true);
    }
  });

  it('invariant 5: every exported load, validate, and resolve function rejects invalid input', async () => {
    const names = Object.keys(core)
      .filter((name) => /^(load|validate|resolve)/.test(name) && typeof (core as Record<string, unknown>)[name] === 'function')
      .sort();
    expect(names).toEqual(['loadPolicy', 'resolveCommit', 'resolvePolicy', 'validatePolicy', 'validatePolicyBytes']);

    const results: unknown[] = [];

    const invalidFileResult = await core.loadPolicy({ kind: 'file', path: '/does-not-exist/policy.yml' });
    results.push(invalidFileResult);

    const bytesResult = await (async () => {
      const dir = os.tmpdir();
      const { writeFileSync, mkdtempSync } = await import('node:fs');
      const { join } = await import('node:path');
      const tmp = mkdtempSync(join(dir, 'invariant5-'));
      const path = join(tmp, 'policy.yml');
      writeFileSync(path, 'version: 1\nextra: 1\n');
      return core.loadPolicy({ kind: 'file', path });
    })();
    results.push(bytesResult);

    results.push(core.validatePolicy({ version: 1 }));
    results.push(core.validatePolicyBytes(Buffer.from('version: 1\n')));
    results.push(core.resolvePolicy({ dismissal_codes: [] } as unknown as core.Policy));

    const gitOptions = { repoDir: os.tmpdir(), timeoutMs: 1000, maxOutputBytes: 1000 };
    results.push(await core.resolveCommit(gitOptions, '-x'));

    const versionRunner: ProcessRunner = async (_binary, args) => {
      if (args[0] === 'rev-parse' && args[1] === '--git-dir') {
        return ok({ exitCode: 0, stdout: Buffer.from('.git\n'), stderr: Buffer.alloc(0) });
      }
      if (args[0] === 'rev-parse' && args[1] === '--verify') {
        return ok({ exitCode: 0, stdout: Buffer.from(`${commit}\n`), stderr: Buffer.alloc(0) });
      }
      if (args[0] === 'ls-tree' && args.includes('.github/patch-steward')) {
        return ok(defaultLsRoot());
      }
      if (args[0] === 'ls-tree' && args.includes('-r')) {
        return ok({ exitCode: 0, stdout: Buffer.from(`100644 blob ${blobId} 11\tpolicy.yml\u0000`), stderr: Buffer.alloc(0) });
      }
      if (args[0] === 'cat-file') {
        return ok({ exitCode: 0, stdout: Buffer.from('version: 2\n'), stderr: Buffer.alloc(0) });
      }
      throw new Error(`unexpected git invocation: ${args.join(' ')}`);
    };
    results.push(await core.loadPolicy({ kind: 'git', repoDir: os.tmpdir(), ref: 'main' }, { runner: versionRunner }));

    for (const result of results) {
      const r = result as { ok: boolean; failure?: { outcome: string; cause: string } };
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.failure?.outcome).toBe('inconclusive');
        expect(FAILURE_CAUSES).toContain(r.failure?.cause);
      }
      expect('value' in (result as object)).toBe(false);
    }
  });
});
