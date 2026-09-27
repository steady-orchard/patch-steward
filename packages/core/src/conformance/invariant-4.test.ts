import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { RecordCause } from '../records/decision.js';
import type { FailureCause, PipelineStage } from '../vocabulary.js';
import { FAILURE_CAUSES, PIPELINE_STAGES } from '../vocabulary.js';
import type { HandoffPhase, HandoffRecord } from '../pipeline/handoff.js';
import type { PhaseFunction, PhaseImplementations, SequencePhase } from '../pipeline/phases.js';
import type { RunBinding, SequenceResult } from '../pipeline/sequence.js';
import { acceptGateHandoff, runPhaseSequence } from '../pipeline/sequence.js';
import { localDecisionInput } from '../pipeline/publish-phase.js';
import { initialBudget } from '../pipeline/budget.js';
import type { DecisionFinding, DecisionInput, DecisionRequirement, DecisionResult } from '../decision/table.js';
import { decideOutcome } from '../decision/table.js';
import type { StageResult } from '../decision/stages.js';
import { DEFAULT_CHECKLIST_POLICY } from '../submission/default-checklist.js';
import { fixedClock, fixedRandom } from '../clock.js';
import { err, ok } from '../result.js';
import type { Result } from '../result.js';
import type { GitHubFetch } from '../github/client.js';
import type { GitHubRepositoryRef } from '../github/reader.js';
import type { AttachmentAddress, AttachmentTransportResponse } from '../net/attachment-fetch.js';
import type { ScreenDeps, ScreenResult } from '../pipeline/screen.js';
import { screenSubmission } from '../pipeline/screen.js';
import type { EvidenceFs } from '../evidence/local-store.js';
import { nodeEvidenceFs } from '../evidence/local-store.js';
import type { EvidenceRedactFn } from '../evidence/redact-records.js';
import { redactTexts } from '../redaction/redact.js';
import { REPORT_TITLE } from '../report/templates.js';
import { REPORT_MAX_LENGTH } from '../policy/bounds.js';

const ARROW = '→';

const RUN_ID = 'local-20260927T101500Z-3f9a1c2e';
const SNAPSHOT = 'sha256:' + '5'.repeat(64);
const REVISION = 'b'.repeat(40);
const BINDING: RunBinding = { run_id: RUN_ID, run_attempt: 1, snapshot_hash: SNAPSHOT, policy_revision: REVISION };
const MAX_ROUNDS = 1;
const TIMEOUT_MS = 25;
const REQUIRED: readonly PipelineStage[] = [...PIPELINE_STAGES];

const ADVISORY = {
  stage: 'contract',
  severity: 'advisory' as const,
  code: 'submission.trusted-path-change',
  detail: null,
  field: null,
  subjects: ['.github/workflows/ci.yml'],
  message: 'Trusted paths changed.',
};

const GH_CAUSE: RecordCause = {
  cause: 'github-unavailable',
  code: 'github.server-error',
  message: 'The GitHub API responded with a server error.',
  subjects: [],
};

function stageOf(phase: HandoffPhase, round: number): PipelineStage {
  switch (phase) {
    case 'gate':
      return 'references';
    case 'intake':
      return 'claim';
    case 'execute':
      return round === 0 ? 'reproduction' : 'regression';
    case 'assess':
      return round === 0 ? 'fix-verification' : 'challenge';
  }
}

function gateCandidate(options: { readonly withCause: boolean }): Record<string, unknown> {
  return {
    handoff_version: 1,
    phase: 'gate',
    run: { run_id: RUN_ID, run_attempt: 1 },
    snapshot_hash: SNAPSHOT,
    policy_revision: REVISION,
    round: 0,
    budget_remaining: initialBudget(DEFAULT_CHECKLIST_POLICY, { githubRequests: 5 }),
    early_exit: null,
    findings: [
      {
        stage: ADVISORY.stage,
        severity: ADVISORY.severity,
        code: ADVISORY.code,
        detail: null,
        field: null,
        subjects: ADVISORY.subjects,
        message: ADVISORY.message,
      },
    ],
    causes: options.withCause ? [GH_CAUSE] : [],
    stage_results: [{ stage: 'references', status: 'complete' }],
    next_round_plan: null,
  };
}

