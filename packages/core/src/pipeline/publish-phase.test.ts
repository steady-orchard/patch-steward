import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { publishLocalRun, localDecisionInput } from './publish-phase.js';
import type { LocalRunContext, LocalPublishInput } from './publish-phase.js';
import { handoffRecordSchema } from './handoff.js';
import type { HandoffFinding, HandoffRecord } from './handoff.js';
import { initialBudget } from './budget.js';
import type { RecordCause } from '../records/decision.js';
import type { StageResult } from '../decision/stages.js';
import { submissionRecordSchema } from '../records/submission.js';
import type { SubmissionRecord } from '../records/submission.js';
import { CONTRACT_FINDING_MESSAGES } from '../submission/contract.js';
import { DEFAULT_CHECKLIST_POLICY } from '../submission/default-checklist.js';
import type { LoadedPolicy } from '../policy/loader.js';
import { nodeEvidenceFs } from '../evidence/local-store.js';
import type { ClassificationInput } from '../report/templates.js';

const RUN_ID = 'local-20260927T101500Z-3f9a1c2e';

const trustedPolicy: LoadedPolicy = {
  revision: { kind: 'git-tree', id: 'b'.repeat(40), commit: 'a'.repeat(40), ref: 'main' },
  policy: DEFAULT_CHECKLIST_POLICY,
  authoritative: true,
};

const prSubmission: SubmissionRecord = submissionRecordSchema.parse({
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

const F1: HandoffFinding = {
  stage: 'contract',
  severity: 'blocking',
  code: 'submission.field-missing',
  detail: null,
  field: 'regression-test',
  subjects: [],
  message: CONTRACT_FINDING_MESSAGES['submission.field-missing'],
};

const classification: ClassificationInput = { type: 'pull_request', category: 'bugfix', consistent: true, plausible: ['bugfix'] };

const context: LocalRunContext = {
  runId: RUN_ID,
  runAttempt: 1,
  startedAt: '2026-09-27T10:15:00.000Z',
  gateCompletedAt: '2026-09-27T10:15:01.000Z',
  stewardVersion: '0.0.0-test',
  loadedPolicy: trustedPolicy,
  policyLoadedAt: '2026-09-27T10:15:00.500Z',
  defaultBranch: 'main',
  submission: prSubmission,
  baseCommit: 'd'.repeat(40),
  mode: 'observe',
  classification,
  requiredStages: ['references', 'claim'],
  githubRequests: 7,
  retries: 0,
};

function makeHandoff(
  findings: readonly HandoffFinding[],
  causes: readonly RecordCause[],
  stageResults: readonly StageResult[],
): HandoffRecord {
  return handoffRecordSchema.parse({
    handoff_version: 1,
    phase: 'assess',
    run: { run_id: RUN_ID, run_attempt: 1 },
    snapshot_hash: prSubmission.snapshot_hash,
    policy_revision: 'b'.repeat(40),
    round: 0,
    budget_remaining: initialBudget(DEFAULT_CHECKLIST_POLICY, { githubRequests: 5 }),
    early_exit: null,
    findings,
    causes,
    stage_results: stageResults,
    next_round_plan: null,
  });
}

function makeInput(evidenceDir: string, handoff: HandoffRecord, runnerCauses: readonly RecordCause[] = []): LocalPublishInput {
  return {
    context,
    handoff,
    runnerCauses,
    phases: [{ phase: 'gate', seconds: 1, recordedAt: '2026-09-27T10:15:01.000Z' }],
    logLines: ['gate complete'],
    evidenceDir,
    credentials: [],
    finishedAt: '2026-09-27T10:15:03.000Z',
  };
}

function mkTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'm5-pp-'));
}

function rmTmpDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

