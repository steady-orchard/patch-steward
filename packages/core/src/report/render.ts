import type { RecordCause } from '../records/decision.js';
import type { Result } from '../result.js';
import { err, ok } from '../result.js';
import { REPORT_MAX_LENGTH } from '../policy/bounds.js';

import type { ClassificationInput, ProvenanceInput, ReportHeaderInput, ReportSection } from './templates.js';
import {
  REPORT_EMPTY_SECTION_LINE,
  REPORT_ITEM_TEMPLATES,
  REPORT_LOCAL_RUN_NOTICE,
  REPORT_SECTIONS,
  REPORT_SECTION_HEADINGS,
  REPORT_TITLE,
  causeLine,
  classificationLine,
  nonAuthoritativeNotice,
  overflowLine,
  provenanceLines,
  reportHeaderLines,
  OUTCOME_CHANGE_LINES,
} from './templates.js';
import { REPORT_ITEM_MAX_LENGTHS, REPORT_SECTION_ITEM_LIMITS, flaggedItemLimit } from './caps.js';
import { fillReportTemplate, reportCodeSpan, REPORT_TRUNCATION_SUFFIX } from './escape.js';
import type { FindingTexts } from './finding-templates.js';

export interface ReportFindingItem {
  readonly evidencePath: string;
  readonly texts: FindingTexts;
  readonly requestId: string | null;
  readonly dismissalCode: string | null;
}

export interface ReportInput {
  readonly header: ReportHeaderInput;
  readonly localRun: boolean;
  readonly classification: ClassificationInput;
  readonly findings: readonly ReportFindingItem[];
  readonly causes: readonly RecordCause[];
  readonly executedCommands: readonly string[];
  readonly references: readonly string[];
  readonly flagged: readonly string[];
  readonly maxFlagged: number;
  readonly provenance: ProvenanceInput;
  readonly evidenceLocation: (relativePath: string) => string;
}

export type ReportRenderFailureCode = 'report.too-large';

function codeSpanRanges(line: string): readonly (readonly [number, number])[] {
  const ranges: [number, number][] = [];
  let i = 0;
  const len = line.length;
  while (i < len) {
    if (line[i] === '`') {
      let runLength = 0;
      let j = i;
      while (j < len && line[j] === '`') {
        runLength++;
        j++;
      }
      const closer = findCloserIndex(line, j, runLength);
      if (closer === -1) {
        i = j;
      } else {
        ranges.push([i, closer + runLength]);
        i = closer + runLength;
      }
    } else {
      i++;
    }
  }
  return ranges;
}

function findCloserIndex(line: string, from: number, runLength: number): number {
  const len = line.length;
  let i = from;
  while (i < len) {
    if (line[i] === '`') {
      let count = 0;
      const start = i;
      while (i < len && line[i] === '`') {
        count++;
        i++;
      }
      if (count === runLength) {
        return start;
      }
    } else {
      i++;
    }
  }
  return -1;
}

function insideRange(ranges: readonly (readonly [number, number])[], p: number): boolean {
  for (const [s, e] of ranges) {
    if (s < p && p < e) {
      return true;
    }
  }
  return false;
}

export function fitReportLine(line: string, max: number): string {
  if (max < REPORT_TRUNCATION_SUFFIX.length) {
    throw new RangeError('max is smaller than the truncation suffix');
  }
  if (line.length <= max) {
    return line;
  }
  const ranges = codeSpanRanges(line);
  const limit = Math.max(0, max - REPORT_TRUNCATION_SUFFIX.length);
  let result = 0;
  let candidate = limit;
  while (candidate >= 0) {
    let q = candidate;
    while (q > 0 && line.charCodeAt(q - 1) >= 0xd800 && line.charCodeAt(q - 1) <= 0xdbff) {
      q--;
    }
    if (!insideRange(ranges, q)) {
      result = q;
      break;
    }
    candidate--;
  }
  return line.slice(0, result).trimEnd() + REPORT_TRUNCATION_SUFFIX;
}