async function controlIntake(previous: HandoffRecord): Promise<Result<unknown, string>> {
  return ok({
    ...previous,
    phase: 'intake',
    round: 0,
    next_round_plan: null,
    stage_results: [...previous.stage_results, { stage: stageOf('intake', 0), status: 'complete' as const }],
  });
}

async function controlExecute(previous: HandoffRecord): Promise<Result<unknown, string>> {
  const round = previous.phase === 'assess' ? previous.round + 1 : previous.round;
  return ok({
    ...previous,
    phase: 'execute',
    round,
    next_round_plan: null,
    stage_results: [...previous.stage_results, { stage: stageOf('execute', round), status: 'complete' as const }],
  });
}

async function controlAssess(previous: HandoffRecord): Promise<Result<unknown, string>> {
  const round = previous.round;
  return ok({
    ...previous,
    phase: 'assess',
    next_round_plan: round === 0 ? { reason: 'control round' } : null,
    stage_results: [...previous.stage_results, { stage: stageOf('assess', round), status: 'complete' as const }],
  });
}

type TransformInjection = {
  readonly kind: 'transform';
  readonly title: string;
  readonly transform: (candidate: Record<string, unknown>) => Record<string, unknown>;
};
type ThrowInjection = { readonly kind: 'throw'; readonly title: 'phase throws' };
type TimeoutInjection = { readonly kind: 'timeout'; readonly title: 'phase timeout' };
type TypedFailureInjection = { readonly kind: 'typed-failure'; readonly title: string; readonly cause: FailureCause };
type Injection = TransformInjection | ThrowInjection | TimeoutInjection | TypedFailureInjection;

const GATE_TRANSFORMS: readonly TransformInjection[] = [
  { kind: 'transform', title: 'handoff fails its schema', transform: (c) => ({ ...c, unexpected: true }) },
  {
    kind: 'transform',
    title: 'run mismatch',
    transform: (c) => ({ ...c, run: { ...(c.run as Record<string, unknown>), run_id: 'local-20260927T101500Z-00000000' } }),
  },
  {
    kind: 'transform',
    title: 'attempt mismatch',
    transform: (c) => ({ ...c, run: { ...(c.run as Record<string, unknown>), run_attempt: 2 } }),
  },
  { kind: 'transform', title: 'snapshot mismatch', transform: (c) => ({ ...c, snapshot_hash: 'sha256:' + '6'.repeat(64) }) },
  { kind: 'transform', title: 'policy revision mismatch', transform: (c) => ({ ...c, policy_revision: 'c'.repeat(40) }) },
  { kind: 'transform', title: 'round out of sequence', transform: (c) => ({ ...c, round: (c.round as number) + 1 }) },
  { kind: 'transform', title: 'round over the maximum', transform: (c) => ({ ...c, round: 3 }) },
  {
    kind: 'transform',
    title: 'budget negative',
    transform: (c) => ({ ...c, budget_remaining: { ...(c.budget_remaining as Record<string, unknown>), executions: -1 } }),
  },
  {
    kind: 'transform',
    title: 'required stage result missing',
    transform: (c) => ({ ...c, stage_results: (c.stage_results as readonly unknown[]).slice(0, -1) }),
  },
];

const NON_GATE_EXTRA_TRANSFORMS: readonly TransformInjection[] = [
  {
    kind: 'transform',
    title: 'budget increased',
    transform: (c) => {
      const budget = c.budget_remaining as Record<string, unknown>;
      return { ...c, budget_remaining: { ...budget, github_requests: (budget.github_requests as number) + 1 } };
    },
  },
  { kind: 'transform', title: 'findings dropped', transform: (c) => ({ ...c, findings: [] }) },
  { kind: 'transform', title: 'causes dropped', transform: (c) => ({ ...c, causes: [] }) },
];