function runPaths(tmp: string): { readonly runDir: string; readonly stagingDir: string; readonly metricsFile: string } {
  return {
    runDir: path.join(tmp, 'octo', 'demo', 'runs', 'pr-12', RUN_ID),
    stagingDir: path.join(tmp, 'octo', 'demo', 'runs', '.staging', RUN_ID),
    metricsFile: path.join(tmp, 'octo', 'demo', 'metrics', '2026-09', `${RUN_ID}.json`),
  };
}

const C1: RecordCause = { cause: 'steward-defect', code: 'pipeline.stage-incomplete', message: 'sample cause 1.', subjects: [] };
const C2: RecordCause = { cause: 'steward-defect', code: 'pipeline.handoff-invalid', message: 'sample cause 2.', subjects: [] };

describe('localDecisionInput', { timeout: 60000 }, () => {
  it('local decision input is current, available, and not-required', () => {
    const handoff = makeHandoff([F1], [C1], []);
    const decisionInput = localDecisionInput(handoff, [C2], ['references'], []);
    expect(decisionInput.freshness).toBe('current');
    expect(decisionInput.capacity).toBe('available');
    expect(decisionInput.admission).toBe('not-required');
    expect(decisionInput.causes).toEqual([C1, C2]);
    expect(decisionInput.requirements).toEqual([]);
    expect(decisionInput.stageResults).toEqual([]);
  });
});

