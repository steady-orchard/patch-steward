import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { publishRunEvidence } from './publish.js';
import type { RunEvidenceInput, RunEvidenceFailureCode } from './publish.js';
import { nodeEvidenceFs } from './local-store.js';
import type { EvidenceFs } from './local-store.js';
import { prepareFindings, decisionFindings } from './assemble.js';
import type { RunAssemblyInput } from './assemble.js';
import type { HandoffFinding } from '../pipeline/handoff.js';
import { CONTRACT_FINDING_MESSAGES } from '../submission/contract.js';
import { decideOutcome } from '../decision/table.js';
import type { DecisionResult } from '../decision/table.js';
import { submissionRecordSchema } from '../records/submission.js';
import type { SubmissionRecord } from '../records/submission.js';
import type { LoadedPolicy } from '../policy/loader.js';
import { DEFAULT_CHECKLIST_POLICY } from '../submission/default-checklist.js';
import { err } from '../result.js';
import type { Result } from '../result.js';

const RUN_ID = 'local-20260927T101500Z-3f9a1c2e';

const trustedPolicy: LoadedPolicy = {
  revision: { kind: 'git-tree', id: 'b'.repeat(40), commit: 'a'.repeat(40), ref: 'main' },
  policy: DEFAULT_CHECKLIST_POLICY,
  authoritative: true,
};

interface MakeSubmissionOptions {
  readonly fieldsExtra?: Record<string, string>;
  readonly repository?: string;
  readonly attachments?: readonly {
    readonly url: string;
    readonly format: string;
    readonly bytes: number;
    readonly content_hash: string | null;
    readonly required: boolean;
    readonly entries: readonly string[] | null;
  }[];
}

function makeSubmission(options: MakeSubmissionOptions = {}): SubmissionRecord {
  return submissionRecordSchema.parse({
    schema_version: 1,
    record_type: 'submission',
    repository: options.repository ?? 'octo/demo',
    type: 'pull_request',
    number: 12,
    snapshot_hash: 'sha256:' + '5'.repeat(64),
    target_branch: 'main',
    head_commit: 'c'.repeat(40),
    issue_kind: null,
    category: 'bugfix',
    fields: { category: 'bugfix', ...options.fieldsExtra },
    linked_evidence_hashes: [],
    author_responses: [],
    shared_head_pull_requests: [],
    contract_results: [],
    trusted_paths_changed: false,
    execution_sensitive_paths_changed: false,
    template: { form: 'pull_request', version: 1 },
    attachments: options.attachments ?? [],
    claim_scope_hash: null,
  });
}

function makeFindings(): readonly HandoffFinding[] {
  return [
    {
      stage: 'contract',
      severity: 'blocking',
      code: 'submission.field-missing',
      detail: null,
      field: 'regression-test',
      subjects: [],
      message: CONTRACT_FINDING_MESSAGES['submission.field-missing'],
    },
  ];
}

interface ScenarioOptions {
  readonly submission?: SubmissionRecord;
  readonly policy?: LoadedPolicy;
}

function buildInput(evidenceDir: string, options: ScenarioOptions = {}): RunEvidenceInput {
  const submission = options.submission ?? makeSubmission();
  const findings = makeFindings();
  const loadedPolicy = options.policy ?? trustedPolicy;
  const prepared = prepareFindings(findings, {
    repository: submission.repository,
    defaultBranch: 'main',
    submissionType: submission.type,
    template: submission.template ?? null,
    category: submission.category,
    headCommit: submission.head_commit,
    policy: loadedPolicy.policy,
    policyChange: null,
  });
  if (!prepared.ok) {
    throw new Error('test setup: prepareFindings failed');
  }
  const decisionResult: DecisionResult = decideOutcome({
    freshness: 'current',
    capacity: 'available',
    admission: 'not-required',
    findings: decisionFindings(prepared.value),
    causes: [],
    requiredStages: ['references', 'claim'],
    stageResults: [],
    requirements: [],
  });
  if (decisionResult.kind !== 'outcome') {
    throw new Error('test setup: decision did not resolve to an outcome');
  }

  const assembly: RunAssemblyInput = {
    runId: RUN_ID,
    runAttempt: 1,
    startedAt: '2026-09-27T10:15:00.000Z',
    gateCompletedAt: '2026-09-27T10:15:01.000Z',
    finishedAt: '2026-09-27T10:15:03.000Z',
    phases: [{ phase: 'gate', seconds: 1, recordedAt: '2026-09-27T10:15:01.000Z' }],
    stewardVersion: '0.0.0-test',
    loadedPolicy,
    policyLoadedAt: '2026-09-27T10:15:00.500Z',
    submission,
    baseCommit: 'd'.repeat(40),
    mode: 'observe',
    findings: prepared.value,
    decision: decisionResult,
    githubRequests: 7,
    retries: 0,
  };

  return {
    evidenceDir,
    assembly,
    classification: { type: 'pull_request', category: 'bugfix', consistent: true, plausible: ['bugfix'] },
    defaultBranch: 'main',
    logLines: ['gate: complete'],
    credentials: [],
    localRun: true,
    createdAt: '2026-09-27T10:15:03.000Z',
  };
}

function mkTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'm5-fail-'));
}

function rmTmpDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

function pathExists(target: string): boolean {
  try {
    fs.lstatSync(target);
    return true;
  } catch {
    return false;
  }
}

