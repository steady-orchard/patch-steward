import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';

import { steppingClock } from '../clock.js';
import { OutputCaptureBuffer } from '../execution/output-capture.js';
import type { ExecutionPlanEntry } from '../execution/plan.js';
import { validateExecutionPlan, validateExecutionResults } from '../execution/transport.js';
import type { ExecutionPlanTransport, ExecutionTransportBinding } from '../execution/transport.js';
import { parseJunitXml } from '../junit/parse.js';
import type { ProcessOutput, ProcessRunner } from '../process/run-process.js';
import type { StreamProcessRunner } from '../process/stream-process.js';
import type { RecordRunId } from '../records/common.js';
import { ok } from '../result.js';
import { containerInspectSchema, runContainerExecution } from '../runner/container.js';
import type { ContainerExecutionLimits } from '../runner/container.js';
import { imageInspectSchema, prepareRunnerImage } from '../runner/image.js';
import {
  dockerInfoSchema,
  dockerVersionSchema,
  podmanInfoSchema,
  podmanVersionSchema,
  selectContainerRuntime,
} from '../runner/runtime.js';
import type { ResolvedImage, SelectedRuntime } from '../runner/types.js';

const NON_OBJECTS: unknown[] = [null, undefined, 'text', 7, true, []];

function reply(stdout: string, exitCode = 0): ProcessRunner {
  return async () => ok({ exitCode, stdout: Buffer.from(stdout), stderr: Buffer.alloc(0) } satisfies ProcessOutput);
}

