import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { streamProcess, type StreamProcessOptions, type StreamProcessOutcome } from './stream-process.js';

const defaultEnv: Record<string, string> = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
);
const limits = { headBytes: 1024, tailBytes: 1024, streamBytes: 1048576 };
const flood = `const b = Buffer.alloc(65536, 120); (function w() { process.stdout.write(b, w); })();`;
const upper = `let s = ''; process.stdin.on('data', (d) => (s += d)).on('end', () => process.stdout.write(s.toUpperCase()));`;

function options(overrides: Partial<StreamProcessOptions> = {}): StreamProcessOptions {
  return {
    cwd: os.tmpdir(),
    env: defaultEnv,
    timeoutMs: 30000,
    stdin: { kind: 'closed' },
    output: { kind: 'capture', limits },
    ...overrides,
  };
}

async function run(script: string, overrides: Partial<StreamProcessOptions> = {}): Promise<StreamProcessOutcome> {
  const result = await streamProcess(process.execPath, ['-e', script], options(overrides));
  if (!result.ok) throw new Error(`unexpected failure ${result.failure.code}`);
  return result.value;
}

function text(outcome: StreamProcessOutcome): string {
  const captured = outcome.captured;
  if (captured === null) throw new Error('no capture');
  return Buffer.concat([captured.head, captured.tail]).toString('utf8');
}

