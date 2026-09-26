import { LIFECYCLE_LABEL_STATES, ISSUE_CLASSIFICATIONS } from './vocabulary.js';
import type { IssueClassification, LabelFamily, LifecycleLabelState } from './vocabulary.js';

export interface LabelDefault {
  readonly name: string;
  readonly color: string;
  readonly description: string;
}

export const LABEL_NAME_PREFIXES: Readonly<Record<LabelFamily, string>> = Object.freeze({
  status: 'steward:',
  classification: 'claim:',
});

export const STATUS_LABEL_DEFAULTS: Readonly<Record<LifecycleLabelState, LabelDefault>> = Object.freeze({
  queued: Object.freeze({
    name: 'steward:queued',
    color: 'c5def5',
    description: 'Waiting for screening capacity; screening restarts automatically.',
  }),
  'awaiting-approval': Object.freeze({
    name: 'steward:awaiting-approval',
    color: 'fbca04',
    description: 'Waiting for a maintainer to admit model-based screening.',
  }),
  screening: Object.freeze({
    name: 'steward:screening',
    color: '1d76db',
    description: 'Screening is in progress.',
  }),
  pass: Object.freeze({
    name: 'steward:pass',
    color: '0e8a16',
    description: 'Screening requirements are met; maintainers decide acceptance.',
  }),
  'awaiting-author': Object.freeze({
    name: 'steward:awaiting-author',
    color: 'd93f0b',
    description: 'Waiting for the author to address the numbered requests in the report.',
  }),
  triage: Object.freeze({
    name: 'steward:triage',
    color: '5319e7',
    description: "Needs a maintainer decision; see the report's open questions.",
  }),
});

export const CLASSIFICATION_LABEL_DEFAULTS: Readonly<Record<IssueClassification, LabelDefault>> = Object.freeze({
  'supported-defect': Object.freeze({
    name: 'claim:supported-defect',
    color: 'b60205',
    description: 'Claim validated as a defect in supported behavior.',
  }),
  'intended-behavior': Object.freeze({
    name: 'claim:intended-behavior',
    color: 'bfdadc',
    description: 'Reported behavior matches documented intended behavior.',
  }),
  'feature-request': Object.freeze({
    name: 'claim:feature-request',
    color: 'a2eeef',
    description: 'Describes new behavior rather than a defect.',
  }),
  'accepted-proposal': Object.freeze({
    name: 'claim:accepted-proposal',
    color: '0052cc',
    description: 'Proposal accepted by a recorded maintainer decision.',
  }),
  'proposal-pending': Object.freeze({
    name: 'claim:proposal-pending',
    color: 'd4c5f9',
    description: 'Well-formed proposal waiting for a maintainer decision.',
  }),
  duplicate: Object.freeze({
    name: 'claim:duplicate',
    color: 'cfd3d7',
    description: 'Duplicates an existing issue or a previously dismissed claim.',
  }),
  uncertain: Object.freeze({
    name: 'claim:uncertain',
    color: 'fef2c0',
    description: 'Classification needs a maintainer decision.',
  }),
});

export function allLabelDefaults(): readonly LabelDefault[] {
  return [
    ...LIFECYCLE_LABEL_STATES.map((state) => STATUS_LABEL_DEFAULTS[state]),
    ...ISSUE_CLASSIFICATIONS.map((classification) => CLASSIFICATION_LABEL_DEFAULTS[classification]),
  ];
}