const ROUND_REQUEST_INJECTION: TransformInjection = {
  kind: 'transform',
  title: 'round request beyond the maximum',
  transform: (c) => ({ ...c, next_round_plan: { reason: 'injected' } }),
};

const PHASE_THROWS: ThrowInjection = { kind: 'throw', title: 'phase throws' };
const PHASE_TIMEOUT: TimeoutInjection = { kind: 'timeout', title: 'phase timeout' };

const TYPED_FAILURES: readonly TypedFailureInjection[] = FAILURE_CAUSES.map((cause) => ({
  kind: 'typed-failure' as const,
  title: `phase returns a typed ${cause} failure`,
  cause,
}));

const NON_GATE_INJECTIONS: readonly Injection[] = [
  PHASE_THROWS,
  ...TYPED_FAILURES,
  ...GATE_TRANSFORMS,
  ...NON_GATE_EXTRA_TRANSFORMS,
  PHASE_TIMEOUT,
];

interface Boundary {
  readonly title: string;
  readonly target: { readonly phase: SequencePhase; readonly round: number } | null;
}

const GATE_BOUNDARY: Boundary = { title: `gate${ARROW}intake`, target: null };
const INTAKE_BOUNDARY: Boundary = { title: `intake${ARROW}execute`, target: { phase: 'intake', round: 0 } };
const EXECUTE_ASSESS_BOUNDARY: Boundary = { title: `execute${ARROW}assess`, target: { phase: 'execute', round: 0 } };
const ASSESS_EXECUTE1_BOUNDARY: Boundary = { title: `assess${ARROW}execute-1`, target: { phase: 'assess', round: 0 } };
const EXECUTE_N_ASSESS_N_BOUNDARY: Boundary = { title: `execute-N${ARROW}assess-N`, target: { phase: 'execute', round: 1 } };
const ASSESS_N_PUBLISH_BOUNDARY: Boundary = { title: `assess(-N)${ARROW}publish`, target: { phase: 'assess', round: 1 } };

const OTHER_BOUNDARIES: readonly Boundary[] = [
  INTAKE_BOUNDARY,
  EXECUTE_ASSESS_BOUNDARY,
  ASSESS_EXECUTE1_BOUNDARY,
  EXECUTE_N_ASSESS_N_BOUNDARY,
  ASSESS_N_PUBLISH_BOUNDARY,
];

function computeRound(name: SequencePhase, previous: HandoffRecord): number {
  if (name === 'intake') return 0;
  if (name === 'execute') return previous.phase === 'assess' ? previous.round + 1 : previous.round;
  return previous.round;
}

function wrapPhase(
  name: SequencePhase,
  control: PhaseFunction,
  target: { readonly phase: SequencePhase; readonly round: number } | null,
  injection: Injection | null,
): PhaseFunction {
  return async (previous, context) => {
    if (target === null || injection === null || target.phase !== name || computeRound(name, previous) !== target.round) {
      return control(previous, context);
    }
    if (injection.kind === 'throw') {
      throw new Error('injected');
    }
    if (injection.kind === 'timeout') {
      return new Promise<Result<unknown, string>>(() => undefined);
    }
    if (injection.kind === 'typed-failure') {
      return err('invariant4.injected', injection.cause, 'Injected failure.');
    }
    const base = await control(previous, context);
    if (!base.ok) {
      return base;
    }
    return ok(injection.transform(base.value as Record<string, unknown>));
  };
}

function phasesFor(
  target: { readonly phase: SequencePhase; readonly round: number } | null,
  injection: Injection | null,
): PhaseImplementations {
  return {
    intake: wrapPhase('intake', controlIntake, target, injection),
    execute: wrapPhase('execute', controlExecute, target, injection),
    assess: wrapPhase('assess', controlAssess, target, injection),
  };
}

