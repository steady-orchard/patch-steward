import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { TarStreamParser, type TarEntryKind } from '../archive/tar-read.js';
import { buildTarArchive } from '../archive/tar.js';

export type FixtureManifestEntry =
  | { readonly path: string; readonly mode: '100644' | '100755'; readonly content?: string; readonly base64?: string }
  | { readonly path: string; readonly symlink: string }
  | { readonly path: string; readonly gitlink: string };

export interface FixtureManifest {
  readonly description: string;
  readonly commit: { readonly message: string; readonly time: number };
  readonly entries: readonly FixtureManifestEntry[];
}

export interface FixtureRepository {
  readonly dir: string;
  readonly commit: string;
  readonly tree: string;
  readonly env: Readonly<Record<string, string>>;
  dispose(): void;
}

export interface ArchiveEntry {
  readonly path: string;
  readonly kind: TarEntryKind;
  readonly mode: number;
  readonly linkTarget: string | null;
  readonly content: Buffer | null;
}

export function loadFixtureManifest(fileName: string): FixtureManifest {
  const file = fileURLToPath(new URL('../../../../fixtures/repositories/' + fileName, import.meta.url));
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<FixtureManifest>;
  if (parsed.description === undefined || parsed.commit === undefined || parsed.entries === undefined) {
    throw new Error(`fixture manifest ${fileName} is missing description, commit, or entries`);
  }
  return parsed as FixtureManifest;
}

export function fixtureGitEnv(globalConfigPath: string, time: number): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && !key.toUpperCase().startsWith('GIT_')) env[key] = value;
  }
  return {
    ...env,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: globalConfigPath,
    GIT_AUTHOR_NAME: 'Fixture',
    GIT_COMMITTER_NAME: 'Fixture',
    GIT_AUTHOR_EMAIL: 'fixture@example.com',
    GIT_COMMITTER_EMAIL: 'fixture@example.com',
    GIT_AUTHOR_DATE: `${time} +0000`,
    GIT_COMMITTER_DATE: `${time} +0000`,
  };
}

interface TreeNode {
  readonly files: Map<string, { mode: string; type: string; id: string }>;
  readonly dirs: Map<string, TreeNode>;
}

function newNode(): TreeNode {
  return { files: new Map(), dirs: new Map() };
}

export function createFixtureRepository(manifest: FixtureManifest): FixtureRepository {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-steward-fixture-repo-'));
  try {
    const config = path.join(root, 'gitconfig');
    const hooks = path.join(root, 'hooks');
    fs.writeFileSync(config, '');
    fs.mkdirSync(hooks);
    const dir = path.join(root, 'source.git');
    const env = fixtureGitEnv(config, manifest.commit.time);
    const git = (args: readonly string[], input?: string | Buffer, cwd: string = dir): string =>
      execFileSync('git', ['-c', 'core.hooksPath=' + hooks, ...args], { cwd, env, input, encoding: 'utf8' }).trim();
    git(['init', '--bare', '-q', dir], undefined, root);

    const blob = (data: Buffer): string => git(['hash-object', '-w', '--no-filters', '--stdin'], data);
    const top = newNode();
    for (const entry of manifest.entries) {
      const parts = entry.path.split('/');
      const name = parts.pop() as string;
      let node = top;
      for (const part of parts) {
        let next = node.dirs.get(part);
        if (next === undefined) {
          next = newNode();
          node.dirs.set(part, next);
        }
        node = next;
      }
      if ('symlink' in entry) {
        node.files.set(name, { mode: '120000', type: 'blob', id: blob(Buffer.from(entry.symlink)) });
      } else if ('gitlink' in entry) {
        node.files.set(name, { mode: '160000', type: 'commit', id: entry.gitlink });
      } else {
        const data = entry.base64 !== undefined ? Buffer.from(entry.base64, 'base64') : Buffer.from(entry.content ?? '', 'utf8');
        node.files.set(name, { mode: entry.mode, type: 'blob', id: blob(data) });
      }
    }

    const writeTree = (node: TreeNode): string => {
      let input = '';
      for (const [name, file] of node.files) input += `${file.mode} ${file.type} ${file.id}\t${name}\0`;
      for (const [name, child] of node.dirs) input += `040000 tree ${writeTree(child)}\t${name}\0`;
      return git(['mktree', '-z'], input);
    };
    const tree = writeTree(top);
    const commit = git(['commit-tree', tree, '-m', manifest.commit.message]);
    return { dir, commit, tree, env, dispose: () => fs.rmSync(root, { recursive: true, force: true }) };
  } catch (error) {
    fs.rmSync(root, { recursive: true, force: true });
    throw error;
  }
}

