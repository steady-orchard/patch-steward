import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { verifyRunDirectory } from './verify.js';
import { publishRunEvidence } from './publish.js';
import type { RunEvidenceInput } from './publish.js';
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
import { prettyJson } from './pretty-json.js';
import { contentHash, canonicalJsonHash } from '../hash.js';
import type { ClassificationInput } from '../report/templates.js';

const RUN_ID = 'local-20260927T101500Z-3f9a1c2e';

const trustedPolicy: LoadedPolicy = {
  revision: { kind: 'git-tree', id: 'b'.repeat(40), commit: 'a'.repeat(40), ref: 'main' },
  policy: DEFAULT_CHECKLIST_POLICY,
  authoritative: true,
};

function makeSubmission(): SubmissionRecord {
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
    fields: { category: 'bugfix' },
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
    {
      stage: 'contract',
      severity: 'uncertain',
      code: 'submission.execution-sensitive-change',
      detail: null,
      field: null,
      subjects: ['package.json'],
      message: CONTRACT_FINDING_MESSAGES['submission.execution-sensitive-change'],
    },
  ];
}

function buildInput(evidenceDir: string): RunEvidenceInput {
  const submission = makeSubmission();
  const findings = makeFindings();
  const loadedPolicy = trustedPolicy;
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

  const classification: ClassificationInput = { type: 'pull_request', category: 'bugfix', consistent: true, plausible: ['bugfix'] };

  return {
    evidenceDir,
    assembly,
    classification,
    defaultBranch: 'main',
    logLines: ['gate: complete'],
    credentials: [],
    localRun: true,
    createdAt: '2026-09-27T10:15:03.000Z',
  };
}

function mkTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'm5-verify-'));
}

function rmTmpDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

let sourceStore: string;
let runDirRelative: readonly string[];

beforeAll(async () => {
  sourceStore = mkTmpDir();
  const input = buildInput(sourceStore);
  const result = await publishRunEvidence(input);
  if (!result.ok) {
    throw new Error('test setup: publishRunEvidence failed');
  }
  runDirRelative = ['octo', 'demo', 'runs', 'pr-12', RUN_ID];
});

afterAll(() => {
  rmTmpDir(sourceStore);
});

function freshRunDir(): { root: string; runDir: string } {
  const root = mkTmpDir();
  fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  fs.cpSync(sourceStore, root, { recursive: true });
  const runDir = path.join(root, ...runDirRelative);
  return { root, runDir };
}

function rewriteListed(runDir: string, relPath: string, newBytes: Buffer, updateContentHash: boolean): void {
  const target = path.join(runDir, ...relPath.split('/'));
  fs.writeFileSync(target, newBytes);

  const manifestPath = path.join(runDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
    files: { path: string; bytes: number; sha256: string; content_hash: string | null }[];
  };
  const entry = manifest.files.find((f) => f.path === relPath);
  if (entry === undefined) {
    throw new Error('rewriteListed: entry not found');
  }
  entry.bytes = newBytes.length;
  entry.sha256 = contentHash(newBytes);
  if (updateContentHash) {
    const parsed: unknown = JSON.parse(newBytes.toString('utf8'));
    const hash = canonicalJsonHash(parsed);
    if (!hash.ok) {
      throw new Error('rewriteListed: canonicalJsonHash failed');
    }
    entry.content_hash = hash.value;
  }
  const prettyResult = prettyJson(manifest);
  if (!prettyResult.ok) {
    throw new Error('rewriteListed: prettyJson failed');
  }
  fs.writeFileSync(manifestPath, prettyResult.value);
}

