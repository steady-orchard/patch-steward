import { describe, expect, it } from 'vitest';

import type { RecordCause } from '../records/decision.js';
import { DEFAULT_CHECKLIST_POLICY } from '../submission/default-checklist.js';
import { maskCodeSpans, reportDenylistMatches } from './denylist.js';
import {
  causeLine,
  nonAuthoritativeNotice,
  OUTCOME_CHANGE_LINES,
  provenanceLines,
  REPORT_LOCAL_RUN_NOTICE,
  REPORT_SECTION_HEADINGS,
  REPORT_TITLE,
  reportHeaderLines,
  type ProvenanceInput,
  type ReportHeaderInput,
} from './templates.js';
import { reportCharacterViolations, reportCodeSpan, reportFixedTextViolations, reportSubjectList } from './escape.js';
import { reportStaticBudget } from './caps.js';
import { findingTexts, type FindingTemplateContext } from './finding-templates.js';
import { fitReportItem, fitReportLine, renderReport, type ReportFindingItem, type ReportInput } from './render.js';

const STORE = 'runs/pr-12/local-20260927T101500Z-3f9a1c2e';
const evidenceLocation = (p: string): string => (p === '' ? STORE : STORE + '/' + p);

const ctx: FindingTemplateContext = {
  repository: 'octo/demo',
  defaultBranch: 'main',
  submissionType: 'pull_request',
  template: { form: 'pull_request', version: 1 },
  category: 'bugfix',
  headCommit: 'c'.repeat(40),
  policy: DEFAULT_CHECKLIST_POLICY,
  policyChange: null,
};

function issueHeader(): ReportHeaderInput {
  return {
    outcome: 'pass',
    causes: [],
    repository: 'octo/demo',
    submissionType: 'issue',
    number: 1,
    snapshotHash: 'sha256:' + '1'.repeat(64),
    targetBranch: null,
    headCommit: null,
    baseCommit: null,
    policyRevision: 'a'.repeat(40),
    runId: 'local-20260927T101500Z-3f9a1c2e',
    runAttempt: 1,
  };
}

function prHeader(): ReportHeaderInput {
  return {
    outcome: 'pass',
    causes: [],
    repository: 'octo/demo',
    submissionType: 'pull_request',
    number: 12,
    snapshotHash: 'sha256:' + '5'.repeat(64),
    targetBranch: 'main',
    headCommit: 'c'.repeat(40),
    baseCommit: 'd'.repeat(40),
    policyRevision: 'b'.repeat(40),
    runId: 'local-20260927T101500Z-3f9a1c2e',
    runAttempt: 1,
  };
}

const trustedProvenance: ProvenanceInput = {
  source: 'trusted-branch',
  policyRevision: 'b'.repeat(40),
  ref: 'refs/heads/main',
  commit: 'e'.repeat(40),
  stewardVersion: '1.0.0',
};

function baseInput(overrides: Partial<ReportInput> = {}): ReportInput {
  return {
    header: issueHeader(),
    localRun: false,
    classification: { type: 'issue', issueKind: 'defect' },
    findings: [],
    causes: [],
    executedCommands: [],
    references: [],
    flagged: [],
    maxFlagged: DEFAULT_CHECKLIST_POLICY.hygiene.max_flagged,
    provenance: trustedProvenance,
    evidenceLocation,
    ...overrides,
  };
}

function expectOk(result: ReturnType<typeof renderReport>): string {
  if (!result.ok) {
    throw new Error('expected ok, got ' + JSON.stringify(result.failure));
  }
  return result.value;
}

it('report sections follow the fixed order', () => {
  const text = expectOk(renderReport(baseInput()));
  const headingLines = text.split('\n').filter((l) => l.startsWith('### '));
  expect(headingLines).toEqual(Object.values(REPORT_SECTION_HEADINGS));
  expect(text).toContain('\n' + '- None.' + '\n');
  expect(text.startsWith(REPORT_TITLE + '\n\n- Outcome:')).toBe(true);
  expect(text.endsWith('- Runner: no execution in this run\n')).toBe(true);
  expect(text).not.toContain('\n\n\n');
});

