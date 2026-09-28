import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runAction } from './dispatch.js';
import type { ActionDeps } from './dispatch.js';
import type { HostedGateInput, HostedGateResult, HostedPublishInput, HostedPublishResult } from '@patch-steward/core';

describe('action entry', () => {
  let dir: string;
  let env: Record<string, string>;
  const KEY = 'line-one-' + 'k'.repeat(20) + '\n' + 'line-two-' + 'k'.repeat(20) + '\n';

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'm6-act-'));
    writeFileSync(join(dir, 'event.json'), '{}');
    env = {
      GITHUB_EVENT_NAME: 'issues',
      GITHUB_EVENT_PATH: join(dir, 'event.json'),
      GITHUB_REPOSITORY: 'steady-orchard/patch-steward-testbed-public',
      GITHUB_REPOSITORY_ID: '1376317064',
      GITHUB_REF: 'refs/heads/master',
      GITHUB_SERVER_URL: 'https://github.com',
      GITHUB_API_URL: 'https://api.github.com',
      GITHUB_RUN_ID: '36081628326',
      GITHUB_RUN_ATTEMPT: '1',
      RUNNER_TEMP: dir,
      GITHUB_OUTPUT: join(dir, 'output'),
      GITHUB_STEP_SUMMARY: join(dir, 'summary'),
      PATCH_STEWARD_APP_ID: '4993303',
      PATCH_STEWARD_APP_PRIVATE_KEY: KEY,
    };
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  function publishEnv(): Record<string, string> {
    return {
      ...env,
      STEWARD_GATE_DISPOSITION: 'runnable',
      STEWARD_GATE_RECORD_ONLY: 'false',
      STEWARD_GATE_SNAPSHOT_HASH: 'sha256:' + 'a'.repeat(64),
      STEWARD_GATE_POLICY_REVISION: 'b'.repeat(40),
    };
  }

  async function readTextOrEmpty(filePath: string): Promise<string> {
    try {
      return await readFile(filePath, 'utf8');
    } catch {
      return '';
    }
  }

  function stdoutSink(): { lines: string[]; stdout: (text: string) => void } {
    const lines: string[] = [];
    return {
      lines,
      stdout: (text: string) => {
        lines.push(text);
      },
    };
  }

  it('the action dispatches gate and publish', async () => {
    const sink = stdoutSink();
    let gateCalls = 0;
    let gateInput: HostedGateInput | null = null;
    const runGate = async (input: HostedGateInput): Promise<HostedGateResult> => {
      gateCalls += 1;
      gateInput = input;
      return { ok: true, disposition: 'runnable', outputs: { disposition: 'runnable' }, files: [], logLines: [] };
    };
    const deps: ActionDeps = { env, stdout: sink.stdout, runGate };
    const gateStatus = await runAction(['gate'], deps);
    expect(gateStatus).toBe(0);
    expect(gateCalls).toBe(1);
    expect(Buffer.from((gateInput as unknown as HostedGateInput).payload).toString()).toBe('{}');

    const handoffBytes = new Uint8Array([1, 2, 3]);
    const gateContextBytes = new Uint8Array([4, 5, 6]);
    mkdirSync(join(dir, 'steward', 'handoff'), { recursive: true });
    writeFileSync(join(dir, 'steward', 'handoff', 'handoff.json'), Buffer.from(handoffBytes), { flag: 'w' });
    writeFileSync(join(dir, 'steward', 'handoff', 'gate-context.json'), Buffer.from(gateContextBytes), { flag: 'w' });
    let publishCalls = 0;
    let publishInput: HostedPublishInput | null = null;
    const runPublish = async (input: HostedPublishInput): Promise<HostedPublishResult> => {
      publishCalls += 1;
      publishInput = input;
      return { ok: true, status: 'pass', outputs: { status: 'pass' }, logLines: [] };
    };
    const publishDeps: ActionDeps = { env: publishEnv(), stdout: sink.stdout, runPublish };
    const publishStatus = await runAction(['publish'], publishDeps);
    expect(publishStatus).toBe(0);
    expect(publishCalls).toBe(1);
    const resolvedPublishInput = publishInput as unknown as HostedPublishInput;
    expect(new Uint8Array(resolvedPublishInput.files.handoff as Uint8Array)).toEqual(handoffBytes);
    expect(new Uint8Array(resolvedPublishInput.files.gateContext as Uint8Array)).toEqual(gateContextBytes);
  });

  it('an unknown job prints usage and exits 2', async () => {
    for (const argv of [[], ['deploy'], ['gate', 'x']]) {
      const sink = stdoutSink();
      const status = await runAction(argv, { env, stdout: sink.stdout });
      expect(status).toBe(2);
      expect(sink.lines).toContain('usage: main.js gate|publish\n');
    }
  });

  it('masks are emitted before any other output', async () => {
    const sink = stdoutSink();
    const runGate = async (_input: HostedGateInput, gateDeps: { mask: (secret: string) => void }): Promise<HostedGateResult> => {
      gateDeps.mask('a-token');
      return { ok: true, disposition: 'runnable', outputs: {}, files: [], logLines: [] };
    };
    const status = await runAction(['gate'], { env, stdout: sink.stdout, runGate });
    expect(status).toBe(0);
    expect(sink.lines[0]).toBe('::add-mask::line-one-' + 'k'.repeat(20) + '\n' + '::add-mask::line-two-' + 'k'.repeat(20) + '\n');
    expect(sink.lines).toContain('::add-mask::a-token\n');
  });

  it('environment failures name the variable, never its value', async () => {
    const sink = stdoutSink();
    const badEnv = { ...env };
    delete (badEnv as Record<string, string | undefined>).GITHUB_RUN_ID;
    const status = await runAction(['gate'], { env: badEnv, stdout: sink.stdout });
    expect(status).toBe(1);
    expect(sink.lines.some((line) => line.includes('action.environment-invalid GITHUB_RUN_ID'))).toBe(true);
    for (const line of sink.lines) {
      const isMaskLine = line.startsWith('::add-mask::');
      if (!isMaskLine) {
        expect(line).not.toContain('line-one-' + 'k'.repeat(20));
        expect(line).not.toContain('line-two-' + 'k'.repeat(20));
      }
    }
  });

  it('gate files are staged under the runner temp directory', async () => {
    const sink = stdoutSink();
    const files = [
      { name: 'handoff' as const, bytes: new Uint8Array([1]) },
      { name: 'gate-context' as const, bytes: new Uint8Array([2]) },
      { name: 'ownership' as const, bytes: new Uint8Array([3]) },
    ];
    const runGate = async (): Promise<HostedGateResult> => ({
      ok: true,
      disposition: 'runnable',
      outputs: { disposition: 'runnable', commit: 'true' },
      files,
      logLines: [],
    });
    const status = await runAction(['gate'], { env, stdout: sink.stdout, runGate });
    expect(status).toBe(0);
    const handoff = await readFile(join(dir, 'steward', 'handoff', 'handoff.json'));
    const gateContext = await readFile(join(dir, 'steward', 'handoff', 'gate-context.json'));
    const ownership = await readFile(join(dir, 'steward', 'ownership', 'ownership.json'));
    expect(new Uint8Array(handoff)).toEqual(new Uint8Array([1]));
    expect(new Uint8Array(gateContext)).toEqual(new Uint8Array([2]));
    expect(new Uint8Array(ownership)).toEqual(new Uint8Array([3]));
    const output = await readFile(env.GITHUB_OUTPUT as string, 'utf8');
    expect(output).toContain('disposition=runnable\n');
    expect(output).toContain('commit=true\n');
  });

  it('multi-line outputs are refused', async () => {
    const sink = stdoutSink();
    const runGate = async (): Promise<HostedGateResult> => ({
      ok: true,
      disposition: 'runnable',
      outputs: { name: 'a' + String.fromCharCode(10) + 'b' },
      files: [],
      logLines: [],
    });
    const status = await runAction(['gate'], { env, stdout: sink.stdout, runGate });
    expect(status).toBe(1);
    const content = await readTextOrEmpty(env.GITHUB_OUTPUT as string);
    expect(content).toBe('');
  });

  it('the step summary is bounded', async () => {
    const sink = stdoutSink();
    const runGate = async (
      _input: HostedGateInput,
      gateDeps: { writeSummary: (text: string) => Promise<void> },
    ): Promise<HostedGateResult> => {
      await gateDeps.writeSummary('x'.repeat(70000));
      return { ok: true, disposition: 'runnable', outputs: {}, files: [], logLines: [] };
    };
    const status = await runAction(['gate'], { env, stdout: sink.stdout, runGate });
    expect(status).toBe(0);
    const summary = await readFile(env.GITHUB_STEP_SUMMARY as string, 'utf8');
    expect(summary.length).toBeLessThanOrEqual(65536);
  });

  it('invariant 4: hosted upload failure never yields pass', async () => {
    const sink = stdoutSink();
    const notADir = join(dir, 'not-a-dir');
    writeFileSync(notADir, 'x');
    const badEnv = { ...env, RUNNER_TEMP: notADir };
    const runGate = async (): Promise<HostedGateResult> => ({
      ok: true,
      disposition: 'runnable',
      outputs: { disposition: 'runnable', commit: 'true' },
      files: [{ name: 'handoff', bytes: new Uint8Array([1]) }],
      logLines: [],
    });
    const status = await runAction(['gate'], { env: badEnv, stdout: sink.stdout, runGate });
    expect(status).toBe(1);
    const content = await readTextOrEmpty(env.GITHUB_OUTPUT as string);
    expect(content).not.toContain('commit=true');
    expect(sink.lines.join('')).toContain('could not be staged');
  });

  it('a failed core run exits nonzero without outputs', async () => {
    const sink = stdoutSink();
    const runGate = async (): Promise<HostedGateResult> => ({
      ok: false,
      failure: { code: 'gate.policy-missing', cause: 'policy-invalid', outcome: 'inconclusive', message: 'missing', details: [] },
      logLines: [],
    });
    const status = await runAction(['gate'], { env, stdout: sink.stdout, runGate });
    expect(status).toBe(1);
    expect(sink.lines.join('')).toContain('gate failed gate.policy-missing');
    const content = await readTextOrEmpty(env.GITHUB_OUTPUT as string);
    expect(content).toBe('');
  });
});