export function fitReportItem(lines: readonly string[], max: number): readonly string[] {
  const total = lines.reduce((sum, l) => sum + l.length + 1, 0);
  if (total <= max) {
    return lines;
  }
  const budget = max - lines.length;
  const order = lines.map((line, index) => ({ line, index })).sort((a, b) => a.line.length - b.line.length || a.index - b.index);
  const results = new Array<string>(lines.length);
  let remaining = budget;
  const n = order.length;
  for (let k = 0; k < n; k++) {
    const entry = order[k] as { line: string; index: number };
    const share = Math.floor(remaining / (n - k));
    const fitted = entry.line.length <= share ? entry.line : fitReportLine(entry.line, share);
    results[entry.index] = fitted;
    remaining -= fitted.length;
  }
  return results;
}

function fitItemLines(lines: readonly string[], cap: number): readonly string[] {
  return fitReportItem(lines, cap);
}

function buildListSection(
  items: readonly string[],
  cap: number,
  limit: number,
  section: Exclude<ReportSection, 'provenance'>,
  evidenceLocation: string,
): readonly string[] {
  const lines: string[] = [];
  const shown = items.slice(0, limit);
  for (const item of shown) {
    const fitted = fitItemLines([item], cap);
    lines.push(...fitted);
  }
  const overflowCount = items.length - shown.length;
  if (overflowCount > 0) {
    lines.push(overflowLine(overflowCount, section, evidenceLocation));
  }
  if (lines.length === 0) {
    lines.push(REPORT_EMPTY_SECTION_LINE);
  }
  return lines;
}

export function renderReport(input: ReportInput): Result<string, ReportRenderFailureCode> {
  const lines: string[] = [];
  lines.push(REPORT_TITLE, '', ...reportHeaderLines(input.header));

  const notices: string[] = [];
  if (input.localRun) {
    notices.push(REPORT_LOCAL_RUN_NOTICE);
  }
  if (input.provenance.source === 'local-file') {
    notices.push(nonAuthoritativeNotice(input.provenance.policyRevision));
  }
  if (notices.length > 0) {
    lines.push('', ...notices.map((n) => '> ' + n));
  }

  for (const section of REPORT_SECTIONS) {
    lines.push('', REPORT_SECTION_HEADINGS[section], '', ...renderSection(section, input));
  }

  const text = lines.join('\n') + '\n';
  if (text.length > REPORT_MAX_LENGTH) {
    return err('report.too-large', 'steward-defect', 'The rendered report exceeds the report maximum.');
  }
  return ok(text);
}

function renderSection(section: ReportSection, input: ReportInput): readonly string[] {
  if (section === 'classification') {
    return renderClassification(input);
  }
  if (section === 'blockers') {
    return renderFindings(input, 'blocker');
  }
  if (section === 'uncertainties') {
    return renderFindings(input, 'uncertainty');
  }
  if (section === 'executed-commands') {
    return buildListSection(
      input.executedCommands.map((s) => '- ' + s.replace(/\r/g, ' ').replace(/\n/g, ' ')),
      REPORT_ITEM_MAX_LENGTHS['executed-command'],
      REPORT_SECTION_ITEM_LIMITS['executed-commands'],
      'executed-commands',
      input.evidenceLocation(''),
    );
  }
  if (section === 'references') {
    return buildListSection(
      input.references.map((s) => '- ' + s.replace(/\r/g, ' ').replace(/\n/g, ' ')),
      REPORT_ITEM_MAX_LENGTHS.reference,
      REPORT_SECTION_ITEM_LIMITS.references,
      'references',
      input.evidenceLocation(''),
    );
  }
  if (section === 'flagged') {
    return buildListSection(
      input.flagged.map((s) => '- ' + s.replace(/\r/g, ' ').replace(/\n/g, ' ')),
      REPORT_ITEM_MAX_LENGTHS['flagged-item'],
      flaggedItemLimit(input.maxFlagged),
      'flagged',
      input.evidenceLocation(''),
    );
  }
  if (section === 'what-would-change') {
    return renderWhatWouldChange(input);
  }
  return provenanceLines(input.provenance);
}