it('report carries the bound identifiers and provenance', () => {
  const header = prHeader();
  const text = expectOk(
    renderReport(
      baseInput({ header, classification: { type: 'pull_request', category: 'bugfix', consistent: true, plausible: [] } }),
    ),
  );
  const headerLines = reportHeaderLines(header);
  const provLines = provenanceLines(trustedProvenance);
  let cursor = -1;
  for (const line of [...headerLines, ...provLines]) {
    const idx = text.indexOf(line, cursor + 1);
    expect(idx).toBeGreaterThan(cursor);
    cursor = idx;
  }
});

it('non-authoritative run is labeled in report.md', () => {
  const rev = 'local:' + 'e'.repeat(64);
  const localProvenance: ProvenanceInput = { source: 'local-file', policyRevision: rev, stewardVersion: '1.0.0' };
  const localText = expectOk(renderReport(baseInput({ localRun: true, provenance: localProvenance })));
  expect(localText).toContain('\n> ' + REPORT_LOCAL_RUN_NOTICE + '\n> ' + nonAuthoritativeNotice(rev) + '\n');

  const trustedText = expectOk(renderReport(baseInput({ localRun: true, provenance: trustedProvenance })));
  expect(trustedText).toContain('> ' + REPORT_LOCAL_RUN_NOTICE);
  expect(trustedText).not.toContain('Non-authoritative');
});

it('blockers carry location, evidence, and request lines', () => {
  const texts = findingTexts({ code: 'submission.field-missing', detail: null, field: 'regression-test', subjects: [] }, ctx);
  if (!texts.ok) throw new Error('expected ok');
  const finding: ReportFindingItem = {
    evidencePath: 'findings/finding-0001.json',
    texts: texts.value,
    requestId: 'R1',
    dismissalCode: null,
  };
  const text = expectOk(renderReport(baseInput({ findings: [finding] })));
  const lines = text.split('\n');
  const start = lines.indexOf('### Blockers');
  const section = lines.slice(start + 2, start + 2 + 4);
  expect(section).toEqual([
    '1. The required "Regression test" section is absent or has no content.',
    '   - Location: the "Regression test" section of the pull request description',
    '   - Evidence: `runs/pr-12/local-20260927T101500Z-3f9a1c2e/findings/finding-0001.json`',
    '   - Request `R1`: Fill in the "Regression test" section.',
  ]);

  const dismissedFinding: ReportFindingItem = { ...finding, dismissalCode: 'duplicate' };
  const dismissedText = expectOk(renderReport(baseInput({ findings: [dismissedFinding] })));
  const dismissedLines = dismissedText.split('\n');
  const dismissedStart = dismissedLines.indexOf('### Blockers');
  const dismissedSection = dismissedLines.slice(dismissedStart + 2, dismissedStart + 2 + 5);
  expect(dismissedSection[3]).toBe('   - Dismissal code: `duplicate`');
  expect(dismissedSection[4]).toBe('   - Request `R1`: Fill in the "Regression test" section.');
});

it('uncertainties carry a decision line', () => {
  const texts = findingTexts(
    { code: 'submission.execution-sensitive-change', detail: null, field: null, subjects: ['package.json'] },
    ctx,
  );
  if (!texts.ok) throw new Error('expected ok');
  const finding: ReportFindingItem = {
    evidencePath: 'findings/finding-0002.json',
    texts: texts.value,
    requestId: null,
    dismissalCode: null,
  };
  const text = expectOk(renderReport(baseInput({ findings: [finding] })));
  const lines = text.split('\n');
  const start = lines.indexOf('### Uncertainties for maintainers');
  const section = lines.slice(start + 2, start + 2 + 4);
  expect(section[0]).toBe('1. Execution-sensitive paths changed: `package.json`.');
  expect(section[1]).toBe('   - Location: `package.json`');
  expect(section[3]).toBe(
    '   - Decision needed: review these changes; test results from this pull request cannot be relied on until a maintainer does.',
  );
});

