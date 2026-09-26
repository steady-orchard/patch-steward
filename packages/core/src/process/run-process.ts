import { execFile } from 'node:child_process';
import type { Result } from '../result.js';
import { ok, err } from '../result.js';

export type ProcessFailureCode =
  'process.unavailable' | 'process.timeout' | 'process.output-too-large' | 'process.failed' | 'process.invalid-options';

export interface RunProcessOptions {
  readonly cwd: string;
  readonly env: Readonly<Record<string, string>>;
  readonly timeoutMs: number;
  readonly maxOutputBytes: number;
}

export interface ProcessOutput {
  readonly exitCode: number;
  readonly stdout: Buffer;
  readonly stderr: Buffer;
}

export type ProcessRunner = (
  binary: string,
  args: readonly string[],
  options: RunProcessOptions,
) => Promise<Result<ProcessOutput, ProcessFailureCode>>;

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

export const runProcess: ProcessRunner = async (binary, args, options) => {
  const { cwd, env, timeoutMs, maxOutputBytes } = options;

  if (!isPositiveInteger(timeoutMs) || !isNonNegativeInteger(maxOutputBytes)) {
    return err('process.invalid-options', 'steward-defect', 'timeoutMs and maxOutputBytes must satisfy their bounds.');
  }

  const abortController = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    abortController.abort();
  }, timeoutMs);

  try {
    return await new Promise<Result<ProcessOutput, ProcessFailureCode>>((resolve) => {
      execFile(
        binary,
        [...args],
        {
          cwd,
          env,
          encoding: 'buffer',
          maxBuffer: maxOutputBytes,
          signal: abortController.signal,
          killSignal: 'SIGKILL',
          windowsHide: true,
          shell: false,
        },
        (error, stdout, stderr) => {
          clearTimeout(timer);

          if (error) {
            if (timedOut) {
              resolve(err('process.timeout', 'infrastructure', `Process timed out after ${timeoutMs} ms.`));
              return;
            }
            const code = (error as NodeJS.ErrnoException).code;
            if (code === 'ENOENT' || code === 'EACCES') {
              resolve(err('process.unavailable', 'infrastructure', 'The requested binary could not be executed.'));
              return;
            }
            if (code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
              resolve(err('process.output-too-large', 'infrastructure', 'Process output exceeded the configured cap.'));
              return;
            }
            if (typeof code === 'number') {
              resolve(ok({ exitCode: code, stdout, stderr }));
              return;
            }
            resolve(err('process.failed', 'infrastructure', 'Process terminated abnormally.'));
            return;
          }

          resolve(ok({ exitCode: 0, stdout, stderr }));
        },
      );
    });
  } catch {
    clearTimeout(timer);
    return err('process.failed', 'infrastructure', 'Process terminated abnormally.');
  }
};
