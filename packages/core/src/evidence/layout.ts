import path from 'node:path';

import type { RandomSource } from '../clock.js';
import { LOCAL_RUN_ID_PATTERN, recordRepositorySchema } from '../records/common.js';
import type { RecordType } from '../records/common.js';
import type { SubmissionType } from '../vocabulary.js';
import { err, ok } from '../result.js';
import type { Result } from '../result.js';

export const RUN_MANIFEST_FILE = 'manifest.json';

export const RUN_FILES = Object.freeze({
  run: 'run.json',
  submission: 'submission.json',
  policyRevision: 'policy-revision.json',
  decision: 'decision.json',
  report: 'report.json',
  reportMarkdown: 'report.md',
  log: 'logs/steward.txt',
});

export const WAITING_RUN_FILES = Object.freeze({
  run: 'run.json',
  submission: 'submission.json',
  policyRevision: 'policy-revision.json',
  waiting: 'waiting.json',
  log: 'logs/steward.txt',
});

export const RUNS_DIRECTORY = 'runs';
export const STAGING_DIRECTORY_NAME = '.staging';
export const METRICS_DIRECTORY = 'metrics';
export const SUPERSESSIONS_DIRECTORY = 'supersessions';

export type EvidenceLayoutFailureCode = 'evidence.layout-invalid';

export function localRunId(startedAt: Date, random: RandomSource): string {
  const iso = startedAt.toISOString();
  const datePart = iso.slice(0, 10).replaceAll('-', '');
  const timePart = iso.slice(11, 19).replaceAll(':', '');
  const runId = `local-${datePart}T${timePart}Z-${random.hex(4)}`;
  if (!LOCAL_RUN_ID_PATTERN.test(runId)) {
    throw new Error('localRunId: generated id does not match LOCAL_RUN_ID_PATTERN');
  }
  return runId;
}

export function runDirectoryName(runId: string | number, runAttempt: number): string {
  return typeof runId === 'string' ? runId : `${runId}-${runAttempt}`;
}

function sequenceId(prefix: string, sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 9999) {
    throw new RangeError(`${prefix}: sequence must be an integer between 1 and 9999`);
  }
  return `${prefix}-${String(sequence).padStart(4, '0')}`;
}

export function findingId(sequence: number): string {
  return sequenceId('finding', sequence);
}

export function findingFilePath(sequence: number): string {
  return `findings/${findingId(sequence)}.json`;
}

export function executionFilePath(sequence: number): string {
  return `executions/${sequenceId('execution', sequence)}.json`;
}

export function maintainerActionFilePath(sequence: number): string {
  return `maintainer-actions/${sequenceId('action', sequence)}.json`;
}

export function runStorePath(type: SubmissionType, number: number, runId: string | number, runAttempt: number): string {
  const kind = type === 'pull_request' ? 'pr' : 'issue';
  return `${RUNS_DIRECTORY}/${kind}-${number}/${runDirectoryName(runId, runAttempt)}`;
}

export function stagingStorePath(runId: string | number, runAttempt: number): string {
  return `${RUNS_DIRECTORY}/${STAGING_DIRECTORY_NAME}/${runDirectoryName(runId, runAttempt)}`;
}

export function metricsStorePath(startedAt: string, runId: string | number, runAttempt: number): string {
  const month = new Date(startedAt).toISOString().slice(0, 7);
  return `${METRICS_DIRECTORY}/${month}/${runDirectoryName(runId, runAttempt)}.json`;
}

export function supersessionStorePath(type: SubmissionType, number: number, runId: number, runAttempt: number): string {
  const kind = type === 'pull_request' ? 'pr' : 'issue';
  return `${RUNS_DIRECTORY}/${kind}-${number}/${SUPERSESSIONS_DIRECTORY}/${runDirectoryName(runId, runAttempt)}.json`;
}

export function supersessionMetricsStorePath(recordedAt: string, runId: number, runAttempt: number): string {
  const month = new Date(recordedAt).toISOString().slice(0, 7);
  return `${METRICS_DIRECTORY}/${month}/${runDirectoryName(runId, runAttempt)}-supersession.json`;
}