export function commitRawEntries(
  repo: FixtureRepository,
  entries: readonly { readonly name: Uint8Array; readonly content: Uint8Array }[],
  wrapDirectory?: Uint8Array,
): string {
  const run = (args: readonly string[], input?: Buffer): string =>
    execFileSync('git', args, { cwd: repo.dir, env: repo.env, input, encoding: 'utf8' }).trim();
  const records: Buffer[] = [];
  for (const entry of entries) {
    const id = run(['hash-object', '-w', '--no-filters', '--stdin'], Buffer.from(entry.content));
    records.push(Buffer.from(`100644 blob ${id}\t`), Buffer.from(entry.name), Buffer.from([0]));
  }
  let tree = run(['mktree', '-z'], Buffer.concat(records));
  if (wrapDirectory !== undefined) {
    tree = run(
      ['mktree', '-z'],
      Buffer.concat([Buffer.from(`040000 tree ${tree}\t`), Buffer.from(wrapDirectory), Buffer.from([0])]),
    );
  }
  return run(['commit-tree', tree, '-m', 'raw entries']);
}

export function readArchiveEntries(archivePath: string): ArchiveEntry[] {
  const parser = new TarStreamParser();
  const result = parser.push(fs.readFileSync(archivePath));
  if (!result.ok) throw new Error('tar parse failed: ' + result.failure.code);
  const entries: { path: string; kind: TarEntryKind; mode: number; linkTarget: string | null; chunks: Buffer[] }[] = [];
  for (const event of result.value) {
    if (event.kind === 'entry') {
      const { path: entryPath, kind, mode, linkTarget } = event.entry;
      entries.push({ path: entryPath, kind, mode, linkTarget, chunks: [] });
    } else if (event.kind === 'data') {
      entries[entries.length - 1]?.chunks.push(Buffer.from(event.bytes));
    }
  }
  if (!parser.finish().ok) throw new Error('tar archive is truncated');
  return entries.map(({ chunks, ...rest }) => ({ ...rest, content: rest.kind === 'file' ? Buffer.concat(chunks) : null }));
}

describe('fixture repository helper', { timeout: 60000 }, () => {
  it('builds a repository from a manifest', () => {
    const repo = createFixtureRepository(loadFixtureManifest('hostile-materialization.json'));
    const root = path.dirname(repo.dir);
    try {
      const git = (...args: string[]): Buffer => execFileSync('git', args, { cwd: repo.dir, env: repo.env });
      expect(git('cat-file', '-t', repo.commit).toString().trim()).toBe('commit');
      const records = git('ls-tree', '-r', '-z', '--full-tree', repo.commit).toString().split('\0').filter(Boolean);
      expect(records).toHaveLength(9);
      expect(records.some((r) => r.startsWith('160000 commit 1111111111111111111111111111111111111111'))).toBe(true);
      expect(git('cat-file', 'blob', `${repo.commit}:README.md`).equals(Buffer.from('line one\r\nline two\r\n'))).toBe(true);
    } finally {
      repo.dispose();
    }
    expect(fs.existsSync(root)).toBe(false);
  });

  it('commits raw tree entry names', () => {
    const repo = createFixtureRepository(loadFixtureManifest('hostile-materialization.json'));
    try {
      const ls = (commit: string): Buffer =>
        execFileSync('git', ['ls-tree', '-z', '--full-tree', commit], { cwd: repo.dir, env: repo.env });
      const raw = commitRawEntries(repo, [{ name: Uint8Array.from([0x61, 0x01, 0x62]), content: Buffer.from('x') }]);
      expect(ls(raw).includes(Buffer.from([0x61, 0x01, 0x62]))).toBe(true);
      const wrapped = commitRawEntries(repo, [{ name: Buffer.from('config'), content: Buffer.from('x') }], Buffer.from('.GIT'));
      expect(ls(wrapped).includes(Buffer.from('040000 tree '))).toBe(true);
      expect(ls(wrapped).includes(Buffer.from('\t.GIT\0'))).toBe(true);
    } finally {
      repo.dispose();
    }
  });

  it('reads archive entries', () => {
    const archive = buildTarArchive([
      { path: 'checkout', type: 'directory', mode: 0o755, mtime: 0 },
      { path: 'checkout/a.txt', type: 'file', mode: 0o644, mtime: 0, content: Buffer.from('hi') },
      { path: 'checkout/l', type: 'symlink', mode: 0o777, mtime: 0, linkTarget: '../x' },
    ]);
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-steward-fixture-tar-'));
    try {
      const file = path.join(root, 'a.tar');
      fs.writeFileSync(file, archive);
      const entries = readArchiveEntries(file);
      expect(entries.map((e) => [e.path, e.kind])).toEqual([
        ['checkout', 'directory'],
        ['checkout/a.txt', 'file'],
        ['checkout/l', 'symlink'],
      ]);
      expect(entries[1]?.content?.toString()).toBe('hi');
      expect(entries[2]?.linkTarget).toBe('../x');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
