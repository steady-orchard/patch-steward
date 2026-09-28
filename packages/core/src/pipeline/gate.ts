import type { FailureDetail, Result, StewardFailure } from '../result.js';
import { err } from '../result.js';
import type { GitHubFetch } from '../github/client.js';
import { createGitHubClient } from '../github/client.js';
import { githubBudgetForPolicy, githubBudgetForPreflight } from '../github/budget.js';
import type { GitHubRepositoryRef } from '../github/reader.js';
import { readRepository } from '../github/reader.js';
import type { LoadedPolicy } from '../policy/loader.js';
import { loadPolicy } from '../policy/loader.js';
import { RECORD_LIST_MAX_ITEMS } from '../policy/bounds.js';
import type { CaptureContext, CaptureFailureCode } from '../submission/intake.js';
import { buildSubmissionRecord, captureIssue, capturePullRequest } from '../submission/intake.js';
import type { ContractResult } from '../submission/contract.js';
import type { AttachmentResolver, AttachmentTransport } from '../net/attachment-fetch.js';
import type { IssueKind, Mode, PipelineStage, SubmissionType } from '../vocabulary.js';
import type { SubmissionRecord } from '../records/submission.js';
import type { RequiredStagesInput } from '../decision/stages.js';
import { requiredStages } from '../decision/stages.js';
import type { BudgetRemaining } from './budget.js';
import { initialBudget } from './budget.js';
import type { HandoffFinding } from './handoff.js';
import { HANDOFF_VERSION } from './handoff.js';
import type { ClassificationInput } from '../report/templates.js';
import type { Clock } from '../clock.js';
import type { RecordCause } from '../records/decision.js';

export type ScreenPolicySource = { readonly kind: 'trusted-branch' } | { readonly kind: 'local-file'; readonly path: string };

export const SCREEN_POLICY_FAILURE_CODES = [
  'screen.policy-missing',
  'screen.policy-invalid',
  'screen.policy-file-invalid',
] as const;
export type ScreenPolicyFailureCode = (typeof SCREEN_POLICY_FAILURE_CODES)[number];

export interface GateInput {
  readonly repository: GitHubRepositoryRef;
  readonly submission: { readonly type: SubmissionType; readonly number: number };
  readonly policySource: ScreenPolicySource;
  readonly token: string | null;
  readonly fetch?: GitHubFetch;
  readonly sleep: (ms: number) => Promise<void>;
  readonly attachmentResolver: AttachmentResolver;
  readonly attachmentTransport: AttachmentTransport;
  readonly run: { readonly run_id: string; readonly run_attempt: number };
  readonly clock: Clock;
}

export interface GateOutput {
  readonly handoff: unknown;
  readonly repository: string;
  readonly defaultBranch: string;
  readonly loadedPolicy: LoadedPolicy;
  readonly policyLoadedAt: string;
  readonly submission: SubmissionRecord;
  readonly baseCommit: string | null;
  readonly mode: Mode;
  readonly classification: ClassificationInput;
  readonly requiredStages: readonly PipelineStage[];
  readonly githubRequests: number;
  readonly logLines: readonly string[];
}

export interface GateCapture {
  readonly submission: SubmissionRecord;
  readonly contract: ContractResult;
  readonly classification: ClassificationInput;
  readonly baseCommit: string | null;
  readonly issueKind: IssueKind | null;
  readonly findings: readonly HandoffFinding[];
  readonly causes: readonly RecordCause[];
  readonly requiredStages: readonly PipelineStage[];
  readonly earlyExit: 'contract-needs-changes' | 'contract-inconclusive' | null;
  readonly mode: Mode;
}

