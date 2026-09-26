import { describe, expect, it } from 'vitest';
import { allLabelDefaults, CLASSIFICATION_LABEL_DEFAULTS, STATUS_LABEL_DEFAULTS } from './labels.js';
import { ISSUE_CLASSIFICATIONS, LIFECYCLE_LABEL_STATES } from './vocabulary.js';

describe('label defaults', () => {
  it('allLabelDefaults matches the catalog literal in order', () => {
    expect(allLabelDefaults()).toEqual([
      { name: 'steward:queued', color: 'c5def5', description: 'Waiting for screening capacity; screening restarts automatically.' },
      {
        name: 'steward:awaiting-approval',
        color: 'fbca04',
        description: 'Waiting for a maintainer to admit model-based screening.',
      },
      { name: 'steward:screening', color: '1d76db', description: 'Screening is in progress.' },
      { name: 'steward:pass', color: '0e8a16', description: 'Screening requirements are met; maintainers decide acceptance.' },
      {
        name: 'steward:awaiting-author',
        color: 'd93f0b',
        description: 'Waiting for the author to address the numbered requests in the report.',
      },
      {
        name: 'steward:triage',
        color: '5319e7',
        description: "Needs a maintainer decision; see the report's open questions.",
      },
      {
        name: 'claim:supported-defect',
        color: 'b60205',
        description: 'Claim validated as a defect in supported behavior.',
      },
      {
        name: 'claim:intended-behavior',
        color: 'bfdadc',
        description: 'Reported behavior matches documented intended behavior.',
      },
      { name: 'claim:feature-request', color: 'a2eeef', description: 'Describes new behavior rather than a defect.' },
      {
        name: 'claim:accepted-proposal',
        color: '0052cc',
        description: 'Proposal accepted by a recorded maintainer decision.',
      },
      {
        name: 'claim:proposal-pending',
        color: 'd4c5f9',
        description: 'Well-formed proposal waiting for a maintainer decision.',
      },
      {
        name: 'claim:duplicate',
        color: 'cfd3d7',
        description: 'Duplicates an existing issue or a previously dismissed claim.',
      },
      { name: 'claim:uncertain', color: 'fef2c0', description: 'Classification needs a maintainer decision.' },
    ]);
  });

  it('status label names follow the steward: prefix convention', () => {
    for (const state of LIFECYCLE_LABEL_STATES) {
      expect(STATUS_LABEL_DEFAULTS[state].name).toBe(`steward:${state}`);
    }
  });

  it('classification label names follow the claim: prefix convention', () => {
    for (const classification of ISSUE_CLASSIFICATIONS) {
      expect(CLASSIFICATION_LABEL_DEFAULTS[classification].name).toBe(`claim:${classification}`);
    }
  });

  it('has 13 unique names', () => {
    const names = allLabelDefaults().map((label) => label.name);
    expect(names).toHaveLength(13);
    expect(new Set(names).size).toBe(13);
  });

  it('has lowercase 6-hex-digit colors', () => {
    for (const label of allLabelDefaults()) {
      expect(label.color).toMatch(/^[0-9a-f]{6}$/);
    }
  });

  it('has non-empty, trimmed descriptions', () => {
    for (const label of allLabelDefaults()) {
      expect(label.description.length).toBeGreaterThan(0);
      expect(label.description).toBe(label.description.trim());
    }
  });
});
