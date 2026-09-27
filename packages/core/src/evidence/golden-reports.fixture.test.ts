import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import { publishRunEvidence } from './publish.js';
import type { RunEvidenceInput } from './publish.js';
import { prepareFindings, decisionFindings } from './assemble.js';
import type { RunAssemblyInput } from './assemble.js';
import type { HandoffFinding } from '../pipeline/handoff.js';
import { CONTRACT_FINDING_MESSAGES } from '../submission/contract.js';
import { decideOutcome } from '../decision/table.js';
import { requiredStages } from '../decision/stages.js';
import type { RequiredStagesInput } from '../decision/stages.js';
import { submissionRecordSchema } from '../records/submission.js';
import type { SubmissionRecord } from '../records/submission.js';
import type { LoadedPolicy } from '../policy/loader.js';
import { DEFAULT_CHECKLIST_POLICY } from '../submission/default-checklist.js';
import type { ClassificationInput } from '../report/templates.js';
import type { FindingTemplateContext } from '../report/finding-templates.js';
import { reportDenylistMatches, maskCodeSpans } from '../report/denylist.js';
import { reportCharacterViolations, reportFixedTextViolations } from '../report/escape.js';
import { findCredentialDetector } from '../redaction/detectors.js';
import type { Outcome } from '../vocabulary.js';

const RUN_ID = 'local-20260927T101500Z-3f9a1c2e';
const STARTED_AT = '2026-09-27T10:15:00.000Z';
const GATE_COMPLETED_AT = '2026-09-27T10:15:01.000Z';
const FINISHED_AT = '2026-09-27T10:15:03.000Z';
const POLICY_LOADED_AT = '2026-09-27T10:15:00.500Z';
const CREATED_AT = '2026-09-27T10:15:03.000Z';
const STEWARD_VERSION = '0.0.0-golden';
const PHASES = [{ phase: 'gate', seconds: 1, recordedAt: '2026-09-27T10:15:01.000Z' }] as const;

const REPO = 'octo/demo';
const SNAPSHOT_HASH = 'sha256:' + '5'.repeat(64);
const HEAD_COMMIT = 'c'.repeat(40);
const BASE_COMMIT = 'd'.repeat(40);
const LOCAL_POLICY_HASH = 'e'.repeat(64);

const trustedPolicy: LoadedPolicy = {
  revision: { kind: 'git-tree', id: 'b'.repeat(40), commit: 'a'.repeat(40), ref: 'main' },
  policy: DEFAULT_CHECKLIST_POLICY,
  authoritative: true,
};

const localPolicy: LoadedPolicy = {
  revision: { kind: 'local-file', id: `local:${LOCAL_POLICY_HASH}` as const, path: 'policy.yml' },
  policy: DEFAULT_CHECKLIST_POLICY,
  authoritative: false,
};

const NON_AUTHORITATIVE_TEXT = 'Non-authoritative: screened under the local policy file revision `local:' + LOCAL_POLICY_HASH + '`';

const TOKEN = 'ghp_' + 'A1b2C3d4'.repeat(4) + 'E5f6';

const HOSTILE_SUBJECTS: string[] = [
  '@octocat',
  '#1',
  '<img src=x onerror=alert(1)>',
  '[x](javascript:alert(1))',
  'a```b',
  'line\nbreak',
  'rtl\u202Eevil',
  'zero\u200Bwidth',
  'nul\u0000byte',
  'dir/' + TOKEN,
  '$' + '{{ secrets.GITHUB_TOKEN }}',
];

const HOSTILE_URL = 'https://example.com/@octocat/#1/<img src=x onerror=alert(1)>';

const DEFAULT_PR_CLASSIFICATION: ClassificationInput = {
  type: 'pull_request',
  category: 'bugfix',
  consistent: true,
  plausible: ['bugfix'],
};

function makeIssueSubmission(
  issueKind: 'defect' | 'proposal' | null,
  template: { form: string; version: number } | null,
): SubmissionRecord {
  return submissionRecordSchema.parse({
    schema_version: 1,
    record_type: 'submission',
    repository: REPO,
    type: 'issue',
    number: 29,
    snapshot_hash: SNAPSHOT_HASH,
    target_branch: null,
    head_commit: null,
    issue_kind: issueKind,
    category: null,
    fields: {},
    linked_evidence_hashes: [],
    author_responses: [],
    shared_head_pull_requests: [],
    contract_results: [],
    trusted_paths_changed: null,
    execution_sensitive_paths_changed: null,
    template,
    attachments: [],
    claim_scope_hash: null,
  });
}

