import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  EVIDENCE_DIR_UNAVAILABLE_MESSAGE,
  EVIDENCE_INSIDE_CHECKOUT_MESSAGE,
  defaultEvidenceDir,
  findWorkTreeRoot,
  isPathInside,
  resolveEvidenceDir,
} from './evidence-dir.js';
import type { EvidenceDirEnvironment } from './evidence-dir.js';

let tmpDirs: string[] = [];

function makeTmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm5-evd-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpDirs) {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
  tmpDirs = [];
});

function env(platform: string, envVars: Record<string, string | undefined>, homedir: () => string): EvidenceDirEnvironment {
  return { platform, env: envVars, homedir };
}

describe('defaultEvidenceDir', () => {
  it('default evidence directory on win32 uses LOCALAPPDATA', () => {
    const result = defaultEvidenceDir(env('win32', { LOCALAPPDATA: 'C:\\Users\\me\\AppData\\Local' }, () => 'C:\\Users\\me'));
    expect(result).toEqual({ ok: true, path: 'C:\\Users\\me\\AppData\\Local\\patch-steward\\evidence' });
  });

  it('default evidence directory on win32 falls back to the home directory', () => {
    for (const vars of [{}, { LOCALAPPDATA: 'relative\\dir' }]) {
      const result = defaultEvidenceDir(env('win32', vars, () => 'C:\\Users\\me'));
      expect(result).toEqual({ ok: true, path: 'C:\\Users\\me\\AppData\\Local\\patch-steward\\evidence' });
    }
  });

  it('default evidence directory on darwin', () => {
    const result = defaultEvidenceDir(env('darwin', {}, () => '/Users/me'));
    expect(result).toEqual({ ok: true, path: '/Users/me/Library/Application Support/patch-steward/evidence' });
  });

  it('default evidence directory on linux uses XDG_DATA_HOME', () => {
    const result = defaultEvidenceDir(env('linux', { XDG_DATA_HOME: '/data' }, () => '/home/me'));
    expect(result).toEqual({ ok: true, path: '/data/patch-steward/evidence' });
  });

  it('default evidence directory on linux falls back to the home directory', () => {
    for (const [platform, vars] of [
      ['linux', {}],
      ['linux', { XDG_DATA_HOME: 'rel' }],
      ['freebsd', {}],
    ] as const) {
      const result = defaultEvidenceDir(env(platform, vars, () => '/home/me'));
      expect(result).toEqual({ ok: true, path: '/home/me/.local/share/patch-steward/evidence' });
    }
  });

  it('an unresolvable home directory fails with screen.evidence-dir-unavailable', () => {
    const cases: EvidenceDirEnvironment[] = [
      env('linux', {}, () => ''),
      env('linux', {}, () => {
        throw new Error('no home');
      }),
      env('win32', {}, () => 'relative'),
      env('darwin', {}, () => ''),
    ];
    for (const environment of cases) {
      expect(defaultEvidenceDir(environment)).toEqual({
        ok: false,
        code: 'screen.evidence-dir-unavailable',
        message: EVIDENCE_DIR_UNAVAILABLE_MESSAGE,
      });
    }
  });
});

describe('findWorkTreeRoot', () => {
  it('work tree root is the nearest directory with a .git entry', async () => {
    const tmp = makeTmpDir();
    const work = path.join(tmp, 'work');
    fs.mkdirSync(path.join(work, '.git'), { recursive: true });
    fs.mkdirSync(path.join(work, 'a', 'b'), { recursive: true });
    await expect(findWorkTreeRoot(path.join(work, 'a', 'b'))).resolves.toBe(path.resolve(work));

    const wt = path.join(tmp, 'wt');
    fs.mkdirSync(path.join(wt, 'sub'), { recursive: true });
    fs.writeFileSync(path.join(wt, '.git'), 'gitdir: x');
    await expect(findWorkTreeRoot(path.join(wt, 'sub'))).resolves.toBe(path.resolve(wt));

    await expect(findWorkTreeRoot(path.join(work, 'a'), async () => false)).resolves.toBeNull();
  });
});

describe('isPathInside', () => {
  it('path containment is decided by path.relative', () => {
    const tmp = makeTmpDir();
    expect(isPathInside(tmp, tmp)).toBe(true);
    expect(isPathInside(tmp, path.join(tmp, 'x', 'y'))).toBe(true);
    expect(isPathInside(tmp, path.join(tmp, '..x'))).toBe(true);
    expect(isPathInside(tmp, path.join(tmp, '..', 'other'))).toBe(false);
    expect(isPathInside(path.join(tmp, 'a'), path.join(tmp, 'ab'))).toBe(false);
  });
});

describe('resolveEvidenceDir', () => {
  it('an evidence directory inside the checkout warns', async () => {
    const tmp = makeTmpDir();
    const work = path.join(tmp, 'work');
    fs.mkdirSync(path.join(work, '.git'), { recursive: true });
    fs.mkdirSync(path.join(work, 'a'), { recursive: true });
    const environment = env('linux', {}, () => '/home/me');

    const result = await resolveEvidenceDir({ given: 'evidence', cwd: path.join(work, 'a'), environment });
    expect(result).toEqual({
      ok: true,
      path: path.resolve(work, 'a', 'evidence'),
      warnings: [{ code: 'screen.evidence-inside-checkout', message: EVIDENCE_INSIDE_CHECKOUT_MESSAGE }],
    });
    expect(fs.existsSync(path.join(work, 'a', 'evidence'))).toBe(false);
  });

  it('an evidence directory outside the checkout does not warn', async () => {
    const tmp = makeTmpDir();
    const work = path.join(tmp, 'work');
    fs.mkdirSync(path.join(work, '.git'), { recursive: true });
    fs.mkdirSync(path.join(work, 'a'), { recursive: true });
    const environment = env('linux', {}, () => '/home/me');

    const result = await resolveEvidenceDir({ given: path.join(tmp, 'outside'), cwd: path.join(work, 'a'), environment });
    expect(result).toEqual({ ok: true, path: path.resolve(tmp, 'outside'), warnings: [] });
  });

  it('the default evidence directory is never checked against the checkout', async () => {
    const tmp = makeTmpDir();
    const work = path.join(tmp, 'work');
    fs.mkdirSync(path.join(work, '.git'), { recursive: true });
    fs.mkdirSync(path.join(work, 'a'), { recursive: true });
    const environment = env('linux', { XDG_DATA_HOME: '/data' }, () => '/home/me');

    const result = await resolveEvidenceDir({ given: null, cwd: path.join(work, 'a'), environment });
    expect(result).toEqual({ ok: true, path: '/data/patch-steward/evidence', warnings: [] });
  });
});
