import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { maskCodeSpans, reportDenylistMatches } from './denylist.js';
import { reportCharacterViolations, reportFixedTextViolations, REPORT_TRUNCATION_SUFFIX } from './escape.js';
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
  REPORT_TITLE,
} from './templates.js';
import type { FindingTemplateContext, FindingTemplateInput } from './finding-templates.js';
import { FINDING_TEMPLATES, findingTexts } from './finding-templates.js';
import type { ContractFindingCode } from '../submission/contract.js';
import { CONTRACT_FINDING_CODES, CONTRACT_FINDING_MESSAGES } from '../submission/contract.js';
import { FIELD_MAPPING_REGISTRY } from '../submission/field-mapping.js';
import { SUBMISSION_ATTACHMENT_RULES } from '../submission/attachments.js';
import { DEFAULT_CHECKLIST_POLICY } from '../submission/default-checklist.js';

function stringLeaves(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => stringLeaves(item));
  }
  if (value !== null && typeof value === 'object') {
    return Object.values(value).flatMap((item) => stringLeaves(item));
  }
  return [];
}

const FIELD_LABELS: readonly string[] = [
  ...FIELD_MAPPING_REGISTRY.defect.flatMap((mapping) => mapping.fields.map((field) => field.label)),
  ...FIELD_MAPPING_REGISTRY.proposal.flatMap((mapping) => mapping.fields.map((field) => field.label)),
  ...FIELD_MAPPING_REGISTRY.pullRequest.flatMap((mapping) => mapping.sections.map((section) => section.heading)),
];

const FIXED: readonly string[] = [
  ...stringLeaves(REPORT_TITLE),
  ...stringLeaves(REPORT_SECTION_HEADINGS),
  ...stringLeaves(REPORT_EMPTY_SECTION_LINE),
  ...stringLeaves(REPORT_OVERFLOW_NOUNS),
  ...stringLeaves(REPORT_OVERFLOW_TEMPLATE),
  ...stringLeaves(REPORT_LOCAL_RUN_NOTICE),
  ...stringLeaves(REPORT_NON_AUTHORITATIVE_NOTICE_TEMPLATE),
  ...stringLeaves(REPORT_HEADER_TEMPLATES),
  ...stringLeaves(CLASSIFICATION_TEMPLATES),
  ...stringLeaves(OUTCOME_CHANGE_LINES),
  ...stringLeaves(CAUSE_TEMPLATES),
  ...stringLeaves(REPORT_ITEM_TEMPLATES),
  ...stringLeaves(PROVENANCE_TEMPLATES),
  ...stringLeaves(CHECK_SUMMARY_TEMPLATES),
  ...stringLeaves(FINDING_TEMPLATES),
  ...stringLeaves(REPORT_TRUNCATION_SUFFIX),
  ...FIELD_LABELS,
];

describe('report wording', () => {
  test('report wording has no severity, authorship, or praise term', () => {
    for (const text of FIXED) {
      expect(reportDenylistMatches(text), text).toEqual([]);
    }
    for (const text of Object.values(CONTRACT_FINDING_MESSAGES)) {
      expect(reportDenylistMatches(text), text).toEqual([]);
    }
  });

  test('fixed report text has no mention, issue reference, markup, exclamation mark, or emoji', () => {
    for (const text of FIXED) {
      expect(reportFixedTextViolations(text), text).toEqual([]);
      expect(reportCharacterViolations(text), text).toEqual([]);
    }
  });

  test('contract request texts have no severity, authorship, or praise term', () => {
    const source = readFileSync(new URL('../submission/contract.ts', import.meta.url), 'utf8');
    const start = source.indexOf('\nfunction requestText(');
    const end = source.indexOf('\nfunction buildRequests(');
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const slice = source.slice(start, end);
    const literalPattern = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
    const literals: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = literalPattern.exec(slice)) !== null) {
      literals.push((match[1] ?? match[2] ?? match[3]) as string);
    }
    expect(literals.length).toBeGreaterThanOrEqual(10);
    for (const literal of literals) {
      expect(reportDenylistMatches(literal), literal).toEqual([]);
    }
  });

  test('rendered finding texts keep derived values inside code spans', () => {
    const ctx: FindingTemplateContext = {
      repository: 'octo/demo',
      defaultBranch: 'main',
      submissionType: 'pull_request',
      template: { form: 'pull_request', version: 1 },
      category: 'bugfix',
      headCommit: 'a'.repeat(40),
      policy: DEFAULT_CHECKLIST_POLICY,
      policyChange: { changed: true, proposed: { status: 'valid', revision: 'c'.repeat(40) } },
    };

    const H =
      '@octocat #1 <img src=x onerror=alert(1)> [x](javascript:alert(1)) ' + '$' + '{{ secrets.GITHUB_TOKEN }} ' + '`'.repeat(3);

    const CATEGORY_FIELD_CODES: readonly ContractFindingCode[] = [
      'submission.category-missing',
      'submission.category-invalid',
      'submission.category-mismatch',
    ];
    const LINKED_ISSUE_FIELD_CODES: readonly ContractFindingCode[] = [
      'submission.linked-issue-missing',
      'submission.linked-issue-invalid',
    ];

    const DETAIL_VARIANTS: Partial<Record<ContractFindingCode, readonly (string | null)[]>> = {
      'submission.unstructured': ['issue-form', 'pull-request-template'],
      'submission.attachment-violation': [...SUBMISSION_ATTACHMENT_RULES],
      'submission.linked-issue-missing': [null, 'free-form'],
      'submission.policy-change': ['valid', 'removed', 'unavailable', null],
      'submission.category-mismatch': ['feature'],
    };

    const findings: FindingTemplateInput[] = [];
    for (const code of CONTRACT_FINDING_CODES) {
      const details = DETAIL_VARIANTS[code] ?? [null];
      const field = CATEGORY_FIELD_CODES.includes(code)
        ? 'category'
        : LINKED_ISSUE_FIELD_CODES.includes(code)
          ? 'linked-issue'
          : null;
      for (const detail of details) {
        findings.push({ code, detail, field, subjects: [H, H] });
      }
    }

    for (const finding of findings) {
      const result = findingTexts(finding, ctx);
      expect(result.ok, JSON.stringify(finding)).toBe(true);
      if (!result.ok) {
        continue;
      }
      const texts: string[] =
        result.value.kind === 'blocker'
          ? [result.value.scenario, result.value.location, result.value.request]
          : result.value.kind === 'uncertainty'
            ? [result.value.scenario, result.value.location, result.value.decision]
            : [result.value.note];
      for (const s of texts) {
        expect(reportDenylistMatches(maskCodeSpans(s)), s).toEqual([]);
        expect(reportFixedTextViolations(maskCodeSpans(s)), s).toEqual([]);
        expect(reportCharacterViolations(s), s).toEqual([]);
      }
    }
  });
});
