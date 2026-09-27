import type { RunRecord } from '../records/run.js';
import type { SubmissionRecord } from '../records/submission.js';
import type { FindingRecord } from '../records/finding.js';
import type { DecisionRecord } from '../records/decision.js';
import type { PolicyRevisionRecord } from '../policy/revision-record.js';
import type { ResolvedPolicy } from '../policy/schema.js';
import type { ClassificationInput, ProvenanceInput } from '../report/templates.js';
import type { ReportInput, ReportFindingItem } from '../report/render.js';
import type { CheckSummaryInput } from '../report/summary.js';
import type { FindingTemplateContext } from '../report/finding-templates.js';
import { findingTexts } from '../report/finding-templates.js';
import { CONTRACT_FINDING_CODES } from '../submission/contract.js';
import type { ContractFindingCode } from '../submission/contract.js';
import { localEvidenceLocation } from './layout.js';
import type { Result } from '../result.js';
import { err, ok } from '../result.js';

export interface ReportRecordSources {
  readonly run: RunRecord;
  readonly submission: SubmissionRecord;
  readonly policyRevision: PolicyRevisionRecord;
  readonly findings: readonly FindingRecord[];
  readonly decision: DecisionRecord;
  readonly classification: ClassificationInput;
  readonly defaultBranch: string;
  readonly subjectTotals: readonly number[];
  readonly localRun: boolean;
  readonly storePath: string;
}

export type ReportInputFailureCode = 'report.template-missing';

export function findingTemplateContext(
  submission: SubmissionRecord,
  policy: ResolvedPolicy,
  defaultBranch: string,
): FindingTemplateContext {
  return {
    repository: submission.repository,
    defaultBranch,
    submissionType: submission.type,
    template: submission.template ?? null,
    category: submission.category,
    headCommit: submission.head_commit,
    policy,
    policyChange: submission.policy_change ?? null,
  };
}

export function paddedSubjects(stored: readonly string[], total: number): readonly string[] {
  if (total <= stored.length) {
    return stored;
  }
  return [...stored, ...new Array<string>(total - stored.length).fill('')];
}

function provenanceFor(revision: PolicyRevisionRecord['revision'], stewardVersion: string): ProvenanceInput {
  if (revision.kind === 'git-tree') {
    return {
      source: 'trusted-branch',
      policyRevision: revision.id,
      ref: revision.ref,
      commit: revision.commit,
      stewardVersion,
    };
  }
  return {
    source: 'local-file',
    policyRevision: revision.id,
    stewardVersion,
  };
}

export function buildReportInput(sources: ReportRecordSources): Result<ReportInput, ReportInputFailureCode> {
  const ctx = findingTemplateContext(sources.submission, sources.policyRevision.policy, sources.defaultBranch);

  const items: ReportFindingItem[] = [];
  for (let i = 0; i < sources.findings.length; i++) {
    const record = sources.findings[i] as FindingRecord;
    const code = record.code;
    if (code === undefined || !CONTRACT_FINDING_CODES.includes(code as ContractFindingCode)) {
      return err('report.template-missing', 'steward-defect', 'No report template matches the finding.');
    }
    const texts = findingTexts(
      {
        code: code as ContractFindingCode,
        detail: record.detail ?? null,
        field: record.location.field,
        subjects: paddedSubjects(record.subjects ?? [], sources.subjectTotals[i] ?? 0),
      },
      ctx,
    );
    if (!texts.ok) {
      return texts;
    }
    items.push({
      evidencePath: 'findings/' + record.finding_id + '.json',
      texts: texts.value,
      requestId: record.request_id ?? null,
      dismissalCode: record.dismissal_code,
    });
  }

  const header = {
    outcome: sources.decision.outcome,
    causes: (sources.decision.causes ?? []).map((c) => c.cause),
    repository: sources.submission.repository,
    submissionType: sources.submission.type,
    number: sources.submission.number,
    snapshotHash: sources.submission.snapshot_hash,
    targetBranch: sources.submission.target_branch,
    headCommit: sources.run.commits.head,
    baseCommit: sources.run.commits.base,
    policyRevision: sources.run.policy_revision,
    runId: sources.run.run_id,
    runAttempt: sources.run.run_attempt,
  };

  const provenance = provenanceFor(sources.policyRevision.revision, sources.run.steward_version);

  return ok({
    header,
    localRun: sources.localRun,
    classification: sources.classification,
    findings: items,
    causes: sources.decision.causes ?? [],
    executedCommands: [],
    references: [],
    flagged: [],
    maxFlagged: sources.policyRevision.policy.hygiene.max_flagged,
    provenance,
    evidenceLocation: localEvidenceLocation(sources.storePath),
  });
}

export function buildCheckSummaryInput(sources: ReportRecordSources): CheckSummaryInput {
  const provenance = provenanceFor(sources.policyRevision.revision, sources.run.steward_version);
  const blockers = sources.findings.filter((f) => f.severity === 'blocking').length;
  const uncertainties = sources.findings.filter((f) => f.severity === 'uncertain').length;
  const sharedHeadFinding = sources.findings.find((f) => f.code === 'submission.shared-head');

  return {
    outcome: sources.decision.outcome,
    repository: sources.submission.repository,
    submissionType: sources.submission.type,
    number: sources.submission.number,
    headCommit: sources.run.commits.head,
    snapshotHash: sources.submission.snapshot_hash,
    policyRevision: sources.run.policy_revision,
    policySource: provenance.source,
    localRun: sources.localRun,
    blockers,
    uncertainties,
    sharedHeadPullRequests: sharedHeadFinding?.subjects ?? [],
    evidenceLocation: sources.storePath,
  };
}