type Harness =
  { readonly kind: 'no-run' } | { readonly kind: 'run'; readonly decision: DecisionResult; readonly sequence: SequenceResult };

async function runToDecision(
  gate: HandoffRecord,
  target: { readonly phase: SequencePhase; readonly round: number } | null,
  injection: Injection | null,
): Promise<Harness> {
  const sequence = await runPhaseSequence({
    gate,
    maxRounds: MAX_ROUNDS,
    timeoutMs: TIMEOUT_MS,
    policy: DEFAULT_CHECKLIST_POLICY,
    phases: phasesFor(target, injection),
    clock: fixedClock('2026-09-27T10:15:00.000Z'),
  });
  const findings: readonly DecisionFinding[] = sequence.last.findings.map((finding, index) => ({
    finding_id: 'finding-' + String(index + 1).padStart(4, '0'),
    stage: finding.stage,
    severity: finding.severity,
    code: finding.code,
    request: null,
  }));
  const decision = decideOutcome(localDecisionInput(sequence.last, sequence.causes, REQUIRED, findings));
  return { kind: 'run', decision, sequence };
}

async function runHarness(boundary: Boundary, injection: Injection): Promise<Harness> {
  if (boundary.target === null) {
    let candidate: unknown = gateCandidate({ withCause: false });
    if (injection.kind === 'transform') {
      candidate = injection.transform(candidate as Record<string, unknown>);
    }
    const accepted = acceptGateHandoff(candidate, BINDING, MAX_ROUNDS);
    if (!accepted.ok) {
      return { kind: 'no-run' };
    }
    return runToDecision(accepted.value, null, null);
  }

  const withCause = injection.title === 'causes dropped';
  const accepted = acceptGateHandoff(gateCandidate({ withCause }), BINDING, MAX_ROUNDS);
  if (!accepted.ok) {
    throw new Error('control gate candidate must be accepted');
  }
  return runToDecision(accepted.value, boundary.target, injection);
}

interface Row {
  readonly title: string;
  readonly boundary: Boundary;
  readonly injection: Injection;
  readonly checkCauses: boolean;
}

const ROWS: readonly Row[] = [
  ...GATE_TRANSFORMS.map((injection): Row => ({
    title: `invariant 4: ${GATE_BOUNDARY.title} ${injection.title} never yields pass`,
    boundary: GATE_BOUNDARY,
    injection,
    checkCauses: injection.title !== 'required stage result missing',
  })),
  ...OTHER_BOUNDARIES.flatMap((boundary) => {
    const injections: readonly Injection[] =
      boundary === ASSESS_N_PUBLISH_BOUNDARY ? [...NON_GATE_INJECTIONS, ROUND_REQUEST_INJECTION] : NON_GATE_INJECTIONS;
    return injections.map((injection): Row => ({
      title: `invariant 4: ${boundary.title} ${injection.title} never yields pass`,
      boundary,
      injection,
      checkCauses: injection.title !== 'required stage result missing',
    }));
  }),
];