describe('invariant 5: execution inputs are validated', () => {
  test('invariant 5: runtime JSON is validated', async () => {
    const schemas = [dockerVersionSchema, podmanVersionSchema, dockerInfoSchema, podmanInfoSchema];
    for (const schema of schemas) {
      for (const value of NON_OBJECTS) expect(schema.safeParse(value).success).toBe(false);
      expect(schema.safeParse({}).success).toBe(false);
    }
    expect(dockerVersionSchema.safeParse({ Client: { Version: 29 } }).success).toBe(false);
    expect(podmanVersionSchema.safeParse({ Client: { Version: '5.0.0', OsArch: 7 } }).success).toBe(false);
    expect(dockerInfoSchema.safeParse({ OSType: 'linux', MemoryLimit: 'yes', PidsLimit: true, CpuCfsQuota: true }).success).toBe(
      false,
    );
    expect(dockerInfoSchema.safeParse({ OSType: 'linux', PidsLimit: true, CpuCfsQuota: true }).success).toBe(false);
    expect(podmanInfoSchema.safeParse({ host: { cgroupVersion: 2 } }).success).toBe(false);

    for (const version of ['29 8', 'x'.repeat(65), '']) {
      expect(dockerVersionSchema.safeParse({ Client: { Version: version } }).success).toBe(false);
      expect(podmanVersionSchema.safeParse({ Client: { Version: version, OsArch: 'linux/amd64' } }).success).toBe(false);
    }
    expect(dockerVersionSchema.safeParse({ Client: { Version: 'x'.repeat(64) } }).success).toBe(true);

    const malformed = [
      'not json',
      '[]',
      'null',
      '{}',
      '{"Client":{"Version":"a b"},"Server":{"Version":"1","Os":"linux","Arch":"x"}}',
    ];
    for (const choice of ['docker', 'podman'] as const) {
      for (const stdout of malformed) {
        const selected = await selectContainerRuntime({ choice, hostEnv: {}, control: reply(stdout) });
        expect(selected.ok).toBe(false);
      }
    }
    // Valid version JSON but malformed info JSON must still fail closed.
    const version = JSON.stringify({ Client: { Version: '29.8.0' }, Server: { Version: '29.8.0', Os: 'linux', Arch: 'amd64' } });
    const control: ProcessRunner = async (_binary, args) =>
      ok({ exitCode: 0, stdout: Buffer.from(args.includes('info') ? '{"OSType":1}' : version), stderr: Buffer.alloc(0) });
    const selected = await selectContainerRuntime({ choice: 'docker', hostEnv: {}, control });
    expect(selected.ok).toBe(false);
  });

  test('invariant 5: inspect JSON is validated', async () => {
    const state = { Status: 'exited', Running: false, ExitCode: 0, OOMKilled: false };
    const badContainer: unknown[] = [
      ...NON_OBJECTS,
      {},
      [{}],
      [{ State: { ...state, ExitCode: 1.5 } }],
      [{ State: { ...state, Running: 'no' } }],
      [{ State: { Status: 'exited' } }],
      [{ State: state }, { State: state }],
    ];
    for (const value of badContainer) expect(containerInspectSchema.safeParse(value).success).toBe(false);
    expect(containerInspectSchema.safeParse([{ State: state }]).success).toBe(true);

    const badImage: unknown[] = [
      ...NON_OBJECTS,
      {},
      [{}],
      [{ Id: 5, Size: 1 }],
      [{ Id: 'a', Size: '1' }],
      [{ Id: 'a', Size: -1 }],
      [{ Id: 'a', Size: 1, RepoDigests: 'x' }],
    ];
    for (const value of badImage) expect(imageInspectSchema.safeParse(value).success).toBe(false);

    // Image preparation: pull succeeds, then each malformed inspect output is refused.
    const runtime: SelectedRuntime = {
      name: 'docker',
      binary: 'docker',
      env: { PATH: 'p' },
      clientVersion: '29.8.0',
      serverVersion: '29.8.0',
      os: 'linux',
      arch: 'amd64',
    };
    const imageLimits = { pullSeconds: 600, buildSeconds: 1800, imageBytes: 4294967296, buildOutputStreamBytes: 268435456 };
    const badImageOutputs = [
      'not json',
      '[]',
      JSON.stringify([{ Id: 'xyz', Size: 1 }]),
      JSON.stringify([{ Id: 'e'.repeat(64), Size: '1' }]),
    ];
    for (const stdout of badImageOutputs) {
      const replies = [
        { exit: 0, stdout: '' },
        { exit: 0, stdout },
      ];
      const control: ProcessRunner = async () => {
        const next = replies.shift() ?? { exit: 1, stdout: '' };
        return ok({ exitCode: next.exit, stdout: Buffer.from(next.stdout), stderr: Buffer.alloc(0) });
      };
      const prepared = await prepareRunnerImage(
        { runtime, testNonce: null, control },
        { source: 'registry', reference: 'docker.io/library/busybox:1.37.0' },
        imageLimits,
      );
      expect(prepared.result.ok).toBe(false);
      expect(prepared.result.ok ? null : prepared.result.failure.code).toBe('runner.inspect-invalid');
    }

    // Container execution: the start succeeds, then each malformed inspect output is refused.
    const image: ResolvedImage = {
      source: 'registry',
      reference: 'docker.io/library/busybox:1.37.0',
      digest: 'sha256:' + 'a'.repeat(64),
      id: 'sha256:' + 'b'.repeat(64),
      runnerTreeId: null,
      cached: false,
      runReference: 'docker.io/library/busybox@sha256:' + 'a'.repeat(64),
    };
    const limits: ContainerExecutionLimits = {
      executionSeconds: 1800,
      dependencyStepSeconds: 600,
      outputHeadBytes: 262144,
      outputTailBytes: 786432,
      outputStreamBytes: 268435456,
      resultFiles: 5,
      resultFileBytes: 5242880,
      resultTestCases: 1000,
      preparedCheckoutBytes: 2147483648,
      containerStartSeconds: 120,
      cpus: 2,
      memoryMb: 4096,
      pids: 512,
      scratchMb: 1024,
    };
    const checkout = {
      commit: 'c'.repeat(40),
      tree: 'd'.repeat(40),
      archive_sha256: 'sha256:' + '1'.repeat(64),
      files: 1,
      bytes: 10,
      overlays: [],
      skipped_submodules: [],
    };
    const entry = {
      id: 'head-test',
      kind: 'command',
      command_id: 'test',
      run: ['sh', 'run.sh'],
      working_directory: '.',
      commit_role: 'head',
      commit: 'c'.repeat(40),
      overlay: 'none',
      expected: 'exit-zero',
      network: 'none',
      result_files: [],
    } as ExecutionPlanEntry;
    const containerId = 'f'.repeat(64);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-steward-inv5-'));
    temps.push(dir);
    const archivePath = path.join(dir, 'checkout.tar');
    fs.writeFileSync(archivePath, 'x');

    const badContainerOutputs = [
      'not json',
      '[]',
      JSON.stringify([{ State: { Status: 'exited', Running: 'no', ExitCode: 0, OOMKilled: false } }]),
      JSON.stringify([{ State: { Status: 'exited', Running: false, ExitCode: 0.5, OOMKilled: false } }]),
    ];
    for (const inspectOut of badContainerOutputs) {
      const control: ProcessRunner = async (_binary, args) => {
        const key = args[0] === 'volume' ? `volume ${args[1]}` : args[0] === 'container' ? 'container inspect' : (args[0] ?? '');
        const out: Record<string, string> = {
          'volume create': 'vol123\n',
          create: containerId + '\n',
          'container inspect': inspectOut,
        };
        return ok({ exitCode: 0, stdout: Buffer.from(out[key] ?? ''), stderr: Buffer.alloc(0) });
      };
      const stream: StreamProcessRunner = async (_binary, args) => {
        let captured = null;
        if (args[0] === 'start') {
          const buffer = new OutputCaptureBuffer({ headBytes: 1024, tailBytes: 1024, streamBytes: 4096 });
          buffer.push(Buffer.from('hello'));
          captured = buffer.result();
        }
        return ok({
          exitCode: args[0] === 'start' ? 1 : 0,
          signal: null,
          stopReason: null,
          captured,
          stderr: new Uint8Array(0),
          durationMs: 1,
        });
      };
      const result = await runContainerExecution(
        {
          runtime,
          image,
          runId: 'local-20261003T101500Z-3f9a1c2e' as RecordRunId,
          runAttempt: 1,
          testNonce: 'n0nce',
          clock: steppingClock('2026-10-03T10:15:00.000Z', 1000),
          control,
          stream,
        },
        { entry, archivePath, checkout, limits, preparedCopyPath: null },
      );
      expect(result).toEqual({ kind: 'environment-failure', code: 'runner.inspect-invalid', subject: null });
    }
  });

  test('invariant 5: JUnit input is validated', () => {
    const enc = new TextEncoder();
    const inputs: Uint8Array[] = [
      enc.encode('<testsuites><testsuite name="s"><testcase name="t"'),
      enc.encode('<!DOCTYPE testsuites [<!ENTITY x "y">]><testsuites><testsuite><testcase name="&x;"/></testsuite></testsuites>'),
      Buffer.from([0xff, 0xfe]),
      Buffer.from([0xc3, 0x28]),
      enc.encode('<html><body><testcase name="t"/></body></html>'),
      enc.encode(''),
    ];
    for (const bytes of inputs) {
      let result: ReturnType<typeof parseJunitXml> | undefined;
      expect(() => {
        result = parseJunitXml(bytes, { maxCases: 1000 });
      }).not.toThrow();
      expect(result?.status).toBe('malformed');
    }
  });

  test('invariant 5: transport records are validated', () => {
    const binding: ExecutionTransportBinding = {
      run_id: 'local-20260928T101500Z-3f9a1c2e',
      run_attempt: 1,
      snapshot_hash: 'sha256:' + '5'.repeat(64),
      policy_revision: 'b'.repeat(40),
    };
    const head = 'a'.repeat(40);
    const planEntry = {
      id: 'head-test',
      kind: 'command',
      command_id: 'test',
      run: ['pnpm', 'test'],
      working_directory: '.',
      commit_role: 'head',
      commit: head,
      overlay: 'none',
      expected: 'exit-zero',
      network: 'none',
      result_files: [],
    };
    const run = { run_id: binding.run_id, run_attempt: binding.run_attempt };
    const planRecord = (): Record<string, unknown> => ({
      transport: 'execution-plan',
      transport_version: 1,
      run: { ...run },
      snapshot_hash: binding.snapshot_hash,
      policy_revision: binding.policy_revision,
      entries: [{ ...planEntry }],
      over_budget: false,
    });
    const completed = (part: string): Record<string, unknown> => ({
      kind: 'completed',
      entry_id: 'head-test',
      record: {
        schema_version: 1,
        record_type: 'execution-record',
        run_id: binding.run_id,
        run_attempt: 1,
        plan_entry: 'head-test',
        command: ['pnpm', 'test'],
        runner: 'container',
        environment: { image_digest: null, tool_versions: [] },
        exit: { code: 0, signal: null, timed_out: false },
        output: { head: 'h', tail: 't', truncated: false, total_bytes: 2, stored_path: null },
        result_files: [],
        test_identity: null,
        commits: { head, base: null, merge: null },
        admissibility: 'evidence',
      },
      output: { parts: [part], omitted_bytes: 0, trimmed_bytes: 0 },
      result_texts: [],
    });
    const resultsRecord = (results: unknown[]): Record<string, unknown> => ({
      transport: 'execution-results',
      transport_version: 1,
      run: { ...run },
      snapshot_hash: binding.snapshot_hash,
      policy_revision: binding.policy_revision,
      results,
      causes: [],
    });

    const plan = validateExecutionPlan(planRecord(), binding);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const boundPlan: ExecutionPlanTransport = plan.value;
    const check = (record: unknown) => validateExecutionResults(record, { binding, plan: boundPlan });
    const code = (result: { readonly ok: boolean; readonly failure?: { readonly code: string } }) =>
      result.ok ? null : (result.failure?.code ?? null);

    expect(check(resultsRecord([completed('ht')])).ok).toBe(true);

    expect(code(validateExecutionPlan({ ...planRecord(), extra: 1 }, binding))).toBe('pipeline.transport-invalid');
    expect(code(check({ ...resultsRecord([completed('ht')]), extra: 1 }))).toBe('pipeline.transport-invalid');
    expect(code(check(resultsRecord([{ ...completed('ht'), extra: 1 }])))).toBe('pipeline.transport-invalid');

    expect(code(validateExecutionPlan({ ...planRecord(), transport_version: 2 }, binding))).toBe('pipeline.transport-invalid');
    expect(code(check({ ...resultsRecord([completed('ht')]), transport_version: 2 }))).toBe('pipeline.transport-invalid');

    const otherRun = { run_id: binding.run_id, run_attempt: 2 };
    expect(code(validateExecutionPlan({ ...planRecord(), run: otherRun }, binding))).toBe('pipeline.transport-binding');
    expect(code(check({ ...resultsRecord([completed('ht')]), run: otherRun }))).toBe('pipeline.transport-binding');

    expect(code(check(resultsRecord([completed('a'.repeat(8388609))])))).toBe('pipeline.transport-invalid');
    expect(check(resultsRecord([completed('a'.repeat(8388608))])).ok).toBe(true);
  });
});

const temps: string[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) fs.rmSync(t, { recursive: true, force: true });
});
