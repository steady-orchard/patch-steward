import { describe, expect, it } from 'vitest';
import { PREFLIGHT_NOTICE, escapeTerminalText, renderPreflightJson, renderPreflightText } from './preflight-output.js';
import type { PreflightReport } from './preflight-output.js';

const ZWSP = String.fromCharCode(0x200b);
const RLO = String.fromCharCode(0x202e);
const LSEP = String.fromCharCode(0x2028);
const PSEP = String.fromCharCode(0x2029);
const ELLIPSIS = String.fromCharCode(0x2026);
const ESC = String.fromCharCode(0x1b);
const BEL = String.fromCharCode(0x07);
const NUL = String.fromCharCode(0x00);
const C009B = String.fromCharCode(0x9b);
const TAG_CHAR = String.fromCharCode(0xdb40, 0xdc01);
const LONE_HIGH_SURROGATE = String.fromCharCode(0xd800);

describe('escapeTerminalText', () => {
  it('escape keeps printable text and escapes backslashes', () => {
    expect(escapeTerminalText('src/__init__.py #7 *ok*')).toBe('src/__init__.py #7 *ok*');
    expect(escapeTerminalText('a\\b')).toBe('a\\\\b');
  });

  it('escape turns control, separator, format, and lone surrogate characters into escapes', () => {
    const input = `a\\b${NUL}c${ESC}[2J${C009B}${ZWSP}${RLO}${LSEP}${TAG_CHAR}${LONE_HIGH_SURROGATE}z`;
    expect(escapeTerminalText(input)).toBe('a\\\\b\\u0000c\\u001b[2J\\u009b\\u200b\\u202e\\u2028\\u{e0001}\\ud800z');
  });

  it('escape bounds text and redacts credentials', () => {
    expect(escapeTerminalText('x'.repeat(4097))).toBe(`${'x'.repeat(4096)}${ELLIPSIS}`);
    expect(escapeTerminalText('x'.repeat(4096))).toBe('x'.repeat(4096));
    expect(escapeTerminalText(`token ghp_${'A'.repeat(36)}`)).toBe('token [REDACTED:github-token]');
  });
});

const issueReport: PreflightReport = {
  schema_version: 1,
  unverified: true,
  notice: PREFLIGHT_NOTICE,
  submission: { type: 'issue', issue_kind: 'defect' },
  repository: 'octo/demo',
  policy: { source: 'default-checklist', repository: 'octo/demo', ref: 'main', commit: null, revision: null },
  contract: {
    disposition: 'met',
    findings: [],
    requests: [],
    inconclusive: [],
    category: null,
    plausible_categories: [],
    effective_mode: 'observe',
    enforced: false,
    template: { form: 'defect', version: 1 },
  },
  paths: null,
  warnings: [{ code: 'github.unauthenticated', message: 'No token.', subjects: [] }],
  errors: [],
};

const files = Array.from({ length: 25 }, (_, i) => `src/f${i}.ts`);

const prReport: PreflightReport = {
  schema_version: 1,
  unverified: true,
  notice: PREFLIGHT_NOTICE,
  submission: { type: 'pull_request', issue_kind: null },
  repository: 'octo/demo',
  policy: { source: 'published', repository: 'octo/demo', ref: 'main', commit: 'c'.repeat(40), revision: 'd'.repeat(40) },
  contract: {
    disposition: 'needs-changes',
    findings: [
      {
        code: 'submission.field-missing',
        severity: 'blocking',
        field: 'problem',
        detail: null,
        subjects: [],
        message: 'A required field is missing or trivial.',
      },
      {
        code: 'submission.category-mismatch',
        severity: 'uncertain',
        field: 'category',
        detail: `docs${ESC}[31m`,
        subjects: ['bugfix'],
        message: 'The declared category is not consistent with the changed paths.',
      },
      {
        code: 'submission.execution-sensitive-change',
        severity: 'uncertain',
        field: null,
        detail: null,
        subjects: files,
        message: 'Execution-sensitive paths changed; maintainer triage is required.',
      },
    ],
    requests: [
      {
        number: 1,
        code: 'submission.field-missing',
        field: 'problem',
        text: 'Fill in the "Problem" section of the pull request description.',
      },
    ],
    inconclusive: [
      {
        cause: 'github-unavailable',
        code: 'github.server-error',
        message: 'The GitHub API responded with a server error.',
        subjects: ['#7'],
      },
    ],
    category: 'docs',
    plausible_categories: ['bugfix', 'docs'],
    effective_mode: 'advise',
    enforced: false,
    template: { form: 'pull_request', version: 1 },
  },
  paths: {
    base: 'a'.repeat(40),
    head: 'b'.repeat(40),
    merge_base: 'e'.repeat(40),
    changed: 27,
    trusted_changed: false,
    execution_sensitive_changed: true,
    policy_changed: true,
    trusted_paths: [],
    execution_sensitive_paths: files,
    policy_paths: ['.github/patch-steward/policy.yml'],
    policy_change: {
      changed: true,
      proposed: {
        status: 'invalid',
        revision: 'f'.repeat(40),
        errors: [
          { code: 'policy.unknown-key', path: 'bogus', message: `Unknown key bogus${RLO}; remove it.`, line: null, column: null },
        ],
      },
    },
  },
  warnings: [
    {
      code: 'attachment.format-unverified',
      message: 'Format unknown.',
      subjects: ['https://github.com/user-attachments/assets/0'],
    },
  ],
  errors: [],
};