describe('publishLocalRun', { timeout: 60000 }, () => {
  it('a needs-changes handoff publishes a run directory', async () => {
    const tmp = mkTmpDir();
    try {
      const handoff = makeHandoff([F1], [], []);
      const input = makeInput(tmp, handoff);
      const result = await publishLocalRun(input);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.decision.outcome).toBe('needs-changes');
      expect(result.value.decision.row).toBe(3);
      const { runDir } = runPaths(tmp);
      expect(result.value.published.directory).toBe(path.resolve(runDir));
      expect(fs.existsSync(path.join(runDir, 'manifest.json'))).toBe(true);
      expect(result.value.published.report).toContain('Outcome: `needs-changes`');
      expect(result.value.decision.requests[0]?.request_id).toBe('R1');
    } finally {
      rmTmpDir(tmp);
    }
  });

  it('runner causes make the run inconclusive', async () => {
    const tmp = mkTmpDir();
    try {
      const stageResults: readonly StageResult[] = [
        { stage: 'references', status: 'complete' },
        { stage: 'claim', status: 'complete' },
      ];
      const handoff = makeHandoff([], [], stageResults);
      const timeoutCause: RecordCause = {
        cause: 'budget-exhausted',
        code: 'pipeline.phase-timeout',
        message: 'A pipeline phase exceeded limits.stage_seconds.',
        subjects: ['intake'],
      };
      const input = makeInput(tmp, handoff, [timeoutCause]);
      const result = await publishLocalRun(input);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.decision.outcome).toBe('inconclusive');
      expect(result.value.decision.row).toBe(6);
      expect(result.value.decision.causes[0]?.code).toBe('pipeline.phase-timeout');
    } finally {
      rmTmpDir(tmp);
    }
  });

  it('a required stage without a result ends inconclusive', async () => {
    const tmp = mkTmpDir();
    try {
      const stageResults: readonly StageResult[] = [{ stage: 'references', status: 'complete' }];
      const handoff = makeHandoff([], [], stageResults);
      const input = makeInput(tmp, handoff);
      const result = await publishLocalRun(input);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.decision.outcome).toBe('inconclusive');
      const causes = result.value.decision.causes;
      const last = causes[causes.length - 1];
      expect(last?.cause).toBe('stage-incomplete');
      expect(last?.subjects).toEqual(['claim']);
    } finally {
      rmTmpDir(tmp);
    }
  });

  it('a decision that throws fails publish without a run directory', async () => {
    const tmp = mkTmpDir();
    try {
      const handoff = makeHandoff([], [], []);
      const input = makeInput(tmp, handoff);
      const result = await publishLocalRun(input, {
        decide: () => {
          throw new Error('boom');
        },
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.failure.code).toBe('pipeline.decision-invalid');
      expect(result.failure.outcome).toBe('inconclusive');
      const { runDir, stagingDir, metricsFile } = runPaths(tmp);
      expect(fs.existsSync(runDir)).toBe(false);
      expect(fs.existsSync(stagingDir)).toBe(false);
      expect(fs.existsSync(metricsFile)).toBe(false);
    } finally {
      rmTmpDir(tmp);
    }
  });

  it('a waiting decision fails publish without a run directory', async () => {
    const tmp = mkTmpDir();
    try {
      const handoff = makeHandoff([], [], []);
      const input = makeInput(tmp, handoff);
      const result = await publishLocalRun(input, {
        decide: () => ({ kind: 'waiting', state: 'queued', row: 4 }),
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.failure.code).toBe('pipeline.decision-invalid');
      const { runDir, stagingDir, metricsFile } = runPaths(tmp);
      expect(fs.existsSync(runDir)).toBe(false);
      expect(fs.existsSync(stagingDir)).toBe(false);
      expect(fs.existsSync(metricsFile)).toBe(false);
    } finally {
      rmTmpDir(tmp);
    }
  });

  it('a finding without a report template fails publish without a run directory', async () => {
    const tmp = mkTmpDir();
    try {
      const injected: HandoffFinding = {
        stage: 'intake',
        severity: 'blocking',
        code: 'stage.unknown',
        detail: null,
        field: null,
        subjects: [],
        message: 'Injected.',
      };
      const handoff = makeHandoff([injected], [], []);
      const input = makeInput(tmp, handoff);
      const result = await publishLocalRun(input);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.failure.code).toBe('report.template-missing');
      const { runDir, stagingDir, metricsFile } = runPaths(tmp);
      expect(fs.existsSync(runDir)).toBe(false);
      expect(fs.existsSync(stagingDir)).toBe(false);
      expect(fs.existsSync(metricsFile)).toBe(false);
    } finally {
      rmTmpDir(tmp);
    }
  });

  it('an evidence write failure fails publish without a run directory', async () => {
    const tmp = mkTmpDir();
    try {
      const handoff = makeHandoff([F1], [], []);
      const input = makeInput(tmp, handoff);
      const result = await publishLocalRun(input, {
        evidence: {
          fs: {
            ...nodeEvidenceFs,
            writeFileExclusive: async () => {
              throw Object.assign(new Error('injected'), { code: 'EIO' });
            },
          },
        },
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.failure.code).toBe('evidence.write-failed');
      const { runDir, stagingDir, metricsFile } = runPaths(tmp);
      expect(fs.existsSync(runDir)).toBe(false);
      expect(fs.existsSync(stagingDir)).toBe(false);
      expect(fs.existsSync(metricsFile)).toBe(false);
    } finally {
      rmTmpDir(tmp);
    }
  });

  it('the run log records the decision row and causes', async () => {
    const tmp = mkTmpDir();
    try {
      const stageResults: readonly StageResult[] = [
        { stage: 'references', status: 'complete' },
        { stage: 'claim', status: 'complete' },
      ];
      const handoff = makeHandoff([], [], stageResults);
      const timeoutCause: RecordCause = {
        cause: 'budget-exhausted',
        code: 'pipeline.phase-timeout',
        message: 'A pipeline phase exceeded limits.stage_seconds.',
        subjects: ['intake'],
      };
      const input = makeInput(tmp, handoff, [timeoutCause]);
      const result = await publishLocalRun(input);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const logText = fs.readFileSync(path.join(result.value.published.directory, 'logs', 'steward.txt'), 'utf8');
      expect(logText).toContain('gate complete');
      expect(logText).toContain('decision row 6 outcome inconclusive');
      expect(logText).toContain('decision cause budget-exhausted pipeline.phase-timeout');
    } finally {
      rmTmpDir(tmp);
    }
  });
});
