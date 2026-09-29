import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { decideOutcome } from '../decision/table.js';
import { executionFailureCause, type ExecutionFailureCode } from '../execution/results.js';
import {
  createFixtureRepository,
  loadFixtureManifest,
  type FixtureRepository,
} from '../materialize/fixture-repository.fixture.test.js';
import { materializeCommit, materializeLimitsFromPolicy, type MaterializeLimits } from '../materialize/materialize.js';
import type { OverlayEntry } from '../materialize/paths.js';
import { DEFAULT_CHECKLIST_POLICY } from '../submission/default-checklist.js';

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
  expect(decision.kind === 'outcome' && decision.outcome === 'pass').toBe(false);
}

const defaultLimits = materializeLimitsFromPolicy(DEFAULT_CHECKLIST_POLICY);

describe('invariant 4: materialization failures never pass', { timeout: 120000 }, () => {
  let repo: FixtureRepository | undefined;

  beforeAll(() => {
    repo = createFixtureRepository(loadFixtureManifest('shell-sample.json'));
  });
  afterAll(() => {
    repo?.dispose();
  });

  async function failureCode(commit: string | null, overlay: readonly OverlayEntry[], limits: MaterializeLimits): Promise<string> {
    if (repo === undefined) throw new Error('fixture repository missing');
    const result = await materializeCommit({
      source: { kind: 'local-path', path: repo.dir },
      commit: commit ?? repo.commit,
      token: null,
      overlay,
      limits,
      hostEnv: { ...repo.env },
    });
    if (result.ok) {
      await result.value.dispose();
      throw new Error('expected a materialization failure');
    }
    return result.failure.code;
  }

  it('exit E4: a failed fetch is an environment failure', async () => {
    const code = await failureCode('9'.repeat(40), [], defaultLimits);
    expect(code).toBe('materialize.fetch-failed');
    expectEnvironmentFailure(code as ExecutionFailureCode);
  });

  it('exit E4: a rejected overlay is an environment failure', async () => {
    const overlay: OverlayEntry[] = [{ path: '../escape.txt', content: Buffer.from('x'), mode: '100644' }];
    const code = await failureCode(null, overlay, defaultLimits);
    expect(code).toBe('materialize.overlay-rejected');
    expectEnvironmentFailure(code as ExecutionFailureCode);
  });

  it('exit E4: an oversize checkout is an environment failure', async () => {
    const code = await failureCode(null, [], { ...defaultLimits, checkoutBytes: 1 });
    expect(code).toBe('materialize.checkout-too-large');
    expectEnvironmentFailure(code as ExecutionFailureCode);
  });
});
