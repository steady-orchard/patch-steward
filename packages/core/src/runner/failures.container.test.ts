import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildTarArchive } from '../archive/tar.js';
import { decideOutcome } from '../decision/table.js';
import { executionFailureCause, type ExecutionFailureCode } from '../execution/results.js';
import { openContainerHarness, RUNTIME_NAME, type ContainerHarness } from './container-harness.container.test.js';
import { selectContainerRuntime } from './runtime.js';
import { SHELL_TEST_IMAGE } from './test-images.test.js';

// A typed environment failure must lead to an inconclusive outcome, never a pass.
function expectEnvironmentFailure(code: ExecutionFailureCode): void {
  const cause = executionFailureCause(code);
  expect(cause).toBe('environment-unavailable');
  const decision = decideOutcome({
    freshness: 'current',
    capacity: 'available',
    admission: 'not-required',
    findings: [],
    causes: [{ cause, code, message: 'injected', subjects: [] }],
    requiredStages: [],
    stageResults: [],
    requirements: [],
  });
  expect(decision).toMatchObject({ kind: 'outcome', outcome: 'inconclusive' });
  expect(decision).not.toMatchObject({ kind: 'outcome', outcome: 'pass' });
}

describe('environment failures', () => {
  let harness: ContainerHarness;

  beforeAll(async () => {
    harness = await openContainerHarness();
  });

  afterAll(async () => {
    await harness.close();
  });

  it('exit E4: a missing image is an environment failure', async () => {
    const prepared = await harness.prepareImage('docker.io/library/busybox@sha256:' + '0'.repeat(64));
    expect(prepared.result.ok).toBe(false);
    if (prepared.result.ok) return;
    expect(prepared.result.failure.code).toBe('runner.image-pull-failed');
    expectEnvironmentFailure(prepared.result.failure.code);
  });

  it('exit E4: a failed image build is an environment failure', async () => {
    const archive = buildTarArchive([
      {
        path: 'Dockerfile',
        type: 'file',
        mode: 0o644,
        mtime: 0,
        content: new TextEncoder().encode(`FROM ${SHELL_TEST_IMAGE}\nRUN exit 3\n`),
      },
    ]);
    const prepared = await harness.prepareImage({
      source: 'dockerfile',
      context: { runnerTreeId: 'a'.repeat(40), dockerfilePath: 'Dockerfile', archive },
    });
    expect(prepared.result.ok).toBe(false);
    if (prepared.result.ok) return;
    expect(prepared.result.failure.code).toBe('runner.image-build-failed');
    expectEnvironmentFailure(prepared.result.failure.code);
  });

  it('exit E4: an oversize image is an environment failure', async () => {
    const prepared = await harness.prepareImage(SHELL_TEST_IMAGE, { imageBytes: 1 });
    expect(prepared.result.ok).toBe(false);
    if (prepared.result.ok) return;
    expect(prepared.result.failure.code).toBe('runner.image-too-large');
    expectEnvironmentFailure(prepared.result.failure.code);
  });

  it('exit E4: a missing entrypoint is an environment failure', async () => {
    const prepared = await harness.prepareImage(SHELL_TEST_IMAGE);
    expect(prepared.result.ok, JSON.stringify(prepared.result)).toBe(true);
    if (!prepared.result.ok) return;
    const checkout = await harness.materialize('shell-sample.json');
    const result = await harness.run({
      image: prepared.result.value,
      checkout,
      run: ['/patch-steward-no-such-binary'],
    });
    expect(result.kind, JSON.stringify(result)).toBe('environment-failure');
    if (result.kind !== 'environment-failure') return;
    expect(result.code).toBe('runner.start-failed');
    expectEnvironmentFailure(result.code);
  });

  it('exit E4: an absent runtime is an environment failure', async () => {
    const selected = await selectContainerRuntime({
      choice: RUNTIME_NAME,
      hostEnv: process.env,
      binaries: { [RUNTIME_NAME]: 'patch-steward-no-such-runtime' },
    });
    expect(selected.ok).toBe(false);
    if (selected.ok) return;
    expect(selected.failure.code).toBe('runner.runtime-unavailable');
    expectEnvironmentFailure(selected.failure.code);
  });
});
