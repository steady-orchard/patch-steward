import fs from 'node:fs/promises';
import path from 'node:path';

import type { EvidenceManifest } from './manifest.js';
import { evidenceManifestSchema } from './manifest.js';
import { metricsFileSchema } from './metrics.js';
import { contentHash, canonicalJsonHash } from '../hash.js';
import { runRecordSchema } from '../records/run.js';
import type { RunRecord } from '../records/run.js';
import { submissionRecordSchema } from '../records/submission.js';
import type { SubmissionRecord } from '../records/submission.js';
import { findingRecordSchema } from '../records/finding.js';
import type { FindingRecord } from '../records/finding.js';
import { decisionRecordSchema } from '../records/decision.js';
import type { DecisionRecord } from '../records/decision.js';
import { reportRecordSchema } from '../records/report.js';
import type { ReportRecord } from '../records/report.js';
import { executionRecordSchema } from '../records/execution-record.js';
import { maintainerActionRecordSchema } from '../records/maintainer-action.js';
import { metricsEventRecordSchema } from '../records/metrics-event.js';
import { policyRevisionRecordSchema } from '../policy/revision-record.js';
import type { PolicyRevisionRecord } from '../policy/revision-record.js';
import { err, ok } from '../result.js';
import type { Result } from '../result.js';

export interface RunVerificationWarning {
  readonly code: 'report.metrics-missing';
  readonly message: string;
}

export interface VerifiedRun {
  readonly directory: string;
  readonly manifest: EvidenceManifest;
  readonly run: RunRecord;
  readonly submission: SubmissionRecord;
  readonly policyRevision: PolicyRevisionRecord;
  readonly decision: DecisionRecord;
  readonly report: ReportRecord;
  readonly findings: readonly FindingRecord[];
  readonly reportMarkdown: string;
  readonly files: number;
  readonly metrics: 'verified' | 'missing';
  readonly warnings: readonly RunVerificationWarning[];
}

export type RunVerificationFailureCode = 'report.run-unreadable' | 'report.evidence-invalid';

function invalid(reason: string, relPath: string): Result<never, RunVerificationFailureCode> {
  return err('report.evidence-invalid', 'steward-defect', 'The stored evidence failed verification: ' + reason + '.', [
    { code: 'report.evidence-invalid', path: relPath, message: reason, line: null, column: null },
  ]);
}

function unreadable(): Result<never, RunVerificationFailureCode> {
  return err('report.run-unreadable', 'infrastructure', 'The run directory cannot be read.');
}

const recordSchemaByType: Record<string, { safeParse: (value: unknown) => { success: boolean; data?: unknown } }> = {
  run: runRecordSchema,
  submission: submissionRecordSchema,
  'policy-revision': policyRevisionRecordSchema,
  finding: findingRecordSchema,
  decision: decisionRecordSchema,
  report: reportRecordSchema,
  'execution-record': executionRecordSchema,
  'maintainer-action': maintainerActionRecordSchema,
  'metrics-event': metricsEventRecordSchema,
};

async function readUtf8(filePath: string): Promise<string | undefined> {
  let buffer: Buffer;
  try {
    buffer = await fs.readFile(filePath);
  } catch {
    return undefined;
  }
  const decoder = new TextDecoder('utf-8', { fatal: true });
  try {
    return decoder.decode(buffer);
  } catch {
    return undefined;
  }
}

