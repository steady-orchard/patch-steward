import { describe, expect, it } from 'vitest';
import { STATUS_LABEL_DEFAULTS } from '../labels.js';
import { LIFECYCLE_LABEL_STATES, MODES, SUBMISSION_TYPES } from '../vocabulary.js';
import type { LifecycleLabelState, Mode, SubmissionType } from '../vocabulary.js';
import { mapCheck, mapLabel } from './mapping.js';
import type { CheckMapping, CheckMappingState, LabelMappingState } from './mapping.js';

const statusLabels: Readonly<Record<LifecycleLabelState, string>> = Object.freeze(
  Object.fromEntries(LIFECYCLE_LABEL_STATES.map((state) => [state, STATUS_LABEL_DEFAULTS[state].name])) as Record<
    LifecycleLabelState,
    string
  >,
);

const STATES: ReadonlyArray<readonly [string, CheckMappingState]> = [
  ['pass', { kind: 'outcome', outcome: 'pass' }],
  ['needs-changes', { kind: 'outcome', outcome: 'needs-changes' }],
  ['uncertain', { kind: 'outcome', outcome: 'uncertain' }],
  ['inconclusive', { kind: 'outcome', outcome: 'inconclusive' }],
  ['superseded', { kind: 'outcome', outcome: 'superseded' }],
  ['overridden to pass', { kind: 'overridden', effective: 'pass' }],
  ['overridden to needs-changes', { kind: 'overridden', effective: 'needs-changes' }],
  ['queued', { kind: 'waiting', state: 'queued' }],
  ['awaiting-approval', { kind: 'waiting', state: 'awaiting-approval' }],
];

const TERMINAL_STATES = STATES.filter(([label]) => label !== 'superseded' && label !== 'queued' && label !== 'awaiting-approval');

const WAITING_STATES_LOCAL = STATES.filter(([label]) => label === 'queued' || label === 'awaiting-approval');

function isWaiting(state: CheckMappingState): state is Extract<CheckMappingState, { kind: 'waiting' }> {
  return state.kind === 'waiting';
}

function isSuperseded(state: CheckMappingState): boolean {
  return state.kind === 'outcome' && state.outcome === 'superseded';
}

// Independent expectation table (not derived from mapCheck's own logic).
function expectedForModeState(mode: Mode, label: string, state: CheckMappingState): CheckMapping {
  if (isWaiting(state)) {
    return { kind: 'pending' };
  }
  if (isSuperseded(state)) {
    return { kind: 'complete', conclusion: 'cancelled', summary: 'outcome' };
  }
  if (mode === 'observe') {
    return { kind: 'complete', conclusion: 'neutral', summary: 'not-enforced' };
  }
  if (mode === 'advise') {
    return { kind: 'complete', conclusion: 'neutral', summary: 'outcome' };
  }
  switch (label) {
    case 'pass':
    case 'overridden to pass':
      return { kind: 'complete', conclusion: 'success', summary: 'outcome' };
    case 'needs-changes':
    case 'overridden to needs-changes':
      return { kind: 'complete', conclusion: 'failure', summary: 'outcome' };
    case 'uncertain':
    case 'inconclusive':
      return { kind: 'complete', conclusion: 'action_required', summary: 'outcome' };
    default:
      throw new Error(`unexpected label ${label}`);
  }
}

const MODE_STATE_COMBOS: ReadonlyArray<readonly [Mode, string, CheckMappingState]> = MODES.flatMap((mode) =>
  STATES.map(([label, state]) => [mode, label, state] as const),
);