function makePrSubmission(overrides: Record<string, unknown> = {}): SubmissionRecord {
  return submissionRecordSchema.parse({
    schema_version: 1,
    record_type: 'submission',
    repository: REPO,
    type: 'pull_request',
    number: 12,
    snapshot_hash: SNAPSHOT_HASH,
    target_branch: 'main',
    head_commit: HEAD_COMMIT,
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
    ...overrides,
  });
}

interface BuildOptions {
  readonly submission: SubmissionRecord;
  readonly findings: readonly HandoffFinding[];
  readonly classification: ClassificationInput;
  readonly loadedPolicy?: LoadedPolicy;
}

function buildCaseInput(evidenceDir: string, opts: BuildOptions): RunEvidenceInput {
  const loadedPolicy = opts.loadedPolicy ?? trustedPolicy;
  const ctx: FindingTemplateContext = {
    repository: opts.submission.repository,
    defaultBranch: 'main',
    submissionType: opts.submission.type,
    template: opts.submission.template ?? null,
    category: opts.submission.category,
    headCommit: opts.submission.head_commit,
    policy: loadedPolicy.policy,
    policyChange: null,
  };
  const prepared = prepareFindings(opts.findings, ctx);
  if (!prepared.ok) {
    throw new Error('test setup: prepareFindings failed');
  }

  const requiredStagesInput: RequiredStagesInput =
    opts.submission.type === 'issue'
      ? { type: 'issue', issueKind: opts.submission.issue_kind }
      : {
          type: 'pull_request',
          plausibleCategories: opts.classification.type === 'pull_request' ? opts.classification.plausible : [],
        };

  const decision = decideOutcome({
    freshness: 'current',
    capacity: 'available',
    admission: 'not-required',
    findings: decisionFindings(prepared.value),
    causes: [],
    requiredStages: requiredStages(requiredStagesInput, loadedPolicy.policy.stages.per_category),
    stageResults: [],
    requirements: [],
  });
  if (decision.kind !== 'outcome') {
    throw new Error('test setup: decision did not resolve to an outcome');
  }

  const assembly: RunAssemblyInput = {
    runId: RUN_ID,
    runAttempt: 1,
    startedAt: STARTED_AT,
    gateCompletedAt: GATE_COMPLETED_AT,
    finishedAt: FINISHED_AT,
    phases: [...PHASES],
    stewardVersion: STEWARD_VERSION,
    loadedPolicy,
    policyLoadedAt: POLICY_LOADED_AT,
    submission: opts.submission,
    baseCommit: opts.submission.type === 'pull_request' ? BASE_COMMIT : null,
    mode: 'observe',
    findings: prepared.value,
    decision,
    githubRequests: 7,
    retries: 0,
  };

  return {
    evidenceDir,
    assembly,
    classification: opts.classification,
    defaultBranch: 'main',
    logLines: ['gate: complete'],
    credentials: [],
    localRun: true,
    createdAt: CREATED_AT,
  };
}

function attachmentViolationFinding(detail: string, subjects: string[]): HandoffFinding {
  return {
    stage: 'contract',
    severity: 'blocking',
    code: 'submission.attachment-violation',
    detail,
    field: null,
    subjects,
    message: CONTRACT_FINDING_MESSAGES['submission.attachment-violation'],
  };
}

interface GoldenCase {
  readonly name: string;
  readonly outcome: Outcome;
  readonly nonAuthoritative: boolean;
  readonly reportExtra: readonly string[];
  readonly summaryExtra: readonly string[];
  readonly reportExcludes: readonly string[];
  readonly build: (evidenceDir: string) => RunEvidenceInput;
}

