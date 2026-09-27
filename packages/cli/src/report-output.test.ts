import { describe, expect, it } from 'vitest';

import { OUTCOMES } from '@patch-steward/core';

import { CLI_LOCAL_RUN_NOTICE } from './conventions.js';
import { buildReportFailureJson, reportTextProblem, REPORT_EXIT_BY_OUTCOME } from './report-output.js';

describe('report exit statuses follow the stored outcome', () => {
  it('report exit statuses follow the stored outcome', () => {
    expect(REPORT_EXIT_BY_OUTCOME).toEqual({
      pass: 0,
      'needs-changes': 1,
      uncertain: 1,
      inconclusive: 3,
      overridden: 1,
      superseded: 1,
    });
    expect(Object.keys(REPORT_EXIT_BY_OUTCOME).sort()).toEqual([...OUTCOMES].sort());
  });
});

describe('report text problems are detected in the report and the check summary', () => {
  it('report text problems are detected in the report and the check summary', () => {
    expect(reportTextProblem('ok\n', 'ok')).toBeNull();
    expect(reportTextProblem('a\u0007b', 'ok')).toEqual({
      code: 'report.evidence-invalid',
      path: 'report.md',
      message: 'report.md contains a control or format character.',
    });
    expect(reportTextProblem('ok', 'x\u202ey')).toEqual({
      code: 'report.evidence-invalid',
      path: 'report.json',
      message: 'The check summary contains a control or format character.',
    });
  });
});

describe('report failure json has null run data', () => {
  it('report failure json has null run data', () => {
    const report = buildReportFailureJson([{ code: 'report.run-unreadable', path: '', message: 'm' }]);
    expect(Object.keys(report)).toEqual([
      'schema_version',
      'command',
      'local_run',
      'authoritative',
      'notices',
      'run',
      'submission',
      'policy',
      'outcome',
      'causes',
      'report',
      'check_summary',
      'integrity',
      'warnings',
      'errors',
    ]);
    expect(report.authoritative).toBe(false);
    expect(report.notices).toEqual([CLI_LOCAL_RUN_NOTICE]);
    expect(report.run).toBeNull();
    expect(report.submission).toBeNull();
    expect(report.policy).toBeNull();
    expect(report.outcome).toBeNull();
    expect(report.report).toBeNull();
    expect(report.check_summary).toBeNull();
    expect(report.integrity).toBeNull();
    expect(report.causes).toEqual([]);
    expect(report.warnings).toEqual([]);
    expect(report.errors).toEqual([{ code: 'report.run-unreadable', path: '', message: 'm' }]);
  });
});
