import { describe, expect, it } from 'vitest';
import {
  capPolicyDetails,
  formatExcerpt,
  formatPolicyPath,
  mapZodIssues,
  policyFailureMessage,
  sanitizePathSegment,
} from './messages.js';
import type { ZodIssueLike } from './messages.js';
import type { FailureDetail } from '../result.js';

describe('messages', () => {
  it('formats excerpts with markdown escaping', () => {
    expect(formatExcerpt('a_b*c')).toBe('a\\_b\\*c');
    expect(formatExcerpt('@user')).toBe('\\@user');
  });

  it('formats non-string excerpts', () => {
    expect(formatExcerpt(5)).toBe('5');
    expect(formatExcerpt(Infinity)).toBe('Infinity');
    expect(formatExcerpt(NaN)).toBe('NaN');
    expect(formatExcerpt(true)).toBe('true');
    expect(formatExcerpt(null)).toBe('null');
    expect(formatExcerpt([])).toBe('a list');
    expect(formatExcerpt({})).toBe('a mapping');
  });

  it('truncates excerpts to the maximum length', () => {
    const result = formatExcerpt('x'.repeat(100));
    expect(Array.from(result).length).toBe(80);
    expect(result).toBe('x'.repeat(79) + '…');
  });

  it('escapes control characters in excerpts and paths', () => {
    expect(formatExcerpt('a\u0007b')).toBe('a\\u0007b');
    expect(sanitizePathSegment('k\ny')).toBe('k\\u000ay');
  });

  it('redacts credential-like text in excerpts and paths', () => {
    const sample = 'https://' + 'deploy:' + 's3cr3tvalue' + '@example.com';
    const excerpt = formatExcerpt(sample);
    expect(excerpt).toContain('\\[REDACTED:url-credentials\\]');
    expect(excerpt).not.toContain('s3cr3tvalue');
    const path = sanitizePathSegment(sample);
    expect(path).toContain('[REDACTED:url-credentials]');
    expect(path).not.toContain('s3cr3tvalue');
  });

  it('formats policy paths', () => {
    expect(formatPolicyPath(['execution', 'commands', 2, 'id'])).toBe('execution.commands.2.id');
    expect(formatPolicyPath([])).toBe('');
  });

  it('maps unrecognized keys to one detail per key', () => {
    const issues: ZodIssueLike[] = [{ code: 'unrecognized_keys', path: ['runner'], keys: ['a', 'b'], message: 'x' }];
    const details = mapZodIssues(issues, {});
    expect(details).toHaveLength(2);
    expect(details[0]?.path).toBe('runner.a');
    expect(details[0]?.code).toBe('policy.unknown-key');
    expect(details[1]?.path).toBe('runner.b');
    expect(details[1]?.code).toBe('policy.unknown-key');
  });

  it('maps undefined values to policy.missing-key', () => {
    const raw = { runner: {} };
    const issues: ZodIssueLike[] = [{ code: 'invalid_type', path: ['runner', 'resources'], message: 'Required' }];
    const details = mapZodIssues(issues, raw);
    expect(details[0]?.code).toBe('policy.missing-key');
    expect(details[0]?.path).toBe('runner.resources');
    expect(details[0]?.message).toContain('no default is substituted');
  });

  it('maps numeric limit violations to policy.limit-out-of-bounds', () => {
    const raw = { runner: { resources: { cpus: 5 } } };
    const issues: ZodIssueLike[] = [{ code: 'too_big', path: ['runner', 'resources', 'cpus'], message: 'Too big' }];
    const details = mapZodIssues(issues, raw);
    expect(details[0]?.code).toBe('policy.limit-out-of-bounds');
    expect(details[0]?.message).toContain('from 1 to 4');
    expect(details[0]?.message).toContain('5');

    const rawString = { runner: { resources: { cpus: '5' } } };
    const detailsString = mapZodIssues(issues, rawString);
    expect(detailsString[0]?.code).toBe('policy.invalid-value');
  });

  it('maps other issues to policy.invalid-value', () => {
    const raw = { modes: { default: 'loud' } };
    const issues: ZodIssueLike[] = [{ code: 'invalid_value', path: ['modes', 'default'], message: 'Invalid option' }];
    const details = mapZodIssues(issues, raw);
    expect(details[0]?.code).toBe('policy.invalid-value');
    expect(details[0]?.message).toContain('loud');
    expect(details[0]?.message).toContain('Invalid option');
  });

  it('does not read inherited properties when locating values', () => {
    const issues: ZodIssueLike[] = [{ code: 'invalid_type', path: ['toString'], message: 'Required' }];
    const details = mapZodIssues(issues, {});
    expect(details[0]?.code).toBe('policy.missing-key');
  });

  it('caps details at the validation maximum', () => {
    const details: FailureDetail[] = Array.from({ length: 150 }, (_, index) => ({
      code: 'policy.invalid-value',
      path: `p${index}`,
      message: 'x',
      line: null,
      column: null,
    }));
    expect(capPolicyDetails(details)).toHaveLength(100);
  });

  it('failure message names the count and states no default', () => {
    const first: FailureDetail = { code: 'policy.invalid-value', path: 'p', message: 'bad', line: null, column: null };
    const message = policyFailureMessage(150, first);
    expect(message).toContain('150 error(s)');
    expect(message).toContain('No default was substituted');
    expect(message).toContain('inconclusive');
    expect(message).toContain('Only the first 100 errors are listed.');

    const singleMessage = policyFailureMessage(1, first);
    expect(singleMessage).not.toContain('Only the first');
  });
});
