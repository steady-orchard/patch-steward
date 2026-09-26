import { describe, expect, it } from 'vitest';
import { DEFECT_ISSUE_FIELD_IDS, PROPOSAL_ISSUE_FIELD_IDS, PULL_REQUEST_FIELD_IDS } from '../submission-fields.js';
import {
  DEFECT_FORM_MAPPING_V1,
  PROPOSAL_FORM_MAPPING_V1,
  PULL_REQUEST_TEMPLATE_MAPPING_V1,
  FIELD_MAPPING_REGISTRY,
  SUBMISSION_TEMPLATE_FORMS,
  submissionTemplateFormSchema,
  SECURITY_CLAIM_OPTION_LABEL,
  PULL_REQUEST_TEMPLATE_MARKER_PATTERN,
  pullRequestTemplateMarker,
  normalizeTemplateLabel,
  INSTALLED_TEMPLATE_PATHS,
} from './field-mapping.js';

describe('field-mapping', () => {
  it('field mapping v1 matches the approved table', () => {
    expect(DEFECT_FORM_MAPPING_V1.fields.map((f) => [f.id, f.label, f.element, f.required])).toEqual([
      ['expected-behavior', 'Expected behavior', 'textarea', true],
      ['authoritative-basis', 'Authoritative basis', 'textarea', true],
      ['actual-behavior', 'Actual behavior', 'textarea', true],
      ['affected-version', 'Affected version', 'input', true],
      ['reproduction-command', 'Reproduction command', 'textarea', true],
      ['expected-result', 'Expected result', 'textarea', true],
      ['proposed-scope', 'Proposed scope', 'textarea', false],
      ['references', 'References', 'textarea', false],
      ['security-claim', 'Security claim', 'checkboxes', false],
    ]);

    expect(PROPOSAL_FORM_MAPPING_V1.fields.map((f) => [f.id, f.label, f.element, f.required])).toEqual([
      ['problem', 'Problem', 'textarea', true],
      ['benefit', 'Benefit', 'textarea', true],
      ['existing-decision', 'Existing decision', 'textarea', false],
      ['proposed-scope', 'Proposed scope', 'textarea', true],
      ['references', 'References', 'textarea', false],
    ]);

    expect(PULL_REQUEST_TEMPLATE_MAPPING_V1.sections.map((s) => [s.id, s.heading])).toEqual([
      ['category', 'Category'],
      ['problem', 'Problem'],
      ['benefit', 'Benefit'],
      ['intended-behavior', 'Intended behavior'],
      ['acceptance-criteria', 'Acceptance criteria'],
      ['linked-issue', 'Linked issue'],
      ['regression-test', 'Regression test'],
      ['test-scaffolding', 'Test scaffolding'],
      ['reproduction-command', 'Reproduction command'],
      ['expected-result', 'Expected result'],
      ['references', 'References'],
    ]);

    expect(DEFECT_FORM_MAPPING_V1.form).toBe('defect');
    expect(DEFECT_FORM_MAPPING_V1.version).toBe(1);
    expect(PROPOSAL_FORM_MAPPING_V1.form).toBe('proposal');
    expect(PROPOSAL_FORM_MAPPING_V1.version).toBe(1);
    expect(PULL_REQUEST_TEMPLATE_MAPPING_V1.version).toBe(1);
  });

  it('field mapping ids follow the canonical field id order', () => {
    expect(DEFECT_FORM_MAPPING_V1.fields.map((f) => f.id)).toEqual([...DEFECT_ISSUE_FIELD_IDS]);
    expect(PROPOSAL_FORM_MAPPING_V1.fields.map((f) => f.id)).toEqual([...PROPOSAL_ISSUE_FIELD_IDS]);
    expect(PULL_REQUEST_TEMPLATE_MAPPING_V1.sections.map((s) => s.id)).toEqual([...PULL_REQUEST_FIELD_IDS]);
  });

  it('field mapping registry lists versions newest first', () => {
    for (const list of [FIELD_MAPPING_REGISTRY.defect, FIELD_MAPPING_REGISTRY.proposal, FIELD_MAPPING_REGISTRY.pullRequest]) {
      expect(list.length).toBeGreaterThan(0);
      const versions = list.map((m) => m.version);
      for (let i = 1; i < versions.length; i += 1) {
        expect(versions[i]).toBeLessThan(versions[i - 1] as number);
      }
    }
    expect(FIELD_MAPPING_REGISTRY.defect[0]).toBe(DEFECT_FORM_MAPPING_V1);
    expect(FIELD_MAPPING_REGISTRY.proposal[0]).toBe(PROPOSAL_FORM_MAPPING_V1);
    expect(FIELD_MAPPING_REGISTRY.pullRequest[0]).toBe(PULL_REQUEST_TEMPLATE_MAPPING_V1);

    expect(Object.isFrozen(FIELD_MAPPING_REGISTRY)).toBe(true);
    expect(Object.isFrozen(FIELD_MAPPING_REGISTRY.defect)).toBe(true);
    expect(Object.isFrozen(DEFECT_FORM_MAPPING_V1)).toBe(true);
    expect(Object.isFrozen(DEFECT_FORM_MAPPING_V1.fields)).toBe(true);
    expect(Object.isFrozen(DEFECT_FORM_MAPPING_V1.fields[0])).toBe(true);
  });

  it('pull request template marker round-trips through its pattern', () => {
    const marker = pullRequestTemplateMarker(1);
    expect(marker).toBe('<!-- patch-steward:pr-template v1 -->');

    const match = PULL_REQUEST_TEMPLATE_MARKER_PATTERN.exec(marker);
    expect(match?.[1]).toBe('1');

    expect(PULL_REQUEST_TEMPLATE_MARKER_PATTERN.test('<!-- patch-steward:pr-template v12 -->')).toBe(true);

    expect(PULL_REQUEST_TEMPLATE_MARKER_PATTERN.test('<!-- patch-steward:pr-template v0 -->')).toBe(false);
    expect(PULL_REQUEST_TEMPLATE_MARKER_PATTERN.test('<!-- patch-steward:pr-template v01 -->')).toBe(false);
    expect(PULL_REQUEST_TEMPLATE_MARKER_PATTERN.test(' <!-- patch-steward:pr-template v1 -->')).toBe(false);
    expect(PULL_REQUEST_TEMPLATE_MARKER_PATTERN.test('<!-- patch-steward:pr-template v1 --> ')).toBe(false);
    expect(PULL_REQUEST_TEMPLATE_MARKER_PATTERN.test('<!-- patch-steward:pr-template 1 -->')).toBe(false);
  });

  it('template labels normalize composition and whitespace', () => {
    expect(normalizeTemplateLabel('  Expected\t behavior \n')).toBe('Expected behavior');
    expect(normalizeTemplateLabel('Café')).toBe('Café');
    expect(normalizeTemplateLabel('Expected behavior')).toBe('Expected behavior');
  });

  it('submission template forms and installed paths', () => {
    expect(SUBMISSION_TEMPLATE_FORMS).toEqual(['defect', 'proposal', 'pull_request']);
    expect(submissionTemplateFormSchema.safeParse('issue').success).toBe(false);
    expect(INSTALLED_TEMPLATE_PATHS).toEqual({
      defect: '.github/ISSUE_TEMPLATE/steward-defect.yml',
      proposal: '.github/ISSUE_TEMPLATE/steward-proposal.yml',
      pull_request: '.github/pull_request_template.md',
    });
    expect(SECURITY_CLAIM_OPTION_LABEL).toBe('This report claims a security problem');
  });
});