function renderClassification(input: ReportInput): readonly string[] {
  const lines: string[] = [];
  const classificationItem = fitItemLines(
    ['- ' + classificationLine(input.classification)],
    REPORT_ITEM_MAX_LENGTHS['classification-line'],
  );
  lines.push(...classificationItem);

  const notes = input.findings.filter((f) => f.texts.kind === 'note');
  const limit = REPORT_SECTION_ITEM_LIMITS['classification-notes'];
  const shown = notes.slice(0, limit);
  for (const finding of shown) {
    const texts = finding.texts as Extract<FindingTexts, { kind: 'note' }>;
    const item = fitItemLines(
      [fillReportTemplate(REPORT_ITEM_TEMPLATES.note, { note: texts.note })],
      REPORT_ITEM_MAX_LENGTHS['classification-note'],
    );
    lines.push(...item);
  }
  const overflowCount = notes.length - shown.length;
  if (overflowCount > 0) {
    lines.push(overflowLine(overflowCount, 'classification', input.evidenceLocation('')));
  }
  return lines;
}

function renderFindings(input: ReportInput, kind: 'blocker' | 'uncertainty'): readonly string[] {
  const section: Exclude<ReportSection, 'provenance'> = kind === 'blocker' ? 'blockers' : 'uncertainties';
  const cap = REPORT_ITEM_MAX_LENGTHS[kind];
  const limit = REPORT_SECTION_ITEM_LIMITS[section];
  const matching = input.findings.filter((f) => f.texts.kind === kind);
  const shown = matching.slice(0, limit);
  const lines: string[] = [];
  shown.forEach((finding, idx) => {
    const number = idx + 1;
    const itemLines: string[] = [];
    if (kind === 'blocker') {
      const texts = finding.texts as Extract<FindingTexts, { kind: 'blocker' }>;
      itemLines.push(fillReportTemplate(REPORT_ITEM_TEMPLATES.item, { number: String(number), scenario: texts.scenario }));
      itemLines.push(fillReportTemplate(REPORT_ITEM_TEMPLATES.location, { location: texts.location }));
      itemLines.push(
        fillReportTemplate(REPORT_ITEM_TEMPLATES.evidence, {
          evidence: reportCodeSpan(input.evidenceLocation(finding.evidencePath)),
        }),
      );
      if (finding.dismissalCode !== null) {
        itemLines.push(fillReportTemplate(REPORT_ITEM_TEMPLATES.dismissalCode, { code: reportCodeSpan(finding.dismissalCode) }));
      }
      if (finding.requestId !== null) {
        itemLines.push(
          fillReportTemplate(REPORT_ITEM_TEMPLATES.request, {
            requestId: reportCodeSpan(finding.requestId),
            request: texts.request,
          }),
        );
      }
    } else {
      const texts = finding.texts as Extract<FindingTexts, { kind: 'uncertainty' }>;
      itemLines.push(fillReportTemplate(REPORT_ITEM_TEMPLATES.item, { number: String(number), scenario: texts.scenario }));
      itemLines.push(fillReportTemplate(REPORT_ITEM_TEMPLATES.location, { location: texts.location }));
      itemLines.push(
        fillReportTemplate(REPORT_ITEM_TEMPLATES.evidence, {
          evidence: reportCodeSpan(input.evidenceLocation(finding.evidencePath)),
        }),
      );
      itemLines.push(fillReportTemplate(REPORT_ITEM_TEMPLATES.decision, { decision: texts.decision }));
    }
    lines.push(...fitItemLines(itemLines, cap));
  });
  const overflowCount = matching.length - shown.length;
  if (overflowCount > 0) {
    lines.push(overflowLine(overflowCount, section, input.evidenceLocation('')));
  }
  if (lines.length === 0) {
    lines.push(REPORT_EMPTY_SECTION_LINE);
  }
  return lines;
}

function renderWhatWouldChange(input: ReportInput): readonly string[] {
  const cap = REPORT_ITEM_MAX_LENGTHS['what-would-change-item'];
  const items: string[] = ['- ' + OUTCOME_CHANGE_LINES[input.header.outcome]];
  for (const cause of input.causes) {
    items.push('- ' + causeLine(cause));
  }
  const limit = REPORT_SECTION_ITEM_LIMITS['what-would-change'];
  const shown = items.slice(0, limit);
  const lines: string[] = [];
  for (const item of shown) {
    lines.push(...fitItemLines([item], cap));
  }
  const overflowCount = items.length - shown.length;
  if (overflowCount > 0) {
    lines.push(overflowLine(overflowCount, 'what-would-change', input.evidenceLocation('')));
  }
  if (lines.length === 0) {
    lines.push(REPORT_EMPTY_SECTION_LINE);
  }
  return lines;
}
