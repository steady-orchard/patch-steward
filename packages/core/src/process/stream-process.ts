import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { OutputCaptureBuffer, type CapturedOutput, type OutputCaptureLimits } from '../execution/output-capture.js';
import { RUNTIME_KILL_GRACE_MS } from '../policy/bounds.js';
import { err, ok, type Result } from '../result.js';

export type StreamProcessFailureCode = 'process.unavailable' | 'process.failed' | 'process.invalid-options';

export type StreamProcessStdin =
  | { readonly kind: 'closed' }
  | { readonly kind: 'bytes'; readonly bytes: Uint8Array }
  | { readonly kind: 'file'; readonly path: string };

export type StreamProcessOutput =
  | { readonly kind: 'capture'; readonly limits: OutputCaptureLimits }
  | { readonly kind: 'sink'; readonly onStdout: (chunk: Uint8Array) => 'continue' | 'stop'; readonly stderrMaxBytes: number };

export interface StreamProcessOptions {
  readonly cwd: string;
  readonly env: Readonly<Record<string, string>>;
  readonly timeoutMs: number;
  readonly stdin: StreamProcessStdin;
  readonly output: StreamProcessOutput;
  readonly killTree?: boolean;
  readonly windowsVerbatimArguments?: boolean;
}

export type StreamStopReason = 'timeout' | 'output-limit' | 'sink-stop';

export interface StreamProcessOutcome {
  readonly exitCode: number | null;
  readonly signal: string | null;
  readonly stopReason: StreamStopReason | null;
  readonly captured: CapturedOutput | null;
  readonly stderr: Uint8Array;
  readonly durationMs: number;
}

export type StreamProcessRunner = (
  binary: string,
  args: readonly string[],
  options: StreamProcessOptions,
) => Promise<Result<StreamProcessOutcome, StreamProcessFailureCode>>;

type Stop = StreamStopReason | 'stdin-error';

function invalid(): Result<StreamProcessOutcome, StreamProcessFailureCode> {
  return err('process.invalid-options', 'steward-defect', 'Stream process options are invalid.');
}

function killChild(child: ChildProcess, killTree: boolean): void {
  const pid = child.pid;
  if (killTree && pid !== undefined && process.platform === 'win32') {
    const killer = spawn(
      path.join(process.env['SystemRoot'] ?? 'C:/Windows', 'System32', 'taskkill.exe'),
      ['/PID', String(pid), '/T', '/F'],
      {
        stdio: 'ignore',
        windowsHide: true,
        shell: false,
      },
    );
    killer.on('error', () => undefined);
  } else if (killTree && pid !== undefined) {
    try {
      process.kill(-pid, 'SIGKILL');
      return;
    } catch {
      // fall through to the direct kill
    }
  }
  try {
    child.kill('SIGKILL');
  } catch {
    // already gone
  }
}

export const streamProcess: StreamProcessRunner = (binary, args, options) => {
  const { output, stdin } = options;
  if (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs < 1) return Promise.resolve(invalid());
  let buffer: OutputCaptureBuffer | null = null;
  if (output.kind === 'capture') {
    try {
      buffer = new OutputCaptureBuffer(output.limits);
    } catch {
      return Promise.resolve(invalid());
    }
  } else if (!Number.isSafeInteger(output.stderrMaxBytes) || output.stderrMaxBytes < 0) {
    return Promise.resolve(invalid());
  }

  return new Promise((resolve) => {
    const start = performance.now();
    const killTree = options.killTree === true;
    const child = spawn(binary, [...args], {
      cwd: options.cwd,
      env: { ...options.env },
      shell: false,
      windowsHide: true,
      stdio: [stdin.kind === 'closed' ? 'ignore' : 'pipe', 'pipe', 'pipe'],
      detached: killTree && process.platform !== 'win32',
      windowsVerbatimArguments: options.windowsVerbatimArguments === true,
    });

    let spawned = false;
    let settled = false;
    let stop: Stop | null = null;
    let exitSeen: { code: number | null; signal: string | null } | null = null;
    let graceTimer: NodeJS.Timeout | undefined;
    const stderrChunks: Buffer[] = [];
    let stderrLength = 0;

    const finish = (result: Result<StreamProcessOutcome, StreamProcessFailureCode>): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(graceTimer);
      resolve(result);
    };

    const settleOutcome = (code: number | null, signal: string | null): void => {
      if (stop === 'stdin-error') {
        finish(err('process.failed', 'infrastructure', 'Process terminated abnormally.'));
        return;
      }
      finish(
        ok({
          exitCode: code,
          signal,
          stopReason: stop,
          captured: buffer === null ? null : buffer.result(),
          stderr: buffer === null ? Buffer.concat(stderrChunks) : new Uint8Array(0),
          durationMs: Math.round(performance.now() - start),
        }),
      );
    };

    const decide = (reason: Stop): void => {
      if (stop !== null) return;
      stop = reason;
      killChild(child, killTree);
      graceTimer = setTimeout(() => {
        child.stdout?.destroy();
        child.stderr?.destroy();
        settleOutcome(exitSeen?.code ?? null, exitSeen?.signal ?? null);
      }, RUNTIME_KILL_GRACE_MS);
    };

    child.once('spawn', () => {
      spawned = true;
    });
    child.on('error', () => {
      if (!spawned) finish(err('process.unavailable', 'infrastructure', 'The requested binary could not be executed.'));
    });
    child.on('exit', (code, signal) => {
      exitSeen = { code, signal };
    });
    child.on('close', (code, signal) => {
      if (!spawned) return;
      settleOutcome(code, signal);
    });

    const timer = setTimeout(() => decide('timeout'), options.timeoutMs);

    if (child.stdin !== null) {
      child.stdin.on('error', () => undefined);
      if (stdin.kind === 'bytes') {
        child.stdin.end(Buffer.from(stdin.bytes));
      } else if (stdin.kind === 'file') {
        const source = fs.createReadStream(stdin.path);
        source.on('error', () => {
          source.unpipe();
          child.stdin?.destroy();
          decide('stdin-error');
        });
        source.pipe(child.stdin);
      }
    }

    child.stdout?.on('data', (chunk: Buffer) => {
      if (stop !== null) return;
      if (buffer !== null) {
        if (buffer.push(chunk)) decide('output-limit');
      } else if (output.kind === 'sink' && output.onStdout(chunk) === 'stop') {
        decide('sink-stop');
      }
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      if (stop !== null) return;
      if (buffer !== null) {
        if (buffer.push(chunk)) decide('output-limit');
      } else if (output.kind === 'sink') {
        const room = output.stderrMaxBytes - stderrLength;
        if (room > 0) {
          const part = chunk.subarray(0, room);
          stderrChunks.push(part);
          stderrLength += part.length;
        }
      }
    });
  });
};
