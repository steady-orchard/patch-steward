import { describe, expect, it } from 'vitest';

import type { CheckSummaryInput } from './summary.js';
import { renderCheckSummary } from './summary.js';
import { REPORT_LOCAL_RUN_NOTICE, nonAuthoritativeNotice } from './templates.js';
import { maskCodeSpans } from './denylist.js';
import { reportCharacterViolations, reportFixedTextViolations } from './escape.js';
import { CHECK_SUMMARY_MAX_LENGTH } from '../policy/bounds.js';

function baseInput(overrides: Partial<CheckSummaryInput> = {}): CheckSummaryInput {
  return {
    outcome: 'needs-changes',
    repository: 'octo/demo',
    submissionType: 'pull_request',
    number: 12,
    headCommit: 'c'.repeat(40),
    snapshotHash: 'sha256:' + '5'.repeat(64),
    policyRevision: 'b'.repeat(40),
    policySource: 'trusted-branch',
    localRun: true,
    blockers: 2,
    uncertainties: 1,
    sharedHeadPullRequests: [],
    evidenceLocation: 'runs/pr-12/local-20260927T101500Z-3f9a1c2e',
    ...overrides,
  };
}

describe('renderCheckSummary', () => {
  it('check summary follows the approved layout', () => {
    const result = renderCheckSummary(baseInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe(
      '**Outcome:** `needs-changes`\n\n' +
        'Certifies `octo/demo` pull request `12` at head commit `' +
        'c'.repeat(40) +
        '` (snapshot `sha256:' +
        '5'.repeat(64) +
        '`) under policy revision `' +
        'b'.repeat(40) +
        '`.\n' +
        'Blockers: 2. Uncertainties for maintainers: 1.\n\n' +
        REPORT_LOCAL_RUN_NOTICE +
        '\n\n' +
        'Report and evidence: `runs/pr-12/local-20260927T101500Z-3f9a1c2e`\n',
    );

    const issueResult = renderCheckSummary(baseInput({ submissionType: 'issue', number: 29, headCommit: null, localRun: false }));
    expect(issueResult.ok).toBe(true);
    if (!issueResult.ok) return;
    expect(issueResult.value).toContain(
      'Certifies `octo/demo` issue `29` (snapshot `sha256:' + '5'.repeat(64) + '`) under policy revision `' + 'b'.repeat(40) + '`.',
    );
    expect(issueResult.value).not.toContain('head commit');
  });

  it('shared head is stated in the check summary', () => {
    const result = renderCheckSummary(baseInput({ sharedHeadPullRequests: ['13', '14'] }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain(
      'Blockers: 2. Uncertainties for maintainers: 1.\nShared head commit with pull requests `13`, `14`.',
    );
  });

  it('non-authoritative run is labeled in check summary', () => {
    const revision = 'local:' + 'e'.repeat(64);
    const result = renderCheckSummary(baseInput({ policySource: 'local-file', policyRevision: revision }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain('\n\n' + REPORT_LOCAL_RUN_NOTICE + '\n\n' + nonAuthoritativeNotice(revision) + '\n\n');

    const trustedResult = renderCheckSummary(baseInput());
    expect(trustedResult.ok).toBe(true);
    if (!trustedResult.ok) return;
    expect(trustedResult.value).not.toContain('Non-authoritative');
  });

  it('check summary stays within its maximum', () => {
    const result = renderCheckSummary(
      baseInput({
        repository: 'x'.repeat(140),
        evidenceLocation: '`'.repeat(5000),
        policyRevision: '`'.repeat(5000),
        policySource: 'local-file',
        sharedHeadPullRequests: Array.from({ length: 100 }, (_, i) => String(1000000000 + i)),
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.length).toBeLessThanOrEqual(CHECK_SUMMARY_MAX_LENGTH);
  });

  it('check summary keeps derived values in code spans', () => {
    const result = renderCheckSummary(
      baseInput({
        evidenceLocation: '@octocat #1 <b>x</b>\n\u202E',
        sharedHeadPullRequests: ['@a', '#2'],
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(reportFixedTextViolations(maskCodeSpans(result.value))).toEqual([]);
    expect(reportCharacterViolations(result.value)).toEqual([]);
  });
});
