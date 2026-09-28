import { RUN_FILES, repositoryStoreRoot, repositoryStorePath, runStorePath, stagingStorePath, metricsStorePath } from './layout.js';
import type { EvidenceLayoutFailureCode } from './layout.js';
import { assembleRunRecords } from './assemble.js';
import type { RunAssemblyInput, RunAssemblyFailureCode } from './assemble.js';
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
import { writeRunDirectory, nodeEvidenceFs } from './local-store.js';
import type { EvidenceFs, LocalStoreFailureCode } from './local-store.js';
import { buildReportInput, buildCheckSummaryInput } from './report-input.js';
import type { ReportRecordSources, ReportInputFailureCode } from './report-input.js';
import { prettyJson } from './pretty-json.js';
import { renderReport } from '../report/render.js';
import type { ReportRenderFailureCode } from '../report/render.js';
import { renderCheckSummary } from '../report/summary.js';
import type { CheckSummaryFailureCode } from '../report/summary.js';
import type { ClassificationInput } from '../report/templates.js';
import { BUILT_IN_DETECTORS } from '../redaction/detectors.js';
import { REPORT_MAX_LENGTH, CHECK_SUMMARY_MAX_LENGTH, EVIDENCE_LOG_FILE_MAX_BYTES } from '../policy/bounds.js';
import { runRecordSchema } from '../records/run.js';
import type { RunRecord } from '../records/run.js';
import { submissionRecordSchema } from '../records/submission.js';
import type { SubmissionRecord } from '../records/submission.js';
import { findingRecordSchema } from '../records/finding.js';
import type { FindingRecord } from '../records/finding.js';
import { decisionRecordSchema } from '../records/decision.js';
import type { DecisionRecord } from '../records/decision.js';
import { metricsEventRecordSchema } from '../records/metrics-event.js';
import type { MetricsEventRecord } from '../records/metrics-event.js';
import { reportRecordSchema } from '../records/report.js';
import type { ReportRecord } from '../records/report.js';
import { policyRevisionRecordSchema } from '../policy/revision-record.js';
import type { PolicyRevisionRecord } from '../policy/revision-record.js';
import { err, ok } from '../result.js';
import type { Result } from '../result.js';

export interface RunEvidencePreparation {
  readonly assembly: RunAssemblyInput;
  readonly classification: ClassificationInput;
  readonly defaultBranch: string;
  readonly logLines: readonly string[];
  readonly credentials: readonly string[];
  readonly localRun: boolean;
  readonly createdAt: string;
  readonly evidenceLocation?: string;
}

export interface RunEvidenceInput extends RunEvidencePreparation {
  readonly evidenceDir: string;
}

export interface RunEvidenceOptions {
  readonly fs?: EvidenceFs;
  readonly redact?: EvidenceRedactFn;
}

export interface PublishedRun {
  readonly directory: string;
  readonly storePath: string;
  readonly report: string;
  readonly checkSummary: string;
  readonly run: RunRecord;
  readonly submission: SubmissionRecord;
  readonly policyRevision: PolicyRevisionRecord;
  readonly findings: readonly FindingRecord[];
  readonly decision: DecisionRecord;
  readonly reportRecord: ReportRecord;
  readonly manifest: EvidenceManifest;
}

export interface PreparedEvidenceFile {
  readonly path: string;
  readonly bytes: Uint8Array;
}

export interface PreparedRunEvidence extends Omit<PublishedRun, 'directory'> {
  readonly files: readonly PreparedEvidenceFile[];
  readonly metrics: PreparedEvidenceFile;
  readonly manifestBytes: Uint8Array;
}

export type RunEvidenceFailureCode =
  | EvidenceLayoutFailureCode
  | RunAssemblyFailureCode
  | EvidenceRedactionFailureCode
  | ReportInputFailureCode
  | ReportRenderFailureCode
  | CheckSummaryFailureCode
  | EvidenceManifestFailureCode
  | LocalStoreFailureCode
  | 'evidence.too-large';

interface SerializedFile {
  readonly path: string;
  readonly bytes: Uint8Array;
}

function serializeRecord(value: unknown): Result<Uint8Array, RunEvidenceFailureCode> {
  const text = prettyJson(value);
  if (!text.ok) {
    return err('evidence.record-invalid', 'steward-defect', 'An evidence record could not be serialized.');
  }
  return ok(Buffer.from(text.value, 'utf8'));
}

