import { describe, expect, it } from 'vitest';

import { FAILURE_CAUSES, OUTCOMES } from '../vocabulary.js';

import { reportDenylistMatches } from './denylist.js';
import { REPORT_HEADING_MAX_LENGTH } from './caps.js';
import {
  CAUSE_TEMPLATES,
  CHECK_SUMMARY_TEMPLATES,
  CLASSIFICATION_TEMPLATES,
  OUTCOME_CHANGE_LINES,
  PROVENANCE_TEMPLATES,
  REPORT_EMPTY_SECTION_LINE,
  REPORT_HEADER_TEMPLATES,
  REPORT_ITEM_TEMPLATES,
  REPORT_LOCAL_RUN_NOTICE,
  REPORT_NON_AUTHORITATIVE_NOTICE_TEMPLATE,
  REPORT_OVERFLOW_NOUNS,
  REPORT_OVERFLOW_TEMPLATE,
  REPORT_SECTION_HEADINGS,
  REPORT_SECTIONS,
  REPORT_TITLE,
  causeLine,
  classificationLine,
  nonAuthoritativeNotice,
  overflowLine,
  provenanceLines,
  reportHeaderLines,
} from './templates.js';

function collectStringLeaves(value: unknown, out: string[]): void {
  if (typeof value === 'string') {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStringLeaves(item, out);
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const item of Object.values(value)) collectStringLeaves(item, out);
  }
}