const CASES: readonly GoldenCase[] = [
  {
    name: 'issue-unstructured',
    outcome: 'needs-changes',
    nonAuthoritative: false,
    reportExtra: [],
    summaryExtra: [],
    reportExcludes: [],
    build: (dir) =>
      buildCaseInput(dir, {
        submission: makeIssueSubmission(null, null),
        findings: [
          {
            stage: 'contract',
            severity: 'blocking',
            code: 'submission.unstructured',
            detail: 'issue-form',
            field: null,
            subjects: [],
            message: CONTRACT_FINDING_MESSAGES['submission.unstructured'],
          },
        ],
        classification: { type: 'issue', issueKind: null },
      }),
  },
  {
    name: 'issue-defect-complete',
    outcome: 'inconclusive',
    nonAuthoritative: false,
    reportExtra: ['stage-incomplete'],
    summaryExtra: [],
    reportExcludes: [],
    build: (dir) =>
      buildCaseInput(dir, {
        submission: makeIssueSubmission('defect', { form: 'defect', version: 1 }),
        findings: [],
        classification: { type: 'issue', issueKind: 'defect' },
      }),
  },
  {
    name: 'pr-field-missing-attachment',
    outcome: 'needs-changes',
    nonAuthoritative: false,
    reportExtra: ['Request `R2`'],
    summaryExtra: [],
    reportExcludes: [],
    build: (dir) =>
      buildCaseInput(dir, {
        submission: makePrSubmission(),
        findings: [
          {
            stage: 'contract',
            severity: 'blocking',
            code: 'submission.field-missing',
            detail: null,
            field: 'regression-test',
            subjects: [],
            message: CONTRACT_FINDING_MESSAGES['submission.field-missing'],
          },
          attachmentViolationFinding('destination', ['https://example.com/log.txt']),
        ],
        classification: DEFAULT_PR_CLASSIFICATION,
      }),
  },
  {
    name: 'pr-execution-sensitive',
    outcome: 'inconclusive',
    nonAuthoritative: false,
    reportExtra: ['Execution-sensitive paths changed'],
    summaryExtra: [],
    reportExcludes: [],
    build: (dir) =>
      buildCaseInput(dir, {
        submission: makePrSubmission({ execution_sensitive_paths_changed: true }),
        findings: [
          {
            stage: 'contract',
            severity: 'uncertain',
            code: 'submission.execution-sensitive-change',
            detail: null,
            field: null,
            subjects: ['package.json', 'scripts/test.sh'],
            message: CONTRACT_FINDING_MESSAGES['submission.execution-sensitive-change'],
          },
        ],
        classification: DEFAULT_PR_CLASSIFICATION,
      }),
  },
  {
    name: 'pr-shared-head',
    outcome: 'needs-changes',
    nonAuthoritative: false,
    reportExtra: [],
    summaryExtra: ['Shared head commit with pull requests `13`, `14`.'],
    reportExcludes: [],
    build: (dir) =>
      buildCaseInput(dir, {
        submission: makePrSubmission({ shared_head_pull_requests: [13, 14] }),
        findings: [
          {
            stage: 'contract',
            severity: 'blocking',
            code: 'submission.shared-head',
            detail: null,
            field: null,
            subjects: ['13', '14'],
            message: CONTRACT_FINDING_MESSAGES['submission.shared-head'],
          },
        ],
        classification: DEFAULT_PR_CLASSIFICATION,
      }),
  },
  {
    name: 'pr-local-policy',
    outcome: 'inconclusive',
    nonAuthoritative: true,
    reportExtra: [NON_AUTHORITATIVE_TEXT],
    summaryExtra: [NON_AUTHORITATIVE_TEXT],
    reportExcludes: [],
    build: (dir) =>
      buildCaseInput(dir, {
        submission: makePrSubmission(),
        findings: [],
        classification: DEFAULT_PR_CLASSIFICATION,
        loadedPolicy: localPolicy,
      }),
  },
  {
    name: 'pr-overflow',
    outcome: 'needs-changes',
    nonAuthoritative: false,
    reportExtra: [`- 3 more blockers are recorded in the evidence: \`runs/pr-12/${RUN_ID}\`.`],
    summaryExtra: [],
    reportExcludes: [],
    build: (dir) =>
      buildCaseInput(dir, {
        submission: makePrSubmission(),
        findings: Array.from({ length: 23 }, (_, i) =>
          attachmentViolationFinding('destination', [`https://example.com/file-${String(i + 1).padStart(2, '0')}.txt`]),
        ),
        classification: DEFAULT_PR_CLASSIFICATION,
      }),
  },
  {
    name: 'pr-hostile',
    outcome: 'needs-changes',
    nonAuthoritative: false,
    reportExtra: ['[REDACTED:github-token]', '\\u{202E}'],
    summaryExtra: [],
    reportExcludes: [TOKEN],
    build: (dir) =>
      buildCaseInput(dir, {
        submission: makePrSubmission(),
        findings: [
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
            subjects: HOSTILE_SUBJECTS,
            message: CONTRACT_FINDING_MESSAGES['submission.execution-sensitive-change'],
          },
          {
            stage: 'contract',
            severity: 'advisory',
            code: 'submission.trusted-path-change',
            detail: null,
            field: null,
            subjects: HOSTILE_SUBJECTS,
            message: CONTRACT_FINDING_MESSAGES['submission.trusted-path-change'],
          },
          attachmentViolationFinding('destination', [HOSTILE_URL]),
        ],
        classification: DEFAULT_PR_CLASSIFICATION,
      }),
  },
];

