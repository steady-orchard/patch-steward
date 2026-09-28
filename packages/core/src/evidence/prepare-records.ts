import { metricsEventRecordSchema } from '../records/metrics-event.js';
import type { MetricsEventRecord } from '../records/metrics-event.js';
import { supersessionRecordSchema } from '../records/supersession.js';
import type { SupersessionRecord } from '../records/supersession.js';
import { err, ok } from '../result.js';
import type { Result } from '../result.js';
import type { Outcome, SubmissionType, SupersessionReason, WaitingState } from '../vocabulary.js';
import type { EvidenceStoreGroup } from './git-store.js';
import { metricsStorePath, supersessionMetricsStorePath, supersessionStorePath } from './layout.js';
import { buildSupersessionMetricsEvents } from './metrics.js';
import { prettyJson } from './pretty-json.js';
import type { PreparedEvidenceFile } from './publish.js';
import type { EvidenceRedactionFailureCode } from './redact-records.js';
import { redactEvidenceStrings } from './redact-records.js';

export type EvidenceGroupFailureCode =
  'evidence.layout-invalid' | 'evidence.record-invalid' | 'evidence.redaction-invalidated' | EvidenceRedactionFailureCode;

export interface RunEvidenceGroupSource {
  readonly storePath: string;
  readonly files: readonly PreparedEvidenceFile[];
  readonly manifestBytes: Uint8Array;
  readonly metrics: PreparedEvidenceFile;
}

const RUN_STORE_PATH_PATTERN = /^runs\/(pr|issue)-[1-9][0-9]{0,9}\/[1-9][0-9]{0,19}-[1-9][0-9]{0,9}$/;
const METRICS_FILE_PATH_PATTERN = /^metrics\/[0-9]{4}-(0[1-9]|1[0-2])\/[A-Za-z0-9-]{1,80}\.json$/;

function splitStorePath(storePath: string): { readonly directory: string; readonly path: string } {
  const slash = storePath.lastIndexOf('/');
  return { directory: storePath.slice(0, slash), path: storePath.slice(slash + 1) };
}

export function runEvidenceGroups(
  source: RunEvidenceGroupSource,
): Result<readonly EvidenceStoreGroup[], 'evidence.layout-invalid'> {
  if (!RUN_STORE_PATH_PATTERN.test(source.storePath) || !METRICS_FILE_PATH_PATTERN.test(source.metrics.path)) {
    return err('evidence.layout-invalid', 'steward-defect', 'The evidence layout is invalid.');
  }
  const { directory: metricsDirectory, path: metricsFileName } = splitStorePath(source.metrics.path);
  return ok([
    {
      directory: source.storePath,
      mode: 'exact',
      files: [...source.files, { path: 'manifest.json', bytes: source.manifestBytes }],
    },
    {
      directory: metricsDirectory,
      mode: 'contains',
      files: [{ path: metricsFileName, bytes: source.metrics.bytes }],
    },
  ]);
}

export interface PreparedRecordEvidence {
  readonly groups: readonly EvidenceStoreGroup[];
  readonly storePaths: readonly string[];
}

export interface SupersessionEvidenceInput {
  readonly runId: number;
  readonly runAttempt: number;
  readonly subject: { readonly repository: string; readonly type: SubmissionType; readonly number: number };
  readonly reason: SupersessionReason;
  readonly successor: { readonly run_id: number; readonly run_attempt: number; readonly artifact_created_at: string } | null;
  readonly recordedSnapshotHash: string;
  readonly liveSnapshotHash: string | null;
  readonly from: Outcome | WaitingState;
  readonly recordedAt: string;
  readonly credentials: readonly string[];
}

function recordInvalid(): Result<never, EvidenceGroupFailureCode> {
  return err('evidence.record-invalid', 'steward-defect', 'An evidence record failed its schema.');
}

function redactionInvalidated(): Result<never, EvidenceGroupFailureCode> {
  return err('evidence.redaction-invalidated', 'steward-defect', 'A structural record changed under redaction.');
}

function serialize(value: unknown): Result<Uint8Array, EvidenceGroupFailureCode> {
  const text = prettyJson(value);
  if (!text.ok) {
    return recordInvalid();
  }
  return ok(Buffer.from(text.value, 'utf8'));
}

