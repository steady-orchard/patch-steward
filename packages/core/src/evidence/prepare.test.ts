import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { publishRunEvidence, prepareRunEvidence } from './publish.js';
import type { RunEvidenceInput, RunEvidencePreparation } from './publish.js';
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
import { REPORT_LOCAL_RUN_NOTICE } from '../report/templates.js';
import type { ClassificationInput } from '../report/templates.js';

const RUN_ID = 'local-20260927T101500Z-3f9a1c2e';

const trustedPolicy: LoadedPolicy = {
  revision: { kind: 'git-tree', id: 'b'.repeat(40), commit: 'a'.repeat(40), ref: 'main' },
  policy: DEFAULT_CHECKLIST_POLICY,
  authoritative: true,
};

function makeSubmission(fieldsExtra: Record<string, string> = {}): SubmissionRecord {
  return submissionRecordSchema.parse({
    schema_version: 1,
    record_type: 'submission',
    repository: 'octo/demo',
    type: 'pull_request',
    number: 12,
    snapshot_hash: 'sha256:' + '5'.repeat(64),
    target_branch: 'main',
    head_commit: 'c'.repeat(40),
    issue_kind: null,
    category: 'bugfix',
    fields: { category: 'bugfix', ...fieldsExtra },
    linked_evidence_hashes: [],
    author_responses: [],
    shared_head_pull_requests: [],
    contract_results: [],
    trusted_paths_changed: false,
    execution_sensitive_paths_changed: false,
    template: { form: 'pull_request', version: 1 },
    attachments: [],
    claim_scope_hash: null,
  });
}

function makeFindings(f2Subjects: readonly string[] = ['package.json']): readonly HandoffFinding[] {
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
    {
      stage: 'contract',
      severity: 'uncertain',
      code: 'submission.execution-sensitive-change',
      detail: null,
      field: null,
      subjects: [...f2Subjects],
      message: CONTRACT_FINDING_MESSAGES['submission.execution-sensitive-change'],
    },
  ];
}

interface ScenarioOptions {
  readonly submission?: SubmissionRecord;
  readonly f2Subjects?: readonly string[];
  readonly logLines?: readonly string[];
  readonly credentials?: readonly string[];
  readonly policy?: LoadedPolicy;
  readonly runId?: string | number;
  readonly localRun?: boolean;
  readonly evidenceLocation?: string;
}

function buildInput(evidenceDir: string, options: ScenarioOptions = {}): RunEvidenceInput {
  const submission = options.submission ?? makeSubmission();
  const findings = makeFindings(options.f2Subjects);
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
    runId: options.runId ?? RUN_ID,
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

  const classification: ClassificationInput = { type: 'pull_request', category: 'bugfix', consistent: true, plausible: ['bugfix'] };

  const preparation: RunEvidencePreparation = {
    assembly,
    classification,
    defaultBranch: 'main',
    logLines: options.logLines ?? ['gate: complete'],
    credentials: options.credentials ?? [],
    localRun: options.localRun ?? true,
    createdAt: '2026-09-27T10:15:03.000Z',
    ...(options.evidenceLocation !== undefined ? { evidenceLocation: options.evidenceLocation } : {}),
  };

  return {
    evidenceDir,
    ...preparation,
  };
}

function mkTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'm6-p2-prep-'));
}

function rmTmpDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

function listFiles(root: string): readonly string[] {
  const results: string[] = [];
  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        results.push(path.relative(root, full).split(path.sep).join('/'));
      }
    }
  }
  walk(root);
  return results.sort();
}

describe('prepared run evidence', { timeout: 30000 }, () => {
  it('prepared run files equal the local store bytes', async () => {
    const dir = mkTmpDir();
    try {
      const preparedResult = await prepareRunEvidence(buildInput(dir));
      expect(preparedResult.ok).toBe(true);
      if (!preparedResult.ok) return;
      const prepared = preparedResult.value;

      const published = await publishRunEvidence(buildInput(dir));
      expect(published.ok).toBe(true);
      if (!published.ok) return;
      const result = published.value;

      for (const file of prepared.files) {
        const full = path.join(result.directory, ...file.path.split('/'));
        expect(Buffer.from(fs.readFileSync(full))).toEqual(Buffer.from(file.bytes));
      }
      expect(Buffer.from(fs.readFileSync(path.join(result.directory, 'manifest.json')))).toEqual(
        Buffer.from(prepared.manifestBytes),
      );
      const storeRoot = path.resolve(result.directory, '..', '..', '..');
      const metricsFull = path.join(storeRoot, ...prepared.metrics.path.split('/'));
      expect(Buffer.from(fs.readFileSync(metricsFull))).toEqual(Buffer.from(prepared.metrics.bytes));

      expect(listFiles(result.directory)).toEqual([...prepared.files.map((f) => f.path), 'manifest.json'].sort());
      expect(prepared.storePath).toBe(result.storePath);
      expect(prepared.report).toBe(result.report);
    } finally {
      rmTmpDir(dir);
    }
  });

  it('a hosted evidence location replaces the store path in the report', async () => {
    const dir = mkTmpDir();
    try {
      const evidenceLocation = 'https://github.com/octo/evidence/tree/steward-evidence/octo/demo/runs/pr-12/36081628326-1';
      const input = buildInput(dir, { runId: 36081628326, localRun: false, evidenceLocation });
      const result = await prepareRunEvidence(input);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.storePath).toBe('runs/pr-12/36081628326-1');
      expect(result.value.report).toContain('`' + evidenceLocation + '/findings/finding-0001.json`');
      expect(result.value.report).not.toMatch(/`runs\/pr-12\//);
      expect(result.value.report).not.toContain(REPORT_LOCAL_RUN_NOTICE);
      expect(result.value.checkSummary).toContain(evidenceLocation);
      expect(result.value.metrics.path).toBe('metrics/2026-09/36081628326-1.json');
    } finally {
      rmTmpDir(dir);
    }
  });

  it('without an evidence location the report shows the store path', async () => {
    const dir = mkTmpDir();
    try {
      const result = await prepareRunEvidence(buildInput(dir));
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.report).toContain('`runs/pr-12/' + RUN_ID + '/findings/finding-0001.json`');
      expect(result.value.checkSummary).toContain('runs/pr-12/' + RUN_ID);
    } finally {
      rmTmpDir(dir);
    }
  });

  it('an invalid repository fails evidence preparation', async () => {
    const dir = mkTmpDir();
    try {
      const input = buildInput(dir);
      const invalid: RunEvidencePreparation = {
        ...input,
        assembly: { ...input.assembly, submission: { ...input.assembly.submission, repository: 'bad/../x' } as SubmissionRecord },
      };
      const result = await prepareRunEvidence(invalid);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.failure.code).toBe('evidence.layout-invalid');
    } finally {
      rmTmpDir(dir);
    }
  });
});
