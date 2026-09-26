import type { ResolvedPolicy } from '../policy/schema.js';
import type { GitHubClient, GitHubFailureCode } from '../github/client.js';
import { githubFailure } from '../github/client.js';
import type { GitHubRepositoryRef } from '../github/reader.js';
import {
  readIssue,
  readOpenPullRequestsForCommit,
  readPullRequest,
  readPullRequestFiles,
  readRepository,
  repositoryRefFromFullName,
} from '../github/reader.js';
import type { AttachmentResolver, AttachmentTransport } from '../net/attachment-fetch.js';
import type { IssueKind } from '../vocabulary.js';
import type { Result } from '../result.js';
import { err, ok } from '../result.js';
import { contentHash } from '../hash.js';
import type { ContentHash } from '../hash.js';
import { SUBMISSION_FIELD_IDS } from '../submission-fields.js';
import type { ParsedSubmissionBody, BodyParseFailureCode } from './parse.js';
import { parseIssueBody, parsePullRequestBody } from './parse.js';
import type { AttachmentAssessmentSet } from './attachments.js';
import { assessAttachmentsStatically } from './attachments.js';
import { fetchSubmissionAttachments } from './attachment-fetching.js';
import { readProposedPolicyFromGitHub } from './proposed-policy.js';
import type { ContractRepository, ContractResult, LinkedIssueCheck, ProposedPolicyCheck, SharedHeadCheck } from './contract.js';
import { checkContract, contractRequiredFields, linkedIssueReference } from './contract.js';
import { changedPathSet, detectPathFlags } from './paths.js';
import type { ClaimScope, ClaimScopeFieldId, ClaimScopeFieldState } from './normalize.js';
import { CLAIM_SCOPE_FIELD_IDS, computeClaimScope } from './normalize.js';
import type { Snapshot, IssueSnapshot, PullRequestSnapshot, SnapshotAuthorResponseInput, SnapshotFailureCode } from './snapshot.js';
import { attachmentUrlSchema, buildIssueSnapshot, buildPullRequestSnapshot, snapshotHash } from './snapshot.js';
import type { SubmissionRecord } from '../records/submission.js';
import { submissionRecordSchema } from '../records/submission.js';

export interface CaptureContext {
  readonly client: GitHubClient;
  readonly repository: GitHubRepositoryRef;
  readonly policy: ResolvedPolicy;
  readonly policyRevision: string;
  readonly attachmentResolver: AttachmentResolver;
  readonly attachmentTransport: AttachmentTransport;
  readonly authorResponses: readonly SnapshotAuthorResponseInput[];
}

export type SubmissionRecordFailureCode = 'intake.record-invalid';

export type CaptureFailureCode = GitHubFailureCode | BodyParseFailureCode | SnapshotFailureCode | SubmissionRecordFailureCode;

export interface IssueCapture {
  readonly type: 'issue';
  readonly issueKind: IssueKind | null;
  readonly body: ParsedSubmissionBody;
  readonly attachments: AttachmentAssessmentSet;
  readonly contract: ContractResult;
  readonly snapshot: IssueSnapshot;
  readonly snapshotHash: ContentHash;
  readonly record: SubmissionRecord | null;
}

export interface PullRequestCapture {
  readonly type: 'pull_request';
  readonly body: ParsedSubmissionBody;
  readonly attachments: AttachmentAssessmentSet;
  readonly contract: ContractResult;
  readonly claimScope: ClaimScope;
  readonly snapshot: PullRequestSnapshot;
  readonly snapshotHash: ContentHash;
  readonly record: SubmissionRecord;
}

export interface SubmissionRecordInput {
  readonly snapshot: Snapshot;
  readonly issueKind: IssueKind | null;
  readonly body: ParsedSubmissionBody;
  readonly contract: ContractResult;
  readonly attachments: AttachmentAssessmentSet;
  readonly claimScopeHash: ContentHash | null;
}

function recordInvalid(): Result<never, SubmissionRecordFailureCode> {
  return err('intake.record-invalid', 'steward-defect', 'The captured submission record failed validation.');
}

function keepUrl(url: string): boolean {
  return attachmentUrlSchema.safeParse(url).success;
}

const FORMAT_PATTERN = /^[a-z0-9]+(?:\.[a-z0-9]+)*$/;