function totalBytes(files: readonly SerializedFile[], log: Uint8Array, metrics: Uint8Array, manifest: Uint8Array): number {
  return files.reduce((sum, file) => sum + file.bytes.length, 0) + log.length + metrics.length + manifest.length;
}

export async function prepareRunEvidence(
  input: RunEvidencePreparation,
  options: RunEvidenceOptions = {},
): Promise<Result<PreparedRunEvidence, RunEvidenceFailureCode>> {
  try {
    const { submission, runId, runAttempt, startedAt, loadedPolicy } = input.assembly;

    const storePath = runStorePath(submission.type, submission.number, runId, runAttempt);
    const storePathResult = repositoryStorePath(submission.repository, storePath);
    if (!storePathResult.ok) {
      return storePathResult;
    }
    const metricsPath = metricsStorePath(startedAt, runId, runAttempt);

    const assembled = assembleRunRecords(input.assembly);
    if (!assembled.ok) {
      return assembled;
    }

    const logText = renderLogText(input.logLines);
    const policy = loadedPolicy.policy;
    const policyPatterns = policy.evidence.redaction_patterns.map((p) => ({ id: p.id, pattern: p.pattern }));
    const redactionOptions: EvidenceRedactionOptions = {
      credentials: input.credentials,
      policyPatterns,
      ...(options.redact !== undefined ? { redact: options.redact } : {}),
    };

    const findingsCount = assembled.value.findings.length;
    const decisionIndex = 3 + findingsCount;
    const metricsStart = decisionIndex + 1;

    const recordsForPass1: RedactableRecord[] = [
      { value: assembled.value.run, schema: runRecordSchema },
      { value: assembled.value.submission, schema: submissionRecordSchema },
      { value: assembled.value.policyRevision, schema: policyRevisionRecordSchema },
      ...assembled.value.findings.map((f) => ({ value: f, schema: findingRecordSchema })),
      { value: assembled.value.decision, schema: decisionRecordSchema },
      ...assembled.value.metricsEvents.map((m) => ({ value: m, schema: metricsEventRecordSchema })),
    ];

    const pass1 = await redactEvidenceStrings(recordsForPass1, [logText, input.defaultBranch], redactionOptions);
    if (!pass1.ok) {
      return pass1;
    }

    const run = pass1.value.records[0] as RunRecord;
    const submissionRecord = pass1.value.records[1] as SubmissionRecord;
    const policyRevision = pass1.value.records[2] as PolicyRevisionRecord;
    const findings = pass1.value.records.slice(3, decisionIndex) as FindingRecord[];
    const decision = pass1.value.records[decisionIndex] as DecisionRecord;
    const metricsEvents = pass1.value.records.slice(metricsStart) as MetricsEventRecord[];

    const sources: ReportRecordSources = {
      run,
      submission: submissionRecord,
      policyRevision,
      findings,
      decision,
      classification: input.classification,
      defaultBranch: pass1.value.texts[1] as string,
      subjectTotals: input.assembly.findings.map((p) => p.finding.subjects.length),
      localRun: input.localRun,
      storePath: input.evidenceLocation ?? storePath,
    };

    const reportInput = buildReportInput(sources);
    if (!reportInput.ok) {
      return reportInput;
    }
    const report = renderReport(reportInput.value);
    if (!report.ok) {
      return report;
    }
    const summary = renderCheckSummary(buildCheckSummaryInput(sources));
    if (!summary.ok) {
      return summary;
    }

    const pass2 = await redactEvidenceStrings([], [report.value, summary.value], redactionOptions);
    if (!pass2.ok) {
      return pass2;
    }
    const renderedReport = pass2.value.texts[0] as string;
    const renderedSummary = pass2.value.texts[1] as string;
    if (renderedReport.length > REPORT_MAX_LENGTH) {
      return err('report.too-large', 'steward-defect', 'The rendered report exceeds the report maximum.');
    }
    if (renderedSummary.length > CHECK_SUMMARY_MAX_LENGTH) {
      return err('report.summary-too-large', 'steward-defect', 'The check summary exceeds its maximum.');
    }

    const reportRecordCandidate = {
      schema_version: 1,
      record_type: 'report',
      run_id: run.run_id,
      run_attempt: run.run_attempt,
      rendered: renderedReport,
      check_summary: renderedSummary,
      bound: {
        policy_revision: run.policy_revision,
        snapshot_hash: submissionRecord.snapshot_hash,
        head_commit: run.commits.head,
        base_commit: run.commits.base,
      },
    };
    const reportRecordParsed = reportRecordSchema.safeParse(reportRecordCandidate);
    if (!reportRecordParsed.success) {
      return err('evidence.record-invalid', 'steward-defect', 'The report record failed its schema.');
    }
    const reportRecord = reportRecordParsed.data;

    const runBytes = serializeRecord(run);
    if (!runBytes.ok) return runBytes;
    const submissionBytes = serializeRecord(submissionRecord);
    if (!submissionBytes.ok) return submissionBytes;
    const policyRevisionBytes = serializeRecord(policyRevision);
    if (!policyRevisionBytes.ok) return policyRevisionBytes;
    const decisionBytes = serializeRecord(decision);
    if (!decisionBytes.ok) return decisionBytes;
    const reportBytes = serializeRecord(reportRecord);
    if (!reportBytes.ok) return reportBytes;
    const reportMarkdownBytes = Buffer.from(renderedReport, 'utf8');

    const findingFiles: SerializedFile[] = [];
    for (const finding of findings) {
      const bytesResult = serializeRecord(finding);
      if (!bytesResult.ok) return bytesResult;
      findingFiles.push({ path: `findings/${finding.finding_id}.json`, bytes: bytesResult.value });
    }

    const files: SerializedFile[] = [
      { path: RUN_FILES.run, bytes: runBytes.value },
      { path: RUN_FILES.submission, bytes: submissionBytes.value },
      { path: RUN_FILES.policyRevision, bytes: policyRevisionBytes.value },
      { path: RUN_FILES.decision, bytes: decisionBytes.value },
      { path: RUN_FILES.report, bytes: reportBytes.value },
      { path: RUN_FILES.reportMarkdown, bytes: reportMarkdownBytes },
      ...findingFiles,
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
      replacements: mergeRedactionCounts([pass1.value.counts, pass2.value.counts], ['known-secret', ...detectorIds, ...patternIds]),
    };

    const limit = policy.limits.evidence.run_bytes;
    const logCapped = Buffer.from(truncateLogText(pass1.value.texts[0] as string, EVIDENCE_LOG_FILE_MAX_BYTES), 'utf8');

    const upper = buildEvidenceManifest({
      runId,
      runAttempt,
      storePath,
      createdAt: input.createdAt,
      files: [...files, { path: RUN_FILES.log, bytes: logCapped }],
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
      storePath,
      createdAt: input.createdAt,
      files: [...files, { path: RUN_FILES.log, bytes: logFinal }],
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
      report: renderedReport,
      checkSummary: renderedSummary,
      run,
      submission: submissionRecord,
      policyRevision,
      findings,
      decision,
      reportRecord,
      manifest,
      files: [...files, { path: RUN_FILES.log, bytes: logFinal }],
      metrics: { path: metricsPath, bytes: metricsBytes },
      manifestBytes,
    });
  } catch {
    return err('evidence.write-failed', 'steward-defect', 'The evidence write failed.');
  }
}