export async function gateCaptureSubmission(
  context: CaptureContext,
  submission: { readonly type: SubmissionType; readonly number: number },
): Promise<Result<GateCapture, CaptureFailureCode>> {
  let record: SubmissionRecord;
  let contract: ContractResult;
  let classification: ClassificationInput;
  let baseCommit: string | null;
  let issueKind: IssueKind | null;

  if (submission.type === 'issue') {
    const captureResult = await captureIssue(context, submission.number);
    if (!captureResult.ok) {
      return captureResult;
    }
    const capture = captureResult.value;
    if (capture.record !== null) {
      record = capture.record;
    } else {
      const recordResult = buildSubmissionRecord({
        snapshot: capture.snapshot,
        issueKind: null,
        body: capture.body,
        contract: capture.contract,
        attachments: capture.attachments,
        claimScopeHash: null,
      });
      if (!recordResult.ok) {
        return recordResult;
      }
      record = recordResult.value;
    }
    contract = capture.contract;
    issueKind = capture.issueKind;
    classification = { type: 'issue', issueKind: capture.issueKind };
    baseCommit = null;
  } else {
    const captureResult = await capturePullRequest(context, submission.number);
    if (!captureResult.ok) {
      return captureResult;
    }
    const capture = captureResult.value;
    record = capture.record;
    contract = capture.contract;
    issueKind = null;
    classification = {
      type: 'pull_request',
      category: contract.category,
      consistent: contract.category !== null && !contract.findings.some((f) => f.code === 'submission.category-mismatch'),
      plausible: contract.plausible_categories,
    };
    baseCommit = capture.snapshot.base_commit;
  }

  const findings: HandoffFinding[] = contract.findings.map((finding) => ({
    stage: 'contract',
    severity: finding.severity,
    code: finding.code,
    detail: finding.detail,
    field: finding.field,
    subjects: [...finding.subjects],
    message: finding.message,
  }));
  const causes = contract.inconclusive.map((cause) => ({
    cause: cause.cause,
    code: cause.code,
    message: cause.message,
    subjects: cause.subjects.slice(0, RECORD_LIST_MAX_ITEMS),
  }));

  const requiredStagesInput: RequiredStagesInput =
    submission.type === 'issue'
      ? { type: 'issue', issueKind }
      : { type: 'pull_request', plausibleCategories: contract.plausible_categories };
  const stages = requiredStages(requiredStagesInput, context.policy.stages.per_category);

  const earlyExit: 'contract-needs-changes' | 'contract-inconclusive' | null =
    contract.disposition === 'needs-changes'
      ? 'contract-needs-changes'
      : contract.disposition === 'inconclusive'
        ? 'contract-inconclusive'
        : null;

  return {
    ok: true,
    value: {
      submission: record,
      contract,
      classification,
      baseCommit,
      issueKind,
      findings,
      causes,
      requiredStages: stages,
      earlyExit,
      mode: contract.effective_mode,
    },
  };
}

export interface GateHandoffInput {
  readonly run: { readonly run_id: string | number; readonly run_attempt: number };
  readonly policyRevision: string;
  readonly budgetRemaining: BudgetRemaining;
}

export function buildGateHandoff(capture: GateCapture, input: GateHandoffInput): unknown {
  return {
    handoff_version: HANDOFF_VERSION,
    phase: 'gate',
    run: { run_id: input.run.run_id, run_attempt: input.run.run_attempt },
    snapshot_hash: capture.submission.snapshot_hash,
    policy_revision: input.policyRevision,
    round: 0,
    budget_remaining: input.budgetRemaining,
    early_exit: capture.earlyExit,
    findings: capture.findings,
    causes: capture.causes,
    stage_results: [],
    next_round_plan: null,
  };
}

export function gateContractLogLines(capture: GateCapture): readonly string[] {
  return [
    `contract disposition ${capture.contract.disposition}`,
    ...capture.contract.warnings.map((warning) => `warning ${warning.code}`),
    ...capture.causes.map((cause) => `cause ${cause.cause} ${cause.code} at gate`),
  ];
}

export type GateFailureStage = 'repository' | 'policy' | 'capture';

export type GateResult =
  | { readonly ok: true; readonly value: GateOutput }
  | {
      readonly ok: false;
      readonly stage: GateFailureStage;
      readonly failure: StewardFailure;
      readonly repository: string | null;
      readonly loadedPolicy: LoadedPolicy | null;
    };

