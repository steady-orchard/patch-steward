import { describe, expect, it } from 'vitest';
import {
  DEFECT_ISSUE_FIELD_IDS,
  PROPOSAL_ISSUE_FIELD_IDS,
  PULL_REQUEST_FIELD_IDS,
  SUBMISSION_FIELD_IDS,
  defectIssueFieldIdSchema,
  proposalIssueFieldIdSchema,
  pullRequestFieldIdSchema,
} from './submission-fields.js';

describe('submission-fields', () => {
  it('submission field ids are the union of the three field lists', () => {
    const union = new Set<string>([...DEFECT_ISSUE_FIELD_IDS, ...PROPOSAL_ISSUE_FIELD_IDS, ...PULL_REQUEST_FIELD_IDS]);
    expect(new Set(SUBMISSION_FIELD_IDS)).toEqual(union);
    expect(SUBMISSION_FIELD_IDS).toHaveLength(18);
    expect(new Set(SUBMISSION_FIELD_IDS).size).toBe(18);
  });

  it('field id schemas accept their own ids and reject others', () => {
    expect(pullRequestFieldIdSchema.safeParse('security-claim').success).toBe(false);
    expect(defectIssueFieldIdSchema.safeParse('category').success).toBe(false);
    expect(pullRequestFieldIdSchema.safeParse('category').success).toBe(true);
    expect(defectIssueFieldIdSchema.safeParse('security-claim').success).toBe(true);
    expect(proposalIssueFieldIdSchema.safeParse('problem').success).toBe(true);
    expect(proposalIssueFieldIdSchema.safeParse('acceptance-criteria').success).toBe(false);
  });

  it('every field id is kebab-case', () => {
    for (const id of SUBMISSION_FIELD_IDS) {
      expect(id).toMatch(/^[a-z]+(-[a-z]+)*$/);
    }
  });
});