export async function publishRunEvidence(
  input: RunEvidenceInput,
  options: RunEvidenceOptions = {},
): Promise<Result<PublishedRun, RunEvidenceFailureCode>> {
  try {
    const storeRootResult = repositoryStoreRoot(input.evidenceDir, input.assembly.submission.repository);
    if (!storeRootResult.ok) {
      return storeRootResult;
    }
    const storeRoot = storeRootResult.value;

    const prepared = await prepareRunEvidence(input, options);
    if (!prepared.ok) {
      return prepared;
    }

    const written = await writeRunDirectory(
      {
        storeRoot,
        storePath: prepared.value.storePath,
        stagingPath: stagingStorePath(input.assembly.runId, input.assembly.runAttempt),
        files: prepared.value.files,
        metrics: prepared.value.metrics,
        manifest: prepared.value.manifestBytes,
      },
      options.fs ?? nodeEvidenceFs,
    );
    if (!written.ok) {
      return written;
    }

    return ok({
      directory: written.value.directory,
      storePath: prepared.value.storePath,
      report: prepared.value.report,
      checkSummary: prepared.value.checkSummary,
      run: prepared.value.run,
      submission: prepared.value.submission,
      policyRevision: prepared.value.policyRevision,
      findings: prepared.value.findings,
      decision: prepared.value.decision,
      reportRecord: prepared.value.reportRecord,
      manifest: prepared.value.manifest,
    });
  } catch {
    return err('evidence.write-failed', 'steward-defect', 'The evidence write failed.');
  }
}