describe('streamProcess', { timeout: 60000 }, () => {
  it('merges stdout and stderr in arrival order', async () => {
    const outcome = await run(
      `process.stdout.write('a'); setTimeout(() => { process.stderr.write('b'); setTimeout(() => process.stdout.write('c'), 100); }, 100);`,
    );
    expect(outcome.exitCode).toBe(0);
    expect(outcome.stopReason).toBeNull();
    expect(text(outcome)).toBe('abc');
    expect(outcome.captured?.totalBytes).toBe(3);
    expect(outcome.stderr.length).toBe(0);
  });

  it('keeps the head and tail of long output', async () => {
    const outcome = await run(`process.stdout.write('x'.repeat(10000));`, {
      output: { kind: 'capture', limits: { headBytes: 100, tailBytes: 100, streamBytes: 1000000 } },
    });
    expect(outcome.captured?.totalBytes).toBe(10000);
    expect(outcome.captured?.omittedBytes).toBe(9800);
    expect(outcome.captured?.head.length).toBe(100);
    expect(outcome.captured?.tail.length).toBe(100);
    expect(outcome.captured?.limited).toBe(false);
  });

  it('stops at the stream limit', async () => {
    const outcome = await run(flood, {
      output: { kind: 'capture', limits: { headBytes: 1024, tailBytes: 1024, streamBytes: 262144 } },
    });
    expect(outcome.stopReason).toBe('output-limit');
    expect(outcome.captured?.totalBytes).toBe(262144);
    expect(outcome.captured?.limited).toBe(true);
  });

  it('stops at the timeout', async () => {
    const outcome = await run(`setInterval(() => {}, 1000);`, { timeoutMs: 500 });
    expect(outcome.stopReason).toBe('timeout');
    expect(outcome.durationMs).toBeGreaterThanOrEqual(400);
    expect(outcome.durationMs).toBeLessThan(20000);
  });

  it('reports the exit code', async () => {
    const outcome = await run(`process.exit(7)`);
    expect(outcome.exitCode).toBe(7);
    expect(outcome.signal).toBeNull();
    expect(outcome.stopReason).toBeNull();
  });

  it('feeds standard input from bytes', async () => {
    const outcome = await run(upper, { stdin: { kind: 'bytes', bytes: Buffer.from('hello') } });
    expect(text(outcome)).toBe('HELLO');
  });

  it('feeds standard input from a file', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-steward-stream-'));
    try {
      const file = path.join(dir, 'in.txt');
      fs.writeFileSync(file, 'from file');
      const outcome = await run(upper, { stdin: { kind: 'file', path: file } });
      expect(text(outcome)).toBe('FROM FILE');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it('closes standard input', async () => {
    const outcome = await run(`process.stdin.on('end', () => process.stdout.write('eof')); process.stdin.resume();`);
    expect(text(outcome)).toBe('eof');
  });

  it('streams standard output to a sink', async () => {
    const chunks: Buffer[] = [];
    const outcome = await run(`process.stdout.write('abc'); process.stderr.write('err');`, {
      output: {
        kind: 'sink',
        onStdout: (chunk) => {
          chunks.push(Buffer.from(chunk));
          return 'continue';
        },
        stderrMaxBytes: 2,
      },
    });
    expect(Buffer.concat(chunks).toString('utf8')).toBe('abc');
    expect(Buffer.from(outcome.stderr).toString('utf8')).toBe('er');
    expect(outcome.captured).toBeNull();
  });

  it('stops when the sink asks', async () => {
    let collected = 0;
    const outcome = await run(flood, {
      output: {
        kind: 'sink',
        onStdout: (chunk) => {
          collected += chunk.length;
          return collected >= 4096 ? 'stop' : 'continue';
        },
        stderrMaxBytes: 0,
      },
    });
    expect(outcome.stopReason).toBe('sink-stop');
  });

  it('kills the whole process tree', async () => {
    const outcome = await run(
      `const { spawn } = require('node:child_process'); const g = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'inherit' }); process.stdout.write('pid=' + g.pid + ';'); setInterval(() => {}, 1000);`,
      { killTree: true, timeoutMs: 1500 },
    );
    expect(outcome.stopReason).toBe('timeout');
    const match = /pid=([0-9]+);/.exec(text(outcome));
    const pid = Number(match?.[1]);
    expect(Number.isInteger(pid)).toBe(true);
    let gone = false;
    for (let i = 0; i < 50 && !gone; i++) {
      try {
        process.kill(pid, 0);
        // A killed orphan stays a zombie when PID 1 of a container never reaps it.
        if (process.platform === 'linux') {
          let zombie: boolean;
          try {
            const stat = fs.readFileSync('/proc/' + pid + '/stat', 'utf8');
            zombie = stat.slice(stat.lastIndexOf(') ') + 2).startsWith('Z');
          } catch {
            zombie = true;
          }
          if (zombie) {
            gone = true;
            break;
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch {
        gone = true;
      }
    }
    expect(gone).toBe(true);
  });

  it('reports a binary that cannot start', async () => {
    const result = await streamProcess('patch-steward-no-such-binary-' + Date.now(), [], options());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('process.unavailable');
      expect(result.failure.cause).toBe('infrastructure');
    }
  });

  it('rejects invalid options', async () => {
    const zero = await streamProcess(process.execPath, ['-e', ''], options({ timeoutMs: 0 }));
    expect(zero.ok).toBe(false);
    if (!zero.ok) {
      expect(zero.failure.code).toBe('process.invalid-options');
      expect(zero.failure.cause).toBe('steward-defect');
    }
    const bad = await streamProcess(
      process.execPath,
      ['-e', ''],
      options({ output: { kind: 'capture', limits: { headBytes: 1, tailBytes: 1, streamBytes: 0 } } }),
    );
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.failure.code).toBe('process.invalid-options');
  });

  it('passes only the given environment', async () => {
    expect(process.env['VITEST']).toBeDefined();
    const env: Record<string, string> = { PATCH_STEWARD_PROBE: 'v' };
    const root = process.env['SystemRoot'];
    if (root !== undefined) env['SystemRoot'] = root;
    const outcome = await run(
      `process.stdout.write(JSON.stringify({ probe: process.env.PATCH_STEWARD_PROBE ?? null, vitest: process.env.VITEST ?? null }))`,
      { env },
    );
    expect(JSON.parse(text(outcome))).toEqual({ probe: 'v', vitest: null });
  });
});