const LATEST_RUN_DIRECTORY_PATTERN = /^([1-9][0-9]{0,19})-([1-9][0-9]{0,9})$/;

export function repositoryStorePath(repository: string, storePath: string): Result<string, EvidenceLayoutFailureCode> {
  const parsed = recordRepositorySchema.safeParse(repository);
  if (!parsed.success) {
    return err('evidence.layout-invalid', 'steward-defect', 'The repository name cannot form an evidence path.');
  }
  const [owner, name] = parsed.data.split('/');
  if (name === '.' || name === '..') {
    return err('evidence.layout-invalid', 'steward-defect', 'The repository name cannot form an evidence path.');
  }
  if (storePath === '' || storePath.startsWith('/') || storePath.includes('\\')) {
    return err('evidence.layout-invalid', 'steward-defect', 'The repository name cannot form an evidence path.');
  }
  const segments = storePath.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    return err('evidence.layout-invalid', 'steward-defect', 'The repository name cannot form an evidence path.');
  }
  return ok(`${owner}/${name}/${storePath}`);
}

export function latestRunDirectoryName(
  names: readonly string[],
): { readonly name: string; readonly runId: number; readonly runAttempt: number } | null {
  let best: { readonly name: string; readonly runId: number; readonly runAttempt: number } | null = null;
  for (const name of names) {
    const match = LATEST_RUN_DIRECTORY_PATTERN.exec(name);
    if (match === null) {
      continue;
    }
    const runId = Number(match[1]);
    const runAttempt = Number(match[2]);
    if (!Number.isSafeInteger(runId) || !Number.isSafeInteger(runAttempt)) {
      continue;
    }
    if (best === null || runId > best.runId || (runId === best.runId && runAttempt > best.runAttempt)) {
      best = { name, runId, runAttempt };
    }
  }
  return best;
}

const FINDING_FILE_PATTERN = /^findings\/finding-[0-9]{4}\.json$/;
const EXECUTION_FILE_PATTERN = /^executions\/execution-[0-9]{4}\.json$/;
const MAINTAINER_ACTION_FILE_PATTERN = /^maintainer-actions\/action-[0-9]{4}\.json$/;
const LOG_FILE_PATTERN = /^logs\/[a-z0-9][a-z0-9-]{0,63}\.txt$/;

export function recordTypeForPath(path: string): RecordType | null | undefined {
  switch (path) {
    case RUN_FILES.run:
      return 'run';
    case RUN_FILES.submission:
      return 'submission';
    case RUN_FILES.policyRevision:
      return 'policy-revision';
    case RUN_FILES.decision:
      return 'decision';
    case RUN_FILES.report:
      return 'report';
    case RUN_FILES.reportMarkdown:
      return null;
    case WAITING_RUN_FILES.waiting:
      return 'waiting';
    default:
      break;
  }
  if (FINDING_FILE_PATTERN.test(path)) {
    return 'finding';
  }
  if (EXECUTION_FILE_PATTERN.test(path)) {
    return 'execution-record';
  }
  if (MAINTAINER_ACTION_FILE_PATTERN.test(path)) {
    return 'maintainer-action';
  }
  if (LOG_FILE_PATTERN.test(path)) {
    return null;
  }
  return undefined;
}

export function repositoryStoreRoot(evidenceDir: string, repository: string): Result<string, EvidenceLayoutFailureCode> {
  const parsed = recordRepositorySchema.safeParse(repository);
  if (!parsed.success) {
    return err('evidence.layout-invalid', 'steward-defect', 'The repository name cannot form an evidence path.');
  }
  const [owner, name] = parsed.data.split('/');
  if (name === '.' || name === '..') {
    return err('evidence.layout-invalid', 'steward-defect', 'The repository name cannot form an evidence path.');
  }
  return ok(path.join(evidenceDir, owner ?? '', name ?? ''));
}

export function storePathToPlatform(root: string, storePath: string): string {
  return path.join(root, ...storePath.split('/'));
}

export function localEvidenceLocation(storePath: string): (relativePath: string) => string {
  return (relativePath: string): string => (relativePath === '' ? storePath : `${storePath}/${relativePath}`);
}
