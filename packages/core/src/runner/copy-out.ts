import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import { TarSingleFileReader, TarStreamParser, type SingleTarFileRead } from '../archive/tar-read.js';
import { RUNTIME_CONTROL_OUTPUT_MAX_BYTES, SANDBOX_CHECKOUT_PATH } from '../policy/bounds.js';
import { streamProcess, type StreamProcessRunner } from '../process/stream-process.js';
import { err, ok, type Result } from '../result.js';
import { runtimeCopyOutArgs, runtimeVolumeExportArgs } from './argv.js';
import type { ResultFileRead } from './record.js';
import type { SelectedRuntime } from './types.js';

export interface CopyOutContext {
  readonly runtime: SelectedRuntime;
  readonly timeoutMs: number;
  readonly stream?: StreamProcessRunner;
  /** The /work volume; Podman needs it when its client cannot stream `cp` output. */
  readonly volume?: string;
}

export interface PreparedCopy {
  readonly path: string;
  readonly bytes: number;
  readonly sha256: string;
}

const NOT_FOUND = /no such file or directory|could not find the file/i;

// Measured shape (Podman 6.1.2 Windows client, 2026-10-23): `podman cp <id>:<path> -` exits 125 with no output and
// stderr `Error: "/dev/stdout" could not be found on the host: no such file or directory`.
export const PODMAN_STDOUT_COPY_UNSUPPORTED = /"\/dev\/stdout" could not be found on the host/;

function stdoutCopyUnsupported(
  runtimeName: string,
  run: { readonly exitCode: number | null; readonly stderr: Uint8Array },
  seen: number,
): boolean {
  return (
    runtimeName === 'podman' &&
    run.exitCode !== 0 &&
    seen === 0 &&
    PODMAN_STDOUT_COPY_UNSUPPORTED.test(new TextDecoder('utf-8').decode(run.stderr))
  );
}

function joined(chunks: readonly Uint8Array[]): Uint8Array {
  return Uint8Array.from(Buffer.concat(chunks));
}

type VolumeFileRead = SingleTarFileRead | { readonly kind: 'missing' };

// Picks one path out of a `podman volume export` stream (entries are rooted at the volume, e.g. `checkout/x`).
class VolumeFileReader {
  private readonly parser = new TarStreamParser();
  private outcome: VolumeFileRead | null = null;
  private collecting = false;
  private chunks: Uint8Array[] = [];

  constructor(
    private readonly target: string,
    private readonly maxBytes: number,
  ) {}

  push(chunk: Uint8Array): 'continue' | 'done' {
    if (this.outcome !== null) return 'done';
    const result = this.parser.push(chunk);
    if (!result.ok) return this.settle({ kind: 'invalid' });
    for (const event of result.value) {
      if (event.kind === 'entry') {
        if (this.collecting) return this.settle({ kind: 'file', bytes: joined(this.chunks) });
        if (event.entry.path !== this.target) continue;
        if (event.entry.kind !== 'file') return this.settle({ kind: 'not-regular', entryKind: event.entry.kind });
        if (event.entry.size > this.maxBytes) return this.settle({ kind: 'too-large', declaredBytes: event.entry.size });
        this.collecting = true;
      } else if (event.kind === 'data') {
        if (this.collecting) this.chunks.push(event.bytes);
      } else {
        return this.settle(this.collecting ? { kind: 'file', bytes: joined(this.chunks) } : { kind: 'missing' });
      }
    }
    return 'continue';
  }

  finish(): VolumeFileRead {
    return this.outcome ?? { kind: 'invalid' };
  }

  private settle(outcome: VolumeFileRead): 'done' {
    this.outcome = outcome;
    this.chunks = [];
    return 'done';
  }
}

async function copyOutResultFileViaVolume(
  ctx: CopyOutContext,
  relativePath: string,
  maxBytes: number,
): Promise<Result<ResultFileRead, 'runner.copy-failed'>> {
  if (ctx.volume === undefined) return copyFailed(relativePath, 'volume');
  const stream = ctx.stream ?? streamProcess;
  const reader = new VolumeFileReader(relativePath === '.' ? 'checkout' : `checkout/${relativePath}`, maxBytes);
  const run = await stream(ctx.runtime.binary, runtimeVolumeExportArgs(ctx.volume), {
    cwd: os.tmpdir(),
    env: ctx.runtime.env,
    timeoutMs: ctx.timeoutMs,
    stdin: { kind: 'closed' },
    output: {
      kind: 'sink',
      onStdout: (chunk) => (reader.push(chunk) === 'done' ? 'stop' : 'continue'),
      stderrMaxBytes: RUNTIME_CONTROL_OUTPUT_MAX_BYTES,
    },
  });
  if (!run.ok) return copyFailed(relativePath, 'stream');
  const { exitCode, stopReason } = run.value;
  if (stopReason === 'timeout') return copyFailed(relativePath, 'stream');
  const outcome = reader.finish();
  switch (outcome.kind) {
    case 'file':
      if (exitCode !== 0 && stopReason === null) return copyFailed(relativePath, 'exit');
      return ok({ kind: 'file', bytes: outcome.bytes });
    case 'not-regular':
      return ok({ kind: 'not-regular' });
    case 'too-large':
      return ok({ kind: 'too-large', declaredBytes: outcome.declaredBytes });
    case 'missing':
      return exitCode !== 0 && stopReason === null ? copyFailed(relativePath, 'exit') : ok({ kind: 'missing' });
    case 'invalid':
      return copyFailed(relativePath, 'invalid');
  }
}