export async function verifyRunDirectory(directory: string): Promise<Result<VerifiedRun, RunVerificationFailureCode>> {
  try {
    const dir = path.resolve(directory);

    let dirStat;
    try {
      dirStat = await fs.stat(dir);
    } catch {
      return unreadable();
    }
    if (!dirStat.isDirectory()) {
      return unreadable();
    }

    const manifestPath = path.join(dir, 'manifest.json');
    let manifestBuffer: Buffer;
    try {
      manifestBuffer = await fs.readFile(manifestPath);
    } catch {
      return invalid('manifest.json is missing', 'manifest.json');
    }
    let manifestText: string;
    try {
      manifestText = new TextDecoder('utf-8', { fatal: true }).decode(manifestBuffer);
    } catch {
      return invalid('manifest.json is not a valid manifest', 'manifest.json');
    }
    let manifestParsed: unknown;
    try {
      manifestParsed = JSON.parse(manifestText);
    } catch {
      return invalid('manifest.json is not a valid manifest', 'manifest.json');
    }
    const manifestResult = evidenceManifestSchema.safeParse(manifestParsed);
    if (!manifestResult.success) {
      return invalid('manifest.json is not a valid manifest', 'manifest.json');
    }
    const manifest = manifestResult.data;

    const listedPaths = new Set<string>(manifest.files.map((f) => f.path));

    for (const entry of manifest.files) {
      const segments = entry.path.split('/');
      const filePath = path.join(dir, ...segments);
      let fileStat;
      try {
        fileStat = await fs.lstat(filePath);
      } catch {
        return invalid('a listed file is missing', entry.path);
      }
      if (!fileStat.isFile()) {
        return invalid('a listed file is missing', entry.path);
      }
      let bytes: Buffer;
      try {
        bytes = await fs.readFile(filePath);
      } catch {
        return invalid('a listed file is missing', entry.path);
      }
      if (bytes.length !== entry.bytes) {
        return invalid('a listed file has the wrong size', entry.path);
      }
      if (contentHash(bytes) !== entry.sha256) {
        return invalid('a listed file has the wrong hash', entry.path);
      }
    }

    const prefixDirectories = new Set<string>();
    for (const entry of manifest.files) {
      const segments = entry.path.split('/');
      for (let i = 1; i < segments.length; i += 1) {
        prefixDirectories.add(segments.slice(0, i).join('/'));
      }
    }

    async function walk(relDir: string): Promise<Result<never, RunVerificationFailureCode> | undefined> {
      const absDir = relDir === '' ? dir : path.join(dir, ...relDir.split('/'));
      let entries;
      try {
        entries = await fs.readdir(absDir, { withFileTypes: true });
      } catch {
        return unreadable();
      }
      for (const entry of entries) {
        const relPath = relDir === '' ? entry.name : `${relDir}/${entry.name}`;
        const posixPath = relPath.split(path.sep).join('/');
        const absPath = path.join(absDir, entry.name);
        let entryStat;
        try {
          entryStat = await fs.lstat(absPath);
        } catch {
          return invalid('an unlisted file is present', posixPath);
        }
        if (entryStat.isSymbolicLink()) {
          return invalid('an unlisted file is present', posixPath);
        }
        if (entryStat.isDirectory()) {
          if (!prefixDirectories.has(posixPath)) {
            return invalid('an unlisted file is present', posixPath);
          }
          const sub = await walk(posixPath);
          if (sub !== undefined) {
            return sub;
          }
          continue;
        }
        if (entryStat.isFile()) {
          if (posixPath !== 'manifest.json' && !listedPaths.has(posixPath)) {
            return invalid('an unlisted file is present', posixPath);
          }
          continue;
        }
        return invalid('an unlisted file is present', posixPath);
      }
      return undefined;
    }

    const walkResult = await walk('');
    if (walkResult !== undefined) {
      return walkResult;
    }

    const recordsByPath = new Map<string, unknown>();
    for (const entry of manifest.files) {
      if (entry.record_type === null) {
        continue;
      }
      const filePath = path.join(dir, ...entry.path.split('/'));
      const text = await readUtf8(filePath);
      if (text === undefined) {
        return invalid('a record fails its schema', entry.path);
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        return invalid('a record fails its schema', entry.path);
      }
      const schema = recordSchemaByType[entry.record_type];
      if (schema === undefined) {
        return invalid('a record fails its schema', entry.path);
      }
      const result = schema.safeParse(parsed);
      if (!result.success) {
        return invalid('a record fails its schema', entry.path);
      }
      const hashResult = canonicalJsonHash(parsed);
      if (!hashResult.ok || hashResult.value !== entry.content_hash) {
        return invalid('a record does not match its content hash', entry.path);
      }
      recordsByPath.set(entry.path, result.data);
    }

    const run = recordsByPath.get('run.json') as RunRecord | undefined;
    const submission = recordsByPath.get('submission.json') as SubmissionRecord | undefined;
    const policyRevision = recordsByPath.get('policy-revision.json') as PolicyRevisionRecord | undefined;
    const decision = recordsByPath.get('decision.json') as DecisionRecord | undefined;
    const report = recordsByPath.get('report.json') as ReportRecord | undefined;
    if (
      run === undefined ||
      submission === undefined ||
      policyRevision === undefined ||
      decision === undefined ||
      report === undefined
    ) {
      return invalid('a listed file is missing', 'manifest.json');
    }

    const findings: FindingRecord[] = [];
    for (const entry of manifest.files) {
      if (entry.record_type === 'finding') {
        findings.push(recordsByPath.get(entry.path) as FindingRecord);
      }
    }

    const reportMarkdownPath = path.join(dir, 'report.md');
    const reportMarkdown = await readUtf8(reportMarkdownPath);
    if (reportMarkdown === undefined) {
      return invalid('a listed file is missing', 'report.md');
    }
    if (report.rendered !== reportMarkdown) {
      return invalid('report.md differs from the report record', 'report.md');
    }

    const warnings: RunVerificationWarning[] = [];
    let metricsStatus: 'verified' | 'missing' = 'verified';
    const metricsSegments = manifest.metrics.path.split('/');
    const metricsFilePath = path.resolve(dir, '..', '..', '..', ...metricsSegments);
    let metricsBuffer: Buffer | undefined;
    try {
      metricsBuffer = await fs.readFile(metricsFilePath);
    } catch {
      metricsBuffer = undefined;
    }
    if (metricsBuffer === undefined) {
      metricsStatus = 'missing';
      warnings.push({ code: 'report.metrics-missing', message: 'The metrics file of this run is missing.' });
    } else {
      if (metricsBuffer.length !== manifest.metrics.bytes || contentHash(metricsBuffer) !== manifest.metrics.sha256) {
        return invalid('the metrics file does not match the manifest', manifest.metrics.path);
      }
      let metricsText: string;
      try {
        metricsText = new TextDecoder('utf-8', { fatal: true }).decode(metricsBuffer);
      } catch {
        return invalid('the metrics file does not match the manifest', manifest.metrics.path);
      }
      let metricsParsed: unknown;
      try {
        metricsParsed = JSON.parse(metricsText);
      } catch {
        return invalid('the metrics file does not match the manifest', manifest.metrics.path);
      }
      const metricsResult = metricsFileSchema.safeParse(metricsParsed);
      if (!metricsResult.success) {
        return invalid('the metrics file does not match the manifest', manifest.metrics.path);
      }
    }

    return ok({
      directory: dir,
      manifest,
      run,
      submission,
      policyRevision,
      decision,
      report,
      findings,
      reportMarkdown,
      files: manifest.files.length,
      metrics: metricsStatus,
      warnings,
    });
  } catch {
    return unreadable();
  }
}
