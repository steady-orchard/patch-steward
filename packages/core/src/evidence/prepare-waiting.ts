import { WAITING_RUN_FILES, runStorePath, repositoryStorePath, metricsStorePath } from './layout.js';
import type { EvidenceLayoutFailureCode } from './layout.js';
import { renderLogText, truncateLogText } from './logs.js';
import { redactEvidenceStrings, mergeRedactionCounts } from './redact-records.js';
import type {
  EvidenceRedactFn,
  EvidenceRedactionFailureCode,
  EvidenceRedactionOptions,
  RedactableRecord,
} from './redact-records.js';
import { buildEvidenceManifest, evidenceManifestSchema } from './manifest.js';
import type { EvidenceManifest, EvidenceManifestFailureCode } from './manifest.js';
import { buildWaitingMetricsEvents } from './metrics.js';
import type { RunPhaseLatency } from './metrics.js';
import { prettyJson } from './pretty-json.js';
import type { PreparedEvidenceFile } from './publish.js';
import type { LoadedPolicy } from '../policy/loader.js';
import type { Mode, WaitingReason } from '../vocabulary.js';
import { BUILT_IN_DETECTORS } from '../redaction/detectors.js';
import { EVIDENCE_LOG_FILE_MAX_BYTES } from '../policy/bounds.js';
import { runRecordSchema } from '../records/run.js';
import type { RunRecord } from '../records/run.js';
import { submissionRecordSchema } from '../records/submission.js';
import type { SubmissionRecord } from '../records/submission.js';
import { waitingRecordSchema } from '../records/waiting.js';
import type { WaitingRecord } from '../records/waiting.js';
import { policyRevisionRecordSchema, policyRevisionRecord } from '../policy/revision-record.js';
import { metricsEventRecordSchema } from '../records/metrics-event.js';
import { err, ok } from '../result.js';
import type { Result } from '../result.js';

export interface WaitingEvidenceInput {
  readonly runId: number;
  readonly runAttempt: number;
  readonly startedAt: string;
  readonly queuedAt: string;
  readonly finishedAt: string;
  readonly phases: readonly RunPhaseLatency[];
  readonly stewardVersion: string;
  readonly loadedPolicy: LoadedPolicy;
  readonly policyLoadedAt: string;
  readonly submission: SubmissionRecord;
  readonly baseCommit: string | null;
  readonly mode: Mode;
  readonly githubRequests: number;
  readonly retries: number;
  readonly waiting: {
    readonly reason: WaitingReason;
    readonly counts: {
      readonly daily_count: number;
      readonly daily_limit: number;
      readonly author_count: number;
      readonly author_limit: number;
    };
    readonly arrivalAt: string;
  };
  readonly logLines: readonly string[];
  readonly credentials: readonly string[];
}

export interface PreparedWaitingEvidence {
  readonly storePath: string;
  readonly files: readonly PreparedEvidenceFile[];
  readonly metrics: PreparedEvidenceFile;
  readonly manifestBytes: Uint8Array;
  readonly run: RunRecord;
  readonly waiting: WaitingRecord;
  readonly manifest: EvidenceManifest;
}

export type WaitingEvidenceFailureCode =
  | EvidenceLayoutFailureCode
  | EvidenceRedactionFailureCode
  | EvidenceManifestFailureCode
  | 'evidence.record-invalid'
  | 'evidence.too-large'
  | 'evidence.write-failed';

interface SerializedFile {
  readonly path: string;
  readonly bytes: Uint8Array;
}

function serializeRecord(value: unknown): Result<Uint8Array, WaitingEvidenceFailureCode> {
  const text = prettyJson(value);
  if (!text.ok) {
    return err('evidence.record-invalid', 'steward-defect', 'An evidence record could not be serialized.');
  }
  return ok(Buffer.from(text.value, 'utf8'));
}

function totalBytes(files: readonly SerializedFile[], log: Uint8Array, metrics: Uint8Array, manifest: Uint8Array): number {
  return files.reduce((sum, file) => sum + file.bytes.length, 0) + log.length + metrics.length + manifest.length;
}

