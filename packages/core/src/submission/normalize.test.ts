import { describe, expect, it } from 'vitest';

import { computeClaimScope, isTrivialFieldValue, normalizeFieldText } from './normalize.js';
import type { ClaimScopeInput } from './normalize.js';

describe('normalizeFieldText', () => {
  it('field normalization converts CRLF and lone CR to LF', () => {
    expect(normalizeFieldText('a\r\nb\rc')).toBe('a\nb\nc');
  });

  it('field normalization removes HTML comments', () => {
    expect(normalizeFieldText('keep <!-- drop --> this')).toBe('keep  this');
    expect(normalizeFieldText('one\n<!--\n## hidden\n-->\ntwo')).toBe('one\n\ntwo');
  });

  it('field normalization removes an unterminated comment to the end', () => {
    expect(normalizeFieldText('text <!-- never closed\nmore')).toBe('text');
  });

  it('field normalization applies Unicode NFC', () => {
    expect(normalizeFieldText('é')).toBe('é');
  });

  it('field normalization trims trailing whitespace per line', () => {
    expect(normalizeFieldText('a  \t\nb\t')).toBe('a\nb');
  });

  it('field normalization trims leading and trailing blank lines', () => {
    expect(normalizeFieldText('\n\n  \nbody\n\n')).toBe('body');
  });

  it('field normalization keeps other Markdown verbatim', () => {
    const text = '**bold** `code` [x](y)\n\n  indented';
    expect(normalizeFieldText(text)).toBe(text);
  });
});

describe('isTrivialFieldValue', () => {
  it('trivial field values are recognized case-insensitively', () => {
    for (const value of [
      '_No response_',
      '_no response_',
      'N/A  ',
      'na',
      'None',
      '-',
      'tbd',
      'Todo',
      '...',
      '',
      '<!-- hint -->',
      '\n\n',
    ]) {
      expect(isTrivialFieldValue(value)).toBe(true);
    }
    for (const value of ['No', 'n/a please', '--', 'none yet']) {
      expect(isTrivialFieldValue(value)).toBe(false);
    }
  });
});

describe('computeClaimScope', () => {
  const contentHash = `sha256:${'c'.repeat(64)}` as const;

  const pinnedFields: ClaimScopeInput['fields'] = {
    problem: { state: 'present', raw: 'The parser crashes on empty input.\r\n' },
    benefit: { state: 'present', raw: 'Users can parse empty files.' },
    'intended-behavior': { state: 'present', raw: '<!-- hint -->\nEmpty input yields an empty document.  ' },
    'acceptance-criteria': { state: 'present', raw: '- empty input returns []\n- no exception\n\n' },
  };

  it('claim scope is available with the pinned canonical text and hash', () => {
    const result = computeClaimScope({
      structured: true,
      fields: pinnedFields,
      linkedIssue: { state: 'resolved', repository: 'octo/widgets', number: 7, contentHash },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const scope = result.value;
    expect(scope.status).toBe('available');
    if (scope.status !== 'available') return;
    expect(scope.hash).toBe('sha256:4ed82e82dd0abb37ae5a3a6bb75bbed3320d46923a6d60526abb214863dfef2f');
    expect(JSON.parse(scope.text)).toEqual({
      claim_scope_version: 1,
      problem: 'The parser crashes on empty input.',
      benefit: 'Users can parse empty files.',
      'intended-behavior': 'Empty input yields an empty document.',
      'acceptance-criteria': '- empty input returns []\n- no exception',
      'linked-proposal': { repository: 'octo/widgets', number: 7, content_hash: contentHash },
    });
    expect(scope.text.startsWith('{"acceptance-criteria":')).toBe(true);
  });

  it('claim scope without a linked issue has a null linked proposal', () => {
    const result = computeClaimScope({
      structured: true,
      fields: pinnedFields,
      linkedIssue: { state: 'absent' },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const scope = result.value;
    expect(scope.status).toBe('available');
    if (scope.status !== 'available') return;
    expect(scope.hash).toBe('sha256:8f82be245e2fe139173b7cd36c16f1a93ead03cc62217fb04c32882e04b90c12');
    expect(JSON.parse(scope.text)['linked-proposal']).toBe(null);
  });

  it('claim scope unavailable: unstructured', () => {
    const result = computeClaimScope({
      structured: false,
      fields: pinnedFields,
      linkedIssue: { state: 'absent' },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({ status: 'unavailable', reason: 'unstructured', field: null });
  });

  it('claim scope unavailable: field-missing', () => {
    const result = computeClaimScope({
      structured: true,
      fields: { ...pinnedFields, benefit: { state: 'absent' } },
      linkedIssue: { state: 'absent' },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({ status: 'unavailable', reason: 'field-missing', field: 'benefit' });
  });

  it('claim scope unavailable: field-trivial', () => {
    const result = computeClaimScope({
      structured: true,
      fields: { ...pinnedFields, 'acceptance-criteria': { state: 'present', raw: '_No response_' } },
      linkedIssue: { state: 'absent' },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({ status: 'unavailable', reason: 'field-trivial', field: 'acceptance-criteria' });
  });

  it('claim scope unavailable: field-duplicate', () => {
    const result = computeClaimScope({
      structured: true,
      fields: { ...pinnedFields, problem: { state: 'duplicate' } },
      linkedIssue: { state: 'absent' },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({ status: 'unavailable', reason: 'field-duplicate', field: 'problem' });
  });

  it('claim scope unavailable: linked-issue-unresolved', () => {
    const result = computeClaimScope({
      structured: true,
      fields: pinnedFields,
      linkedIssue: { state: 'unresolved' },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({ status: 'unavailable', reason: 'linked-issue-unresolved', field: null });
  });

  it('claim scope ignores formatting-only differences', () => {
    const pinnedResult = computeClaimScope({
      structured: true,
      fields: pinnedFields,
      linkedIssue: { state: 'resolved', repository: 'octo/widgets', number: 7, contentHash },
    });
    const variantFields: ClaimScopeInput['fields'] = {
      problem: { state: 'present', raw: '\n\nThe parser crashes on empty input.\r\n\r\n' },
      benefit: { state: 'present', raw: 'Users can parse empty files.  \n<!-- note -->' },
      'intended-behavior': { state: 'present', raw: '<!-- hint -->\nEmpty input yields an empty document.\r\n' },
      'acceptance-criteria': { state: 'present', raw: '\n- empty input returns []\r\n- no exception\t\n\n\n' },
    };
    const variantResult = computeClaimScope({
      structured: true,
      fields: variantFields,
      linkedIssue: { state: 'resolved', repository: 'octo/widgets', number: 7, contentHash },
    });
    expect(pinnedResult.ok).toBe(true);
    expect(variantResult.ok).toBe(true);
    if (!pinnedResult.ok || !variantResult.ok) return;
    const pinnedScope = pinnedResult.value;
    const variantScope = variantResult.value;
    expect(pinnedScope.status).toBe('available');
    expect(variantScope.status).toBe('available');
    if (pinnedScope.status !== 'available' || variantScope.status !== 'available') return;
    expect(variantScope.hash).toBe(pinnedScope.hash);
  });
});
