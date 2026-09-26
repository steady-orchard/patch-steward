import * as fs from 'node:fs';
import type { Result } from '../result.js';
import { ok, err } from '../result.js';
import { runProcess } from '../process/run-process.js';
import type { GitReadOptions, GitFailureCode } from './reader.js';
import { inertGitEnv } from './reader.js';

export interface GitCommandOutput {
  readonly exitCode: number;
  readonly stdout: Buffer;
  readonly stderr: Buffer;
}

export async function runGitCommand(
  options: GitReadOptions,
  args: readonly string[],
  maxOutputBytes: number,
): Promise<Result<GitCommandOutput, GitFailureCode>> {
  try {
    const stat = await fs.promises.stat(options.repoDir);
    if (!stat.isDirectory()) {
      return err('git.not-a-repository', 'infrastructure', 'The configured repository directory does not exist.');
    }
  } catch {
    return err('git.not-a-repository', 'infrastructure', 'The configured repository directory does not exist.');
  }

  const runner = options.runner ?? runProcess;
  const binary = options.gitBinary ?? 'git';
  const result = await runner(binary, args, {
    cwd: options.repoDir,
    env: inertGitEnv(process.env),
    timeoutMs: options.timeoutMs,
    maxOutputBytes,
  });

  if (!result.ok) {
    switch (result.failure.code) {
      case 'process.unavailable':
        return err('git.unavailable', 'infrastructure', 'The git binary could not be executed.');
      case 'process.timeout':
        return err('git.timeout', 'infrastructure', 'The git process timed out.');
      case 'process.output-too-large':
        return err('git.output-too-large', 'infrastructure', 'The git process produced output exceeding the configured cap.');
      case 'process.failed':
      case 'process.invalid-options':
        return err('git.failed', 'infrastructure', 'The git process terminated abnormally.');
      default:
        return err('git.failed', 'infrastructure', 'The git process terminated abnormally.');
    }
  }

  return ok(result.value);
}

export function decodeGitOutput(buffer: Buffer): Result<string, GitFailureCode> {
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    return ok(decoder.decode(buffer));
  } catch {
    return err('git.malformed-output', 'infrastructure', 'Git produced output that was not valid UTF-8.');
  }
}
