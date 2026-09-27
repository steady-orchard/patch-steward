import type { LifecycleLabelState, Mode, Outcome, SubmissionType, WaitingState } from '../vocabulary.js';

export const CHECK_CONCLUSIONS = ['success', 'failure', 'neutral', 'action_required', 'cancelled'] as const;
export type CheckConclusion = (typeof CHECK_CONCLUSIONS)[number];

export type CheckMappingState =
  | { readonly kind: 'outcome'; readonly outcome: Exclude<Outcome, 'overridden'> }
  | { readonly kind: 'overridden'; readonly effective: 'pass' | 'needs-changes' }
  | { readonly kind: 'waiting'; readonly state: WaitingState };

export type LabelMappingState = CheckMappingState | { readonly kind: 'screening' };

export interface CheckMappingInput {
  readonly submissionType: SubmissionType;
  readonly mode: Mode;
  readonly repositoryGateActive: boolean;
  readonly checkRequired: boolean;
  readonly anyCategoryEnforced: boolean;
  readonly sharedHead: boolean;
  readonly state: CheckMappingState;
}

export type CheckMapping =
  | { readonly kind: 'none' }
  | { readonly kind: 'pending' }
  | { readonly kind: 'complete'; readonly conclusion: CheckConclusion; readonly summary: 'outcome' | 'not-enforced' };

export interface LabelMappingInput {
  readonly mode: Mode;
  readonly sharedHead: boolean;
  readonly state: LabelMappingState;
  readonly statusLabels: Readonly<Record<LifecycleLabelState, string>>;
}

export type LabelMapping =
  | { readonly kind: 'none' }
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'label'; readonly state: LifecycleLabelState; readonly name: string };

function isSuperseded(state: CheckMappingState | LabelMappingState): boolean {
  return state.kind === 'outcome' && state.outcome === 'superseded';
}

export function mapCheck(input: CheckMappingInput): CheckMapping {
  const { submissionType, mode, repositoryGateActive, checkRequired, anyCategoryEnforced, sharedHead, state } = input;

  // 1. issues never get a check; nor does an optional check on an inactive gate.
  if (submissionType === 'issue' || (!repositoryGateActive && !checkRequired)) {
    return { kind: 'none' };
  }

  // 2. superseded cleanup: cancel only this check, regardless of everything else.
  if (isSuperseded(state)) {
    return { kind: 'complete', conclusion: 'cancelled', summary: 'outcome' };
  }

  // 3. waiting states keep the check in progress.
  if (state.kind === 'waiting') {
    return { kind: 'pending' };
  }

  // 4. a shared head is never success or neutral, whatever the override.
  if (sharedHead) {
    const conclusion: CheckConclusion = checkRequired || anyCategoryEnforced ? 'action_required' : 'failure';
    return { kind: 'complete', conclusion, summary: 'outcome' };
  }

  // 5. observe never enforces.
  if (mode === 'observe') {
    return { kind: 'complete', conclusion: 'neutral', summary: 'not-enforced' };
  }

  // 6. advise reports without enforcing.
  if (mode === 'advise') {
    return { kind: 'complete', conclusion: 'neutral', summary: 'outcome' };
  }

  // 7. enforce.
  switch (state.kind) {
    case 'overridden':
      return {
        kind: 'complete',
        conclusion: state.effective === 'pass' ? 'success' : 'failure',
        summary: 'outcome',
      };
    case 'outcome': {
      switch (state.outcome) {
        case 'pass':
          return { kind: 'complete', conclusion: 'success', summary: 'outcome' };
        case 'needs-changes':
          return { kind: 'complete', conclusion: 'failure', summary: 'outcome' };
        case 'uncertain':
        case 'inconclusive':
          return { kind: 'complete', conclusion: 'action_required', summary: 'outcome' };
        case 'superseded':
          // unreachable: handled by rule 2 above.
          return { kind: 'complete', conclusion: 'cancelled', summary: 'outcome' };
        default: {
          const exhaustive: never = state.outcome;
          return exhaustive;
        }
      }
    }
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}

export function mapLabel(input: LabelMappingInput): LabelMapping {
  const { mode, sharedHead, state, statusLabels } = input;

  // observe never applies a label.
  if (mode === 'observe') {
    return { kind: 'none' };
  }

  // superseded work leaves the label untouched.
  if (isSuperseded(state)) {
    return { kind: 'unchanged' };
  }

  if (state.kind === 'waiting') {
    return { kind: 'label', state: state.state, name: statusLabels[state.state] };
  }

  if (state.kind === 'screening') {
    return { kind: 'label', state: 'screening', name: statusLabels.screening };
  }

  // a shared head is always awaiting-author, no matter the override.
  if (sharedHead) {
    return { kind: 'label', state: 'awaiting-author', name: statusLabels['awaiting-author'] };
  }

  if (state.kind === 'overridden') {
    const labelState: LifecycleLabelState = state.effective === 'pass' ? 'pass' : 'awaiting-author';
    return { kind: 'label', state: labelState, name: statusLabels[labelState] };
  }

  switch (state.outcome) {
    case 'pass':
      return { kind: 'label', state: 'pass', name: statusLabels.pass };
    case 'needs-changes':
      return { kind: 'label', state: 'awaiting-author', name: statusLabels['awaiting-author'] };
    case 'uncertain':
    case 'inconclusive':
      return { kind: 'label', state: 'triage', name: statusLabels.triage };
    case 'superseded':
      // unreachable: handled above.
      return { kind: 'unchanged' };
    default: {
      const exhaustive: never = state.outcome;
      return exhaustive;
    }
  }
}
