import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { PIPELINE_FAILURE_CAUSES, PIPELINE_FAILURE_CODES, pipelineCause } from '../pipeline/sequence.js';
import type { PipelineFailureCode } from '../pipeline/sequence.js';
import { localDecisionInput } from '../pipeline/publish-phase.js';
import type { LocalPublishFailureCode } from '../pipeline/publish-phase.js';
import { SCREEN_POLICY_FAILURE_CODES } from '../pipeline/gate.js';
import type { ScreenPolicyFailureCode } from '../pipeline/gate.js';
import { SCREEN_EXIT_BY_OUTCOME, SCREEN_FAILURE_CODES, screenPreRunExitStatus, screenPublishFailure } from '../pipeline/screen.js';
import type { ScreenFailureCode } from '../pipeline/screen.js';
import { verifyRunDirectory } from '../evidence/verify.js';
import type { RunVerificationFailureCode } from '../evidence/verify.js';
import { decideOutcome } from '../decision/table.js';
import { handoffRecordSchema } from '../pipeline/handoff.js';
import { initialBudget } from '../pipeline/budget.js';
import { DEFAULT_CHECKLIST_POLICY } from '../submission/default-checklist.js';
import type { FailureCause } from '../vocabulary.js';
import { outcomeSchema } from '../vocabulary.js';
import { err } from '../result.js';
import type { Result } from '../result.js';

const H = handoffRecordSchema.parse({
  handoff_version: 1,
  phase: 'assess',
  run: { run_id: 'local-20260927T101500Z-3f9a1c2e', run_attempt: 1 },
  snapshot_hash: 'sha256:' + '5'.repeat(64),
  policy_revision: 'b'.repeat(40),
  round: 0,
  budget_remaining: initialBudget(DEFAULT_CHECKLIST_POLICY, { githubRequests: 5 }),
  early_exit: null,
  findings: [],
  causes: [],
  stage_results: [],
  next_round_plan: null,
});

describe('never-pass conformance: pipeline and evidence', () => {
  const PIPELINE_TABLE: { readonly [K in PipelineFailureCode]: FailureCause } = {
    'pipeline.handoff-invalid': 'steward-defect',
    'pipeline.handoff-binding': 'steward-defect',
    'pipeline.phase-failed': 'steward-defect',
    'pipeline.phase-timeout': 'budget-exhausted',
    'pipeline.rounds-exhausted': 'budget-exhausted',
    'pipeline.stage-incomplete': 'stage-incomplete',
  };

  it.each(Object.keys(PIPELINE_TABLE) as PipelineFailureCode[])('pipeline failure code %s never yields pass', (code) => {
    expect(PIPELINE_FAILURE_CAUSES[code]).toBe(PIPELINE_TABLE[code]);
    const decision = decideOutcome(localDecisionInput(H, [pipelineCause(code, [])], [], []));
    expect(decision.kind).toBe('outcome');
    if (decision.kind === 'outcome') {
      expect(decision.outcome).toBe('inconclusive');
      expect(decision.row).toBe(6);
    }
  });

  const PUBLISH_TABLE: { readonly [K in LocalPublishFailureCode]: FailureCause } = {
    'evidence.layout-invalid': 'steward-defect',
    'evidence.record-invalid': 'steward-defect',
    'report.template-missing': 'steward-defect',
    'redaction.input-too-large': 'steward-defect',
    'redaction.invalid-pattern': 'steward-defect',
    'redaction.timeout': 'infrastructure',
    'redaction.failed': 'steward-defect',
    'evidence.redaction-invalidated': 'steward-defect',
    'report.too-large': 'steward-defect',
    'report.summary-too-large': 'steward-defect',
    'evidence.manifest-invalid': 'steward-defect',
    'evidence.too-many-files': 'budget-exhausted',
    'evidence.run-exists': 'steward-defect',
    'evidence.write-failed': 'infrastructure',
    'evidence.too-large': 'budget-exhausted',
    'pipeline.decision-invalid': 'steward-defect',
  };

  it.each(Object.keys(PUBLISH_TABLE) as LocalPublishFailureCode[])('publish failure code %s never yields a report', (code) => {
    const f = screenPublishFailure(err(code, PUBLISH_TABLE[code], 'Probe.').failure);
    expect(f.code).toBe('screen.evidence-write-failed');
    expect(f.outcome).toBe('inconclusive');
    expect(f.cause).toBe(PUBLISH_TABLE[code]);
    expect(f.details[0]?.code).toBe(code);
    expect(screenPreRunExitStatus(f)).toBe(2);
  });

  const SCREEN_TABLE: { readonly [K in ScreenFailureCode | ScreenPolicyFailureCode]: 1 | 2 } = {
    'screen.evidence-write-failed': 2,
    'steward.internal-error': 2,
    'screen.policy-missing': 2,
    'screen.policy-invalid': 2,
    'screen.policy-file-invalid': 1,
  };

  it.each(Object.keys(SCREEN_TABLE) as (ScreenFailureCode | ScreenPolicyFailureCode)[])(
    'screen failure code %s never exits 0',
    (code) => {
      const status = screenPreRunExitStatus(err(code, 'steward-defect', 'Probe.').failure);
      expect(status).toBe(SCREEN_TABLE[code]);
      expect(status).not.toBe(0);
    },
  );

  const VERIFICATION_TRIGGERS: {
    readonly [K in RunVerificationFailureCode]: (tmp: string) => Promise<Result<unknown, string>>;
  } = {
    'report.run-unreadable': (tmp) => verifyRunDirectory(join(tmp, 'missing')),
    'report.evidence-invalid': (tmp) => verifyRunDirectory(tmp),
  };

  it.each(Object.keys(VERIFICATION_TRIGGERS) as RunVerificationFailureCode[])(
    'verification failure code %s never yields pass',
    async (code) => {
      const fs = await import('node:fs');
      const os = await import('node:os');
      const path = await import('node:path');
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'm5-npp-'));
      try {
        const result = await VERIFICATION_TRIGGERS[code](tmp);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.failure.code).toBe(code);
          expect(result.failure.outcome).toBe('inconclusive');
          expect(outcomeSchema.parse(result.failure.outcome)).not.toBe('pass');
        }
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      }
    },
  );

  it('only a pass outcome exits 0', () => {
    for (const key of Object.keys(SCREEN_EXIT_BY_OUTCOME) as (keyof typeof SCREEN_EXIT_BY_OUTCOME)[]) {
      const value = SCREEN_EXIT_BY_OUTCOME[key];
      expect(value === 0).toBe(key === 'pass');
      expect(value === 3).toBe(key === 'inconclusive');
    }
  });

  it('pipeline failure tables cover every code', () => {
    expect(Object.keys(PIPELINE_TABLE).sort()).toEqual([...PIPELINE_FAILURE_CODES].sort());
    expect(Object.keys(SCREEN_TABLE).sort()).toEqual([...SCREEN_FAILURE_CODES, ...SCREEN_POLICY_FAILURE_CODES].sort());
    expect(Object.keys(PUBLISH_TABLE)).toHaveLength(16);
    expect(Object.keys(PUBLISH_TABLE)).toContain('pipeline.decision-invalid');
  });
});
