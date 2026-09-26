import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

interface RecordedCall {
  readonly fn: string;
  readonly file: string;
  readonly args: string[];
}

const spy = vi.hoisted(() => ({ calls: [] as RecordedCall[] }));

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();

  function wrap<T extends (...args: never[]) => unknown>(fn: string, original: T): T {
    return ((...args: unknown[]) => {
      spy.calls.push({
        fn,
        file: String(args[0]),
        args: Array.isArray(args[1]) ? args[1].map(String) : [],
      });
      return Reflect.apply(original, undefined, args);
    }) as unknown as T;
  }

  return {
    ...actual,
    execFile: wrap('execFile', actual.execFile),
    execFileSync: wrap('execFileSync', actual.execFileSync),
    spawn: wrap('spawn', actual.spawn),
    spawnSync: wrap('spawnSync', actual.spawnSync),
    exec: wrap('exec', actual.exec),
    execSync: wrap('execSync', actual.execSync),
    fork: wrap('fork', actual.fork),
  };
});

import { runProcess } from '../process/run-process.js';
import { findUpstreamRemote } from '../git/remotes.js';
import { resolveCommit } from '../git/reader.js';
import type { GitReadOptions } from '../git/reader.js';
import { findMergeBase, listChangedPaths } from '../git/diff.js';
import { readProposedPolicyFromGit, proposedPolicyFromBytes } from '../submission/proposed-policy.js';
import { parseIssueBody, parsePullRequestBody } from '../submission/parse.js';
import { DEFAULT_CHECKLIST_POLICY } from '../submission/default-checklist.js';
import { assessAttachmentsStatically } from '../submission/attachments.js';
import { checkContract, contractRequiredFields, linkedIssueReference } from '../submission/contract.js';
import type { ContractRepository, LinkedIssueCheck, PullRequestContractInput } from '../submission/contract.js';
import { changedPathSet } from '../submission/paths.js';
import type { PathChange } from '../submission/paths.js';
import { captureIssue, capturePullRequest } from '../submission/intake.js';
import type { CaptureContext } from '../submission/intake.js';
import { createGitHubClient } from '../github/client.js';
import type { GitHubFetch } from '../github/client.js';
import { createGitHubBudget } from '../github/budget.js';
import type { GitHubRepositoryRef } from '../github/reader.js';
import type {
  AttachmentAddress,
  AttachmentResolver,
  AttachmentTransport,
  AttachmentTransportResponse,
} from '../net/attachment-fetch.js';

const submissionsDir = fileURLToPath(new URL('../../../../fixtures/submissions/', import.meta.url));
const githubFixturesDir = fileURLToPath(new URL('../../../../fixtures/github/testbed/', import.meta.url));
const policy = DEFAULT_CHECKLIST_POLICY;
const REPOSITORY: ContractRepository = { fullName: 'steady-orchard/patch-steward-testbed-public', defaultBranch: 'master' };
const REPO_REF: GitHubRepositoryRef = { owner: 'steady-orchard', name: 'patch-steward-testbed-public' };
const HEAD_SHA = 'b46eef5018c202bcb2470bf62e3defd7496ec65b';

function crlfToLf(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

function readSubmissionText(relative: string): string {
  return crlfToLf(fs.readFileSync(path.join(submissionsDir, relative), 'utf8'));
}

function readSubmissionBytes(relative: string): Buffer {
  return Buffer.from(readSubmissionText(relative), 'utf8');
}

function listBodyFiles(): readonly string[] {
  return fs.readdirSync(submissionsDir).filter((entry) => entry.endsWith('.txt') && !entry.startsWith('proposed-policy'));
}

function listDiffFiles(): readonly string[] {
  return fs.readdirSync(path.join(submissionsDir, 'diffs')).filter((entry) => entry.endsWith('.json'));
}

function readDiffChanges(relative: string): readonly PathChange[] {
  return JSON.parse(fs.readFileSync(path.join(submissionsDir, 'diffs', relative), 'utf8')) as readonly PathChange[];
}

function readGitHubFixture(relative: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(githubFixturesDir, relative), 'utf8')) as Record<string, unknown>;
}

