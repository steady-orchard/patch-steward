import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { GitReadOptions } from './reader.js';
import { findTreeEntry, listTree, readBlob, readPolicyTreeId, resolveCommit } from './reader.js';

const POLICY_TREE_ID = 'e6c67378215c2580909acbf6dacf0ca3eca28891';

interface PureEntry {
  readonly name: string;
  readonly mode: '100644' | '100755' | '120000' | '040000';
  readonly idHex: string;
  readonly isTree: boolean;
}

function hashObjectId(type: string, body: Buffer): string {
  const header = Buffer.from(`${type} ${body.length}\0`);
  return createHash('sha1')
    .update(Buffer.concat([header, body]))
    .digest('hex');
}

function pureBlobId(bytes: Buffer): string {
  return hashObjectId('blob', bytes);
}

function sortEntries(entries: readonly PureEntry[]): PureEntry[] {
  return [...entries].sort((a, b) =>
    Buffer.compare(Buffer.from(a.name + (a.isTree ? '/' : '')), Buffer.from(b.name + (b.isTree ? '/' : ''))),
  );
}

function pureTreeId(entries: readonly PureEntry[]): string {
  const sorted = sortEntries(entries);
  const parts = sorted.map((entry) => {
    const mode = entry.isTree ? '40000' : entry.mode;
    return Buffer.concat([Buffer.from(`${mode} ${entry.name}\0`), Buffer.from(entry.idHex, 'hex')]);
  });
  return hashObjectId('tree', Buffer.concat(parts));
}

let repoDir: string;
let configDir: string;
let globalConfigPath: string;