export function buildSubmissionRecord(input: SubmissionRecordInput): Result<SubmissionRecord, SubmissionRecordFailureCode> {
  const { snapshot, issueKind, body, contract, attachments, claimScopeHash } = input;

  const hashResult = snapshotHash(snapshot);
  if (!hashResult.ok) {
    return recordInvalid();
  }

  const isPullRequest = snapshot.type === 'pull_request';

  const fields: Record<string, string> = {};
  if (body.structured) {
    for (const id of SUBMISSION_FIELD_IDS) {
      const field = body.fields[id];
      if (field !== undefined) {
        fields[id] = field.raw;
      }
    }
  }

  const linkedEvidenceHashes = new Set<string>();
  if (isPullRequest) {
    for (const linkedIssue of snapshot.linked_issues) {
      linkedEvidenceHashes.add(linkedIssue.content_hash);
    }
  }
  for (const attachment of snapshot.attachments) {
    if (attachment.content_hash !== null) {
      linkedEvidenceHashes.add(attachment.content_hash);
    }
  }

  const authorResponses = snapshot.author_responses
    .filter((response) => response.content_hash !== null)
    .map((response) => ({ request_id: response.request_id, comment_id: response.comment_id, content_hash: response.content_hash }));

  const contractResults = contract.findings.map((finding) => ({
    requirement: finding.code,
    satisfied: finding.severity === 'advisory',
    detail: finding.field === null ? finding.message : `${finding.message} Field: ${finding.field}.`,
  }));

  const attachmentRows = attachments.items
    .filter((item) => keepUrl(item.url))
    .map((item) => {
      const format = item.format !== null && FORMAT_PATTERN.test(item.format) && item.format.length <= 64 ? item.format : null;
      return {
        url: item.url,
        format,
        bytes: item.bytes,
        content_hash: item.contentHash,
        required: item.required,
        entries: item.entries === null ? null : item.entries.map((e) => ({ name: e.name, bytes: e.bytes })),
      };
    });

  const object: Record<string, unknown> = {
    schema_version: 1,
    record_type: 'submission',
    repository: snapshot.repository,
    type: snapshot.type,
    number: snapshot.number,
    snapshot_hash: hashResult.value,
    target_branch: isPullRequest ? snapshot.target_branch : null,
    head_commit: isPullRequest ? snapshot.head_commit : null,
    issue_kind: isPullRequest ? null : issueKind,
    category: contract.category,
    fields,
    linked_evidence_hashes: [...linkedEvidenceHashes].sort(),
    author_responses: authorResponses,
    shared_head_pull_requests: isPullRequest ? snapshot.shared_head_pull_requests : [],
    contract_results: contractResults,
    trusted_paths_changed: isPullRequest ? (contract.flags === null ? true : contract.flags.trusted_paths_changed) : null,
    execution_sensitive_paths_changed: isPullRequest
      ? contract.flags === null
        ? true
        : contract.flags.execution_sensitive_paths_changed
      : null,
    template: contract.template,
    snapshot,
  };

  if (isPullRequest) {
    const policyChange = contract.flags?.policy_change ?? null;
    if (
      policyChange !== null &&
      ((!policyChange.changed && policyChange.proposed === null) || (policyChange.changed && policyChange.proposed !== null))
    ) {
      object['policy_change'] = policyChange;
    }
    object['attachments'] = attachmentRows;
    object['claim_scope_hash'] = claimScopeHash;
  }

  const parsed = submissionRecordSchema.safeParse(object);
  if (!parsed.success) {
    return recordInvalid();
  }
  return ok(parsed.data);
}

