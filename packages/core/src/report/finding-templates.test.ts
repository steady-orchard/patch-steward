import { describe, expect, it } from 'vitest';
import { CONTRACT_FINDING_CODES, CONTRACT_FINDING_SEVERITIES } from '../submission/contract.js';
import type { ContractFindingCode } from '../submission/contract.js';
import { SUBMISSION_ATTACHMENT_RULES } from '../submission/attachments.js';
import { DEFAULT_CHECKLIST_POLICY } from '../submission/default-checklist.js';
import { maskCodeSpans, reportDenylistMatches } from './denylist.js';
import type { FindingTemplateContext, FindingTemplateInput } from './finding-templates.js';
import { FINDING_TEMPLATES, findingTexts } from './finding-templates.js';
import type { PolicyChange, ProposedPolicy } from '../submission/proposed-policy.js';

function proposedPolicyOf(status: 'valid' | 'invalid'): ProposedPolicy {
  return status === 'valid' ? { status: 'valid', revision: 'r1' } : { status: 'invalid', revision: 'r1', errors: [] };
}

function policyChangeFor(code: ContractFindingCode, detail: string | null): PolicyChange | null {
  if (code === 'submission.policy-change' && (detail === 'valid' || detail === 'invalid')) {
    return { changed: true, proposed: proposedPolicyOf(detail) };
  }
  return null;
}

const headCommit = 'a'.repeat(40);

const baseCtx: FindingTemplateContext = {
  repository: 'octo/demo',
  defaultBranch: 'main',
  submissionType: 'pull_request',
  template: null,
  category: 'bugfix',
  headCommit,
  policy: DEFAULT_CHECKLIST_POLICY,
  policyChange: null,
};

function input(overrides: Partial<FindingTemplateInput> & { code: ContractFindingCode }): FindingTemplateInput {
  return { detail: null, field: null, subjects: [], ...overrides };
}