function copyFailed(path: string, message: string): Result<never, 'runner.copy-failed'> {
  return err('runner.copy-failed', 'environment-unavailable', 'Copying data out of the container failed.', [
    { code: 'runner.copy-failed', path, message, line: null, column: null },
  ]);
}

export function containerResultPath(relativePath: string): string {
  return relativePath === '.' ? SANDBOX_CHECKOUT_PATH : `${SANDBOX_CHECKOUT_PATH}/${relativePath}`;
}

export async function copyOutResultFile(
  ctx: CopyOutContext,
  containerId: string,
  relativePath: string,
  maxBytes: number,
): Promise<Result<ResultFileRead, 'runner.copy-failed'>> {
  const stream = ctx.stream ?? streamProcess;
  const reader = new TarSingleFileReader(maxBytes);
  let seen = 0;
  const run = await stream(ctx.runtime.binary, runtimeCopyOutArgs(containerId, containerResultPath(relativePath)), {
    cwd: os.tmpdir(),
    env: ctx.runtime.env,
    timeoutMs: ctx.timeoutMs,
    stdin: { kind: 'closed' },
    output: {
      kind: 'sink',
      onStdout: (chunk) => {
        seen += chunk.length;
        return reader.push(chunk) === 'done' ? 'stop' : 'continue';
      },
      stderrMaxBytes: RUNTIME_CONTROL_OUTPUT_MAX_BYTES,
    },
  });
  if (!run.ok) return copyFailed(relativePath, 'stream');
  if (stdoutCopyUnsupported(ctx.runtime.name, run.value, seen)) return copyOutResultFileViaVolume(ctx, relativePath, maxBytes);
  const { exitCode, stopReason, stderr } = run.value;
  if (stopReason === 'timeout') return copyFailed(relativePath, 'stream');
  const outcome = reader.finish();
  switch (outcome.kind) {
    case 'file':
      if (exitCode !== 0 && stopReason === null) return copyFailed(relativePath, 'exit');
      return ok({ kind: 'file', bytes: outcome.bytes });
    case 'not-regular':
      return ok({ kind: 'not-regular' });
    case 'too-large':
      return ok({ kind: 'too-large', declaredBytes: outcome.declaredBytes });
    case 'invalid': {
      const text = new TextDecoder('utf-8').decode(stderr);
      if (exitCode !== 0 && seen === 0 && NOT_FOUND.test(text)) {
        // Podman's `cp` resolves a symlink to a path it cannot find and reports it as absent; the volume export tells
        // a symlink (not regular) apart from a path that does not exist.
        if (ctx.runtime.name === 'podman' && ctx.volume !== undefined)
          return copyOutResultFileViaVolume(ctx, relativePath, maxBytes);
        return ok({ kind: 'missing' });
      }
      return copyFailed(relativePath, 'invalid');
    }
  }
}

function insideCheckout(entryPath: string): boolean {
  if (entryPath !== 'checkout' && !entryPath.startsWith('checkout/')) return false;
  return !entryPath.split('/').includes('..');
}

export async function exportPreparedCopy(
  ctx: CopyOutContext,
  containerId: string,
  outputPath: string,
  maxBytes: number,
): Promise<Result<PreparedCopy, 'runner.copy-failed' | 'runner.prepared-copy-too-large'>> {
  const stream = ctx.stream ?? streamProcess;
  const fd = fs.openSync(outputPath, 'wx');
  const hash = createHash('sha256');
  const parser = new TarStreamParser();
  let total = 0;
  let tooLarge = false;
  let invalid = false;
  let closed = false;
  const close = (): void => {
    if (!closed) {
      closed = true;
      fs.closeSync(fd);
    }
  };
  try {
    const attempt = (args: string[]) =>
      stream(ctx.runtime.binary, args, {
        cwd: os.tmpdir(),
        env: ctx.runtime.env,
        timeoutMs: ctx.timeoutMs,
        stdin: { kind: 'closed' },
        output: {
          kind: 'sink',
          onStdout: (chunk) => {
            total += chunk.length;
            if (total > maxBytes) {
              tooLarge = true;
              return 'stop';
            }
            const events = parser.push(chunk);
            if (!events.ok) {
              invalid = true;
              return 'stop';
            }
            for (const event of events.value) {
              if (event.kind === 'entry' && !insideCheckout(event.entry.path)) {
                invalid = true;
                return 'stop';
              }
            }
            fs.writeSync(fd, chunk);
            hash.update(chunk);
            return 'continue';
          },
          stderrMaxBytes: RUNTIME_CONTROL_OUTPUT_MAX_BYTES,
        },
      });
    let run = await attempt(runtimeCopyOutArgs(containerId, SANDBOX_CHECKOUT_PATH));
    if (run.ok && ctx.volume !== undefined && stdoutCopyUnsupported(ctx.runtime.name, run.value, total)) {
      run = await attempt(runtimeVolumeExportArgs(ctx.volume));
    }
    close();
    if (tooLarge) {
      fs.rmSync(outputPath, { force: true });
      return err('runner.prepared-copy-too-large', 'environment-unavailable', 'The prepared checkout exceeds its size limit.', [
        { code: 'runner.prepared-copy-too-large', path: '', message: `limit ${maxBytes} bytes`, line: null, column: null },
      ]);
    }
    if (!run.ok || run.value.stopReason !== null || run.value.exitCode !== 0 || invalid || !parser.finish().ok) {
      fs.rmSync(outputPath, { force: true });
      return copyFailed('', 'prepared copy stream failed');
    }
    return ok({ path: outputPath, bytes: total, sha256: `sha256:${hash.digest('hex')}` });
  } catch (error) {
    close();
    fs.rmSync(outputPath, { force: true });
    throw error;
  }
}