function expectNothingCommitted(tmp: string, result: Result<unknown, RunEvidenceFailureCode>, code: RunEvidenceFailureCode): void {
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.failure.code).toBe(code);
  expect(result.failure.outcome).toBe('inconclusive');
  expect('value' in result).toBe(false);

  const root = path.join(tmp, 'octo', 'demo');
  expect(pathExists(path.join(root, 'runs', 'pr-12', RUN_ID))).toBe(false);
  expect(pathExists(path.join(root, 'runs', '.staging', RUN_ID))).toBe(false);
  expect(pathExists(path.join(root, 'metrics', '2026-09', `${RUN_ID}.json`))).toBe(false);
}

function failingWriteFs(predicate: (target: string) => boolean): EvidenceFs {
  return {
    ...nodeEvidenceFs,
    writeFileExclusive: async (target: string, data: Uint8Array): Promise<void> => {
      if (predicate(target)) {
        throw Object.assign(new Error('injected'), { code: 'EIO' });
      }
      return nodeEvidenceFs.writeFileExclusive(target, data);
    },
  };
}

describe('publishRunEvidence failures', { timeout: 30000 }, () => {
  it('a redaction timeout leaves no final run directory', async () => {
    const tmp = mkTmpDir();
    try {
      const input = buildInput(tmp);
      const result = await publishRunEvidence(input, {
        redact: async () => err('redaction.timeout', 'infrastructure', 'Redaction exceeded the time bound.'),
      });
      expectNothingCommitted(tmp, result, 'redaction.timeout');
    } finally {
      rmTmpDir(tmp);
    }
  });

  it('a redaction failure leaves no final run directory', async () => {
    const tmp = mkTmpDir();
    try {
      const input = buildInput(tmp);
      const result = await publishRunEvidence(input, {
        redact: async () => {
          throw new Error('boom');
        },
      });
      expectNothingCommitted(tmp, result, 'redaction.failed');
    } finally {
      rmTmpDir(tmp);
    }
  });

  it('a record invalidated by redaction fails the write', async () => {
    const tmp = mkTmpDir();
    try {
      const credential = 'hunter22';
      const submission = makeSubmission({
        attachments: [
          {
            url: 'https://user:' + credential + '@github.com/user-attachments/files/1/a.txt',
            format: 'txt',
            bytes: 10,
            content_hash: null,
            required: false,
            entries: null,
          },
        ],
      });
      const input = buildInput(tmp, { submission });
      const result = await publishRunEvidence(input);
      expectNothingCommitted(tmp, result, 'evidence.redaction-invalidated');
    } finally {
      rmTmpDir(tmp);
    }
  });

  it('a file-write failure leaves no final run directory', async () => {
    const tmp = mkTmpDir();
    try {
      const input = buildInput(tmp);
      const fsImpl = failingWriteFs((p) => p.endsWith('report.md'));
      const result = await publishRunEvidence(input, { fs: fsImpl });
      expectNothingCommitted(tmp, result, 'evidence.write-failed');
    } finally {
      rmTmpDir(tmp);
    }
  });

  it('a metrics write failure leaves no final run directory', async () => {
    const tmp = mkTmpDir();
    try {
      const input = buildInput(tmp);
      const fsImpl = failingWriteFs((p) => p.includes(path.sep + 'metrics' + path.sep));
      const result = await publishRunEvidence(input, { fs: fsImpl });
      expectNothingCommitted(tmp, result, 'evidence.write-failed');
    } finally {
      rmTmpDir(tmp);
    }
  });

  it('a manifest write failure leaves no final run directory', async () => {
    const tmp = mkTmpDir();
    try {
      const input = buildInput(tmp);
      const fsImpl = failingWriteFs((p) => p.endsWith('manifest.json'));
      const result = await publishRunEvidence(input, { fs: fsImpl });
      expectNothingCommitted(tmp, result, 'evidence.write-failed');
    } finally {
      rmTmpDir(tmp);
    }
  });

  it('a rename failure leaves no final run directory', async () => {
    const tmp = mkTmpDir();
    try {
      const input = buildInput(tmp);
      const fsImpl: EvidenceFs = {
        ...nodeEvidenceFs,
        rename: async () => {
          throw Object.assign(new Error('injected'), { code: 'EIO' });
        },
      };
      const result = await publishRunEvidence(input, { fs: fsImpl });
      expectNothingCommitted(tmp, result, 'evidence.write-failed');
    } finally {
      rmTmpDir(tmp);
    }
  });

  it('records over the run byte limit fail the write', async () => {
    const tmp = mkTmpDir();
    try {
      const policy: LoadedPolicy = {
        ...trustedPolicy,
        policy: {
          ...DEFAULT_CHECKLIST_POLICY,
          limits: {
            ...DEFAULT_CHECKLIST_POLICY.limits,
            evidence: { ...DEFAULT_CHECKLIST_POLICY.limits.evidence, run_bytes: 65536 },
          },
        },
      };
      const submission = makeSubmission({ fieldsExtra: { problem: 'x'.repeat(60000) } });
      const input = buildInput(tmp, { submission, policy });
      const result = await publishRunEvidence(input);
      expectNothingCommitted(tmp, result, 'evidence.too-large');
    } finally {
      rmTmpDir(tmp);
    }
  });

  it('an unsafe repository name fails before any write', async () => {
    const tmp = mkTmpDir();
    try {
      const submission = makeSubmission({ repository: 'octo/..' });
      const input = buildInput(tmp, { submission });
      const result = await publishRunEvidence(input);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.failure.code).toBe('evidence.layout-invalid');
      expect(result.failure.outcome).toBe('inconclusive');
      expect('value' in result).toBe(false);
      expect(fs.readdirSync(tmp)).toEqual([]);
    } finally {
      rmTmpDir(tmp);
    }
  });
});