it('advisory findings render only as classification notes', () => {
  const texts = findingTexts(
    { code: 'submission.trusted-path-change', detail: null, field: null, subjects: ['package.json'] },
    ctx,
  );
  if (!texts.ok) throw new Error('expected ok');
  const finding: ReportFindingItem = {
    evidencePath: 'findings/finding-0003.json',
    texts: texts.value,
    requestId: null,
    dismissalCode: null,
  };
  const text = expectOk(renderReport(baseInput({ findings: [finding] })));
  const lines = text.split('\n');
  expect(lines.some((l) => l.startsWith('- Note: '))).toBe(true);
  const blockersStart = lines.indexOf('### Blockers');
  expect(lines[blockersStart + 2]).toBe('- None.');
  const uncertaintiesStart = lines.indexOf('### Uncertainties for maintainers');
  expect(lines[uncertaintiesStart + 2]).toBe('- None.');
});

it('inconclusive causes render under what would change the outcome', () => {
  const cause: RecordCause = {
    cause: 'stage-incomplete',
    code: 'stage.incomplete',
    message: 'x',
    subjects: ['references', 'claim'],
  };
  const header = { ...issueHeader(), outcome: 'inconclusive' as const, causes: ['stage-incomplete' as const] };
  const text = expectOk(renderReport(baseInput({ header, causes: [cause] })));
  const lines = text.split('\n');
  const start = lines.indexOf('### What would change the outcome');
  expect(lines[start + 2]).toBe('- ' + OUTCOME_CHANGE_LINES.inconclusive);
  expect(lines[start + 3]).toBe('- ' + causeLine(cause));
});

it('overflow states the remaining count and links the evidence', () => {
  const blockerFindings: ReportFindingItem[] = [];
  for (let i = 0; i < 23; i++) {
    const texts = findingTexts({ code: 'submission.field-missing', detail: null, field: 'regression-test', subjects: [] }, ctx);
    if (!texts.ok) throw new Error('expected ok');
    blockerFindings.push({ evidencePath: `findings/finding-${i}.json`, texts: texts.value, requestId: null, dismissalCode: null });
  }
  const blockerText = expectOk(renderReport(baseInput({ findings: blockerFindings })));
  const blockerLines = blockerText.split('\n');
  const blockerStart = blockerLines.indexOf('### Blockers');
  const numbered = blockerLines.slice(blockerStart + 2).filter((l) => /^\d+\. /.test(l));
  expect(numbered.length).toBe(20);
  expect(blockerText).toContain('- 3 more blockers are recorded in the evidence: `runs/pr-12/local-20260927T101500Z-3f9a1c2e`.');

  const noteFindings: ReportFindingItem[] = [];
  for (let i = 0; i < 13; i++) {
    const texts = findingTexts(
      { code: 'submission.trusted-path-change', detail: null, field: null, subjects: ['package.json'] },
      ctx,
    );
    if (!texts.ok) throw new Error('expected ok');
    noteFindings.push({ evidencePath: `findings/finding-${i}.json`, texts: texts.value, requestId: null, dismissalCode: null });
  }
  const noteText = expectOk(renderReport(baseInput({ findings: noteFindings })));
  const noteLines = noteText.split('\n').filter((l) => l.startsWith('- Note: '));
  expect(noteLines.length).toBe(10);
  expect(noteText).toContain('- 3 more notes are recorded in the evidence: `runs/pr-12/local-20260927T101500Z-3f9a1c2e`.');
});