function withBody(relative: string, body: string): Record<string, unknown> {
  const object = readGitHubFixture(relative);
  return { ...object, body };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

type RouteMap = Record<string, () => Response>;

function routedFetch(routes: RouteMap): GitHubFetch {
  return (url: string) => {
    const parsed = new URL(url);
    const handler = routes[parsed.pathname];
    if (!handler) {
      throw new Error(`unrouted path ${parsed.pathname}`);
    }
    return Promise.resolve(handler());
  };
}

function fakeAttachmentResolver(): AttachmentResolver {
  return async (): Promise<readonly AttachmentAddress[]> => [{ address: '140.82.112.3', family: 4 }];
}

function fakeAttachmentTransport(): AttachmentTransport {
  return async (): Promise<AttachmentTransportResponse> => ({
    kind: 'response',
    status: 200,
    location: null,
    body: {
      [Symbol.asyncIterator]() {
        let done = false;
        return {
          async next(): Promise<IteratorResult<Uint8Array>> {
            if (done) {
              return { done: true, value: undefined };
            }
            done = true;
            return { done: false, value: new Uint8Array() };
          },
        };
      },
    },
    close: () => undefined,
  });
}

describe('zero-execution spy positive control', () => {
  it('zero-execution spy intercepts spawned processes', async () => {
    spy.calls.length = 0;
    const result = await runProcess(process.execPath, ['-e', ''], {
      cwd: os.tmpdir(),
      env: {},
      timeoutMs: 5000,
      maxOutputBytes: 1024,
    });
    expect(result.ok).toBe(true);
    expect(spy.calls.length).toBe(1);
  }, 60000);
});

describe('zero model calls and zero executions', () => {
  let repoDir: string;
  let configDir: string;
  let globalConfigPath: string;
  let opts: GitReadOptions;

  function fixtureEnv(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value === undefined || key.toUpperCase().startsWith('GIT_')) {
        continue;
      }
      result[key] = value;
    }
    result['GIT_CONFIG_NOSYSTEM'] = '1';
    result['GIT_CONFIG_GLOBAL'] = globalConfigPath;
    result['GIT_AUTHOR_NAME'] = 'Fixture';
    result['GIT_AUTHOR_EMAIL'] = 'fixture@example.com';
    result['GIT_AUTHOR_DATE'] = '2026-01-01T00:00:00Z';
    result['GIT_COMMITTER_NAME'] = 'Fixture';
    result['GIT_COMMITTER_EMAIL'] = 'fixture@example.com';
    result['GIT_COMMITTER_DATE'] = '2026-01-01T00:00:00Z';
    return result;
  }

  function git(args: readonly string[], input?: Buffer): string {
    const out = execFileSync('git', args, { cwd: repoDir, env: fixtureEnv(), input, encoding: 'buffer' });
    return out.toString('utf8').trim();
  }

  function blob(bytes: Buffer): string {
    return git(['hash-object', '-w', '--no-filters', '--stdin'], bytes);
  }

  function mktree(lines: readonly string[]): string {
    return git(['mktree'], Buffer.from(lines.join(''), 'utf8'));
  }

  function commitTree(tree: string, parents: readonly string[] = []): string {
    const args = ['commit-tree', tree];
    for (const parent of parents) {
      args.push('-p', parent);
    }
    args.push('-m', 'fixture');
    return git(args);
  }

  beforeAll(() => {
    repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-zero-exec-'));
    configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-zero-exec-cfg-'));
    globalConfigPath = path.join(configDir, 'gitconfig');
    fs.writeFileSync(globalConfigPath, '');
    git(['-c', 'init.defaultBranch=main', 'init', '-q']);
    git(['remote', 'add', 'origin', 'https://github.com/steady-orchard/patch-steward-testbed-public.git']);

    const baseParseBlob = blob(Buffer.from('export function parse() {}\n', 'utf8'));
    const baseSrcTree = mktree([`100644 blob ${baseParseBlob}\tparse.ts\n`]);
    const baseTree = mktree([`040000 tree ${baseSrcTree}\tsrc\n`]);
    const baseCommit = commitTree(baseTree);

    const headParseBlob = blob(Buffer.from('export function parse() { return []; }\n', 'utf8'));
    const headSrcTree = mktree([`100644 blob ${headParseBlob}\tparse.ts\n`]);
    const policyBlob = blob(readSubmissionBytes('proposed-policy-valid.yml'));
    const patchStewardTree = mktree([`100644 blob ${policyBlob}\tpolicy.yml\n`]);
    const githubTree = mktree([`040000 tree ${patchStewardTree}\tpatch-steward\n`]);
    const headTree = mktree([`040000 tree ${headSrcTree}\tsrc\n`, `040000 tree ${githubTree}\t.github\n`]);
    const headCommit = commitTree(headTree, [baseCommit]);

    git(['update-ref', 'HEAD', headCommit]);
    git(['update-ref', 'refs/remotes/origin/master', baseCommit]);

    opts = { repoDir, timeoutMs: 30000, maxOutputBytes: 1048576 };
  }, 60000);

  afterAll(() => {
    fs.rmSync(repoDir, { recursive: true, force: true, maxRetries: 3 });
    fs.rmSync(configDir, { recursive: true, force: true, maxRetries: 3 });
  });

  it('zero model calls and zero executions', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    spy.calls.length = 0;

    // (a) every submission fixture through parsing, static attachments, and the contract check.
    for (const bodyFile of listBodyFiles()) {
      const text = readSubmissionText(bodyFile);

      const issueResult = parseIssueBody(text);
      if (issueResult.ok) {
        const body = issueResult.value;
        const requiredFields = contractRequiredFields(policy, { type: 'issue', body, requestedKind: null });
        const attachments = assessAttachmentsStatically({ body, bodyText: text, requiredFields, policy });
        checkContract({ type: 'issue', repository: REPOSITORY, policy, body, requestedKind: null, attachments });
      }

      const prResult = parsePullRequestBody(text);
      if (prResult.ok) {
        const body = prResult.value;
        for (const diffFile of listDiffFiles()) {
          const changes = readDiffChanges(diffFile);
          const touchesPolicy = changedPathSet(changes).some((p) => p.startsWith('.github/patch-steward/'));

          const lv = linkedIssueReference(body, REPOSITORY.fullName);
          const linkedIssue: LinkedIssueCheck =
            lv.status === 'one'
              ? { status: 'exists', number: lv.number, contentHash: `sha256:${'0'.repeat(64)}` }
              : { status: 'not-checked' };

          let proposedPolicy: PullRequestContractInput['proposedPolicy'];
          if (touchesPolicy) {
            const bytes = readSubmissionBytes('proposed-policy-valid.yml');
            proposedPolicy = { status: 'read', proposed: proposedPolicyFromBytes('e'.repeat(40), bytes, () => true) };
          } else {
            proposedPolicy = { status: 'not-read' };
          }

          const requiredFields = contractRequiredFields(policy, { type: 'pull_request', body });
          const attachments = assessAttachmentsStatically({ body, bodyText: text, requiredFields, policy });
          checkContract({
            type: 'pull_request',
            repository: REPOSITORY,
            policy,
            body,
            changedPaths: { kind: 'complete', changes },
            linkedIssue,
            sharedHeads: { status: 'known', pullRequests: [] },
            proposedPolicy,
            attachments,
          });
        }
      }
    }

    proposedPolicyFromBytes('e'.repeat(40), readSubmissionBytes('proposed-policy-valid.yml'), () => true);
    proposedPolicyFromBytes('e'.repeat(40), readSubmissionBytes('proposed-policy-invalid.txt'), () => true);
    JSON.parse(fs.readFileSync(path.join(submissionsDir, 'expectations.json'), 'utf8'));

    expect(spy.calls).toEqual([]);

    // (b) the capture path over recorded GitHub responses.
    const defectBody = readSubmissionText('defect-complete.txt');
    const prBody = readSubmissionText('pr-bugfix-complete.txt');
    const routes: RouteMap = {
      '/repos/steady-orchard/patch-steward-testbed-public': () => jsonResponse(readGitHubFixture('repository.json')),
      '/repos/steady-orchard/patch-steward-testbed-public/issues/29': () => jsonResponse(withBody('issue-29.json', defectBody)),
      '/repos/steady-orchard/patch-steward-testbed-public/pulls/26': () => jsonResponse(withBody('pull-26.json', prBody)),
      '/repos/steady-orchard/patch-steward-testbed-public/pulls/26/files': () =>
        jsonResponse(readGitHubFixture('pull-26-files.json')),
      [`/repos/steady-orchard/patch-steward-testbed-public/commits/${HEAD_SHA}/pulls`]: () =>
        jsonResponse(readGitHubFixture('commit-pulls-b46eef5.json')),
    };
    const client = createGitHubClient({
      token: null,
      budget: createGitHubBudget({ requests: 50, retriesPerRequest: 0 }),
      fetch: routedFetch(routes),
    });
    const captureContext: CaptureContext = {
      client,
      repository: REPO_REF,
      policy,
      policyRevision: 'd'.repeat(40),
      attachmentResolver: fakeAttachmentResolver(),
      attachmentTransport: fakeAttachmentTransport(),
      authorResponses: [],
    };

    const issueCapture = await captureIssue(captureContext, 29);
    expect(issueCapture.ok).toBe(true);
    const pullCapture = await capturePullRequest(captureContext, 26);
    expect(pullCapture.ok).toBe(true);

    expect(spy.calls).toEqual([]);

    // (c) the core preflight path: git reads, proposed policy, contract.
    spy.calls.length = 0;

    const remoteResult = await findUpstreamRemote(opts);
    expect(remoteResult.ok).toBe(true);
    const baseResult = await resolveCommit(opts, 'refs/remotes/origin/master');
    const headResult = await resolveCommit(opts, 'HEAD');
    expect(baseResult.ok).toBe(true);
    expect(headResult.ok).toBe(true);
    if (!baseResult.ok || !headResult.ok) {
      throw new Error('preflight commits did not resolve');
    }

    const mergeBaseResult = await findMergeBase(opts, baseResult.value, headResult.value);
    expect(mergeBaseResult.ok).toBe(true);

    const changedResult = await listChangedPaths(opts, baseResult.value, headResult.value);
    expect(changedResult.ok).toBe(true);
    if (!changedResult.ok || changedResult.value.kind !== 'complete') {
      throw new Error('preflight changed paths were not complete');
    }

    const proposedResult = await readProposedPolicyFromGit(opts, headResult.value);
    expect(proposedResult.ok).toBe(true);
    if (!proposedResult.ok) {
      throw new Error('preflight proposed policy did not read');
    }

    const prText = readSubmissionText('pr-bugfix-complete.txt');
    const prBodyResult = parsePullRequestBody(prText);
    expect(prBodyResult.ok).toBe(true);
    if (!prBodyResult.ok) {
      throw new Error('preflight body did not parse');
    }
    const body = prBodyResult.value;
    const lv = linkedIssueReference(body, REPOSITORY.fullName);
    const linkedIssue: LinkedIssueCheck =
      lv.status === 'one'
        ? { status: 'exists', number: lv.number, contentHash: `sha256:${'0'.repeat(64)}` }
        : { status: 'not-checked' };
    const requiredFields = contractRequiredFields(policy, { type: 'pull_request', body });
    const attachments = assessAttachmentsStatically({ body, bodyText: prText, requiredFields, policy });
    const preflightContract = checkContract({
      type: 'pull_request',
      repository: REPOSITORY,
      policy,
      body,
      changedPaths: changedResult.value,
      linkedIssue,
      sharedHeads: { status: 'not-applicable' },
      proposedPolicy: { status: 'read', proposed: proposedResult.value },
      attachments,
    });
    expect(preflightContract.disposition).toBeDefined();

    expect(spy.calls.length).toBeGreaterThan(0);
    for (const call of spy.calls) {
      const base = path.basename(call.file).replace(/\.[^.]*$/, '');
      expect(base).toBe('git');
      expect(['rev-parse', 'merge-base', 'diff-tree', 'ls-tree', 'cat-file', 'remote']).toContain(call.args[0]);
    }

    // (d) the network spy was never triggered by any of the above.
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();

    // (e) static scan: no submission, adapter, or CLI module imports a model or execution module.
    const scanRoots = [
      fileURLToPath(new URL('../submission/', import.meta.url)),
      fileURLToPath(new URL('../github/', import.meta.url)),
      fileURLToPath(new URL('../net/', import.meta.url)),
      fileURLToPath(new URL('../git/', import.meta.url)),
      fileURLToPath(new URL('../../../cli/src/', import.meta.url)),
    ];

    const forbiddenNamePattern = /(llm|model|copilot|openai|anthropic|sandbox|container|docker|runner)/i;
    const forbiddenSpecifiers = new Set([
      'node:child_process',
      'child_process',
      'node:vm',
      'vm',
      'node:worker_threads',
      'worker_threads',
    ]);
    const specifierPattern = /(?:from\s+|import\s*\(\s*)['"]([^'"]+)['"]|^\s*import\s+['"]([^'"]+)['"]/gm;

    function listTsFiles(dir: string): string[] {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const files: string[] = [];
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...listTsFiles(full));
        } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
          files.push(full);
        }
      }
      return files;
    }

    let scannedCount = 0;
    for (const root of scanRoots) {
      for (const file of listTsFiles(root)) {
        scannedCount += 1;
        const text = fs.readFileSync(file, 'utf8');
        let match: RegExpExecArray | null;
        specifierPattern.lastIndex = 0;
        while ((match = specifierPattern.exec(text)) !== null) {
          const specifier = match[1] ?? match[2] ?? '';
          expect(forbiddenNamePattern.test(specifier), `${file} imports forbidden module ${specifier}`).toBe(false);
          expect(forbiddenSpecifiers.has(specifier), `${file} imports forbidden module ${specifier}`).toBe(false);
        }
      }
    }
    expect(scannedCount).toBeGreaterThanOrEqual(30);
  }, 60000);
});