export async function captureIssue(
  context: CaptureContext,
  issueNumber: number,
): Promise<Result<IssueCapture, CaptureFailureCode>> {
  const { client, repository, policy, policyRevision, attachmentResolver, attachmentTransport, authorResponses } = context;

  const repoResult = await readRepository(client, repository);
  if (!repoResult.ok) {
    return repoResult;
  }
  const fullName = repoResult.value.fullName;
  if (repositoryRefFromFullName(fullName) === null) {
    return githubFailure('github.schema-mismatch', 'The repository full name is not valid.');
  }

  const issueResult = await readIssue(client, repository, issueNumber);
  if (!issueResult.ok) {
    return issueResult;
  }
  const issue = issueResult.value;
  const bodyText = issue.body ?? '';

  const bodyResult = parseIssueBody(bodyText);
  if (!bodyResult.ok) {
    return bodyResult;
  }
  const body = bodyResult.value;

  const issueKind: IssueKind | null =
    body.structured && (body.template.form === 'defect' || body.template.form === 'proposal') ? body.template.form : null;

  const requiredFields = contractRequiredFields(policy, { type: 'issue', body, requestedKind: null });
  const staticAttachments = assessAttachmentsStatically({ body, bodyText, requiredFields, policy });
  const attachments = await fetchSubmissionAttachments(staticAttachments, {
    policy,
    resolver: attachmentResolver,
    transport: attachmentTransport,
  });

  const contractRepository: ContractRepository = { fullName, defaultBranch: repoResult.value.defaultBranch };
  const contract = checkContract({ type: 'issue', repository: contractRepository, policy, body, requestedKind: null, attachments });

  const snapshotAttachments = attachments.items
    .filter((item) => keepUrl(item.url))
    .map((item) => ({ url: item.url, contentHash: item.contentHash }));

  const snapshotResult = buildIssueSnapshot({
    repository: fullName,
    number: issue.number,
    title: issue.title,
    body: issue.body,
    attachments: snapshotAttachments,
    authorResponses,
    policyRevision,
  });
  if (!snapshotResult.ok) {
    return snapshotResult;
  }
  const snapshot = snapshotResult.value;

  const hashResult = snapshotHash(snapshot);
  if (!hashResult.ok) {
    return hashResult;
  }

  let record: SubmissionRecord | null = null;
  if (issueKind !== null) {
    const recordResult = buildSubmissionRecord({ snapshot, issueKind, body, contract, attachments, claimScopeHash: null });
    if (!recordResult.ok) {
      return recordResult;
    }
    record = recordResult.value;
  }

  return ok({
    type: 'issue',
    issueKind,
    body,
    attachments,
    contract,
    snapshot,
    snapshotHash: hashResult.value,
    record,
  });
}