describe('renderPreflightText', () => {
  it('text output for an issue lists notice, policy, submission, template, mode, and disposition', () => {
    const t = renderPreflightText(issueReport);
    expect(t.stdout).toBe(
      [
        PREFLIGHT_NOTICE,
        'policy: default checklist (octo/demo has no published policy on main)',
        'submission: issue defect',
        'template: defect v1',
        'mode: observe enforced false',
        'disposition: met',
        '',
      ].join('\n'),
    );
    expect(t.stderr).toBe('warning github.unauthenticated: No token.\n');
  });

  it('text output for a pull request lists category, paths, flags, and the proposed policy', () => {
    const t = renderPreflightText(prReport);
    const lines = t.stdout.split('\n');
    expect(lines.slice(0, 9)).toEqual([
      PREFLIGHT_NOTICE,
      `policy: published octo/demo main commit ${'c'.repeat(40)} revision ${'d'.repeat(40)}`,
      'submission: pull request',
      'template: pull_request v1',
      'mode: advise enforced false',
      'category: docs plausible bugfix,docs',
      `paths: base ${'a'.repeat(40)} merge-base ${'e'.repeat(40)} head ${'b'.repeat(40)} changed 27`,
      'flags: trusted-paths-changed false execution-sensitive-paths-changed true policy-changed true',
      `proposed-policy: invalid revision ${'f'.repeat(40)}`,
    ]);
    expect(lines[9]).toBe('  proposed-policy-error policy.unknown-key bogus: Unknown key bogus\\u202e; remove it.');
    expect(lines[10]).toBe('disposition: needs-changes');
  });

  it('text output lists findings, subjects, requests, and inconclusive causes', () => {
    const t = renderPreflightText(prReport);
    expect(t.stdout).toContain('finding submission.field-missing blocking field problem: A required field is missing or trivial.');
    expect(t.stdout).toContain(
      'finding submission.category-mismatch uncertain field category detail docs\\u001b[31m: The declared category is not consistent with the changed paths.',
    );
    expect(t.stdout).toContain('  subject bugfix');
    expect(t.stdout).toContain('request 1: Fill in the "Problem" section of the pull request description.');
    expect(t.stdout).toContain(
      'inconclusive github-unavailable github.server-error: The GitHub API responded with a server error.',
    );
    expect(t.stdout).toContain('  subject #7');
    expect(t.stderr).toBe(
      'warning attachment.format-unverified: Format unknown.\n  subject https://github.com/user-attachments/assets/0\n',
    );
  });

  it('text output bounds the subjects shown per finding', () => {
    const t = renderPreflightText(prReport);
    const expectedSubjects = files.slice(0, 20).map((f) => `  subject ${f}`);
    for (const line of expectedSubjects) {
      expect(t.stdout).toContain(line);
    }
    expect(t.stdout).toContain('  subjects not shown: 5');
  });

  it('text output without a contract writes only warnings and errors to stderr', () => {
    const failReport: PreflightReport = {
      schema_version: 1,
      unverified: true,
      notice: PREFLIGHT_NOTICE,
      submission: null,
      repository: null,
      policy: null,
      contract: null,
      paths: null,
      warnings: [],
      errors: [
        { code: 'usage.conflicting-options', path: '', message: '--issue and --pr cannot be used together' },
        { code: 'policy.unknown-key', path: `bo${BEL}gus`, message: 'bad' },
      ],
    };
    const t = renderPreflightText(failReport);
    expect(t.stdout).toBe('');
    expect(t.stderr).toBe(
      'error usage.conflicting-options -: --issue and --pr cannot be used together\nerror policy.unknown-key bo\\u0007gus: bad\n',
    );
  });
});

describe('renderPreflightJson', () => {
  it('json output is one line that parses back to the report', () => {
    const j = renderPreflightJson(prReport);
    expect(j.endsWith('\n')).toBe(true);
    expect(j.indexOf('\n')).toBe(j.length - 1);
    expect(JSON.stringify(JSON.parse(j))).toBe(JSON.stringify(prReport));
  });

  it('json output carries no raw control or format characters', () => {
    const j = renderPreflightJson(prReport);
    const body = j.slice(0, -1);
    const hasRaw = [...body].some((c) => {
      const code = c.charCodeAt(0);
      return code < 0x20 || (code >= 0x7f && code <= 0x9f) || c === LSEP || c === PSEP || c === RLO;
    });
    expect(hasRaw).toBe(false);
    expect(j).toContain('bogus\\u202e;');
  });
});
