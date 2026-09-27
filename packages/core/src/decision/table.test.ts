import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { PIPELINE_STAGES } from '../vocabulary.js';
import type { PipelineStage } from '../vocabulary.js';
import type { RecordCause } from '../records/decision.js';

import type { DecisionFinding, DecisionInput, DecisionRequirement } from './table.js';
import { decideOutcome } from './table.js';
import type { StageResult } from './stages.js';

const REQUIRED_STAGES: readonly PipelineStage[] = ['references', 'claim'];

function cause(overrides: Partial<RecordCause> = {}): RecordCause {
  return { cause: 'github-unavailable', code: 'test.cause', message: 'unavailable', subjects: [], ...overrides };
}

function stagesComplete(stages: readonly PipelineStage[] = REQUIRED_STAGES): readonly StageResult[] {
  return stages.map((stage) => ({ stage, status: 'complete' }));
}

function base(): DecisionInput {
  return {
    freshness: 'current',
    capacity: 'available',
    admission: 'not-required',
    findings: [],
    causes: [],
    requiredStages: REQUIRED_STAGES,
    stageResults: stagesComplete(),
    requirements: [],
  };
}

function finding(
  overrides: Partial<DecisionFinding> & Pick<DecisionFinding, 'finding_id' | 'stage' | 'severity' | 'code'>,
): DecisionFinding {
  return { request: null, ...overrides };
}

function requirement(overrides: Partial<DecisionRequirement> & Pick<DecisionRequirement, 'id' | 'required'>): DecisionRequirement {
  return { status: 'satisfied', ...overrides } as DecisionRequirement;
}

