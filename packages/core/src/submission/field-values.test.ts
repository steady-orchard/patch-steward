import { describe, expect, it } from 'vitest';
import { parseCategoryValue, parseLinkedIssueValue } from './field-values.js';

const REPO = 'octo/widgets';

describe('parseCategoryValue', () => {
  it('category value: one id with optional backticks in any case is valid', () => {
    expect(parseCategoryValue('bugfix')).toEqual({ status: 'valid', category: 'bugfix' });
    expect(parseCategoryValue('`Feature`')).toEqual({ status: 'valid', category: 'feature' });
    expect(parseCategoryValue('  DOCS  ')).toEqual({ status: 'valid', category: 'docs' });
    expect(parseCategoryValue('<!-- pick one -->\nchore')).toEqual({ status: 'valid', category: 'chore' });
    expect(parseCategoryValue('security\r\n')).toEqual({ status: 'valid', category: 'security' });
  });

  it('category value: an empty or trivial value is missing', () => {
    expect(parseCategoryValue(undefined)).toEqual({ status: 'missing' });
    expect(parseCategoryValue('_No response_')).toEqual({ status: 'missing' });
    expect(parseCategoryValue('')).toEqual({ status: 'missing' });
    expect(parseCategoryValue('<!-- exactly one -->')).toEqual({ status: 'missing' });
    expect(parseCategoryValue('N/A')).toEqual({ status: 'missing' });
  });

  it('category value: an unknown word or several ids are invalid', () => {
    expect(parseCategoryValue('bugfixes')).toEqual({ status: 'invalid' });
    expect(parseCategoryValue('bugfix, feature')).toEqual({ status: 'invalid' });
    expect(parseCategoryValue('bugfix\nfeature')).toEqual({ status: 'invalid' });
    expect(parseCategoryValue('``')).toEqual({ status: 'invalid' });
    expect(parseCategoryValue('`bug fix`')).toEqual({ status: 'invalid' });
  });
});

describe('parseLinkedIssueValue', () => {
  it('linked issue value: one reference in this repository', () => {
    expect(parseLinkedIssueValue('#29', REPO)).toEqual({ status: 'one', number: 29 });
    expect(parseLinkedIssueValue('Fixes #29', REPO)).toEqual({ status: 'one', number: 29 });
    expect(parseLinkedIssueValue('fixes: #29', REPO)).toEqual({ status: 'one', number: 29 });
    expect(parseLinkedIssueValue('RESOLVES octo/widgets#29', REPO)).toEqual({ status: 'one', number: 29 });
    expect(parseLinkedIssueValue('https://github.com/octo/widgets/issues/29', REPO)).toEqual({ status: 'one', number: 29 });
    expect(parseLinkedIssueValue('Closes https://github.com/Octo/Widgets/issues/29', REPO)).toEqual({
      status: 'one',
      number: 29,
    });
    expect(parseLinkedIssueValue('<!-- hint #123 -->\nFixes #29\n', REPO)).toEqual({ status: 'one', number: 29 });
  });

  it('linked issue value: an empty or trivial value is absent', () => {
    expect(parseLinkedIssueValue(undefined, REPO)).toEqual({ status: 'absent' });
    expect(parseLinkedIssueValue('_No response_', REPO)).toEqual({ status: 'absent' });
    expect(parseLinkedIssueValue('', REPO)).toEqual({ status: 'absent' });
    expect(parseLinkedIssueValue('<!-- one issue, such as #123 -->', REPO)).toEqual({ status: 'absent' });
    expect(parseLinkedIssueValue('N/A', REPO)).toEqual({ status: 'absent' });
  });

  it('linked issue value: several references are invalid', () => {
    expect(parseLinkedIssueValue('#29 #30', REPO)).toEqual({ status: 'invalid', reason: 'several' });
    expect(parseLinkedIssueValue('Fixes #29, fixes #30', REPO)).toEqual({ status: 'invalid', reason: 'several' });
  });

  it('linked issue value: a cross-repository reference is invalid', () => {
    expect(parseLinkedIssueValue('other/repo#5', REPO)).toEqual({ status: 'invalid', reason: 'cross-repository' });
    expect(parseLinkedIssueValue('https://github.com/other/repo/issues/5', REPO)).toEqual({
      status: 'invalid',
      reason: 'cross-repository',
    });
    expect(parseLinkedIssueValue('#29 other/repo#5', REPO)).toEqual({ status: 'invalid', reason: 'cross-repository' });
  });

  it('linked issue value: unreadable text is invalid', () => {
    expect(parseLinkedIssueValue('the crash issue', REPO)).toEqual({ status: 'invalid', reason: 'unreadable' });
    expect(parseLinkedIssueValue('#0', REPO)).toEqual({ status: 'invalid', reason: 'unreadable' });
    expect(parseLinkedIssueValue('Fixes #29.', REPO)).toEqual({ status: 'invalid', reason: 'unreadable' });
    expect(parseLinkedIssueValue('see #29', REPO)).toEqual({ status: 'invalid', reason: 'unreadable' });
    expect(parseLinkedIssueValue('https://github.com/octo/widgets/pull/29', REPO)).toEqual({
      status: 'invalid',
      reason: 'unreadable',
    });
    expect(parseLinkedIssueValue('abc#29', REPO)).toEqual({ status: 'invalid', reason: 'unreadable' });
  });
});