describe('finding-templates', () => {
  it('every template key has fixed text for its kind', () => {
    for (const [key, entry] of Object.entries(FINDING_TEMPLATES)) {
      const code = key.split(':')[0] as ContractFindingCode;
      const severity = CONTRACT_FINDING_SEVERITIES[code];
      const record = entry as { scenario?: string; request?: string; decision?: string; note?: string };
      if (severity === 'blocking') {
        expect(typeof record.scenario).toBe('string');
        expect(typeof record.request).toBe('string');
        expect(record.decision).toBeUndefined();
        expect(record.note).toBeUndefined();
      } else if (severity === 'uncertain') {
        expect(typeof record.scenario).toBe('string');
        expect(typeof record.decision).toBe('string');
        expect(record.request).toBeUndefined();
        expect(record.note).toBeUndefined();
      } else {
        expect(typeof record.note).toBe('string');
        expect(record.scenario).toBeUndefined();
        expect(record.request).toBeUndefined();
        expect(record.decision).toBeUndefined();
      }
    }
  });

  it('every contract finding code and detail resolves to a template', () => {
    for (const code of CONTRACT_FINDING_CODES) {
      const details: (string | null)[] =
        code === 'submission.unstructured'
          ? ['issue-form', 'pull-request-template']
          : code === 'submission.attachment-violation'
            ? [...SUBMISSION_ATTACHMENT_RULES]
            : code === 'submission.linked-issue-missing'
              ? [null, 'free-form']
              : code === 'submission.policy-change'
                ? ['valid', 'invalid', 'removed', 'unavailable', null]
                : code === 'submission.category-mismatch'
                  ? ['feature']
                  : [null];

      for (const detail of details) {
        const field: 'category' | null = code === 'submission.category-mismatch' ? 'category' : null;
        const ctx: FindingTemplateContext = {
          ...baseCtx,
          category: 'bugfix',
          policyChange: policyChangeFor(code, detail),
        };
        const finding = input({ code, detail, field, subjects: ['src/a.ts'] });
        const result = findingTexts(finding, ctx);
        expect(result.ok, `${code}:${String(detail)}`).toBe(true);
      }
    }
  });

  it('blocking findings render a scenario, location, and request', () => {
    const ctx: FindingTemplateContext = {
      ...baseCtx,
      submissionType: 'issue',
      template: { form: 'defect', version: 1 },
    };
    const finding = input({ code: 'submission.field-missing', field: 'expected-behavior' });
    const result = findingTexts(finding, ctx);
    expect(result.ok).toBe(true);
    if (result.ok && result.value.kind === 'blocker') {
      expect(result.value.scenario).toBe('The required "Expected behavior" section is absent or has no content.');
      expect(result.value.location).toBe('the "Expected behavior" section of the issue body');
      expect(result.value.request).toBe('Fill in the "Expected behavior" section.');
    } else {
      throw new Error('expected blocker');
    }
  });

  it('shared head renders the approved wording', () => {
    const finding = input({ code: 'submission.shared-head', subjects: ['#12', '#13'] });
    const result = findingTexts(finding, baseCtx);
    expect(result.ok).toBe(true);
    if (result.ok && result.value.kind === 'blocker') {
      expect(result.value.scenario).toBe(
        'Open pull requests `#12`, `#13` share this head commit, so no check on it can certify this pull request.',
      );
      expect(result.value.location).toBe('head commit `' + headCommit + '`');
    } else {
      throw new Error('expected blocker');
    }
  });

  it('repository links are built from the validated repository name', () => {
    const finding = input({ code: 'submission.unstructured', detail: 'pull-request-template' });
    const result = findingTexts(finding, baseCtx);
    expect(result.ok).toBe(true);
    if (result.ok && result.value.kind === 'blocker') {
      expect(result.value.request).toBe(
        'Rewrite the pull request description with the pull request template: `https://github.com/octo/demo/blob/main/.github/pull_request_template.md`',
      );
    } else {
      throw new Error('expected blocker');
    }
  });

  it('derived values render only inside code spans', () => {
    const hostile = '@octocat #1 <img src=x onerror=alert(1)> [x](javascript:alert(1)) ${{ secrets.GITHUB_TOKEN }} ```';
    for (const code of CONTRACT_FINDING_CODES) {
      const details: (string | null)[] =
        code === 'submission.unstructured'
          ? ['issue-form', 'pull-request-template']
          : code === 'submission.attachment-violation'
            ? [...SUBMISSION_ATTACHMENT_RULES]
            : code === 'submission.linked-issue-missing'
              ? [null, 'free-form']
              : code === 'submission.policy-change'
                ? ['valid', 'invalid', 'removed', 'unavailable', null]
                : code === 'submission.category-mismatch'
                  ? ['feature']
                  : [null];

      for (const detail of details) {
        const field: 'category' | null = code === 'submission.category-mismatch' ? 'category' : null;
        const ctx: FindingTemplateContext = {
          ...baseCtx,
          category: 'bugfix',
          policyChange: policyChangeFor(code, detail),
        };
        const finding = input({ code, detail, field, subjects: [hostile] });
        const result = findingTexts(finding, ctx);
        expect(result.ok, `${code}:${String(detail)}`).toBe(true);
        if (!result.ok) continue;
        const texts: string[] =
          result.value.kind === 'blocker'
            ? [result.value.scenario, result.value.location, result.value.request]
            : result.value.kind === 'uncertainty'
              ? [result.value.scenario, result.value.location, result.value.decision]
              : [result.value.note];
        for (const text of texts) {
          const masked = maskCodeSpans(text);
          expect(masked).not.toContain('@');
          expect(/#[0-9]/.test(masked)).toBe(false);
          expect(masked).not.toContain('<');
          expect(reportDenylistMatches(text)).toEqual([]);
        }
      }
    }
  });

  it('advisory findings render only as notes', () => {
    const codes: ContractFindingCode[] = [
      'submission.trusted-path-change',
      'submission.attachment-unavailable',
      'submission.policy-change',
    ];
    for (const code of codes) {
      const finding = input({ code, subjects: ['src/a.ts'] });
      const result = findingTexts(finding, baseCtx);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.kind).toBe('note');
      }
    }
  });

  it('a missing template fails as a steward defect', () => {
    const finding = input({ code: 'submission.unstructured', detail: 'bogus' });
    const result = findingTexts(finding, baseCtx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('report.template-missing');
      expect(result.failure.cause).toBe('steward-defect');
      expect(result.failure.outcome).toBe('inconclusive');
    }
  });
});