export async function prepareWaitingEvidence(
  input: WaitingEvidenceInput,
  options: { readonly redact?: EvidenceRedactFn } = {},
): Promise<Result<PreparedWaitingEvidence, WaitingEvidenceFailureCode>> {
  try {
    const { submission, runId, runAttempt, startedAt, loadedPolicy } = input;

    const storePath = runStorePath(submission.type, submission.number, runId, runAttempt);
    const storePathResult = repositoryStorePath(submission.repository, storePath);
    if (!storePathResult.ok) {
      return storePathResult;
    }
    const metricsPath = metricsStorePath(startedAt, runId, runAttempt);

    const runCandidate = {
      schema_version: 1,
      record_type: 'run',
      run_id: runId,
      run_attempt: runAttempt,
      subject: {
        kind: 'submission',
        repository: submission.repository,
        type: submission.type,
        number: submission.number,
        snapshot_hash: submission.snapshot_hash,
      },
      commits: { base: input.baseCommit, head: submission.head_commit, group: null },
      owned_check_id: null,
      policy_revision: loadedPolicy.revision.id,
      steward_version: input.stewardVersion,
      provider: loadedPolicy.policy.llm?.provider ?? null,
      requested_model: loadedPolicy.policy.llm?.model ?? null,
      reported_model: null,
      adapter_version: null,
      generation: null,
      runner_identity: null,
      mode: input.mode,
      started_at: startedAt,
      finished_at: input.finishedAt,
      budget: {
        model_calls: 0,
        tokens: null,
        ai_credits: null,
        container_seconds: 0,
        executions: 0,
        github_requests: input.githubRequests,
        retries: input.retries,
      },
    };
    const runParsed = runRecordSchema.safeParse(runCandidate);
    if (!runParsed.success) {
      return err('evidence.record-invalid', 'steward-defect', 'An evidence record failed its schema.');
    }

    const submissionParsed = submissionRecordSchema.safeParse(submission);
    if (!submissionParsed.success) {
      return err('evidence.record-invalid', 'steward-defect', 'An evidence record failed its schema.');
    }

    const policyRevisionResult = policyRevisionRecord(loadedPolicy, {
      stewardVersion: input.stewardVersion,
      loadedAt: input.policyLoadedAt,
    });
    if (!policyRevisionResult.ok) {
      return err('evidence.record-invalid', 'steward-defect', 'An evidence record failed its schema.');
    }

    const waitingCandidate = {
      schema_version: 1,
      record_type: 'waiting',
      run_id: runId,
      run_attempt: runAttempt,
      subject: { repository: submission.repository, type: submission.type, number: submission.number },
      state: 'queued',
      reason: input.waiting.reason,
      counts: input.waiting.counts,
      snapshot_hash: submission.snapshot_hash,
      policy_revision: loadedPolicy.revision.id,
      arrival_at: input.waiting.arrivalAt,
      recorded_at: input.finishedAt,
    };
    const waitingParsed = waitingRecordSchema.safeParse(waitingCandidate);
    if (!waitingParsed.success) {
      return err('evidence.record-invalid', 'steward-defect', 'An evidence record failed its schema.');
    }

    const metricsResult = buildWaitingMetricsEvents({
      runId,
      runAttempt,
      queuedAt: input.queuedAt,
      phases: input.phases,
      finishedAt: input.finishedAt,
    });
    if (!metricsResult.ok) {
      return metricsResult;
    }

    const logText = renderLogText(input.logLines);
    const policy = loadedPolicy.policy;
    const policyPatterns = policy.evidence.redaction_patterns.map((p) => ({ id: p.id, pattern: p.pattern }));
    const redactionOptions: EvidenceRedactionOptions = {
      credentials: input.credentials,
      policyPatterns,
      ...(options.redact !== undefined ? { redact: options.redact } : {}),
    };

    const recordsForPass1: RedactableRecord[] = [
      { value: runParsed.data, schema: runRecordSchema },
      { value: submissionParsed.data, schema: submissionRecordSchema },
      { value: policyRevisionResult.value, schema: policyRevisionRecordSchema },
      { value: waitingParsed.data, schema: waitingRecordSchema },
      ...metricsResult.value.map((m) => ({ value: m, schema: metricsEventRecordSchema })),
    ];

    const pass1 = await redactEvidenceStrings(recordsForPass1, [logText], redactionOptions);
    if (!pass1.ok) {
      return pass1;
    }

    const run = pass1.value.records[0] as RunRecord;
    const submissionRecord = pass1.value.records[1] as SubmissionRecord;
    const policyRevision = pass1.value.records[2];
    const waiting = pass1.value.records[3] as WaitingRecord;
    const metricsEvents = pass1.value.records.slice(4);

    const runBytes = serializeRecord(run);
    if (!runBytes.ok) return runBytes;
    const submissionBytes = serializeRecord(submissionRecord);
    if (!submissionBytes.ok) return submissionBytes;
    const policyRevisionBytes = serializeRecord(policyRevision);
    if (!policyRevisionBytes.ok) return policyRevisionBytes;
    const waitingBytes = serializeRecord(waiting);
    if (!waitingBytes.ok) return waitingBytes;

    const files: SerializedFile[] = [
      { path: WAITING_RUN_FILES.run, bytes: runBytes.value },
      { path: WAITING_RUN_FILES.submission, bytes: submissionBytes.value },
      { path: WAITING_RUN_FILES.policyRevision, bytes: policyRevisionBytes.value },
      { path: WAITING_RUN_FILES.waiting, bytes: waitingBytes.value },
    ];

    const metricsTextResult = prettyJson(metricsEvents);
    if (!metricsTextResult.ok) {
      return err('evidence.record-invalid', 'steward-defect', 'The metrics events could not be serialized.');
    }
    const metricsBytes = Buffer.from(metricsTextResult.value, 'utf8');

    const detectorIds = BUILT_IN_DETECTORS.map((d) => d.id);
    const patternIds = policyPatterns.map((p) => p.id);
    const redaction = {
      detectors: detectorIds,
      policyPatterns: patternIds,
      exactValues: pass1.value.exactValues,
      replacements: mergeRedactionCounts([pass1.value.counts], ['known-secret', ...detectorIds, ...patternIds]),
    };

    const limit = policy.limits.evidence.run_bytes;
    const logCapped = Buffer.from(truncateLogText(pass1.value.texts[0] as string, EVIDENCE_LOG_FILE_MAX_BYTES), 'utf8');

    const upper = buildEvidenceManifest({
      runId,
      runAttempt,
      runKind: 'waiting',
      storePath,
      createdAt: input.finishedAt,
      files: [...files, { path: WAITING_RUN_FILES.log, bytes: logCapped }],
      metrics: { path: metricsPath, bytes: metricsBytes },
      redaction,
    });
    if (!upper.ok) {
      return upper;
    }
    const upperTextResult = prettyJson(upper.value);
    if (!upperTextResult.ok) {
      return err('evidence.record-invalid', 'steward-defect', 'The evidence manifest could not be serialized.');
    }
    const upperBytes = Buffer.byteLength(upperTextResult.value, 'utf8');

    const filesSum = files.reduce((sum, file) => sum + file.bytes.length, 0);
    const logBudget = limit - filesSum - metricsBytes.length - upperBytes;
    if (logBudget < 0) {
      return err('evidence.too-large', 'budget-exhausted', 'The run evidence exceeds limits.evidence.run_bytes.');
    }
    const logFinal = Buffer.from(
      truncateLogText(pass1.value.texts[0] as string, Math.min(EVIDENCE_LOG_FILE_MAX_BYTES, logBudget)),
      'utf8',
    );

    const manifestResult = buildEvidenceManifest({
      runId,
      runAttempt,
      runKind: 'waiting',
      storePath,
      createdAt: input.finishedAt,
      files: [...files, { path: WAITING_RUN_FILES.log, bytes: logFinal }],
      metrics: { path: metricsPath, bytes: metricsBytes },
      redaction,
    });
    if (!manifestResult.ok) {
      return manifestResult;
    }
    const manifest = manifestResult.value;

    const pass3 = await redactEvidenceStrings([{ value: manifest, schema: evidenceManifestSchema }], [], redactionOptions);
    if (!pass3.ok) {
      return pass3;
    }
    if (pass3.value.counts.length > 0) {
      return err('evidence.redaction-invalidated', 'steward-defect', 'The manifest changed under redaction.');
    }

    const manifestTextResult = prettyJson(manifest);
    if (!manifestTextResult.ok) {
      return err('evidence.record-invalid', 'steward-defect', 'The evidence manifest could not be serialized.');
    }
    const manifestBytes = Buffer.from(manifestTextResult.value, 'utf8');

    if (totalBytes(files, logFinal, metricsBytes, manifestBytes) > limit) {
      return err('evidence.too-large', 'budget-exhausted', 'The run evidence exceeds limits.evidence.run_bytes.');
    }

    return ok({
      storePath,
      files: [...files, { path: WAITING_RUN_FILES.log, bytes: logFinal }],
      metrics: { path: metricsPath, bytes: metricsBytes },
      manifestBytes,
      run,
      waiting,
      manifest,
    });
  } catch {
    return err('evidence.write-failed', 'steward-defect', 'The evidence write failed.');
  }
}