describe('decideOutcome', () => {
  it('decision row 1: superseded', () => {
    const changed = decideOutcome({ ...base(), freshness: 'snapshot-changed' });
    expect(changed).toMatchObject({ kind: 'outcome', outcome: 'superseded', row: 1, causes: [] });

    const newerOwner = decideOutcome({ ...base(), freshness: 'newer-owner' });
    expect(newerOwner).toMatchObject({ kind: 'outcome', outcome: 'superseded', row: 1, causes: [] });
  });

  it('decision row 2: needs-changes', () => {
    const sharedHead = finding({
      finding_id: 'f1',
      stage: 'contract',
      severity: 'blocking',
      code: 'submission.shared-head',
      request: 'stop sharing the head commit',
    });
    const result = decideOutcome({ ...base(), findings: [sharedHead] });
    expect(result).toMatchObject({
      kind: 'outcome',
      outcome: 'needs-changes',
      row: 2,
      causes: [],
      requests: [{ request_id: 'R1', finding_id: 'f1', text: 'stop sharing the head commit' }],
    });
  });

  it('decision row 3: needs-changes', () => {
    const missingField = finding({ finding_id: 'f1', stage: 'contract', severity: 'blocking', code: 'submission.field-missing' });
    const result = decideOutcome({ ...base(), findings: [missingField] });
    expect(result).toMatchObject({ kind: 'outcome', outcome: 'needs-changes', row: 3, causes: [] });
  });

  it('decision row 4: queued', () => {
    const result = decideOutcome({ ...base(), capacity: 'cap-reached' });
    expect(result).toEqual({ kind: 'waiting', state: 'queued', row: 4 });
  });

  it('decision row 5: awaiting-approval', () => {
    const result = decideOutcome({ ...base(), admission: 'required' });
    expect(result).toEqual({ kind: 'waiting', state: 'awaiting-approval', row: 5 });
  });

  it('decision row 6: inconclusive', () => {
    const inputCause = cause({ cause: 'github-unavailable' });
    const uncertainFinding = finding({ finding_id: 'f1', stage: 'claim', severity: 'uncertain', code: 'claim.review-needed' });
    const result = decideOutcome({ ...base(), causes: [inputCause], findings: [uncertainFinding] });
    expect(result).toMatchObject({
      kind: 'outcome',
      outcome: 'inconclusive',
      row: 6,
      causes: [inputCause],
      contributing_findings: ['f1'],
    });
  });

  it('decision row 7: uncertain', () => {
    const uncertainFinding = finding({
      finding_id: 'f1',
      stage: 'contract',
      severity: 'uncertain',
      code: 'submission.execution-sensitive-change',
    });
    const result = decideOutcome({ ...base(), findings: [uncertainFinding] });
    expect(result).toMatchObject({ kind: 'outcome', outcome: 'uncertain', row: 7, causes: [] });
  });

  it('decision row 8: needs-changes', () => {
    const missingRequirement = decideOutcome({
      ...base(),
      requirements: [requirement({ id: 'req1', required: true, status: 'missing' })],
    });
    expect(missingRequirement).toMatchObject({ kind: 'outcome', outcome: 'needs-changes', row: 8, causes: [] });

    const blockingClaim = finding({ finding_id: 'f1', stage: 'claim', severity: 'blocking', code: 'claim.unsupported' });
    const blockingResult = decideOutcome({ ...base(), findings: [blockingClaim] });
    expect(blockingResult).toMatchObject({ kind: 'outcome', outcome: 'needs-changes', row: 8, causes: [] });
  });

  it('decision row 9: pass', () => {
    const result = decideOutcome(base());
    expect(result).toMatchObject({
      kind: 'outcome',
      outcome: 'pass',
      row: 9,
      causes: [],
      contributing_findings: [],
      unmet_requirements: [],
      requests: [],
    });
  });

  it('decision precedence: row 1 before row 2', () => {
    const sharedHead = finding({
      finding_id: 'f1',
      stage: 'contract',
      severity: 'blocking',
      code: 'submission.shared-head',
    });
    const result = decideOutcome({ ...base(), freshness: 'snapshot-changed', findings: [sharedHead] });
    expect(result).toMatchObject({ row: 1 });
  });

  it('decision precedence: row 2 before row 3', () => {
    const sharedHead = finding({ finding_id: 'f1', stage: 'contract', severity: 'blocking', code: 'submission.shared-head' });
    const otherBlocking = finding({ finding_id: 'f2', stage: 'contract', severity: 'blocking', code: 'submission.field-missing' });
    const result = decideOutcome({ ...base(), findings: [sharedHead, otherBlocking] });
    expect(result).toMatchObject({ row: 2 });
  });

  it('decision precedence: row 3 before row 4', () => {
    const otherBlocking = finding({ finding_id: 'f1', stage: 'contract', severity: 'blocking', code: 'submission.field-missing' });
    const result = decideOutcome({ ...base(), findings: [otherBlocking], capacity: 'cap-reached' });
    expect(result).toMatchObject({ row: 3 });
  });

  it('decision precedence: row 4 before row 5', () => {
    const result = decideOutcome({ ...base(), capacity: 'cap-reached', admission: 'required' });
    expect(result).toMatchObject({ row: 4 });
  });

  it('decision precedence: row 5 before row 6', () => {
    const result = decideOutcome({ ...base(), admission: 'required', causes: [cause()] });
    expect(result).toMatchObject({ row: 5 });
  });

  it('decision precedence: row 6 before row 7', () => {
    const uncertainFinding = finding({ finding_id: 'f1', stage: 'claim', severity: 'uncertain', code: 'claim.review-needed' });
    const result = decideOutcome({ ...base(), causes: [cause()], findings: [uncertainFinding] });
    expect(result).toMatchObject({ row: 6 });
  });

  it('decision precedence: row 7 before row 8', () => {
    const uncertainFinding = finding({ finding_id: 'f1', stage: 'claim', severity: 'uncertain', code: 'claim.review-needed' });
    const result = decideOutcome({
      ...base(),
      findings: [uncertainFinding],
      requirements: [requirement({ id: 'req1', required: true, status: 'missing' })],
    });
    expect(result).toMatchObject({ row: 7 });
  });

  it('decision precedence: row 8 before row 9', () => {
    const blockingClaim = finding({ finding_id: 'f1', stage: 'claim', severity: 'blocking', code: 'claim.unsupported' });
    const result = decideOutcome({ ...base(), findings: [blockingClaim] });
    expect(result).toMatchObject({ row: 8 });
  });

  it('advisory and speculative findings never gate', () => {
    const advisory = finding({ finding_id: 'f1', stage: 'contract', severity: 'advisory', code: 'contract.note' });
    const speculative = finding({ finding_id: 'f2', stage: 'claim', severity: 'speculative', code: 'claim.note' });
    const result = decideOutcome({ ...base(), findings: [advisory, speculative] });
    expect(result).toMatchObject({ kind: 'outcome', outcome: 'pass', row: 9 });
  });

  it('missing optional checks never become missing required evidence', () => {
    const result = decideOutcome({
      ...base(),
      requirements: [
        requirement({ id: 'opt1', required: false, status: 'missing' }),
        requirement({ id: 'opt2', required: false, status: 'unavailable', cause: cause() }),
      ],
      stageResults: [...stagesComplete(), { stage: 'reproduction', status: 'unavailable', cause: cause() }],
    });
    expect(result).toMatchObject({ kind: 'outcome', outcome: 'pass', row: 9, causes: [] });
  });

  it('a required stage without a result never passes', () => {
    const allStages: readonly PipelineStage[] = ['references', 'claim', 'reproduction'];
    const subsets: PipelineStage[][] = [];
    const total = 1 << allStages.length;
    for (let mask = 1; mask < total; mask += 1) {
      const missing: PipelineStage[] = [];
      allStages.forEach((stage, index) => {
        if ((mask & (1 << index)) !== 0) {
          missing.push(stage);
        }
      });
      subsets.push(missing);
    }

    for (const missing of subsets) {
      const present = allStages.filter((stage) => !missing.includes(stage));
      const orderedMissing = PIPELINE_STAGES.filter((stage) => missing.includes(stage));
      const result = decideOutcome({ ...base(), requiredStages: allStages, stageResults: stagesComplete(present) });
      expect(result.kind).toBe('outcome');
      if (result.kind === 'outcome') {
        expect(result.outcome).toBe('inconclusive');
        expect(result.row).toBe(6);
        const lastCause = result.causes[result.causes.length - 1];
        expect(lastCause).toMatchObject({ cause: 'stage-incomplete', subjects: orderedMissing });
      }
    }
  });

  it('pass is constructed only by row 9', () => {
    const source = readFileSync(new URL('./table.ts', import.meta.url), 'utf8');
    const matches = source.match(/'pass'/g) ?? [];
    expect(matches.length).toBe(1);
    expect(source.includes('"pass"')).toBe(false);
    expect(source.includes('`pass`')).toBe(false);

    const freshnesses: DecisionInput['freshness'][] = ['current', 'snapshot-changed', 'newer-owner'];
    const capacities: DecisionInput['capacity'][] = ['available', 'cap-reached'];
    const admissions: DecisionInput['admission'][] = ['not-required', 'admitted', 'required'];
    const findingCases: DecisionFinding[][] = [
      [],
      [finding({ finding_id: 'a', stage: 'claim', severity: 'advisory', code: 'note' })],
      [finding({ finding_id: 'u', stage: 'claim', severity: 'uncertain', code: 'note' })],
      [finding({ finding_id: 'b', stage: 'claim', severity: 'blocking', code: 'note' })],
    ];
    const causeCases: RecordCause[][] = [[], [cause()]];
    const stageCases: readonly (readonly StageResult[])[] = [stagesComplete(), [{ stage: 'references', status: 'complete' }]];

    for (const freshness of freshnesses) {
      for (const capacity of capacities) {
        for (const admission of admissions) {
          for (const findings of findingCases) {
            for (const causes of causeCases) {
              for (const stageResults of stageCases) {
                const input: DecisionInput = { ...base(), freshness, capacity, admission, findings, causes, stageResults };
                const result = decideOutcome(input);
                const isPass =
                  freshness === 'current' &&
                  capacity === 'available' &&
                  admission !== 'required' &&
                  findings.every((f) => f.severity === 'advisory' || f.severity === 'speculative') &&
                  causes.length === 0 &&
                  stageResults.length === REQUIRED_STAGES.length &&
                  stageResults.every((r) => r.status === 'complete');
                if (isPass) {
                  expect(result).toMatchObject({ kind: 'outcome', outcome: 'pass' });
                } else {
                  expect(result.kind !== 'outcome' || result.outcome !== 'pass').toBe(true);
                }
              }
            }
          }
        }
      }
    }
  });

  it('needs-changes at rows 2 and 3 records no causes', () => {
    const otherBlocking = finding({ finding_id: 'f1', stage: 'contract', severity: 'blocking', code: 'submission.field-missing' });
    const row3 = decideOutcome({ ...base(), findings: [otherBlocking], causes: [cause()], stageResults: [] });
    expect(row3).toMatchObject({ outcome: 'needs-changes', row: 3, causes: [] });

    const sharedHead = finding({ finding_id: 'f2', stage: 'contract', severity: 'blocking', code: 'submission.shared-head' });
    const row2 = decideOutcome({ ...base(), findings: [sharedHead], causes: [cause()], stageResults: [] });
    expect(row2).toMatchObject({ outcome: 'needs-changes', row: 2, causes: [] });
  });

  it('requests follow blocking findings in order', () => {
    const a = finding({ finding_id: 'a', stage: 'claim', severity: 'blocking', code: 'code-a', request: 'fix a' });
    const b = finding({ finding_id: 'b', stage: 'claim', severity: 'advisory', code: 'code-b' });
    const c = finding({ finding_id: 'c', stage: 'claim', severity: 'blocking', code: 'code-c', request: 'fix c' });
    const d = finding({ finding_id: 'd', stage: 'claim', severity: 'blocking', code: 'code-d', request: null });
    const result = decideOutcome({ ...base(), findings: [a, b, c, d] });
    expect(result).toMatchObject({
      requests: [
        { request_id: 'R1', finding_id: 'a', text: 'fix a' },
        { request_id: 'R2', finding_id: 'c', text: 'fix c' },
      ],
    });
  });
});