describe('templates', () => {
  it('report headings follow the fixed section order', () => {
    const expected = [
      'classification',
      'blockers',
      'uncertainties',
      'executed-commands',
      'references',
      'flagged',
      'what-would-change',
      'provenance',
    ] as const;
    expect(REPORT_SECTIONS).toEqual(expected);
    expect(REPORT_SECTIONS.map((section) => REPORT_SECTION_HEADINGS[section])).toEqual([
      '### Classification',
      '### Blockers',
      '### Uncertainties for maintainers',
      '### Executed commands and results',
      '### References',
      '### Flagged automated activity',
      '### What would change the outcome',
      '### Provenance',
    ]);
    expect(REPORT_TITLE.length).toBeLessThanOrEqual(REPORT_HEADING_MAX_LENGTH);
    for (const section of REPORT_SECTIONS) {
      expect(REPORT_SECTION_HEADINGS[section].length).toBeLessThanOrEqual(REPORT_HEADING_MAX_LENGTH);
    }
  });

  it('header lines carry the bound identifiers', () => {
    const lines = reportHeaderLines({
      outcome: 'needs-changes',
      causes: [],
      repository: 'octo/demo',
      submissionType: 'pull_request',
      number: 12,
      snapshotHash: 'sha256:' + 'a'.repeat(64),
      targetBranch: 'main',
      headCommit: 'b'.repeat(40),
      baseCommit: 'c'.repeat(40),
      policyRevision: 'd'.repeat(40),
      runId: 'local-20260927T101500Z-3f9a1c2e',
      runAttempt: 1,
    });
    expect(lines).toEqual([
      '- Outcome: `needs-changes`',
      '- Submission: `octo/demo` pull request `12`',
      '- Snapshot: `sha256:' + 'a'.repeat(64) + '`',
      '- Target branch: `main`',
      '- Head commit: `' + 'b'.repeat(40) + '`',
      '- Base commit tested: `' + 'c'.repeat(40) + '`',
      '- Policy revision: `' + 'd'.repeat(40) + '`',
      '- Run: `local-20260927T101500Z-3f9a1c2e` attempt `1`',
    ]);
  });

  it('inconclusive causes appear only for inconclusive outcomes', () => {
    const causes = ['attachment-fetch-failed', 'stage-incomplete', 'attachment-fetch-failed'] as const;
    const base = {
      repository: 'octo/demo',
      submissionType: 'issue' as const,
      number: 7,
      snapshotHash: 'sha256:' + 'f'.repeat(64),
      targetBranch: null,
      headCommit: null,
      baseCommit: null,
      policyRevision: 'g'.repeat(40),
      runId: 'local-20260927T101500Z-abc12345',
      runAttempt: 1,
    };

    const inconclusiveLines = reportHeaderLines({ ...base, outcome: 'inconclusive', causes: [...causes] });
    expect(inconclusiveLines[1]).toBe('- Inconclusive causes: `attachment-fetch-failed`, `stage-incomplete`');

    const needsChangesLines = reportHeaderLines({ ...base, outcome: 'needs-changes', causes: [...causes] });
    expect(needsChangesLines.some((line) => line.startsWith('- Inconclusive causes:'))).toBe(false);
    expect(inconclusiveLines.some((line) => line.startsWith('- Target branch:'))).toBe(false);
    expect(inconclusiveLines.some((line) => line.startsWith('- Head commit:'))).toBe(false);
    expect(inconclusiveLines.some((line) => line.startsWith('- Base commit tested:'))).toBe(false);
  });

  it('classification line covers forms and categories', () => {
    expect(classificationLine({ type: 'issue', issueKind: 'defect' })).toBe(
      'Form: "defect". Claim classification: not determined; claim validation did not run.',
    );
    expect(classificationLine({ type: 'issue', issueKind: null })).toBe(
      'Form: none (unstructured). Claim classification: not determined; claim validation did not run.',
    );
    expect(classificationLine({ type: 'pull_request', category: 'bugfix', consistent: true, plausible: [] })).toBe(
      'Category: `bugfix`. Claim classification: not determined; claim validation did not run.',
    );
    expect(
      classificationLine({ type: 'pull_request', category: null, consistent: false, plausible: ['feature', 'refactor'] }),
    ).toBe(
      'Category: not determined; plausible: `feature`, `refactor`. Claim classification: not determined; claim validation did not run.',
    );
  });

  it('every outcome and failure cause has fixed text', () => {
    expect(Object.keys(OUTCOME_CHANGE_LINES).sort()).toEqual([...OUTCOMES].sort());
    expect(Object.keys(OUTCOME_CHANGE_LINES)).toHaveLength(6);
    expect(Object.keys(CAUSE_TEMPLATES).sort()).toEqual([...FAILURE_CAUSES].sort());
    expect(Object.keys(CAUSE_TEMPLATES)).toHaveLength(20);
  });

  it('stage-incomplete lists the missing stages', () => {
    expect(
      causeLine({
        cause: 'stage-incomplete',
        code: 'pipeline.stage-incomplete',
        message: 'Required stages produced no result.',
        subjects: ['references', 'claim'],
      }),
    ).toBe(
      'Required stages produced no result: `references`, `claim`. A steward version that runs these stages is required; this version checks the submission contract only.',
    );
  });

  it('overflow line states the remaining count and the evidence location', () => {
    expect(overflowLine(5, 'blockers', 'runs/pr-12/local-20260927T101500Z-3f9a1c2e')).toBe(
      '- 5 more blockers are recorded in the evidence: `runs/pr-12/local-20260927T101500Z-3f9a1c2e`.',
    );
  });

  it('provenance lines distinguish trusted and local policies', () => {
    expect(
      provenanceLines({
        source: 'trusted-branch',
        policyRevision: 'h'.repeat(40),
        ref: 'main',
        commit: 'i'.repeat(40),
        stewardVersion: '1.0.0',
      }),
    ).toEqual([
      '- Policy revision: `' + 'h'.repeat(40) + '` (trusted branch `main` at commit `' + 'i'.repeat(40) + '`)',
      '- Steward version: `1.0.0`',
      '- Model: no model call in this run',
      '- Adapter and runtime: none',
      '- Runner: no execution in this run',
    ]);
    expect(provenanceLines({ source: 'local-file', policyRevision: 'local:' + 'j'.repeat(64), stewardVersion: '1.0.0' })).toEqual([
      '- Policy revision: `local:' + 'j'.repeat(64) + '` (local policy file; non-authoritative)',
      '- Steward version: `1.0.0`',
      '- Model: no model call in this run',
      '- Adapter and runtime: none',
      '- Runner: no execution in this run',
    ]);
  });

  it('notices use the approved wording', () => {
    expect(nonAuthoritativeNotice('local:' + 'e'.repeat(64))).toBe(
      'Non-authoritative: screened under the local policy file revision `local:' +
        'e'.repeat(64) +
        "`, not the trusted branch's policy.",
    );
    expect(REPORT_LOCAL_RUN_NOTICE).toBe(
      "Local run: produced on a maintainer's machine; not the repository's official screening result.",
    );
  });

  it('template text has no denylisted wording', () => {
    const leaves: string[] = [];
    collectStringLeaves(REPORT_TITLE, leaves);
    collectStringLeaves(REPORT_SECTION_HEADINGS, leaves);
    collectStringLeaves(REPORT_EMPTY_SECTION_LINE, leaves);
    collectStringLeaves(REPORT_OVERFLOW_NOUNS, leaves);
    collectStringLeaves(REPORT_OVERFLOW_TEMPLATE, leaves);
    collectStringLeaves(REPORT_LOCAL_RUN_NOTICE, leaves);
    collectStringLeaves(REPORT_NON_AUTHORITATIVE_NOTICE_TEMPLATE, leaves);
    collectStringLeaves(REPORT_HEADER_TEMPLATES, leaves);
    collectStringLeaves(CLASSIFICATION_TEMPLATES, leaves);
    collectStringLeaves(OUTCOME_CHANGE_LINES, leaves);
    collectStringLeaves(CAUSE_TEMPLATES, leaves);
    collectStringLeaves(REPORT_ITEM_TEMPLATES, leaves);
    collectStringLeaves(PROVENANCE_TEMPLATES, leaves);
    collectStringLeaves(CHECK_SUMMARY_TEMPLATES, leaves);

    for (const leaf of leaves) {
      expect(reportDenylistMatches(leaf)).toEqual([]);
    }
  });
});