describe('mapCheck', () => {
  it.each(MODE_STATE_COMBOS)('mode %s maps %s', (mode, label, state) => {
    const result = mapCheck({
      submissionType: 'pull_request',
      mode,
      repositoryGateActive: true,
      checkRequired: true,
      anyCategoryEnforced: mode === 'enforce',
      sharedHead: false,
      state,
    });
    expect(result).toEqual(expectedForModeState(mode, label, state));
  });

  it('not enforced is neutral', () => {
    for (const [, state] of TERMINAL_STATES) {
      for (const checkRequired of [true, false]) {
        const result = mapCheck({
          submissionType: 'pull_request',
          mode: 'observe',
          repositoryGateActive: true,
          checkRequired,
          anyCategoryEnforced: false,
          sharedHead: false,
          state,
        });
        expect(result).toEqual({ kind: 'complete', conclusion: 'neutral', summary: 'not-enforced' });
      }
    }
  });

  it('waiting states stay pending', () => {
    for (const mode of MODES) {
      for (const [, state] of WAITING_STATES_LOCAL) {
        for (const sharedHead of [true, false]) {
          for (const checkRequired of [true, false]) {
            const result = mapCheck({
              submissionType: 'pull_request',
              mode,
              repositoryGateActive: true,
              checkRequired,
              anyCategoryEnforced: false,
              sharedHead,
              state,
            });
            expect(result).toEqual({ kind: 'pending' });
          }
        }
        if (mode === 'advise' || mode === 'enforce') {
          const waitingState = state as Extract<CheckMappingState, { kind: 'waiting' }>;
          const labelResult = mapLabel({ mode, sharedHead: false, state: waitingState, statusLabels });
          expect(labelResult).toEqual({ kind: 'label', state: waitingState.state, name: statusLabels[waitingState.state] });
        }
      }
    }
  });

  it('cancelled only for superseded cleanup', () => {
    for (const submissionType of SUBMISSION_TYPES) {
      for (const mode of MODES) {
        for (const repositoryGateActive of [true, false]) {
          for (const checkRequired of [true, false]) {
            for (const anyCategoryEnforced of [true, false]) {
              for (const sharedHead of [true, false]) {
                for (const [label, state] of STATES) {
                  const result = mapCheck({
                    submissionType,
                    mode,
                    repositoryGateActive,
                    checkRequired,
                    anyCategoryEnforced,
                    sharedHead,
                    state,
                  });
                  const isCancelled = result.kind === 'complete' && result.conclusion === 'cancelled';
                  const shouldCancel = label === 'superseded' && result.kind !== 'none';
                  expect(isCancelled).toBe(shouldCancel);
                }
              }
            }
          }
        }
      }
    }
  });

  it('shared head is never success or neutral under any override', () => {
    for (const mode of MODES) {
      for (const [, state] of TERMINAL_STATES) {
        for (const checkRequired of [true, false]) {
          for (const anyCategoryEnforced of [true, false]) {
            const result = mapCheck({
              submissionType: 'pull_request',
              mode,
              repositoryGateActive: true,
              checkRequired,
              anyCategoryEnforced,
              sharedHead: true,
              state,
            });
            const expectedConclusion = checkRequired || anyCategoryEnforced ? 'action_required' : 'failure';
            expect(result).toEqual({ kind: 'complete', conclusion: expectedConclusion, summary: 'outcome' });
          }
        }
      }
      if (mode === 'advise' || mode === 'enforce') {
        for (const [, state] of TERMINAL_STATES) {
          const labelResult = mapLabel({ mode, sharedHead: true, state, statusLabels });
          expect(labelResult).toEqual({ kind: 'label', state: 'awaiting-author', name: statusLabels['awaiting-author'] });
        }
      }
    }
  });

  it('issues never get a check', () => {
    const submissionType: SubmissionType = 'issue';
    for (const mode of MODES) {
      for (const repositoryGateActive of [true, false]) {
        for (const checkRequired of [true, false]) {
          for (const anyCategoryEnforced of [true, false]) {
            for (const sharedHead of [true, false]) {
              for (const [, state] of STATES) {
                const result = mapCheck({
                  submissionType,
                  mode,
                  repositoryGateActive,
                  checkRequired,
                  anyCategoryEnforced,
                  sharedHead,
                  state,
                });
                expect(result).toEqual({ kind: 'none' });
              }
            }
          }
        }
      }
    }
  });
});

describe('mapLabel', () => {
  it('observe applies no label', () => {
    const allStates: ReadonlyArray<LabelMappingState> = [...STATES.map(([, state]) => state), { kind: 'screening' }];
    for (const state of allStates) {
      for (const sharedHead of [true, false]) {
        const result = mapLabel({ mode: 'observe', sharedHead, state, statusLabels });
        expect(result).toEqual({ kind: 'none' });
      }
    }
  });

  it('superseded leaves labels unchanged', () => {
    const supersededState = STATES.find(([label]) => label === 'superseded')?.[1];
    if (!supersededState) {
      throw new Error('missing superseded state fixture');
    }
    for (const mode of ['advise', 'enforce'] as const) {
      for (const sharedHead of [true, false]) {
        const result = mapLabel({ mode, sharedHead, state: supersededState, statusLabels });
        expect(result).toEqual({ kind: 'unchanged' });
      }
    }
  });

  it('screening in progress is labeled screening', () => {
    for (const mode of ['advise', 'enforce'] as const) {
      const result = mapLabel({ mode, sharedHead: false, state: { kind: 'screening' }, statusLabels });
      expect(result).toEqual({ kind: 'label', state: 'screening', name: statusLabels.screening });
    }
  });

  it('override labels follow the effective outcome', () => {
    for (const mode of ['advise', 'enforce'] as const) {
      const pass = mapLabel({ mode, sharedHead: false, state: { kind: 'overridden', effective: 'pass' }, statusLabels });
      expect(pass).toEqual({ kind: 'label', state: 'pass', name: statusLabels.pass });

      const needsChanges = mapLabel({
        mode,
        sharedHead: false,
        state: { kind: 'overridden', effective: 'needs-changes' },
        statusLabels,
      });
      expect(needsChanges).toEqual({ kind: 'label', state: 'awaiting-author', name: statusLabels['awaiting-author'] });
    }
  });

  it('custom status label names come from the policy', () => {
    const customLabels: Readonly<Record<LifecycleLabelState, string>> = Object.freeze({
      ...statusLabels,
      triage: 'needs-triage',
    });
    const result = mapLabel({
      mode: 'enforce',
      sharedHead: false,
      state: { kind: 'outcome', outcome: 'uncertain' },
      statusLabels: customLabels,
    });
    expect(result).toEqual({ kind: 'label', state: 'triage', name: 'needs-triage' });
  });
});