const FIXTURES_DIR = fileURLToPath(new URL('../../../../fixtures/reports/', import.meta.url));

function mkTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'm5-golden-'));
}

function rmTmpDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

function normalize(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

function readGolden(name: string): string {
  return normalize(fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf8'));
}

interface Produced {
  readonly report: string;
  readonly checkSummary: string;
}

const produced = new Map<string, Produced>();

describe('golden report fixtures', { timeout: 60000 }, () => {
  beforeAll(async () => {
    for (const testCase of CASES) {
      const tmp = mkTmpDir();
      try {
        const input = testCase.build(tmp);
        const result = await publishRunEvidence(input);
        if (!result.ok) {
          throw new Error(`test setup: publishRunEvidence failed for ${testCase.name}: ${result.failure.code}`);
        }
        const report = fs.readFileSync(path.join(result.value.directory, 'report.md'), 'utf8');
        produced.set(testCase.name, { report, checkSummary: result.value.reportRecord.check_summary });
      } finally {
        rmTmpDir(tmp);
      }
    }
  });

  it.each(CASES.map((c) => [c.name, c] as const))('golden report %s matches', (_name, testCase) => {
    const p = produced.get(testCase.name);
    if (p === undefined) throw new Error('test setup: no produced report');
    const golden = readGolden(`${testCase.name}.report.txt`);
    const actual = normalize(p.report);
    expect(actual).toBe(golden);
    expect(actual.startsWith('## Patch Steward screening report\n')).toBe(true);
    expect(actual).toContain('- Outcome: `' + testCase.outcome + '`');
    expect(actual).toContain('> Local run:');
    expect(actual.includes('Non-authoritative')).toBe(testCase.nonAuthoritative);
    for (const extra of testCase.reportExtra) {
      expect(actual).toContain(extra);
    }
    for (const excluded of testCase.reportExcludes) {
      expect(actual.includes(excluded)).toBe(false);
    }
  });

  it.each(CASES.map((c) => [c.name, c] as const))('golden check summary %s matches', (_name, testCase) => {
    const p = produced.get(testCase.name);
    if (p === undefined) throw new Error('test setup: no produced check summary');
    const golden = readGolden(`${testCase.name}.summary.txt`);
    const actual = normalize(p.checkSummary);
    expect(actual).toBe(golden);
    expect(actual.includes('Non-authoritative')).toBe(testCase.nonAuthoritative);
    for (const extra of testCase.summaryExtra) {
      expect(actual).toContain(extra);
    }
  });

  it('every golden case has an entry and every entry has its files', () => {
    const casesJson = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'cases.json'), 'utf8')) as readonly {
      case: string;
      report: string;
      summary: string;
    }[];
    const casesNames = casesJson.map((c) => c.case).sort();
    const goldenNames = CASES.map((c) => c.name).sort();
    expect(casesNames).toEqual(goldenNames);

    for (const entry of casesJson) {
      expect(fs.existsSync(path.join(FIXTURES_DIR, entry.report))).toBe(true);
      expect(fs.existsSync(path.join(FIXTURES_DIR, entry.summary))).toBe(true);
    }

    const referenced = new Set(casesJson.flatMap((c) => [c.report, c.summary]));
    const actualFiles = fs.readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.txt'));
    for (const file of actualFiles) {
      expect(referenced.has(file)).toBe(true);
    }
  });

  it('golden reports have no denylisted wording', () => {
    for (const testCase of CASES) {
      for (const suffix of ['report', 'summary'] as const) {
        const text = readGolden(`${testCase.name}.${suffix}.txt`);
        const masked = maskCodeSpans(text);
        expect(reportDenylistMatches(masked)).toEqual([]);
        expect(reportFixedTextViolations(masked)).toEqual([]);
      }
    }
  });

  it('golden reports contain no control or format character', () => {
    for (const testCase of CASES) {
      for (const suffix of ['report', 'summary'] as const) {
        const text = readGolden(`${testCase.name}.${suffix}.txt`);
        expect(reportCharacterViolations(text)).toEqual([]);
        expect(findCredentialDetector(text)).toBeNull();
      }
    }
  });
});
