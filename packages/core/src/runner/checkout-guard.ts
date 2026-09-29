import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { decodeGitOutput, runGitCommand } from '../git/command.js';
import { GIT_OUTPUT_MAX_BYTES, GIT_TIMEOUT_MS } from '../policy/bounds.js';
import type { ProcessRunner } from '../process/run-process.js';
import { err, ok, type Result } from '../result.js';

export interface OwnCheckoutInput {
  readonly checkoutRoot: string;
  readonly processCwd: string;
  readonly previewWorktrees: readonly string[];
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly runner?: ProcessRunner;
  readonly gitBinary?: string;
}

export interface OwnCheckout {
  readonly root: string;
  readonly kind: 'checkout' | 'preview';
}

export type OwnCheckoutFailureCode = 'runner.not-own-checkout';

function refuse(subject: string, reason: string) {
  return err('runner.not-own-checkout', 'environment-unavailable', 'The directory is not the contributor checkout.', [
    { code: 'runner.not-own-checkout', path: subject, message: reason, line: null, column: null },
  ]);
}

async function realpathOrNull(target: string): Promise<string | null> {
  try {
    return await fs.promises.realpath(target);
  } catch {
    return null;
  }
}

async function gitLine(input: OwnCheckoutInput, cwd: string, args: readonly string[]): Promise<string | null> {
  const result = await runGitCommand(
    {
      repoDir: cwd,
      timeoutMs: GIT_TIMEOUT_MS,
      maxOutputBytes: GIT_OUTPUT_MAX_BYTES,
      ...(input.runner ? { runner: input.runner } : {}),
      ...(input.gitBinary ? { gitBinary: input.gitBinary } : {}),
    },
    args,
    GIT_OUTPUT_MAX_BYTES,
  );
  if (!result.ok || result.value.exitCode !== 0) return null;
  const decoded = decodeGitOutput(result.value.stdout);
  if (!decoded.ok) return null;
  return decoded.value.replace(/\n$/, '').replace(/\r$/, '');
}

async function commonDirectory(input: OwnCheckoutInput, cwd: string): Promise<string | null> {
  const line = await gitLine(input, cwd, ['rev-parse', '--git-common-dir']);
  if (line === null || line === '') return null;
  return realpathOrNull(path.resolve(cwd, line));
}

export async function guardOwnCheckout(input: OwnCheckoutInput): Promise<Result<OwnCheckout, OwnCheckoutFailureCode>> {
  if (input.env['GITHUB_ACTIONS'] === 'true') return refuse(input.checkoutRoot, 'github-actions');

  const top = await gitLine(input, input.processCwd, ['rev-parse', '--show-toplevel']);
  if (top === null || top === '') return refuse(input.checkoutRoot, 'not-a-work-tree');

  const realTop = await realpathOrNull(top);
  const realRoot = await realpathOrNull(input.checkoutRoot);
  if (realTop === null || realRoot === null) return refuse(input.checkoutRoot, 'path-unavailable');

  if (realRoot === realTop) return ok({ root: realRoot, kind: 'checkout' as const });

  const notRoot = refuse(input.checkoutRoot, 'not-the-checkout-root');
  const previews = await Promise.all(input.previewWorktrees.map(realpathOrNull));
  if (!previews.includes(realRoot)) return notRoot;

  const realTmp = await realpathOrNull(os.tmpdir());
  if (realTmp === null || !realRoot.startsWith(realTmp + path.sep)) return notRoot;

  const rootCommon = await commonDirectory(input, realRoot);
  const topCommon = await commonDirectory(input, realTop);
  if (rootCommon === null || rootCommon !== topCommon) return notRoot;

  return ok({ root: realRoot, kind: 'preview' as const });
}

export async function commandDirectory(root: string, workingDirectory: string): Promise<Result<string, OwnCheckoutFailureCode>> {
  if (workingDirectory === '.') return ok(root);
  const real = await realpathOrNull(path.join(root, workingDirectory));
  if (real === null) return refuse(workingDirectory, 'path-unavailable');
  if (real !== root && !real.startsWith(root + path.sep)) return refuse(workingDirectory, 'outside-checkout');
  return ok(real);
}
