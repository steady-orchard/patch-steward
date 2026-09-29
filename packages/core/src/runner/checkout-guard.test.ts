import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ProcessRunner } from '../process/run-process.js';
import { ok } from '../result.js';
import { guardOwnCheckout } from './checkout-guard.js';

interface Call {
  readonly args: readonly string[];
  readonly cwd: string;
}

function scripted(exitCode: number, stdout: string, calls: Call[]): ProcessRunner {
  return (_binary, args, options) => {
    calls.push({ args, cwd: options.cwd });
    return Promise.resolve(ok({ exitCode, stdout: Buffer.from(stdout), stderr: Buffer.alloc(0) }));
  };
}

describe('checkout guard', () => {
  const temps: string[] = [];
  const make = (): string => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-steward-guard-'));
    temps.push(dir);
    return dir;
  };
  let dir = '';

  beforeEach(() => {
    dir = make();
  });

  afterEach(() => {
    for (const t of temps.splice(0)) fs.rmSync(t, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it('refuses under GitHub Actions', async () => {
    const calls: Call[] = [];
    const result = await guardOwnCheckout({
      checkoutRoot: dir,
      processCwd: dir,
      previewWorktrees: [],
      env: { GITHUB_ACTIONS: 'true' },
      runner: scripted(0, dir + '\n', calls),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('runner.not-own-checkout');
    expect(result.failure.details[0]?.message).toBe('github-actions');
    expect(calls).toHaveLength(0);
  });

  it('refuses when git finds no work tree', async () => {
    const calls: Call[] = [];
    const result = await guardOwnCheckout({
      checkoutRoot: dir,
      processCwd: dir,
      previewWorktrees: [],
      env: {},
      runner: scripted(128, '', calls),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.details[0]?.message).toBe('not-a-work-tree');
    expect(calls[0]?.args).toEqual(['rev-parse', '--show-toplevel']);
    expect(calls[0]?.cwd).toBe(dir);
  });

  it('refuses a root other than the top level', async () => {
    const other = make();
    const result = await guardOwnCheckout({
      checkoutRoot: dir,
      processCwd: dir,
      previewWorktrees: [],
      env: {},
      runner: scripted(0, other + '\n', []),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.details[0]?.message).toBe('not-the-checkout-root');
  });
});