export async function prepareSupersessionEvidence(
  input: SupersessionEvidenceInput,
): Promise<Result<PreparedRecordEvidence & { readonly record: SupersessionRecord }, EvidenceGroupFailureCode>> {
  try {
    const candidate = {
      schema_version: 1,
      record_type: 'supersession',
      run_id: input.runId,
      run_attempt: input.runAttempt,
      subject: input.subject,
      reason: input.reason,
      successor: input.successor,
      recorded_snapshot_hash: input.recordedSnapshotHash,
      live_snapshot_hash: input.liveSnapshotHash,
      recorded_at: input.recordedAt,
    };
    const parsedRecord = supersessionRecordSchema.safeParse(candidate);
    if (!parsedRecord.success) {
      return recordInvalid();
    }

    const metricsResult = buildSupersessionMetricsEvents({
      runId: input.runId,
      runAttempt: input.runAttempt,
      from: input.from,
      recordedAt: input.recordedAt,
    });
    if (!metricsResult.ok) {
      return recordInvalid();
    }

    const redacted = await redactEvidenceStrings(
      [
        { value: parsedRecord.data, schema: supersessionRecordSchema },
        ...metricsResult.value.map((event) => ({ value: event, schema: metricsEventRecordSchema })),
      ],
      [],
      { credentials: input.credentials, policyPatterns: [] },
    );
    if (!redacted.ok) {
      return redacted;
    }
    if (redacted.value.counts.length > 0) {
      return redactionInvalidated();
    }
    const record = redacted.value.records[0] as SupersessionRecord;
    const metricsEvents = redacted.value.records.slice(1) as MetricsEventRecord[];

    const recordBytes = serialize(record);
    if (!recordBytes.ok) return recordBytes;
    const metricsBytes = serialize(metricsEvents);
    if (!metricsBytes.ok) return metricsBytes;

    const recordStorePath = supersessionStorePath(input.subject.type, input.subject.number, input.runId, input.runAttempt);
    const metricsStorePath_ = supersessionMetricsStorePath(input.recordedAt, input.runId, input.runAttempt);
    const recordSplit = splitStorePath(recordStorePath);
    const metricsSplit = splitStorePath(metricsStorePath_);

    const groups: EvidenceStoreGroup[] = [
      { directory: recordSplit.directory, mode: 'contains', files: [{ path: recordSplit.path, bytes: recordBytes.value }] },
      { directory: metricsSplit.directory, mode: 'contains', files: [{ path: metricsSplit.path, bytes: metricsBytes.value }] },
    ];

    return ok({ groups, storePaths: [recordStorePath, metricsStorePath_], record });
  } catch {
    return recordInvalid();
  }
}

export interface ClosureEvidenceInput {
  readonly runId: number;
  readonly runAttempt: number;
  readonly event: MetricsEventRecord;
  readonly credentials: readonly string[];
}

export async function prepareClosureEvidence(
  input: ClosureEvidenceInput,
): Promise<Result<PreparedRecordEvidence, EvidenceGroupFailureCode>> {
  try {
    const parsedEvent = metricsEventRecordSchema.safeParse(input.event);
    if (
      !parsedEvent.success ||
      parsedEvent.data.kind !== 'maintainer-resolution' ||
      parsedEvent.data.subject.kind !== 'submission'
    ) {
      return recordInvalid();
    }

    const redacted = await redactEvidenceStrings([{ value: parsedEvent.data, schema: metricsEventRecordSchema }], [], {
      credentials: input.credentials,
      policyPatterns: [],
    });
    if (!redacted.ok) {
      return redacted;
    }
    if (redacted.value.counts.length > 0) {
      return redactionInvalidated();
    }
    const event = redacted.value.records[0] as MetricsEventRecord;

    const bytes = serialize([event]);
    if (!bytes.ok) return bytes;

    const storePath = metricsStorePath(event.recorded_at, input.runId, input.runAttempt);
    const split = splitStorePath(storePath);

    const groups: EvidenceStoreGroup[] = [
      { directory: split.directory, mode: 'contains', files: [{ path: split.path, bytes: bytes.value }] },
    ];

    return ok({ groups, storePaths: [storePath] });
  } catch {
    return recordInvalid();
  }
}
