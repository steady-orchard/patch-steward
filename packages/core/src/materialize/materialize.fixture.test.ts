import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { gitBlobId } from '../evidence/blob-id.js';
import type { Result } from '../result.js';
import { DEFAULT_CHECKLIST_POLICY } from '../submission/default-checklist.js';
import {
  commitRawEntries,
  createFixtureRepository,
  loadFixtureManifest,
  readArchiveEntries,
  type FixtureRepository,
} from './fixture-repository.fixture.test.js';
import { materializeCommit, materializeLimitsFromPolicy, type MaterializedCheckout } from './materialize.js';
import type { OverlayEntry } from './paths.js';

const LF = '\n';
const CR = '\r';
const limits = materializeLimitsFromPolicy(DEFAULT_CHECKLIST_POLICY);
const P = (x: string): string => x.split(path.sep).join('/');
const code = (result: Result<unknown, string>): string | null => (result.ok ? null : result.failure.code);
const remove = (target: string): void => fs.rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });

function leftovers(): string[] {
  return fs
    .readdirSync(os.tmpdir())
    .filter((name) => name.startsWith('patch-steward-materialize-') || name.startsWith('patch-steward-fetch-'));
}

describe('materialization', { timeout: 120000 }, () => {
  let root = '';
  let markers = '';
  let hostile: Record<string, string> = {};
  let plain: Record<string, string> = {};
  let decoy: FixtureRepository | undefined;
  let repo: FixtureRepository | undefined;
  const opened: MaterializedCheckout[] = [];

  // A private temp root keeps leftovers() from racing with concurrently running test files.
  const TEMP_VARS = ['TMPDIR', 'TMP', 'TEMP'] as const;
  const savedTemp: Record<string, string | undefined> = {};
  let privateTemp = '';

  beforeAll(() => {
    for (const key of TEMP_VARS) savedTemp[key] = process.env[key];
    privateTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-steward-mtest-'));
    for (const key of TEMP_VARS) process.env[key] = privateTemp;
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-steward-hostile-host-'));
    markers = path.join(root, 'markers');
    const hooks = path.join(root, 'hooks');
    const templates = path.join(root, 'templates');
    const home = path.join(root, 'home');
    fs.mkdirSync(markers);
    fs.mkdirSync(hooks);
    fs.mkdirSync(path.join(templates, 'hooks'), { recursive: true });
    fs.mkdirSync(path.join(home, '.config', 'git'), { recursive: true });
    const hookScript = (name: string): string => '#!/bin/sh' + LF + "echo hit >> '" + P(markers) + '/' + name + "'" + LF;
    const names = [
      'reference-transaction',
      'post-checkout',
      'post-merge',
      'pre-auto-gc',
      'post-index-change',
      'fsmonitor-watchman',
      'pre-receive',
      'post-update',
      'push-to-checkout',
      'post-rewrite',
    ];
    for (const dir of [hooks, path.join(templates, 'hooks')]) {
      for (const name of names) {
        fs.writeFileSync(path.join(dir, name), hookScript(name));
        fs.chmodSync(path.join(dir, name), 0o755);
      }
    }
    const askpass = path.join(root, 'askpass.sh');
    fs.writeFileSync(askpass, hookScript('askpass'));
    fs.chmodSync(askpass, 0o755);
    decoy = createFixtureRepository({
      description: 'decoy',
      commit: { message: 'decoy', time: 1700000000 },
      entries: [{ path: 'decoy.txt', mode: '100644', content: 'decoy' + LF }],
    });
    repo = createFixtureRepository(loadFixtureManifest('hostile-materialization.json'));
    const hit = (name: string): string => "echo hit >> '" + P(markers) + '/' + name + "'";
    const config = [
      '[core]',
      '\thooksPath = ' + P(hooks),
      '\tfsmonitor = ' + hit('fsmonitor'),
      '\taskPass = ' + P(askpass),
      '\tsshCommand = ' + hit('ssh'),
      '[init]',
      '\ttemplateDir = ' + P(templates),
      '[filter "hostile"]',
      '\tclean = ' + hit('filter-clean'),
      '\tsmudge = ' + hit('filter-smudge'),
      '\tprocess = ' + hit('filter-process'),
      '[url "' + P(decoy.dir) + '"]',
      '\tinsteadOf = ' + repo.dir,
      '[uploadpack]',
      '\tpackObjectsHook = ' + hit('pack-objects-hook'),
      '[credential]',
      '\thelper = !' + hit('credential'),
      '[protocol]',
      '\tallow = always',
      '[submodule]',
      '\trecurse = true',
      '[submodule "vendor/evil"]',
      '\tupdate = !' + hit('submodule-update'),
      '[fetch]',
      '\trecurseSubmodules = true',
      '',
    ].join(LF);
    const configPath = path.join(root, 'hostile.gitconfig');
    fs.writeFileSync(configPath, config);
    fs.writeFileSync(path.join(home, '.gitconfig'), config);
    fs.writeFileSync(path.join(home, '.config', 'git', 'config'), config);
    plain = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined && !key.toUpperCase().startsWith('GIT_')) plain[key] = value;
    }
    hostile = {
      ...plain,
      HOME: home,
      USERPROFILE: home,
      XDG_CONFIG_HOME: path.join(home, '.config'),
      GIT_CONFIG_GLOBAL: configPath,
      GIT_CONFIG_SYSTEM: configPath,
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'core.hooksPath',
      GIT_CONFIG_VALUE_0: P(hooks),
      GIT_CONFIG_PARAMETERS: "'core.hooksPath'='" + P(hooks) + "'",
      GIT_TEMPLATE_DIR: P(templates),
      GIT_ASKPASS: P(askpass),
      SSH_ASKPASS: P(askpass),
    };
  });

  afterEach(async () => {
    for (const item of opened.splice(0)) await item.dispose();
  });

  afterAll(() => {
    repo?.dispose();
    decoy?.dispose();
    if (root !== '') remove(root);
    for (const key of TEMP_VARS) {
      const value = savedTemp[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    if (privateTemp !== '') remove(privateTemp);
  });

  function source(): FixtureRepository {
    if (repo === undefined) throw new Error('fixture repository missing');
    return repo;
  }

  async function run(
    overlay: readonly OverlayEntry[],
    env: Record<string, string> = hostile,
    commit: string = source().commit,
  ): Promise<Result<MaterializedCheckout, string>> {
    const result = await materializeCommit({
      source: { kind: 'local-path', path: source().dir },
      commit,
      token: null,
      overlay,
      limits,
      hostEnv: env,
    });
    if (result.ok) opened.push(result.value);
    return result;
  }

  it('exit E1: host git configuration never runs', async () => {
    const result = await run([]);
    expect(code(result)).toBeNull();
    if (!result.ok) return;
    expect(fs.readdirSync(markers)).toEqual([]);
    const entries = readArchiveEntries(result.value.archivePath);
    expect(entries.some((e) => e.path === 'checkout/README.md')).toBe(true);
    expect(entries.some((e) => e.path === 'checkout/decoy.txt')).toBe(false);
    expect(result.value.checkout.commit).toBe(source().commit);
    expect(result.value.checkout.tree).toBe(source().tree);
  });

  it('exit E1: attributes and submodules never apply', async () => {
    const result = await run([]);
    expect(code(result)).toBeNull();
    if (!result.ok) return;
    const entries = readArchiveEntries(result.value.archivePath);
    const find = (p: string) => entries.find((e) => e.path === p);
    expect(find('checkout/README.md')?.content?.toString('utf8')).toBe('line one' + CR + LF + 'line two' + CR + LF);
    expect(find('checkout/bin/tool.sh')?.mode).toBe(0o755);
    expect(find('checkout/bin/tool.sh')?.content?.toString('utf8')).toContain('$Format:%H$');
    const manifest = loadFixtureManifest('hostile-materialization.json');
    for (const name of ['.gitattributes', '.gitmodules']) {
      const expected = manifest.entries.find((e) => e.path === name);
      const content = expected !== undefined && 'content' in expected ? expected.content : undefined;
      expect(content).toBeDefined();
      expect(find('checkout/' + name)?.kind).toBe('file');
      expect(find('checkout/' + name)?.content?.toString('utf8')).toBe(content);
    }
    const lfs = find('checkout/data/lfs-object.bin')?.content?.toString('utf8') ?? '';
    expect(lfs.startsWith('version https://git-lfs.github.com/spec/v1')).toBe(true);
    expect(find('checkout/escape')?.kind).toBe('symlink');
    expect(find('checkout/escape')?.linkTarget).toBe('../../../../etc/passwd');
    expect(find('checkout/absolute')?.kind).toBe('symlink');
    expect(find('checkout/absolute')?.linkTarget).toBe('/etc/shadow');
    expect(entries.some((e) => e.path.startsWith('checkout/vendor/evil'))).toBe(false);
    expect(result.value.checkout.skipped_submodules).toEqual(['vendor/evil']);
    expect(fs.readdirSync(markers)).toEqual([]);
  });

  it('exit E1: hostile tree names never materialize', async () => {
    const raw = (bytes: number[]) => [{ name: Uint8Array.from(bytes), content: Buffer.from('x') }];
    const text = (name: string) => [{ name: Buffer.from(name), content: Buffer.from('x') }];
    const gitmodules = '[submodule "x"]' + LF + '\tpath = x' + LF + '\turl = ../x' + LF + '\tupdate = !echo hit' + LF;
    const r = source();
    const cases: { commit: string; expected: string }[] = [
      { commit: commitRawEntries(r, text('..')), expected: 'materialize.fetch-failed' },
      { commit: commitRawEntries(r, text('config'), Buffer.from('.GIT')), expected: 'materialize.fetch-failed' },
      { commit: commitRawEntries(r, text('git~1')), expected: 'materialize.fetch-failed' },
      { commit: commitRawEntries(r, text('.git.')), expected: 'materialize.fetch-failed' },
      { commit: commitRawEntries(r, text('.' + String.fromCharCode(0x200c) + 'git')), expected: 'materialize.fetch-failed' },
      {
        commit: commitRawEntries(r, [{ name: Buffer.from('.gitmodules'), content: Buffer.from(gitmodules) }]),
        expected: 'materialize.fetch-failed',
      },
      { commit: commitRawEntries(r, raw([0x61, 92, 0x62])), expected: 'materialize.path-invalid' },
      { commit: commitRawEntries(r, raw([0x61, 0x01, 0x62])), expected: 'materialize.path-invalid' },
      { commit: commitRawEntries(r, raw([0x61, 0xff, 0x62])), expected: 'materialize.path-invalid' },
    ];
    for (const item of cases) {
      expect(code(await run([], hostile, item.commit))).toBe(item.expected);
    }
    expect(fs.readdirSync(markers)).toEqual([]);
    expect(leftovers()).toEqual([]);
  });

  it('exit E1: traversal overlays are rejected', async () => {
    const paths = [
      '../outside.txt',
      'nested/../../outside.txt',
      '/etc/passwd',
      '..' + String.fromCharCode(92) + 'outside.txt',
      '.git/hooks/post-checkout',
      '.GIT/config',
      'nested/.git/config',
    ];
    for (const overlayPath of paths) {
      const result = await run([{ path: overlayPath, content: Buffer.from('x'), mode: '100644' }]);
      expect(code(result)).toBe('materialize.overlay-rejected');
      if (!result.ok) expect(result.failure.details[0]?.path).toBe(overlayPath);
    }
  });

  it('exit E1: symlink-escaping overlays are rejected', async () => {
    const content = Buffer.from('x');
    const overlays: OverlayEntry[] = [
      { path: 'escape/passwd', content, mode: '100644' },
      { path: 'escape', content, mode: '100644' },
      { path: 'absolute', delete: true },
      { path: 'vendor/evil/x', content, mode: '100644' },
      { path: 'vendor/evil', content, mode: '100644' },
    ];
    for (const entry of overlays) {
      const result = await run([entry]);
      expect(code(result)).toBe('materialize.overlay-rejected');
      if (!result.ok) expect(result.failure.details[0]?.path).toBe(entry.path);
    }
  });

  it('applies valid overlays inside the checkout', async () => {
    const result = await run(
      [
        { path: 'README.md', content: Buffer.from('replaced' + LF), mode: '100644' },
        { path: 'nested/new.txt', content: Buffer.from('new' + LF), mode: '100755' },
        { path: 'bin/tool.sh', delete: true },
      ],
      plain,
    );
    expect(code(result)).toBeNull();
    if (!result.ok) return;
    const entries = readArchiveEntries(result.value.archivePath);
    const find = (p: string) => entries.find((e) => e.path === p);
    expect(find('checkout/README.md')?.content?.toString('utf8')).toBe('replaced' + LF);
    expect(find('checkout/nested/new.txt')?.mode).toBe(0o755);
    expect(find('checkout/bin/tool.sh')).toBeUndefined();
    expect(find('checkout/bin')).toBeUndefined();
    expect(result.value.checkout.overlays).toEqual([
      { path: 'README.md', blob: gitBlobId(Buffer.from('replaced' + LF)) },
      { path: 'nested/new.txt', blob: gitBlobId(Buffer.from('new' + LF)) },
      { path: 'bin/tool.sh', blob: null },
    ]);
  });

  it('removes temporary files after materializing', async () => {
    const result = await run([], plain);
    expect(code(result)).toBeNull();
    if (!result.ok) return;
    expect(fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith('patch-steward-fetch-'))).toEqual([]);
    expect(fs.existsSync(result.value.archivePath)).toBe(true);
    await result.value.dispose();
    expect(fs.existsSync(result.value.archivePath)).toBe(false);
  });
});
