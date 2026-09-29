import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { steppingClock } from '../clock.js';
import { executionResultEntrySchema } from '../execution/transport.js';
import { OutputCaptureBuffer } from '../execution/output-capture.js';
import type { ExecutionPlanEntry } from '../execution/plan.js';
import type { ProcessRunner } from '../process/run-process.js';
import type { StreamProcessOptions, StreamProcessRunner, StreamStopReason } from '../process/stream-process.js';
import type { RecordRunId } from '../records/common.js';
import { err, ok } from '../result.js';
import { createUnsandboxedRunner, unsandboxedEnvironment, type UnsandboxedLimits } from './unsandboxed.js';

const RUN_ID = 'local-20261003T101500Z-3f9a1c2e' as RecordRunId;

const LIMITS: UnsandboxedLimits = {
  executionSeconds: 60,
  outputHeadBytes: 262144,
  outputTailBytes: 786432,
  outputStreamBytes: 268435456,
  resultFiles: 5,
  resultFileBytes: 5242880,
  resultTestCases: 1000,
};

function entryFor(run: string[], resultFiles: ExecutionPlanEntry['result_files'] = []): ExecutionPlanEntry {
  return {
    id: 'head-test',
    kind: 'command',
    command_id: 'test',
    run,
    working_directory: '.',
    commit_role: 'head',
    commit: 'c'.repeat(40),
    overlay: 'none',
    expected: 'exit-zero',
    network: 'none',
    result_files: resultFiles,
  } as ExecutionPlanEntry;
}

interface StreamCall {
  readonly binary: string;
  readonly args: readonly string[];
  readonly options: StreamProcessOptions;
}

function fakeStream(calls: StreamCall[], stopReason: StreamStopReason | null = null): StreamProcessRunner {
  return (binary, args, options) => {
    calls.push({ binary, args, options });
    const buffer = new OutputCaptureBuffer({ headBytes: 1024, tailBytes: 1024, streamBytes: 4096 });
    buffer.push(new TextEncoder().encode('hello\n'));
    return Promise.resolve(
      ok({ exitCode: 0, signal: null, stopReason, captured: buffer.result(), stderr: new Uint8Array(0), durationMs: 5 }),
    );
  };
}

describe('unsandboxed runner', () => {
  let root = '';
  const secret = 'ghp' + '_' + 'a'.repeat(36);

  beforeEach(() => {
    root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'patch-steward-unsandboxed-')));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  const git = (): ProcessRunner => () =>
    Promise.resolve(ok({ exitCode: 0, stdout: Buffer.from(root + '\n'), stderr: Buffer.alloc(0) }));

  const make = async (stream: StreamProcessRunner, hostEnv: Record<string, string | undefined> = { PATH: 'p' }) => {
    const result = await createUnsandboxedRunner({
      checkoutRoot: root,
      processCwd: root,
      previewWorktrees: [],
      hostEnv,
      credentials: [],
      runId: RUN_ID,
      runAttempt: 1,
      clock: steppingClock('2026-10-03T10:15:00.000Z', 1000),
      platform: 'linux',
      git: git(),
      stream,
    });
    if (!result.ok) throw new Error('runner refused');
    return result.value;
  };

  it('filters credentials from the environment', () => {
    expect(
      unsandboxedEnvironment(
        { PATH: 'p', GH_TOKEN: 't1', github_token: 't2', STEWARD_LLM_API_KEY: 'k', OTHER: secret, SAFE: 'x', EMPTY: undefined },
        [secret, ''],
      ),
    ).toEqual({ PATH: 'p', SAFE: 'x' });
  });

  it('runs a command through the stream runner', async () => {
    const calls: StreamCall[] = [];
    const runner = await make(fakeStream(calls), { PATH: 'p', GH_TOKEN: 't' });
    const result = await runner.run(entryFor(['make', 'test']), LIMITS);
    expect(result.kind).toBe('completed');
    if (result.kind !== 'completed') return;
    const call = calls[0];
    expect(call?.binary).toBe('make');
    expect(call?.args).toEqual(['test']);
    expect(call?.options.cwd).toBe(runner.root);
    expect(call?.options.killTree).toBe(true);
    expect(call?.options.stdin).toEqual({ kind: 'closed' });
    expect(call?.options.output).toEqual({
      kind: 'capture',
      limits: { headBytes: 262144, tailBytes: 786432, streamBytes: 268435456 },
    });
    expect(call?.options.env).toEqual({ PATH: 'p' });
    expect(result.execution.record.admissibility).toBe('claim');
    expect(result.execution.record.runner).toBe('unsandboxed');
    expect(result.execution.record.environment.runtime?.name).toBe('host');
    expect(executionResultEntrySchema.safeParse(result.execution).success).toBe(true);
  });

  it('records timeouts and output limits', async () => {
    const timeout = await (await make(fakeStream([], 'timeout'))).run(entryFor(['make']), LIMITS);
    const limited = await (await make(fakeStream([], 'output-limit'))).run(entryFor(['make']), LIMITS);
    if (timeout.kind !== 'completed' || limited.kind !== 'completed') throw new Error('not completed');
    expect(timeout.execution.record.exit.timed_out).toBe(true);
    expect(limited.execution.record.exit.output_limited).toBe(true);
  });

  it('reports a command that cannot start', async () => {
    const stream: StreamProcessRunner = () => Promise.resolve(err('process.unavailable', 'infrastructure', 'x'));
    const result = await (await make(stream)).run(entryFor(['make']), LIMITS);
    expect(result).toEqual({ kind: 'environment-failure', code: 'runner.start-failed', subject: 'make' });
  });

  it('reads host result files', async () => {
    fs.mkdirSync(path.join(root, 'reports', 'dir'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'reports', 'ok.xml'),
      '<testsuites><testsuite name="s"><testcase classname="c" name="t"/></testsuite></testsuites>',
    );
    fs.writeFileSync(path.join(root, 'reports', 'big.xml'), 'x'.repeat(2000));
    const declared = ['reports/ok.xml', 'reports/big.xml', 'reports/dir', 'reports/missing.xml'].map((p) => ({
      path: p,
      format: 'junit-xml' as const,
    }));
    const runner = await make(fakeStream([]));
    const result = await runner.run(entryFor(['make'], declared), { ...LIMITS, resultFileBytes: 1000 });
    if (result.kind !== 'completed') throw new Error('not completed');
    expect(result.execution.record.result_files.map((f) => f.status)).toEqual(['parsed', 'too-large', 'not-regular', 'missing']);
  });
});
