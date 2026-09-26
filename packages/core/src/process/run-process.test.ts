import { describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { runProcess } from './run-process.js';

const testEnv: Record<string, string> = {};
for (const [key, value] of Object.entries(process.env)) {
  if (value !== undefined) {
    testEnv[key] = value;
  }
}

const cwd = os.tmpdir();
const timeoutMs = 5000;
const maxOutputBytes = 1000000;

describe('runProcess', { timeout: 30000 }, () => {
  it('captures stdout', async () => {
    const result = await runProcess(process.execPath, ['-e', "process.stdout.write('hi')"], {
      cwd,
      env: testEnv,
      timeoutMs,
      maxOutputBytes,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.exitCode).toBe(0);
      expect(result.value.stdout.toString()).toBe('hi');
    }
  });

  it('reports a non-zero exit code', async () => {
    const result = await runProcess(process.execPath, ['-e', 'process.exit(3)'], {
      cwd,
      env: testEnv,
      timeoutMs,
      maxOutputBytes,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.exitCode).toBe(3);
    }
  });

  it('passes arguments literally without a shell', async () => {
    const arg = '$HOME && echo pwned; `x`';
    const result = await runProcess(process.execPath, ['-e', 'process.stdout.write(process.argv[1] ?? "")', arg], {
      cwd,
      env: testEnv,
      timeoutMs,
      maxOutputBytes,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.stdout.toString()).toBe(arg);
    }
  });

  it('passes the given environment', async () => {
    const env = { ...testEnv, PS_RUN_PROCESS_TEST: 'v1' };
    const result = await runProcess(process.execPath, ['-e', 'process.stdout.write(process.env.PS_RUN_PROCESS_TEST ?? "")'], {
      cwd,
      env,
      timeoutMs,
      maxOutputBytes,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.stdout.toString()).toBe('v1');
    }
  });

  it('reports a missing binary as unavailable', async () => {
    const missing = path.join(os.tmpdir(), 'no-such-binary-for-run-process-test');
    const result = await runProcess(missing, [], { cwd, env: testEnv, timeoutMs, maxOutputBytes });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('process.unavailable');
      expect(result.failure.cause).toBe('infrastructure');
      expect(result.failure.outcome).toBe('inconclusive');
    }
  });

  it('times out long-running processes quickly', async () => {
    const start = Date.now();
    const result = await runProcess(process.execPath, ['-e', 'setTimeout(() => {}, 10000)'], {
      cwd,
      env: testEnv,
      timeoutMs: 300,
      maxOutputBytes,
    });
    const elapsed = Date.now() - start;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('process.timeout');
      expect(result.failure.cause).toBe('infrastructure');
    }
    expect(elapsed).toBeLessThan(5000);
  });

  it('reports oversized stdout as output-too-large', async () => {
    const result = await runProcess(process.execPath, ['-e', "process.stdout.write('x'.repeat(10000))"], {
      cwd,
      env: testEnv,
      timeoutMs,
      maxOutputBytes: 100,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('process.output-too-large');
    }
  });

  it('reports oversized stderr as output-too-large', async () => {
    const result = await runProcess(process.execPath, ['-e', "process.stderr.write('x'.repeat(10000))"], {
      cwd,
      env: testEnv,
      timeoutMs,
      maxOutputBytes: 100,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('process.output-too-large');
    }
  });

  it('allows output exactly at the cap', async () => {
    const result = await runProcess(process.execPath, ['-e', "process.stdout.write('x'.repeat(100))"], {
      cwd,
      env: testEnv,
      timeoutMs,
      maxOutputBytes: 100,
    });
    expect(result.ok).toBe(true);
  });

  it('rejects a zero timeout as invalid', async () => {
    const result = await runProcess(process.execPath, ['-e', ''], { cwd, env: testEnv, timeoutMs: 0, maxOutputBytes });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('process.invalid-options');
      expect(result.failure.cause).toBe('steward-defect');
      expect(result.failure.outcome).toBe('inconclusive');
    }
  });

  it('rejects a non-integer timeout as invalid', async () => {
    const result = await runProcess(process.execPath, ['-e', ''], { cwd, env: testEnv, timeoutMs: 1.5, maxOutputBytes });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('process.invalid-options');
      expect(result.failure.cause).toBe('steward-defect');
    }
  });

  it('rejects a negative output cap as invalid', async () => {
    const result = await runProcess(process.execPath, ['-e', ''], {
      cwd,
      env: testEnv,
      timeoutMs,
      maxOutputBytes: -1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('process.invalid-options');
      expect(result.failure.cause).toBe('steward-defect');
    }
  });
});
