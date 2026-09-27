import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

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
import { evidenceManifestSchema } from './manifest.js';
import { prettyJson } from './pretty-json.js';
import { contentHash, canonicalJsonHash } from '../hash.js';
import { BUILT_IN_DETECTORS } from '../redaction/detectors.js';
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
    logLines: options.logLines ?? ['gate: complete'],
    credentials: options.credentials ?? [],
    localRun: true,
    createdAt: '2026-09-27T10:15:03.000Z',
  };
}

function mkTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'm5-pub-'));
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

describe('publishRunEvidence', { timeout: 30000 }, () => {
  it('publish writes the approved run directory layout', async () => {
    const tmp = mkTmpDir();
    try {
      const input = buildInput(tmp);
      const result = await publishRunEvidence(input);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const root = path.join(tmp, 'octo', 'demo');
      expect(result.value.directory).toBe(path.resolve(path.join(root, 'runs', 'pr-12', RUN_ID)));

      const files = listFiles(root);
      expect(files).toEqual(
        [
          `metrics/2026-09/${RUN_ID}.json`,
          ...[
            'decision.json',
            'findings/finding-0001.json',
            'findings/finding-0002.json',
            'logs/steward.txt',
            'manifest.json',
            'policy-revision.json',
            'report.json',
            'report.md',
            'run.json',
            'submission.json',
          ].map((p) => `runs/pr-12/${RUN_ID}/${p}`),
        ].sort(),
      );
    } finally {
      rmTmpDir(tmp);
    }
  });

  it('stored json files follow the pretty json rules', async () => {
    const tmp = mkTmpDir();
    try {
      const input = buildInput(tmp);
      const result = await publishRunEvidence(input);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const root = path.join(tmp, 'octo', 'demo');
      const jsonFiles = listFiles(root).filter((p) => p.endsWith('.json'));
      expect(jsonFiles.length).toBeGreaterThan(0);
      for (const relative of jsonFiles) {
        const full = path.join(root, ...relative.split('/'));
        const buffer = fs.readFileSync(full);
        expect(buffer[0]).not.toBe(0xef);
        const text = buffer.toString('utf8');
        expect(text.includes('\r')).toBe(false);
        expect(text.endsWith('\n')).toBe(true);
        expect(text.endsWith('\n\n')).toBe(false);
        const parsed: unknown = JSON.parse(text);
        const pretty = prettyJson(parsed);
        expect(pretty.ok).toBe(true);
        if (pretty.ok) {
          expect(text).toBe(pretty.value);
        }
      }
    } finally {
      rmTmpDir(tmp);
    }
  });

  it('manifest lists every stored file with its bytes and hashes', async () => {
    const tmp = mkTmpDir();
    try {
      const input = buildInput(tmp);
      const result = await publishRunEvidence(input);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const root = path.join(tmp, 'octo', 'demo');
      const manifestPath = path.join(root, 'runs', 'pr-12', RUN_ID, 'manifest.json');
      const manifestText = fs.readFileSync(manifestPath, 'utf8');
      const manifestParsed = evidenceManifestSchema.parse(JSON.parse(manifestText));

      expect(manifestParsed.store_path).toBe(`runs/pr-12/${RUN_ID}`);
      expect([...manifestParsed.redaction.detectors].sort()).toEqual([...BUILT_IN_DETECTORS.map((d) => d.id)].sort());
      expect(manifestParsed.redaction.detectors).toHaveLength(23);

      const expectedFiles = listFiles(root)
        .filter((p) => p.startsWith(`runs/pr-12/${RUN_ID}/`) && p !== `runs/pr-12/${RUN_ID}/manifest.json`)
        .map((p) => p.slice(`runs/pr-12/${RUN_ID}/`.length))
        .sort();
      expect(manifestParsed.files.map((f) => f.path)).toEqual(expectedFiles);

      for (const entry of manifestParsed.files) {
        const full = path.join(root, 'runs', 'pr-12', RUN_ID, ...entry.path.split('/'));
        const buffer = fs.readFileSync(full);
        expect(entry.bytes).toBe(buffer.length);
        expect(entry.sha256).toBe(contentHash(buffer));
        if (entry.record_type !== null) {
          const parsed: unknown = JSON.parse(buffer.toString('utf8'));
          const hash = canonicalJsonHash(parsed);
          expect(hash.ok).toBe(true);
          if (hash.ok) {
            expect(entry.content_hash).toBe(hash.value);
          }
        }
      }

      const metricsFull = path.join(tmp, 'octo', 'demo', 'metrics', '2026-09', `${RUN_ID}.json`);
      const metricsBuffer = fs.readFileSync(metricsFull);
      expect(manifestParsed.metrics.bytes).toBe(metricsBuffer.length);
      expect(manifestParsed.metrics.sha256).toBe(contentHash(metricsBuffer));
    } finally {
      rmTmpDir(tmp);
    }
  });

  it('report.md equals the rendered report record', async () => {
    const tmp = mkTmpDir();
    try {
      const input = buildInput(tmp);
      const result = await publishRunEvidence(input);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const root = path.join(tmp, 'octo', 'demo', 'runs', 'pr-12', RUN_ID);
      const reportJson = JSON.parse(fs.readFileSync(path.join(root, 'report.json'), 'utf8')) as {
        rendered: string;
        bound: { policy_revision: string; snapshot_hash: string; head_commit: string; base_commit: string };
      };
      const reportMd = fs.readFileSync(path.join(root, 'report.md'), 'utf8');

      expect(reportJson.rendered).toBe(reportMd);
      expect(reportMd).toBe(result.value.report);
      expect(reportJson.bound).toEqual({
        policy_revision: 'b'.repeat(40),
        snapshot_hash: 'sha256:' + '5'.repeat(64),
        head_commit: 'c'.repeat(40),
        base_commit: 'd'.repeat(40),
      });
      expect(reportMd).toContain('- Outcome: `needs-changes`');
      expect(reportMd).toContain('Request `R1`');
    } finally {
      rmTmpDir(tmp);
    }
  });

  it('metrics events go to the monthly partition', async () => {
    const tmp = mkTmpDir();
    try {
      const input = buildInput(tmp);
      const result = await publishRunEvidence(input);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const metricsFile = path.join(tmp, 'octo', 'demo', 'metrics', '2026-09', `${RUN_ID}.json`);
      const events = JSON.parse(fs.readFileSync(metricsFile, 'utf8')) as readonly { kind: string }[];
      expect(events.map((e) => e.kind)).toEqual(['state-transition', 'latency', 'cost', 'state-transition']);
    } finally {
      rmTmpDir(tmp);
    }
  });

  it('a resolved credential appears in no stored file', async () => {
    const tmp = mkTmpDir();
    try {
      const credential = 's3ntinel' + '-token-' + 'value42';
      const forms = [
        credential,
        Buffer.from(credential).toString('base64'),
        Buffer.from('x-access-token:' + credential).toString('base64'),
      ];
      const submission = makeSubmission({ problem: 'see ' + credential });
      const input = buildInput(tmp, {
        submission,
        f2Subjects: ['dir/' + credential],
        logLines: ['gate: complete', ...forms],
        credentials: [credential],
      });
      const result = await publishRunEvidence(input);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const root = path.join(tmp, 'octo', 'demo');
      for (const relative of listFiles(root)) {
        const text = fs.readFileSync(path.join(root, ...relative.split('/')), 'utf8');
        for (const form of forms) {
          expect(text.includes(form)).toBe(false);
        }
      }

      const manifest = JSON.parse(fs.readFileSync(path.join(root, 'runs', 'pr-12', RUN_ID, 'manifest.json'), 'utf8')) as {
        redaction: { exact_values: number; replacements: readonly { id: string; count: number }[] };
      };
      expect(manifest.redaction.exact_values).toBe(3);
      expect(manifest.redaction.replacements.some((r) => r.id === 'known-secret')).toBe(true);
    } finally {
      rmTmpDir(tmp);
    }
  });

  it('every stored string is redacted before write', async () => {
    const tmp = mkTmpDir();
    try {
      const token = 'ghp_' + 'A1b2C3d4'.repeat(4) + 'E5f6';
      const submission = makeSubmission({ problem: 'token ' + token });
      const input = buildInput(tmp, {
        submission,
        f2Subjects: [token],
        logLines: ['gate: complete', 'token ' + token],
      });
      const result = await publishRunEvidence(input);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const root = path.join(tmp, 'octo', 'demo');
      for (const relative of listFiles(root)) {
        const text = fs.readFileSync(path.join(root, ...relative.split('/')), 'utf8');
        expect(text.includes(token)).toBe(false);
      }

      const runDir = path.join(root, 'runs', 'pr-12', RUN_ID);
      expect(fs.readFileSync(path.join(runDir, 'submission.json'), 'utf8')).toContain('[REDACTED:github-token]');
      expect(fs.readFileSync(path.join(runDir, 'report.md'), 'utf8')).toContain('[REDACTED:github-token]');
      expect(fs.readFileSync(path.join(runDir, 'logs', 'steward.txt'), 'utf8')).toContain('[REDACTED:github-token]');
    } finally {
      rmTmpDir(tmp);
    }
  });

  it('the report is rendered from redacted records', async () => {
    const tmp = mkTmpDir();
    try {
      const token = 'ghp_' + 'A1b2C3d4'.repeat(4) + 'E5f6';
      const input = buildInput(tmp, { f2Subjects: [token] });
      const result = await publishRunEvidence(input);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const runDir = path.join(tmp, 'octo', 'demo', 'runs', 'pr-12', RUN_ID);
      const reportMd = fs.readFileSync(path.join(runDir, 'report.md'), 'utf8');
      const uncertaintiesSection = reportMd.slice(reportMd.indexOf('## Uncertainties'));
      expect(uncertaintiesSection).toMatch(/`[^`]*\[REDACTED:github-token\][^`]*`/);
      expect(result.value.report).toBe(reportMd);
    } finally {
      rmTmpDir(tmp);
    }
  });

  it('subject overflow keeps the full count in the report', async () => {
    const tmp = mkTmpDir();
    try {
      const manySubjects = Array.from({ length: 1500 }, (_, i) => `src/f-${String(i + 1).padStart(4, '0')}.ts`);
      const input = buildInput(tmp, { f2Subjects: manySubjects });
      const result = await publishRunEvidence(input);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const runDir = path.join(tmp, 'octo', 'demo', 'runs', 'pr-12', RUN_ID);
      const reportMd = fs.readFileSync(path.join(runDir, 'report.md'), 'utf8');
      expect(reportMd).toContain('and 1490 more');

      const finding2 = JSON.parse(fs.readFileSync(path.join(runDir, 'findings', 'finding-0002.json'), 'utf8')) as {
        subjects: readonly string[];
        basis: string;
      };
      expect(finding2.subjects).toHaveLength(1000);
      expect(finding2.basis.endsWith(' Subjects recorded: 1000 of 1500.')).toBe(true);
    } finally {
      rmTmpDir(tmp);
    }
  });

  it('the run byte limit truncates logs first', async () => {
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
      const logLines = Array.from({ length: 3000 }, (_, i) => `line ${i} ${'x'.repeat(40)}`);
      const input = buildInput(tmp, { policy, logLines });
      const result = await publishRunEvidence(input);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const root = path.join(tmp, 'octo', 'demo');
      const runDir = path.join(root, 'runs', 'pr-12', RUN_ID);
      const logText = fs.readFileSync(path.join(runDir, 'logs', 'steward.txt'), 'utf8');
      expect(logText).toContain('[truncated ');

      let total = 0;
      for (const relative of listFiles(root)) {
        total += fs.statSync(path.join(root, ...relative.split('/'))).size;
      }
      expect(total).toBeLessThanOrEqual(65536);

      const manifest = JSON.parse(fs.readFileSync(path.join(runDir, 'manifest.json'), 'utf8')) as {
        files: readonly { path: string; bytes: number }[];
      };
      const logEntry = manifest.files.find((f) => f.path === 'logs/steward.txt');
      expect(logEntry?.bytes).toBe(Buffer.byteLength(logText, 'utf8'));
    } finally {
      rmTmpDir(tmp);
    }
  });
});
