import { randomBytes } from 'node:crypto';
import os from 'node:os';
import { describe, expect, it } from 'vitest';
import { systemClock } from '../clock.js';
import type { ExecutionPlanEntry } from '../execution/plan.js';
import { executionResultEntrySchema } from '../execution/transport.js';
import { createFixtureRepository, loadFixtureManifest } from '../materialize/fixture-repository.fixture.test.js';
import { materializeCommit, materializeLimitsFromPolicy } from '../materialize/materialize.js';
import { runProcess, type ProcessRunner } from '../process/run-process.js';
import { streamProcess, type StreamProcessRunner } from '../process/stream-process.js';
import { executionRecordSchema } from '../records/execution-record.js';
import { DEFAULT_CHECKLIST_POLICY } from '../submission/default-checklist.js';
import { forbiddenRuntimeArguments } from './argv.js';
import { containerLimitsFromPolicy, runContainerExecution } from './container.js';
import { imageLimitsFromPolicy, prepareRunnerImage } from './image.js';
import { selectContainerRuntime } from './runtime.js';
import { SHELL_TEST_IMAGE } from './test-images.test.js';

const runtimeName = process.env['STEWARD_CONTAINER_RUNTIME'] ?? 'docker';
if (runtimeName !== 'docker' && runtimeName !== 'podman') {
  throw new Error(`STEWARD_CONTAINER_RUNTIME must be docker or podman, got ${runtimeName}`);
}

describe('container runner', () => {
  it('runs one hardened container execution', async () => {
    const nonce = randomBytes(6).toString('hex');
    const calls: string[][] = [];
    const control: ProcessRunner = (b, a, o) => {
      calls.push([...a]);
      return runProcess(b, a, o);
    };
    const stream: StreamProcessRunner = (b, a, o) => {
      calls.push([...a]);
      return streamProcess(b, a, o);
    };

    const runtime = await selectContainerRuntime({ choice: runtimeName, hostEnv: process.env, control });
    expect(runtime.ok, JSON.stringify(runtime)).toBe(true);
    if (!runtime.ok) return;
    const selected = runtime.value;

    const repo = createFixtureRepository(loadFixtureManifest('shell-sample.json'));
    let dispose: (() => void) | null = null;
    try {
      const prepared = await prepareRunnerImage(
        { runtime: selected, testNonce: nonce, control, stream, runId: 'local-20261003T101500Z-' + nonce.slice(0, 8) },
        { source: 'registry', reference: SHELL_TEST_IMAGE },
        imageLimitsFromPolicy(DEFAULT_CHECKLIST_POLICY),
      );
      expect(prepared.result.ok, JSON.stringify(prepared.result)).toBe(true);
      if (!prepared.result.ok) return;
      const image = prepared.result.value;
      expect(image.digest).toBe('sha256:' + SHELL_TEST_IMAGE.split('sha256:')[1]);

      const materialized = await materializeCommit({
        source: { kind: 'local-path', path: repo.dir },
        commit: repo.commit,
        token: null,
        overlay: [],
        limits: materializeLimitsFromPolicy(DEFAULT_CHECKLIST_POLICY),
        hostEnv: process.env,
      });
      expect(materialized.ok, JSON.stringify(materialized)).toBe(true);
      if (!materialized.ok) return;
      dispose = () => materialized.value.dispose();

      const limits = {
        ...containerLimitsFromPolicy(DEFAULT_CHECKLIST_POLICY),
        executionSeconds: 120,
        cpus: 1,
        memoryMb: 512,
        pids: 128,
        scratchMb: 64,
      };
      const entry: ExecutionPlanEntry = {
        id: 'head-test',
        kind: 'command',
        command_id: 'test',
        run: ['sh', 'run.sh'],
        working_directory: '.',
        commit_role: 'head',
        commit: repo.commit,
        overlay: 'none',
        expected: 'exit-zero',
        network: 'none',
        result_files: [
          { path: 'reports/junit.xml', format: 'junit-xml' },
          { path: 'missing.xml', format: 'junit-xml' },
        ],
      };
      const result = await runContainerExecution(
        {
          runtime: selected,
          image,
          runId: 'local-20261003T101500Z-' + nonce.slice(0, 8),
          runAttempt: 1,
          testNonce: nonce,
          clock: systemClock,
          control,
          stream,
        },
        {
          entry,
          archivePath: materialized.value.archivePath,
          checkout: {
            ...materialized.value.checkout,
            overlays: materialized.value.checkout.overlays.map((o) => ({ ...o })),
            skipped_submodules: [...materialized.value.checkout.skipped_submodules],
          },
          limits,
          preparedCopyPath: null,
        },
      );
      expect(result.kind, JSON.stringify(result)).toBe('completed');
      if (result.kind !== 'completed') return;
      const { execution } = result;
      const record = execution.record;
      expect(record.exit.code).toBe(3);
      expect(record.exit.timed_out).toBe(false);
      const output = record.output.head + record.output.tail;
      expect(output).toContain('hello from the sandbox');
      expect(output).toContain('65532');
      expect(record.result_files[0]?.status).toBe('parsed');
      expect(record.result_files[0]?.junit?.tests).toBe(1);
      expect(record.result_files[0]?.junit?.passed).toBe(1);
      expect(record.result_files[1]?.status).toBe('missing');
      expect(record.admissibility).toBe('evidence');
      expect(record.environment.runtime?.name).toBe(runtimeName);
      expect(executionRecordSchema.safeParse(record).success).toBe(true);
      expect(executionResultEntrySchema.safeParse(execution).success).toBe(true);
      for (const args of calls) expect(forbiddenRuntimeArguments(args)).toEqual([]);
    } finally {
      dispose?.();
      repo.dispose();
      const label = 'label=org.patch-steward.test=' + nonce;
      for (const args of [
        ['ps', '-a', '-q', '--filter', label],
        ['volume', 'ls', '-q', '--filter', label],
        ['image', 'ls', '-q', '--filter', label],
      ]) {
        const res = await runProcess(selected.binary, args, {
          cwd: os.tmpdir(),
          env: selected.env,
          timeoutMs: 120000,
          maxOutputBytes: 1048576,
        });
        expect(res.ok, JSON.stringify(res)).toBe(true);
        if (res.ok) {
          expect(res.value.exitCode).toBe(0);
          expect(res.value.stdout.toString('utf8').trim()).toBe('');
        }
      }
    }
  });
});
