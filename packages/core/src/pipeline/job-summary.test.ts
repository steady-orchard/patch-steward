import { describe, expect, it } from 'vitest';
import { fitJobSummary, renderJobSummary } from './job-summary.js';
import type { JobSummaryInput } from './job-summary.js';
import { reportCharacterViolations, reportCodeSpan } from '../report/escape.js';
import { JOB_SUMMARY_MAX_LENGTH } from '../policy/bounds.js';

const baseInput: JobSummaryInput = {
  job: 'gate',
  repository: 'octo/repo',
  subjectType: 'pull_request',
  subjectNumber: 42,
  runId: 123,
  runAttempt: 1,
  status: 'runnable',
  snapshotHash: null,
  policyRevision: null,
  owner: null,
  caps: null,
  evidence: null,
  freshness: null,
  retentionDays: null,
  failureCode: null,
};

describe('job summary', () => {
  it('gate summaries list disposition, snapshot, owner, and caps', () => {
    const input: JobSummaryInput = {
      ...baseInput,
      snapshotHash: 'abcd1234',
      policyRevision: 'deadbeef',
      owner: { action: 'committed', runId: 123, runAttempt: 1 },
      caps: { dailyCount: 3, dailyLimit: 50, authorCount: 1, authorLimit: 2 },
      retentionDays: 90,
    };
    const expected =
      [
        '## Patch Steward gate',
        '',
        '- Submission: `octo/repo` pull request `42`',
        '- Run: `123-1`',
        '- Status: `runnable`',
        '- Snapshot: `abcd1234`',
        '- Policy revision: `deadbeef`',
        '- Owner: committed `123-1`',
        '- Caps: daily `3` of `50`, author `1` of `2`',
        '- Ownership artifact retention: `90` days',
      ].join('\n') + '\n';
    expect(renderJobSummary(input)).toBe(expected);
  });

  it('publish summaries list outcome, evidence, and freshness', () => {
    const commit = 'a'.repeat(40);
    const location = 'https://github.com/octo/repo/tree/steward-evidence/pull-42';
    expect(location.length).toBeLessThan(200);
    const input: JobSummaryInput = {
      ...baseInput,
      job: 'publish',
      subjectType: 'issue',
      status: 'pass',
      evidence: { commit, location },
      freshness: { state: 'current' },
    };
    const expected =
      [
        '## Patch Steward publish',
        '',
        '- Submission: `octo/repo` issue `42`',
        '- Run: `123-1`',
        '- Status: `pass`',
        '- Evidence: commit `' + commit + '` at `' + location + '`',
        '- Freshness: `current`',
      ].join('\n') + '\n';
    expect(renderJobSummary(input)).toBe(expected);
  });

  it('superseded freshness names its reason', () => {
    const superseded = renderJobSummary({ ...baseInput, freshness: { state: 'superseded', reason: 'newer-owner' } });
    expect(superseded).toContain('- Freshness: `superseded` (`newer-owner`)');
    const unknown = renderJobSummary({ ...baseInput, freshness: { state: 'unknown' } });
    expect(unknown).toContain('- Freshness: `unknown`');
  });

  it('absent fields are omitted', () => {
    const output = renderJobSummary(baseInput);
    const expected =
      ['## Patch Steward gate', '', '- Submission: `octo/repo` pull request `42`', '- Run: `123-1`', '- Status: `runnable`'].join(
        '\n',
      ) + '\n';
    expect(output).toBe(expected);
    expect(output.split('\n')).toHaveLength(6);
  });

  it('derived values render as code spans', () => {
    const output = renderJobSummary(baseInput);
    expect(output).toContain('- Submission: ' + reportCodeSpan('octo/repo') + ' pull request ' + reportCodeSpan('42'));
    expect(output).toContain('- Run: ' + reportCodeSpan('123-1'));
    expect(output).toContain('- Status: ' + reportCodeSpan('runnable'));
  });

  it('hostile values cannot break the summary layout', () => {
    const hostile = 'bad`\nvalue\r@user #12 <b>' + String.fromCharCode(0x202e) + String.fromCharCode(0x200b) + 'end';
    const input: JobSummaryInput = {
      ...baseInput,
      failureCode: hostile,
      evidence: { commit: 'a'.repeat(40), location: hostile },
    };
    const output = renderJobSummary(input);
    const lines = output.split('\n');
    // trailing newline produces one empty element at the end
    expect(lines[lines.length - 1]).toBe('');
    for (const line of lines) {
      expect(line === '' || line.startsWith('## ') || line.startsWith('- ')).toBe(true);
    }
    expect(reportCharacterViolations(output)).toEqual([]);
  });

  it('short retention is flagged', () => {
    const short = renderJobSummary({ ...baseInput, retentionDays: 89 });
    expect(short).toContain('- Ownership artifact retention: `89` days (shorter than requested)');
    const exact = renderJobSummary({ ...baseInput, retentionDays: 90 });
    expect(exact).toContain('- Ownership artifact retention: `90` days');
    expect(exact).not.toContain('(shorter than requested)');
  });

  it('summaries never exceed the bound', () => {
    const lines = [
      '## Patch Steward gate',
      '',
      '- Submission: `octo/repo` pull request `42`',
      '- Run: `123-1`',
      '- Status: `runnable`',
    ];
    const fitted = fitJobSummary(lines, 40);
    expect(fitted.startsWith('## Patch Steward gate\n')).toBe(true);
    expect(fitted.endsWith('- Summary truncated.\n')).toBe(true);
    expect(fitted.length).toBeLessThanOrEqual(40 + '- Summary truncated.\n'.length + '## Patch Steward gate\n'.length);
    expect(renderJobSummary(baseInput).length).toBeLessThanOrEqual(JOB_SUMMARY_MAX_LENGTH);
  });
});