describe('invariant 4: never pass on failure', () => {
  // it.each's default title formatting (`taskTitleValueFormatTruncate: 40`) truncates any interpolated string
  // longer than 40 characters, which would corrupt these titles; iterate the generated table directly instead
  // so every title is emitted verbatim.
  for (const row of ROWS) {
    it(row.title, async () => {
      const harness = await runHarness(row.boundary, row.injection);
      if (harness.kind === 'no-run') {
        expect(harness.kind).toBe('no-run');
        return;
      }
      expect(harness.decision.kind).toBe('outcome');
      if (harness.decision.kind !== 'outcome') {
        return;
      }
      expect(harness.decision.outcome).not.toBe('pass');
      if (row.checkCauses) {
        expect(harness.decision.causes.length).toBeGreaterThan(0);
      }
    });
  }

  it('invariant 4: the control run passes', async () => {
    const accepted = acceptGateHandoff(gateCandidate({ withCause: false }), BINDING, MAX_ROUNDS);
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    const harness = await runToDecision(accepted.value, null, null);
    expect(harness.kind).toBe('run');
    if (harness.kind !== 'run') return;
    expect(harness.decision.kind).toBe('outcome');
    if (harness.decision.kind !== 'outcome') return;
    expect(harness.decision.outcome).toBe('pass');
    expect(harness.decision.row).toBe(9);
    expect(harness.sequence.phases.map((phase) => phase.phase)).toEqual(['intake', 'execute', 'assess', 'execute-1', 'assess-1']);
    expect(harness.sequence.causes).toEqual([]);
  });

  it('invariant 4: pass only when row 9 holds', () => {
    const freshnessValues: readonly DecisionInput['freshness'][] = ['current', 'snapshot-changed', 'newer-owner'];
    const capacityValues: readonly DecisionInput['capacity'][] = ['available', 'cap-reached'];
    const admissionValues: readonly DecisionInput['admission'][] = ['not-required', 'admitted', 'required'];

    const findingsCases: readonly { readonly findings: readonly DecisionFinding[]; readonly ok: boolean }[] = [
      { findings: [], ok: true },
      { findings: [{ finding_id: 'f1', stage: 'x', severity: 'advisory', code: 'x', request: null }], ok: true },
      { findings: [{ finding_id: 'f1', stage: 'x', severity: 'speculative', code: 'x', request: null }], ok: true },
      { findings: [{ finding_id: 'f1', stage: 'x', severity: 'uncertain', code: 'x', request: null }], ok: false },
      { findings: [{ finding_id: 'f1', stage: 'contract', severity: 'blocking', code: 'x', request: null }], ok: false },
      { findings: [{ finding_id: 'f1', stage: 'claim', severity: 'blocking', code: 'x', request: null }], ok: false },
      {
        findings: [{ finding_id: 'f1', stage: 'other', severity: 'blocking', code: 'submission.shared-head', request: null }],
        ok: false,
      },
    ];

    const causesCases: readonly (readonly RecordCause[])[] = [[], [GH_CAUSE]];

    const stageCases: readonly { readonly results: readonly StageResult[]; readonly ok: boolean }[] = [
      {
        results: [
          { stage: 'references', status: 'complete' },
          { stage: 'claim', status: 'complete' },
        ],
        ok: true,
      },
      { results: [{ stage: 'references', status: 'complete' }], ok: false },
      {
        results: [
          { stage: 'references', status: 'complete' },
          { stage: 'claim', status: 'unavailable', cause: GH_CAUSE },
        ],
        ok: false,
      },
    ];

    const requirementsCases: readonly { readonly requirements: readonly DecisionRequirement[]; readonly ok: boolean }[] = [
      { requirements: [], ok: true },
      { requirements: [{ id: 'r', required: true, status: 'satisfied' }], ok: true },
      { requirements: [{ id: 'r', required: true, status: 'missing' }], ok: false },
      { requirements: [{ id: 'r', required: false, status: 'missing' }], ok: true },
      { requirements: [{ id: 'r', required: true, status: 'unavailable', cause: GH_CAUSE }], ok: false },
    ];

    let total = 0;
    let passing = 0;

    for (const freshness of freshnessValues) {
      for (const capacity of capacityValues) {
        for (const admission of admissionValues) {
          for (const findingsCase of findingsCases) {
            for (const causes of causesCases) {
              for (const stageCase of stageCases) {
                for (const requirementsCase of requirementsCases) {
                  total += 1;
                  const input: DecisionInput = {
                    freshness,
                    capacity,
                    admission,
                    findings: findingsCase.findings,
                    causes,
                    requiredStages: ['references', 'claim'],
                    stageResults: stageCase.results,
                    requirements: requirementsCase.requirements,
                  };
                  const result = decideOutcome(input);
                  const expectedPass =
                    freshness === 'current' &&
                    capacity === 'available' &&
                    admission !== 'required' &&
                    findingsCase.ok &&
                    causes.length === 0 &&
                    stageCase.ok &&
                    requirementsCase.ok;
                  const isPass = result.kind === 'outcome' && result.outcome === 'pass';
                  expect(isPass).toBe(expectedPass);
                  if (isPass) {
                    passing += 1;
                    if (result.kind === 'outcome') {
                      expect(result.row).toBe(9);
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    expect(total).toBe(3780);
    expect(passing).toBeGreaterThan(0);
  });
});

function makeInv4TmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'm5-inv4-'));
}

function removeInv4TmpDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

const INV4_REPOSITORY: GitHubRepositoryRef = { owner: 'octo', name: 'demo' };
const INV4_GATE_TIMEOUT_MS = 25;

function inv4GateDeps(gate: NonNullable<ScreenDeps['gate']>, evidenceDir: string, phaseTimeoutMs?: number): ScreenDeps {
  return {
    repository: INV4_REPOSITORY,
    submission: { type: 'issue', number: 5 },
    policySource: {
      kind: 'local-file',
      path: fileURLToPath(new URL('../../../../fixtures/policies/valid/minimal-no-llm.yml', import.meta.url)),
    },
    token: null,
    evidenceDir,
    sleep: async () => undefined,
    gate,
    ...(phaseTimeoutMs !== undefined ? { phaseTimeoutMs } : {}),
  };
}

async function inv4ExpectNoRun(gate: NonNullable<ScreenDeps['gate']>, phaseTimeoutMs?: number): Promise<void> {
  const tmp = makeInv4TmpDir();
  const evidenceDir = join(tmp, 'never-written');
  try {
    const result: ScreenResult = await screenSubmission(inv4GateDeps(gate, evidenceDir, phaseTimeoutMs));
    expect(result.kind).toBe('not-started');
    if (result.kind === 'not-started') {
      expect(result.exitStatus).toBe(2);
    }
    expect('published' in result).toBe(false);
    expect(existsSync(evidenceDir)).toBe(false);
  } finally {
    removeInv4TmpDir(tmp);
  }
}

describe('invariant 4: gate phase failures', { timeout: 60000 }, () => {
  it(`invariant 4: gate${ARROW}intake phase throws never yields pass`, async () => {
    await inv4ExpectNoRun(async () => {
      throw new Error('injected');
    });
  });

  for (const cause of FAILURE_CAUSES) {
    it(`invariant 4: gate${ARROW}intake phase returns a typed ${cause} failure never yields pass`, async () => {
      await inv4ExpectNoRun(async () => ({
        ok: false,
        stage: 'capture',
        failure: err('invariant4.injected', cause, 'Injected failure.').failure,
        repository: null,
        loadedPolicy: null,
      }));
    });
  }

  it(`invariant 4: gate${ARROW}intake phase timeout never yields pass`, async () => {
    await inv4ExpectNoRun(() => new Promise(() => undefined), INV4_GATE_TIMEOUT_MS);
  });
});

function inv4DefectBody(): string {
  return readFileSync(new URL('../../../../fixtures/submissions/defect-complete.txt', import.meta.url), 'utf8').replace(
    /\r\n/g,
    '\n',
  );
}

function inv4PolicyPath(): string {
  return fileURLToPath(new URL('../../../../fixtures/policies/valid/minimal-no-llm.yml', import.meta.url));
}

function inv4Fetch(): GitHubFetch {
  const routes: Record<string, unknown> = {
    '/repos/octo/demo': { full_name: 'octo/demo', default_branch: 'main', private: false },
    '/repos/octo/demo/issues/5': {
      number: 5,
      title: 't',
      body: inv4DefectBody(),
      state: 'open',
      user: null,
      author_association: 'NONE',
    },
  };
  return (url: string) => {
    const pathname = new URL(url).pathname;
    if (!(pathname in routes)) {
      return Promise.resolve(new Response('{}', { status: 404 }));
    }
    return Promise.resolve(new Response(JSON.stringify(routes[pathname]), { status: 200 }));
  };
}

function inv4CommonDeps(evidenceDir: string, overrides: Partial<ScreenDeps> = {}): ScreenDeps {
  return {
    repository: INV4_REPOSITORY,
    submission: { type: 'issue', number: 5 },
    policySource: { kind: 'local-file', path: inv4PolicyPath() },
    token: null,
    evidenceDir,
    fetch: inv4Fetch(),
    sleep: async () => undefined,
    attachmentResolver: async (): Promise<readonly AttachmentAddress[]> => [{ address: '140.82.112.3', family: 4 }],
    attachmentTransport: async (): Promise<AttachmentTransportResponse> => ({ kind: 'error', reason: 'network' }),
    clock: fixedClock('2026-09-27T10:15:00.000Z'),
    random: fixedRandom('3f9a1c2e'),
    ...overrides,
  };
}

function inv4HasManifestAnywhere(dir: string): boolean {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return false;
  const entries = readdirSync(dir, { recursive: true }) as readonly string[];
  return entries.some((entry) => entry.endsWith('manifest.json'));
}

function inv4AssertNoRunLeftovers(dir: string): void {
  expect(existsSync(join(dir, 'octo', 'demo', 'runs', 'issue-5', RUN_ID))).toBe(false);
  expect(existsSync(join(dir, 'octo', 'demo', 'runs', '.staging', RUN_ID))).toBe(false);
  expect(existsSync(join(dir, 'octo', 'demo', 'metrics', '2026-09', RUN_ID + '.json'))).toBe(false);
  expect(inv4HasManifestAnywhere(dir)).toBe(false);
}

async function inv4ExpectPublishFailed(overrides: Partial<ScreenDeps>, expectedCode: string): Promise<void> {
  const tmp = makeInv4TmpDir();
  try {
    const result: ScreenResult = await screenSubmission(inv4CommonDeps(tmp, overrides));
    expect(result.kind).toBe('publish-failed');
    if (result.kind === 'publish-failed') {
      expect(result.exitStatus).toBe(2);
      expect(result.failure.code).toBe('screen.evidence-write-failed');
      expect(result.failure.details[0]?.code).toBe(expectedCode);
    }
    expect('published' in result).toBe(false);
    inv4AssertNoRunLeftovers(tmp);
  } finally {
    removeInv4TmpDir(tmp);
  }
}

function inv4CapGuardRedact(): EvidenceRedactFn {
  return async (inputs, options) => {
    const result = await redactTexts(inputs, options);
    if (!result.ok) return result;
    if (inputs.length === 2 && (inputs[0] as string).startsWith(REPORT_TITLE)) {
      const texts = [...result.value.texts];
      texts[0] = (texts[0] as string) + 'x'.repeat(REPORT_MAX_LENGTH + 1);
      return ok({ ...result.value, texts });
    }
    return result;
  };
}

function inv4SchemaBreakRedact(): EvidenceRedactFn {
  return async (inputs, options) => {
    const result = await redactTexts(inputs, options);
    if (!result.ok) return result;
    const texts = result.value.texts.map((text) => (text === RUN_ID ? '[REDACTED:injected]' : text));
    return ok({ ...result.value, texts });
  };
}

function inv4FailingFs(shouldFail: (path: string) => boolean): EvidenceFs {
  return {
    ...nodeEvidenceFs,
    writeFileExclusive: async (path: string, data: Uint8Array): Promise<void> => {
      if (shouldFail(path)) {
        throw Object.assign(new Error('injected'), { code: 'EIO' });
      }
      return nodeEvidenceFs.writeFileExclusive(path, data);
    },
  };
}

function inv4RenameFailingFs(): EvidenceFs {
  return {
    ...nodeEvidenceFs,
    rename: async (): Promise<void> => {
      throw Object.assign(new Error('injected'), { code: 'EIO' });
    },
  };
}

interface Inv4PublishRow {
  readonly step: string;
  readonly expectedCode: string;
  readonly overrides: Partial<ScreenDeps>;
}

const INV4_PUBLISH_ROWS: readonly Inv4PublishRow[] = [
  {
    step: 'decision',
    expectedCode: 'pipeline.decision-invalid',
    overrides: {
      decide: () => {
        throw new Error('injected');
      },
    },
  },
  {
    step: 'render',
    expectedCode: 'report.template-missing',
    overrides: {
      phases: {
        intake: async (previous: HandoffRecord): Promise<Result<unknown, string>> =>
          ok({
            ...previous,
            phase: 'intake',
            round: 0,
            next_round_plan: null,
            findings: [
              ...previous.findings,
              {
                stage: 'intake',
                severity: 'blocking',
                code: 'stage.unknown',
                detail: null,
                field: null,
                subjects: [],
                message: 'Injected finding.',
              },
            ],
          }),
      },
    },
  },
  { step: 'cap guard', expectedCode: 'report.too-large', overrides: { evidence: { redact: inv4CapGuardRedact() } } },
  {
    step: 'redaction',
    expectedCode: 'redaction.failed',
    overrides: { evidence: { redact: async () => err('redaction.failed', 'steward-defect', 'Injected.') } },
  },
  {
    step: 'redaction timeout',
    expectedCode: 'redaction.timeout',
    overrides: { evidence: { redact: async () => err('redaction.timeout', 'infrastructure', 'Injected.') } },
  },
  {
    step: 'schema re-validation',
    expectedCode: 'evidence.redaction-invalidated',
    overrides: { evidence: { redact: inv4SchemaBreakRedact() } },
  },
  {
    step: 'file write',
    expectedCode: 'evidence.write-failed',
    overrides: { evidence: { fs: inv4FailingFs((path) => path.endsWith('run.json')) } },
  },
  {
    step: 'metrics write',
    expectedCode: 'evidence.write-failed',
    overrides: { evidence: { fs: inv4FailingFs((path) => path.includes(sep + 'metrics' + sep)) } },
  },
  {
    step: 'manifest write',
    expectedCode: 'evidence.write-failed',
    overrides: { evidence: { fs: inv4FailingFs((path) => path.endsWith('manifest.json')) } },
  },
  { step: 'commit rename', expectedCode: 'evidence.write-failed', overrides: { evidence: { fs: inv4RenameFailingFs() } } },
];

describe('invariant 4: publish failures', { timeout: 60000 }, () => {
  for (const row of INV4_PUBLISH_ROWS) {
    it(`invariant 4: publish ${row.step} failure yields no report`, async () => {
      await inv4ExpectPublishFailed(row.overrides, row.expectedCode);
    });
  }

  it('invariant 4: failed evidence write yields no report', async () => {
    const tmp = makeInv4TmpDir();
    try {
      const evidenceDir = join(tmp, 'not-a-directory');
      writeFileSync(evidenceDir, '');
      const result: ScreenResult = await screenSubmission(inv4CommonDeps(evidenceDir));
      expect(result.kind).toBe('publish-failed');
      if (result.kind === 'publish-failed') {
        expect(result.exitStatus).toBe(2);
        expect(result.failure.code).toBe('screen.evidence-write-failed');
        expect(result.failure.details[0]?.code).toBe('evidence.write-failed');
      }
      expect('published' in result).toBe(false);
      inv4AssertNoRunLeftovers(evidenceDir);
    } finally {
      removeInv4TmpDir(tmp);
    }
  });
});