describe('verifyRunDirectory', { timeout: 30000 }, () => {
  it('a stored run verifies', async () => {
    const { root, runDir } = freshRunDir();
    try {
      const result = await verifyRunDirectory(runDir);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.files).toBe(9);
      expect(result.value.metrics).toBe('verified');
      expect(result.value.warnings).toEqual([]);
      expect(result.value.decision.outcome).toBe('needs-changes');
      expect(result.value.findings).toHaveLength(2);
      expect(result.value.reportMarkdown).toBe(result.value.report.rendered);
    } finally {
      rmTmpDir(root);
    }
  });

  const tamperCases: readonly { title: string; tamper: (runDir: string) => void }[] = [
    { title: 'a missing manifest', tamper: (runDir) => fs.rmSync(path.join(runDir, 'manifest.json')) },
    { title: 'an invalid manifest', tamper: (runDir) => fs.writeFileSync(path.join(runDir, 'manifest.json'), '{}\n') },
    { title: 'a missing listed file', tamper: (runDir) => fs.rmSync(path.join(runDir, 'run.json')) },
    {
      title: 'a changed file size',
      tamper: (runDir) => fs.appendFileSync(path.join(runDir, 'logs', 'steward.txt'), 'x'),
    },
    {
      title: 'a changed file hash',
      tamper: (runDir) => {
        const logPath = path.join(runDir, 'logs', 'steward.txt');
        const text = fs.readFileSync(logPath, 'utf8');
        const replaced = (text[0] === 'g' ? 'x' : 'g') + text.slice(1);
        fs.writeFileSync(logPath, replaced);
      },
    },
    {
      title: 'an unlisted file',
      tamper: (runDir) => fs.writeFileSync(path.join(runDir, 'notes.txt'), 'hi'),
    },
    {
      title: 'a record that fails its schema',
      tamper: (runDir) => {
        const decisionPath = path.join(runDir, 'decision.json');
        const parsed = JSON.parse(fs.readFileSync(decisionPath, 'utf8')) as Record<string, unknown>;
        (parsed as Record<string, unknown>)['extra_key'] = true;
        const prettyResult = prettyJson(parsed);
        if (!prettyResult.ok) throw new Error('prettyJson failed');
        rewriteListed(runDir, 'decision.json', Buffer.from(prettyResult.value, 'utf8'), true);
      },
    },
    {
      title: 'a record content hash mismatch',
      tamper: (runDir) => {
        const decisionPath = path.join(runDir, 'decision.json');
        const parsed = JSON.parse(fs.readFileSync(decisionPath, 'utf8')) as {
          requests: readonly { text: string }[];
        };
        const requests = parsed.requests.map((r, i) => (i === 0 ? { ...r, text: r.text + ' changed' } : r));
        const modified = { ...parsed, requests };
        const prettyResult = prettyJson(modified);
        if (!prettyResult.ok) throw new Error('prettyJson failed');
        rewriteListed(runDir, 'decision.json', Buffer.from(prettyResult.value, 'utf8'), false);
      },
    },
    {
      title: 'a report that differs from its record',
      tamper: (runDir) => {
        const mdPath = path.join(runDir, 'report.md');
        const text = fs.readFileSync(mdPath, 'utf8');
        rewriteListed(runDir, 'report.md', Buffer.from(text + '\nextra line\n', 'utf8'), false);
      },
    },
    {
      title: 'a mismatched metrics file',
      tamper: (runDir) => {
        const metricsPath = path.resolve(runDir, '..', '..', '..', 'metrics', '2026-09', `${RUN_ID}.json`);
        fs.appendFileSync(metricsPath, ' ');
      },
    },
  ];

  it.each(tamperCases)('verification rejects $title', async ({ tamper }) => {
    const { root, runDir } = freshRunDir();
    try {
      tamper(runDir);
      const result = await verifyRunDirectory(runDir);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.failure.code).toBe('report.evidence-invalid');
      expect('value' in result).toBe(false);
    } finally {
      rmTmpDir(root);
    }
  });

  it('a missing metrics file is a warning', async () => {
    const { root, runDir } = freshRunDir();
    try {
      const metricsPath = path.resolve(runDir, '..', '..', '..', 'metrics', '2026-09', `${RUN_ID}.json`);
      fs.rmSync(metricsPath);
      const result = await verifyRunDirectory(runDir);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.metrics).toBe('missing');
      expect(result.value.warnings).toEqual([
        { code: 'report.metrics-missing', message: 'The metrics file of this run is missing.' },
      ]);
    } finally {
      rmTmpDir(root);
    }
  });

  it('an unreadable run directory fails', async () => {
    const { root, runDir } = freshRunDir();
    try {
      const nonexistent = await verifyRunDirectory(path.join(runDir, 'does-not-exist'));
      expect(nonexistent.ok).toBe(false);
      if (!nonexistent.ok) {
        expect(nonexistent.failure.code).toBe('report.run-unreadable');
      }

      const regularFile = await verifyRunDirectory(path.join(runDir, 'run.json'));
      expect(regularFile.ok).toBe(false);
      if (!regularFile.ok) {
        expect(regularFile.failure.code).toBe('report.run-unreadable');
      }
    } finally {
      rmTmpDir(root);
    }
  });
});