it('report stays within caps', () => {
  const L = '`'.repeat(300);
  const span = reportCodeSpan(L);
  expect(span.length).toBe(616);

  const blockerFindings: ReportFindingItem[] = Array.from({ length: 25 }, (_, i) => ({
    evidencePath: `findings/blocker-${i}.json`,
    texts: {
      kind: 'blocker' as const,
      scenario: 'S ' + span + ' ' + span,
      location: reportSubjectList(Array.from({ length: 12 }, () => L)),
      request: 'R ' + span + span,
    },
    requestId: 'R1',
    dismissalCode: 'duplicate',
  }));

  const uncertaintyFindings: ReportFindingItem[] = Array.from({ length: 15 }, (_, i) => ({
    evidencePath: `findings/uncertainty-${i}.json`,
    texts: {
      kind: 'uncertainty' as const,
      scenario: 'S ' + span + ' ' + span,
      location: reportSubjectList(Array.from({ length: 12 }, () => L)),
      decision: 'R ' + span + span,
    },
    requestId: null,
    dismissalCode: null,
  }));

  const noteFindings: ReportFindingItem[] = Array.from({ length: 15 }, (_, i) => ({
    evidencePath: `findings/note-${i}.json`,
    texts: { kind: 'note' as const, note: reportSubjectList(Array.from({ length: 12 }, () => L)) },
    requestId: null,
    dismissalCode: null,
  }));

  const causes: RecordCause[] = Array.from({ length: 15 }, () => ({
    cause: 'attachment-fetch-failed',
    code: 'attachment.fetch-failed',
    message: 'x',
    subjects: Array.from({ length: 12 }, () => L),
  }));

  const header: ReportHeaderInput = { ...prHeader(), outcome: 'inconclusive', targetBranch: L };
  const provenance: ProvenanceInput = { ...trustedProvenance, ref: L };

  const input: ReportInput = baseInput({
    header,
    classification: { type: 'pull_request', category: 'bugfix', consistent: true, plausible: [] },
    findings: [...blockerFindings, ...uncertaintyFindings, ...noteFindings],
    causes,
    executedCommands: Array.from({ length: 15 }, () => 'x'.repeat(3000) + span),
    references: Array.from({ length: 25 }, () => 'x'.repeat(3000) + span),
    flagged: Array.from({ length: 15 }, () => 'x'.repeat(3000) + span),
    maxFlagged: 50,
    provenance,
  });

  const result = renderReport(input);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  const text = result.value;
  expect(text.length).toBeLessThanOrEqual(60000);
  expect(text.length).toBeLessThanOrEqual(reportStaticBudget());

  const firstHeadingIndex = text.indexOf('\n### ');
  expect(firstHeadingIndex).toBeLessThanOrEqual(3000);

  const provenanceMarker = '### Provenance\n\n';
  const provenanceIndex = text.indexOf(provenanceMarker);
  expect(provenanceIndex).toBeGreaterThan(-1);
  const afterProvenance = text.slice(provenanceIndex + provenanceMarker.length);
  expect(afterProvenance.length).toBeLessThanOrEqual(1500);

  expect(reportCharacterViolations(text)).toEqual([]);

  const lines = text.split('\n');
  interface Item {
    readonly lines: string[];
  }
  const sectionCaps: Record<string, number> = {
    '### Classification': 300,
    '### Blockers': 1000,
    '### Uncertainties for maintainers': 800,
    '### Executed commands and results': 600,
    '### References': 250,
    '### Flagged automated activity': 300,
    '### What would change the outcome': 500,
  };
  let currentCap: number | null = null;
  const items: Item[] = [];
  let current: Item | null = null;
  for (const line of lines) {
    if (Object.prototype.hasOwnProperty.call(sectionCaps, line)) {
      currentCap = sectionCaps[line] as number;
      current = null;
      continue;
    }
    if (line === '### Provenance') {
      currentCap = null;
      current = null;
      continue;
    }
    if (currentCap === null) continue;
    if (/^\d+\. /.test(line) || line.startsWith('- ')) {
      current = { lines: [line] };
      items.push(current);
    } else if (line.startsWith('   ') && current !== null) {
      current.lines.push(line);
    }
  }
  for (const item of items) {
    const total = item.lines.reduce((sum, l) => sum + l.length + 1, 0) - 1;
    const firstLine = item.lines[0] as string;
    const cap = /^- \d+ more /.test(firstLine) ? 300 : undefined;
    if (cap !== undefined) {
      expect(total).toBeLessThanOrEqual(cap);
    }
  }

  expect(text).toContain('- 5 more blockers');
  expect(text).toContain('- 5 more uncertainties');
  expect(text).toContain('- 5 more notes');
  expect(text).toContain('- 5 more executed commands');
  expect(text).toContain('- 5 more references');
  expect(text).toContain('- 5 more flagged items');
  expect(text).toContain('- 6 more items');
});