function fixtureEnv(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined) {
      continue;
    }
    if (key.toUpperCase().startsWith('GIT_')) {
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

function commit(tree: string, parent?: string): string {
  const args = ['commit-tree', tree, ...(parent ? ['-p', parent] : []), '-m', 'fixture'];
  return git(args);
}

function makeTree(entries: readonly PureEntry[]): { readonly id: string; readonly pure: string } {
  const sorted = sortEntries(entries);
  const lines = sorted.map(
    (entry) => `${entry.isTree ? '040000' : entry.mode} ${entry.isTree ? 'tree' : 'blob'} ${entry.idHex}\t${entry.name}\n`,
  );
  return { id: mktree(lines), pure: pureTreeId(entries) };
}

const P = Buffer.from('version: 1\n', 'utf8');
const D = Buffer.from('FROM scratch\n', 'utf8');
const R = Buffer.from('one\n', 'utf8');

let opts: GitReadOptions;
let blobP: string;
let blobD: string;
let blobR: string;
let runnerTree: { readonly id: string; readonly pure: string };
let policyTree: { readonly id: string; readonly pure: string };
let siblingTree: { readonly id: string; readonly pure: string };
let githubTree: { readonly id: string; readonly pure: string };
let commit1: string;

function commitPolicyVariant(entries: readonly PureEntry[]): {
  readonly commitId: string;
  readonly policyId: string;
  readonly policyPure: string;
} {
  const policyVariant = makeTree(entries);
  const githubVariant = makeTree([
    { name: 'patch-steward', mode: '040000', idHex: policyVariant.id, isTree: true },
    { name: 'patch-steward-other', mode: '040000', idHex: siblingTree.id, isTree: true },
  ]);
  const rootVariant = makeTree([
    { name: '.github', mode: '040000', idHex: githubVariant.id, isTree: true },
    { name: 'README.md', mode: '100644', idHex: blobR, isTree: false },
  ]);
  const commitId = commit(rootVariant.id, commit1);
  return { commitId, policyId: policyVariant.id, policyPure: policyVariant.pure };
}

describe('policy tree identity', { timeout: 60000 }, () => {
  beforeAll(() => {
    repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-tree-id-'));
    configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-tree-id-cfg-'));
    globalConfigPath = path.join(configDir, 'gitconfig');
    fs.writeFileSync(globalConfigPath, '');

    git(['-c', 'init.defaultBranch=main', 'init', '-q']);

    blobP = blob(P);
    blobD = blob(D);
    blobR = blob(R);
    const blobX = blob(Buffer.from('outside\n', 'utf8'));

    runnerTree = makeTree([{ name: 'Dockerfile', mode: '100644', idHex: blobD, isTree: false }]);
    policyTree = makeTree([
      { name: 'policy.yml', mode: '100644', idHex: blobP, isTree: false },
      { name: 'runner', mode: '040000', idHex: runnerTree.id, isTree: true },
    ]);
    siblingTree = makeTree([{ name: 'x.txt', mode: '100644', idHex: blobX, isTree: false }]);
    githubTree = makeTree([
      { name: 'patch-steward', mode: '040000', idHex: policyTree.id, isTree: true },
      { name: 'patch-steward-other', mode: '040000', idHex: siblingTree.id, isTree: true },
    ]);
    const rootTree = makeTree([
      { name: '.github', mode: '040000', idHex: githubTree.id, isTree: true },
      { name: 'README.md', mode: '100644', idHex: blobR, isTree: false },
    ]);

    commit1 = commit(rootTree.id);
    git(['update-ref', 'HEAD', commit1]);
    git(['reset', '--hard']);

    opts = { repoDir, timeoutMs: 30000, maxOutputBytes: 1048576 };
  }, 60000);

  afterAll(() => {
    fs.rmSync(repoDir, { recursive: true, force: true, maxRetries: 3 });
    fs.rmSync(configDir, { recursive: true, force: true, maxRetries: 3 });
  });

  test('tree id equals the hard-coded constant', async () => {
    const headResult = await resolveCommit(opts, 'HEAD');
    expect(headResult.ok).toBe(true);
    expect(headResult.ok && headResult.value).toBe(commit1);

    const treeResult = await readPolicyTreeId(opts, commit1);
    expect(treeResult.ok).toBe(true);
    expect(treeResult.ok && treeResult.value).toBe(POLICY_TREE_ID);

    const rp = git(['rev-parse', 'HEAD:.github/patch-steward']);
    expect(rp).toBe(POLICY_TREE_ID);
  });

  test('hard-coded constant equals the pure TypeScript tree hash', () => {
    expect(policyTree.pure).toBe(POLICY_TREE_ID);
    expect(policyTree.id).toBe(POLICY_TREE_ID);
    expect(pureBlobId(P)).toBe(blobP);
  });

  test('commit outside the directory keeps the tree id', async () => {
    const blobR2 = blob(Buffer.from('two\n', 'utf8'));
    const rootTree2 = makeTree([
      { name: '.github', mode: '040000', idHex: githubTree.id, isTree: true },
      { name: 'README.md', mode: '100644', idHex: blobR2, isTree: false },
    ]);
    const commit2 = commit(rootTree2.id, commit1);
    expect(commit2).not.toBe(commit1);

    const treeResult = await readPolicyTreeId(opts, commit2);
    expect(treeResult.ok).toBe(true);
    expect(treeResult.ok && treeResult.value).toBe(POLICY_TREE_ID);
  });

  test('byte, file, and mode changes inside the directory change the tree id', async () => {
    const blobP2 = blob(Buffer.from('version: 2\n', 'utf8'));
    const blobPCrlf = blob(Buffer.from('version: 1\r\n', 'utf8'));
    const blobExtra = blob(Buffer.from('x: 1\n', 'utf8'));
    const blobD2 = blob(Buffer.from('FROM busybox\n', 'utf8'));
    const runnerTree2 = makeTree([{ name: 'Dockerfile', mode: '100644', idHex: blobD2, isTree: false }]);

    const variants = [
      commitPolicyVariant([
        { name: 'policy.yml', mode: '100644', idHex: blobP2, isTree: false },
        { name: 'runner', mode: '040000', idHex: runnerTree.id, isTree: true },
      ]),
      commitPolicyVariant([
        { name: 'policy.yml', mode: '100644', idHex: blobPCrlf, isTree: false },
        { name: 'runner', mode: '040000', idHex: runnerTree.id, isTree: true },
      ]),
      commitPolicyVariant([
        { name: 'policy.yml', mode: '100644', idHex: blobP, isTree: false },
        { name: 'extra.yml', mode: '100644', idHex: blobExtra, isTree: false },
        { name: 'runner', mode: '040000', idHex: runnerTree.id, isTree: true },
      ]),
      commitPolicyVariant([{ name: 'policy.yml', mode: '100644', idHex: blobP, isTree: false }]),
      commitPolicyVariant([
        { name: 'policy.yml', mode: '100755', idHex: blobP, isTree: false },
        { name: 'runner', mode: '040000', idHex: runnerTree.id, isTree: true },
      ]),
      commitPolicyVariant([
        { name: 'policy.yml', mode: '100644', idHex: blobP, isTree: false },
        { name: 'runner', mode: '040000', idHex: runnerTree2.id, isTree: true },
      ]),
    ];

    for (const variant of variants) {
      const result = await readPolicyTreeId(opts, variant.commitId);
      expect(result.ok).toBe(true);
      expect(result.ok && result.value).toBe(variant.policyId);
      expect(result.ok && result.value).toBe(variant.policyPure);
      expect(variant.policyId).not.toBe(POLICY_TREE_ID);
    }

    const ids = variants.map((variant) => variant.policyId);
    expect(new Set(ids).size).toBe(6);
  });

  test('working-tree edit does not change the tree id or blob bytes', async () => {
    fs.mkdirSync(path.join(repoDir, '.github', 'patch-steward'), { recursive: true });
    fs.writeFileSync(path.join(repoDir, '.github', 'patch-steward', 'policy.yml'), 'version: 99\n');
    git(['add', '.github/patch-steward/policy.yml']);

    const headResult = await resolveCommit(opts, 'HEAD');
    expect(headResult.ok).toBe(true);
    expect(headResult.ok && headResult.value).toBe(commit1);

    const treeResult = await readPolicyTreeId(opts, commit1);
    expect(treeResult.ok).toBe(true);
    expect(treeResult.ok && treeResult.value).toBe(POLICY_TREE_ID);

    const entriesResult = await listTree(opts, POLICY_TREE_ID);
    expect(entriesResult.ok).toBe(true);
    if (!entriesResult.ok) {
      return;
    }
    const summary = entriesResult.value.map((entry) => ({
      path: entry.path,
      mode: entry.mode,
      type: entry.type,
      size: entry.size,
    }));
    expect(summary).toEqual([
      { path: 'policy.yml', mode: '100644', type: 'blob', size: 11 },
      { path: 'runner/Dockerfile', mode: '100644', type: 'blob', size: 13 },
    ]);

    const found = findTreeEntry(entriesResult.value, 'policy.yml');
    expect(found.ok).toBe(true);
    if (!found.ok) {
      return;
    }
    const blobResult = await readBlob(opts, found.value, 1024);
    expect(blobResult.ok).toBe(true);
    expect(blobResult.ok && blobResult.value.equals(P)).toBe(true);
  });

  test('a commit with only README.md reports the policy directory missing', async () => {
    const rootOnlyReadme = makeTree([{ name: 'README.md', mode: '100644', idHex: blobR, isTree: false }]);
    const commit3 = commit(rootOnlyReadme.id, commit1);

    const result = await readPolicyTreeId(opts, commit3);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.failure.code).toBe('git.policy-directory-missing');
  });

  test('an unresolvable ref fails ref resolution', async () => {
    const result = await resolveCommit(opts, 'refs/heads/does-not-exist');
    expect(result.ok).toBe(false);
    expect(!result.ok && result.failure.code).toBe('git.ref-unresolvable');
  });

  test('a symlinked policy.yml is not a regular file', async () => {
    const blobLink = blob(Buffer.from('elsewhere.yml', 'utf8'));
    const symTree = makeTree([{ name: 'policy.yml', mode: '120000', idHex: blobLink, isTree: false }]);

    const listResult = await listTree(opts, symTree.id);
    expect(listResult.ok).toBe(true);
    if (!listResult.ok) {
      return;
    }
    const found = findTreeEntry(listResult.value, 'policy.yml');
    expect(found.ok).toBe(true);
    if (!found.ok) {
      return;
    }
    const blobResult = await readBlob(opts, found.value, 1024);
    expect(blobResult.ok).toBe(false);
    expect(!blobResult.ok && blobResult.failure.code).toBe('git.entry-not-regular');
  });

  test('a blob larger than the cap fails as too large', async () => {
    const bigBytes = Buffer.alloc(2048, 'a');
    const blobBig = blob(bigBytes);
    const bigTree = makeTree([{ name: 'policy.yml', mode: '100644', idHex: blobBig, isTree: false }]);

    const listResult = await listTree(opts, bigTree.id);
    expect(listResult.ok).toBe(true);
    if (!listResult.ok) {
      return;
    }
    const found = findTreeEntry(listResult.value, 'policy.yml');
    expect(found.ok).toBe(true);
    if (!found.ok) {
      return;
    }
    const blobResult = await readBlob(opts, found.value, 1024);
    expect(blobResult.ok).toBe(false);
    expect(!blobResult.ok && blobResult.failure.code).toBe('git.blob-too-large');
  });
});
