import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parsePullRequestBody } from './parse.js';
import { parseCategoryValue, parseLinkedIssueValue } from './field-values.js';
import type { CategoryValue, LinkedIssueValue } from './field-values.js';
import type { SubmissionFieldId } from '../submission-fields.js';

const corpusDir = fileURLToPath(new URL('../../../../fixtures/submissions/', import.meta.url));
const REPOSITORY = 'steady-orchard/patch-steward-testbed-public';

function readFixture(name: string): string {
  return readFileSync(corpusDir + name, 'utf8');
}

interface UnstructuredExpectation {
  readonly structured: false;
  readonly reason: string;
}

interface StructuredExpectation {
  readonly structured: true;
  readonly fieldCount: number;
  readonly duplicates: readonly SubmissionFieldId[];
  readonly trivial: readonly SubmissionFieldId[];
  readonly category: CategoryValue;
  readonly linkedIssue: LinkedIssueValue;
}

type Expectation = UnstructuredExpectation | StructuredExpectation;

const TRIVIAL_ONLY_TEST_SCAFFOLDING: readonly SubmissionFieldId[] = ['test-scaffolding'];

const TRIVIAL_DOCS_LIKE: readonly SubmissionFieldId[] = [
  'benefit',
  'intended-behavior',
  'acceptance-criteria',
  'linked-issue',
  'regression-test',
  'test-scaffolding',
  'reproduction-command',
  'expected-result',
  'references',
];

const EXPECTED: Record<string, Expectation> = {
  'pr-bugfix-complete.txt': {
    structured: true,
    fieldCount: 11,
    duplicates: [],
    trivial: TRIVIAL_ONLY_TEST_SCAFFOLDING,
    category: { status: 'valid', category: 'bugfix' },
    linkedIssue: { status: 'one', number: 29 },
  },
  'pr-missing-marker.txt': { structured: false, reason: 'marker-missing' },
  'pr-duplicate-heading.txt': {
    structured: true,
    fieldCount: 10,
    duplicates: ['problem'],
    trivial: TRIVIAL_ONLY_TEST_SCAFFOLDING,
    category: { status: 'valid', category: 'bugfix' },
    linkedIssue: { status: 'one', number: 29 },
  },
  'pr-unknown-section.txt': {
    structured: true,
    fieldCount: 11,
    duplicates: [],
    trivial: TRIVIAL_ONLY_TEST_SCAFFOLDING,
    category: { status: 'valid', category: 'bugfix' },
    linkedIssue: { status: 'one', number: 29 },
  },
  'pr-category-missing.txt': {
    structured: true,
    fieldCount: 11,
    duplicates: [],
    trivial: ['category', 'test-scaffolding'],
    category: { status: 'missing' },
    linkedIssue: { status: 'one', number: 29 },
  },
  'pr-category-invalid.txt': {
    structured: true,
    fieldCount: 11,
    duplicates: [],
    trivial: TRIVIAL_ONLY_TEST_SCAFFOLDING,
    category: { status: 'invalid' },
    linkedIssue: { status: 'one', number: 29 },
  },
  'pr-category-several.txt': {
    structured: true,
    fieldCount: 11,
    duplicates: [],
    trivial: TRIVIAL_ONLY_TEST_SCAFFOLDING,
    category: { status: 'invalid' },
    linkedIssue: { status: 'one', number: 29 },
  },
  'pr-docs.txt': {
    structured: true,
    fieldCount: 11,
    duplicates: [],
    trivial: TRIVIAL_DOCS_LIKE,
    category: { status: 'valid', category: 'docs' },
    linkedIssue: { status: 'absent' },
  },
  'pr-chore.txt': {
    structured: true,
    fieldCount: 11,
    duplicates: [],
    trivial: TRIVIAL_DOCS_LIKE,
    category: { status: 'valid', category: 'chore' },
    linkedIssue: { status: 'absent' },
  },
  'pr-linked-issue-missing.txt': {
    structured: true,
    fieldCount: 11,
    duplicates: [],
    trivial: ['linked-issue', 'test-scaffolding'],
    category: { status: 'valid', category: 'bugfix' },
    linkedIssue: { status: 'absent' },
  },
  'pr-linked-issue-cross-repository.txt': {
    structured: true,
    fieldCount: 11,
    duplicates: [],
    trivial: TRIVIAL_ONLY_TEST_SCAFFOLDING,
    category: { status: 'valid', category: 'bugfix' },
    linkedIssue: { status: 'invalid', reason: 'cross-repository' },
  },
  'pr-linked-issue-several.txt': {
    structured: true,
    fieldCount: 11,
    duplicates: [],
    trivial: TRIVIAL_ONLY_TEST_SCAFFOLDING,
    category: { status: 'valid', category: 'bugfix' },
    linkedIssue: { status: 'invalid', reason: 'several' },
  },
  'pr-attachment-count.txt': {
    structured: true,
    fieldCount: 11,
    duplicates: [],
    trivial: TRIVIAL_ONLY_TEST_SCAFFOLDING,
    category: { status: 'valid', category: 'bugfix' },
    linkedIssue: { status: 'one', number: 29 },
  },
  'pr-attachment-format.txt': {
    structured: true,
    fieldCount: 11,
    duplicates: [],
    trivial: TRIVIAL_ONLY_TEST_SCAFFOLDING,
    category: { status: 'valid', category: 'bugfix' },
    linkedIssue: { status: 'one', number: 29 },
  },
  'pr-attachment-destination.txt': {
    structured: true,
    fieldCount: 11,
    duplicates: [],
    trivial: TRIVIAL_ONLY_TEST_SCAFFOLDING,
    category: { status: 'valid', category: 'bugfix' },
    linkedIssue: { status: 'one', number: 29 },
  },
  'pr-attachment-scheme.txt': {
    structured: true,
    fieldCount: 11,
    duplicates: [],
    trivial: TRIVIAL_ONLY_TEST_SCAFFOLDING,
    category: { status: 'valid', category: 'bugfix' },
    linkedIssue: { status: 'one', number: 29 },
  },
};