it('oversized items are truncated outside code spans', () => {
  const line = '- Note: ' + 'a'.repeat(50) + ' ' + reportCodeSpan('x'.repeat(150)) + ' tail';
  const truncated = fitReportLine(line, 100);
  expect(truncated.length).toBeLessThanOrEqual(100);
  expect(truncated.endsWith(' (truncated)')).toBe(true);
  expect(maskCodeSpans(truncated)).not.toContain('`');

  const shortLine = 'short line';
  expect(fitReportLine(shortLine, 100)).toBe(shortLine);

  const itemLines = [
    '1. ' + 'a'.repeat(500),
    '   - Location: ' + 'b'.repeat(500),
    '   - Evidence: `short`',
    '   - Request: ' + 'c'.repeat(500),
  ];
  const max = 400;
  const fitted = fitReportItem(itemLines, max);
  const total = fitted.reduce((sum, l) => sum + l.length + 1, 0);
  expect(total).toBeLessThanOrEqual(max);
  expect(fitted[0]?.startsWith('1. ')).toBe(true);
  expect(fitted[2]).toBe('   - Evidence: `short`');

  expect(() => fitReportLine('x', 11)).toThrow(RangeError);
});

describe('E-rule tests', () => {
  const H = [
    '@octocat',
    '#1',
    '<img src=x onerror=alert(1)>',
    '[x](javascript:alert(1))',
    'a```b',
    'line\nbreak',
    'bell\u0007',
    'rtl\u202Eevil',
    'zero\u200Bwidth',
    '$' + '{{ secrets.GITHUB_TOKEN }}',
  ];

  function erText(): string {
    const executionTexts = findingTexts(
      { code: 'submission.execution-sensitive-change', detail: null, field: null, subjects: H },
      ctx,
    );
    const attachmentTexts = findingTexts(
      {
        code: 'submission.attachment-violation',
        detail: 'destination',
        field: null,
        subjects: ['https://example.com/@octocat/#1/<img src=x onerror=alert(1)>'],
      },
      ctx,
    );
    const trustedPathTexts = findingTexts({ code: 'submission.trusted-path-change', detail: null, field: null, subjects: H }, ctx);
    if (!executionTexts.ok || !attachmentTexts.ok || !trustedPathTexts.ok) {
      throw new Error('expected ok');
    }
    const findings: ReportFindingItem[] = [
      { evidencePath: 'findings/finding-0001.json', texts: executionTexts.value, requestId: null, dismissalCode: null },
      { evidencePath: 'findings/finding-0002.json', texts: attachmentTexts.value, requestId: 'R1', dismissalCode: null },
      { evidencePath: 'findings/finding-0003.json', texts: trustedPathTexts.value, requestId: null, dismissalCode: null },
    ];
    return expectOk(renderReport(baseInput({ findings })));
  }

  it('rendered report keeps derived values in code spans', () => {
    const text = erText();
    const masked = maskCodeSpans(text);
    expect(reportFixedTextViolations(masked)).toEqual([]);
    expect(reportDenylistMatches(masked)).toEqual([]);
  });

  it('rendered report escapes line breaks and control characters', () => {
    const text = erText();
    expect(text).not.toContain('\u0007');
    expect(text).not.toContain('\u202E');
    expect(text).not.toContain('\u200B');
    expect(text).not.toContain('\r');
    expect(text).toContain('line\\nbreak');
    expect(text).toContain('\\u{202E}');
  });

  it('rendered report fences backtick runs', () => {
    const text = erText();
    expect(text).toContain('````a```b````');
  });

  it('rendered report links only to the repository and the evidence', () => {
    const text = erText();
    const masked = maskCodeSpans(text);
    expect(masked).not.toContain('http');
    expect(masked).not.toContain('](');
    expect(masked).not.toContain('<');
  });

  it('rendered report contains no control or format character', () => {
    const text = erText();
    expect(reportCharacterViolations(text)).toEqual([]);
  });
});