export async function capturePullRequest(
  context: CaptureContext,
  pullNumber: number,
): Promise<Result<PullRequestCapture, CaptureFailureCode>> {
  const { client, repository, policy, policyRevision, attachmentResolver, attachmentTransport, authorResponses } = context;

  const repoResult = await readRepository(client, repository);
  if (!repoResult.ok) {
    return repoResult;
  }
  const fullName = repoResult.value.fullName;
  if (repositoryRefFromFullName(fullName) === null) {
    return githubFailure('github.schema-mismatch', 'The repository full name is not valid.');
  }

  const prResult = await readPullRequest(client, repository, pullNumber);
  if (!prResult.ok) {
    return prResult;
  }
  const pr = prResult.value;
  const bodyText = pr.body ?? '';

  const bodyResult = parsePullRequestBody(bodyText);
  if (!bodyResult.ok) {
    return bodyResult;
  }
  const body = bodyResult.value;

  const changedPathsResult = await readPullRequestFiles(client, repository, pullNumber, pr.changedFiles);
  if (!changedPathsResult.ok) {
    return changedPathsResult;
  }
  const changedPaths = changedPathsResult.value;

  const lv = linkedIssueReference(body, fullName);
  let linkedIssue: LinkedIssueCheck;
  if (lv.status === 'one') {
    const linkedIssueResult = await readIssue(client, repository, lv.number);
    if (linkedIssueResult.ok) {
      linkedIssue = {
        status: 'exists',
        number: lv.number,
        contentHash: contentHash(new TextEncoder().encode(linkedIssueResult.value.body ?? '')),
      };
    } else if (linkedIssueResult.failure.code === 'github.not-found' || linkedIssueResult.failure.code === 'github.not-an-issue') {
      linkedIssue = { status: 'not-found', number: lv.number };
    } else {
      linkedIssue = { status: 'unavailable', number: lv.number, failure: linkedIssueResult.failure };
    }
  } else {
    linkedIssue = { status: 'not-checked' };
  }

  const sharedHeadsResult = await readOpenPullRequestsForCommit(client, repository, pr.headSha);
  let sharedHeads: SharedHeadCheck;
  if (sharedHeadsResult.ok) {
    sharedHeads = { status: 'known', pullRequests: sharedHeadsResult.value.filter((n) => n !== pullNumber) };
  } else {
    sharedHeads = { status: 'unavailable', failure: sharedHeadsResult.failure };
  }

  let proposedPolicy: ProposedPolicyCheck;
  if (changedPaths.kind === 'complete') {
    const flags = detectPathFlags(changedPathSet(changedPaths.changes), {
      trusted: policy.trusted_paths.additional,
      executionSensitive: policy.execution_sensitive_paths.additional,
    });
    if (flags.policy.length > 0) {
      const proposedResult = await readProposedPolicyFromGitHub(client, repository, pr.headSha);
      proposedPolicy = proposedResult.ok
        ? { status: 'read', proposed: proposedResult.value }
        : { status: 'unavailable', failure: proposedResult.failure };
    } else {
      proposedPolicy = { status: 'not-read' };
    }
  } else {
    proposedPolicy = { status: 'not-read' };
  }

  const requiredFields = contractRequiredFields(policy, { type: 'pull_request', body });
  const staticAttachments = assessAttachmentsStatically({ body, bodyText, requiredFields, policy });
  const attachments = await fetchSubmissionAttachments(staticAttachments, {
    policy,
    resolver: attachmentResolver,
    transport: attachmentTransport,
  });

  const contractRepository: ContractRepository = { fullName, defaultBranch: repoResult.value.defaultBranch };
  const contract = checkContract({
    type: 'pull_request',
    repository: contractRepository,
    policy,
    body,
    changedPaths,
    linkedIssue,
    sharedHeads,
    proposedPolicy,
    attachments,
  });

  const claimScopeFields: Record<ClaimScopeFieldId, ClaimScopeFieldState> = {} as Record<ClaimScopeFieldId, ClaimScopeFieldState>;
  for (const id of CLAIM_SCOPE_FIELD_IDS) {
    if (body.structured) {
      if (body.duplicates.includes(id)) {
        claimScopeFields[id] = { state: 'duplicate' };
      } else {
        const field = body.fields[id];
        claimScopeFields[id] = field === undefined ? { state: 'absent' } : { state: 'present', raw: field.raw };
      }
    } else {
      claimScopeFields[id] = { state: 'absent' };
    }
  }
  const claimScopeLinkedIssue =
    lv.status === 'absent'
      ? ({ state: 'absent' } as const)
      : linkedIssue.status === 'exists'
        ? ({ state: 'resolved', repository: fullName, number: linkedIssue.number, contentHash: linkedIssue.contentHash } as const)
        : ({ state: 'unresolved' } as const);

  const claimScopeResult = computeClaimScope({
    structured: body.structured,
    fields: claimScopeFields,
    linkedIssue: claimScopeLinkedIssue,
  });
  if (!claimScopeResult.ok) {
    return claimScopeResult;
  }
  const claimScope = claimScopeResult.value;

  const snapshotResult = buildPullRequestSnapshot({
    repository: fullName,
    number: pr.number,
    title: pr.title,
    body: pr.body,
    targetBranch: pr.baseRef,
    headCommit: pr.headSha,
    baseCommit: pr.baseSha,
    linkedIssues:
      linkedIssue.status === 'exists'
        ? [{ repository: fullName, number: linkedIssue.number, contentHash: linkedIssue.contentHash }]
        : [],
    attachments: attachments.items
      .filter((item) => keepUrl(item.url))
      .map((item) => ({ url: item.url, contentHash: item.contentHash })),
    authorResponses,
    sharedHeadPullRequests: sharedHeads.status === 'known' ? sharedHeads.pullRequests : [],
    policyRevision,
  });
  if (!snapshotResult.ok) {
    return snapshotResult;
  }
  const snapshot = snapshotResult.value;

  const hashResult = snapshotHash(snapshot);
  if (!hashResult.ok) {
    return hashResult;
  }

  const recordResult = buildSubmissionRecord({
    snapshot,
    issueKind: null,
    body,
    contract,
    attachments,
    claimScopeHash: claimScope.status === 'available' ? claimScope.hash : null,
  });
  if (!recordResult.ok) {
    return recordResult;
  }

  return ok({
    type: 'pull_request',
    body,
    attachments,
    contract,
    claimScope,
    snapshot,
    snapshotHash: hashResult.value,
    record: recordResult.value,
  });
}