describe('pull request body fixture corpus', () => {
  it.each(Object.keys(EXPECTED))('pull request body fixture %s parses as expected', (name) => {
    const expectation = EXPECTED[name] as Expectation;
    const body = readFixture(name);
    const result = parsePullRequestBody(body);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const parsed = result.value;
    if (!expectation.structured) {
      expect(parsed.structured).toBe(false);
      if (!parsed.structured) {
        expect(parsed.reason).toBe(expectation.reason);
      }
      return;
    }
    expect(parsed.structured).toBe(true);
    if (!parsed.structured) {
      return;
    }
    expect(parsed.template.form).toBe('pull_request');
    expect(parsed.template.version).toBe(1);
    expect(Object.keys(parsed.fields).length).toBe(expectation.fieldCount);
    expect(parsed.duplicates).toEqual(expectation.duplicates);
    const trivialIds = (Object.keys(parsed.fields) as SubmissionFieldId[]).filter((id) => parsed.fields[id]?.trivial === true);
    expect(trivialIds).toEqual(expectation.trivial);
    expect(parseCategoryValue(parsed.fields.category?.raw)).toEqual(expectation.category);
    expect(parseLinkedIssueValue(parsed.fields['linked-issue']?.raw, REPOSITORY)).toEqual(expectation.linkedIssue);
  });

  it('pull request body fixture pr-unknown-section.txt keeps the problem field intact', () => {
    const body = readFixture('pr-unknown-section.txt');
    const result = parsePullRequestBody(body);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const parsed = result.value;
    expect(parsed.structured).toBe(true);
    if (!parsed.structured) {
      return;
    }
    expect(parsed.fields.problem?.normalized).toBe('`widget parse` exits with status 1 on an empty file.');
  });

  it('pull request attachment fixtures carry their URLs', () => {
    function reproductionRaw(name: string): string {
      const body = readFixture(name);
      const result = parsePullRequestBody(body);
      expect(result.ok).toBe(true);
      if (!result.ok) {
        return '';
      }
      const parsed = result.value;
      expect(parsed.structured).toBe(true);
      if (!parsed.structured) {
        return '';
      }
      return parsed.fields['reproduction-command']?.raw ?? '';
    }

    const countRaw = reproductionRaw('pr-attachment-count.txt');
    const occurrences = countRaw.split('https://github.com/user-attachments/files/').length - 1;
    expect(occurrences).toBe(6);

    expect(reproductionRaw('pr-attachment-format.txt')).toContain('/tool.exe');
    expect(reproductionRaw('pr-attachment-destination.txt')).toContain('https://user-images.githubusercontent.com/');
    expect(reproductionRaw('pr-attachment-scheme.txt')).toContain('http://github.com/user-attachments/');
  });

  it('pull request body fixtures match their pinned bytes', () => {
    const body = readFixture('pr-bugfix-complete.txt').replace(/\r/g, '');
    const digest = createHash('sha256').update(body, 'utf8').digest('hex');
    expect(digest).toBe('34c1ec808074dff00656fe769b56edeaab7d44f8c92acd6aa27d060cab8b182a');
  });
});