function detailsOf(failure: StewardFailure): readonly FailureDetail[] {
  return failure.details.length > 0
    ? failure.details
    : [{ code: failure.code, path: '', message: failure.message, line: null, column: null }];
}

export async function runGate(input: GateInput): Promise<GateResult> {
  const bootstrapBudget = githubBudgetForPreflight();
  const bootstrap = createGitHubClient({
    token: input.token,
    budget: bootstrapBudget,
    sleep: input.sleep,
    ...(input.fetch !== undefined ? { fetch: input.fetch } : {}),
  });

  const repoResult = await readRepository(bootstrap, input.repository);
  if (!repoResult.ok) {
    return { ok: false, stage: 'repository', failure: repoResult.failure, repository: null, loadedPolicy: null };
  }
  const repo = repoResult.value;

  const loadedResult: Result<LoadedPolicy, string> =
    input.policySource.kind === 'trusted-branch'
      ? await loadPolicy({ kind: 'github', client: bootstrap, repository: input.repository, branch: repo.defaultBranch })
      : await loadPolicy({ kind: 'file', path: input.policySource.path });

  const policyLoadedAt = input.clock.now().toISOString();

  if (!loadedResult.ok) {
    const failure = loadedResult.failure;
    let mapped: StewardFailure;
    if (input.policySource.kind === 'trusted-branch') {
      if (failure.code === 'policy-source.not-published') {
        mapped = err(
          'screen.policy-missing',
          'policy-unavailable',
          'The repository has no published policy on its default branch.',
        ).failure;
      } else if (failure.cause === 'policy-invalid') {
        mapped = err(
          'screen.policy-invalid',
          'policy-invalid',
          'The published policy on the default branch is invalid.',
          detailsOf(failure),
        ).failure;
      } else {
        mapped = failure;
      }
    } else {
      if (failure.cause === 'policy-invalid') {
        mapped = err('screen.policy-file-invalid', 'policy-invalid', 'The policy file is invalid.', detailsOf(failure)).failure;
      } else {
        mapped = failure;
      }
    }
    return { ok: false, stage: 'policy', failure: mapped, repository: repo.fullName, loadedPolicy: null };
  }
  const loaded = loadedResult.value;
  const policy = loaded.policy;

  const runBudget = githubBudgetForPolicy(policy);
  const client = createGitHubClient({
    token: input.token,
    budget: runBudget,
    sleep: input.sleep,
    ...(input.fetch !== undefined ? { fetch: input.fetch } : {}),
  });

  const captureContext: CaptureContext = {
    client,
    repository: input.repository,
    policy,
    policyRevision: loaded.revision.id,
    attachmentResolver: input.attachmentResolver,
    attachmentTransport: input.attachmentTransport,
    authorResponses: [],
  };

  const captureResult = await gateCaptureSubmission(captureContext, input.submission);
  if (!captureResult.ok) {
    return { ok: false, stage: 'capture', failure: captureResult.failure, repository: repo.fullName, loadedPolicy: loaded };
  }
  const capture = captureResult.value;

  const handoff = buildGateHandoff(capture, {
    run: input.run,
    policyRevision: loaded.revision.id,
    budgetRemaining: initialBudget(policy, { githubRequests: runBudget.requestsUsed() }),
  });

  const sourceLabel = input.policySource.kind === 'trusted-branch' ? 'trusted-branch' : 'local-file';
  const logLines: string[] = [`policy ${sourceLabel} revision ${loaded.revision.id}`, ...gateContractLogLines(capture)];

  return {
    ok: true,
    value: {
      handoff,
      repository: repo.fullName,
      defaultBranch: repo.defaultBranch,
      loadedPolicy: loaded,
      policyLoadedAt,
      submission: capture.submission,
      baseCommit: capture.baseCommit,
      mode: capture.mode,
      classification: capture.classification,
      requiredStages: capture.requiredStages,
      githubRequests: bootstrapBudget.requestsUsed() + runBudget.requestsUsed(),
      logLines,
    },
  };
}
