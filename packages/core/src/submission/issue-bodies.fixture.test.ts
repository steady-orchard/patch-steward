import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseIssueBody } from './parse.js';
import type { SubmissionFieldId } from '../submission-fields.js';

const corpusDir = fileURLToPath(new URL('../../../../fixtures/submissions/', import.meta.url));

interface StructuredExpectation {
  readonly structured: true;
  readonly form: 'defect' | 'proposal';
  readonly version: number;
  readonly fieldCount: number;
  readonly duplicates: readonly SubmissionFieldId[];
  readonly trivial: readonly SubmissionFieldId[];
  readonly securityClaim: boolean | null;
}

interface UnstructuredExpectation {
  readonly structured: false;
  readonly reason: string;
}

type Expectation = StructuredExpectation | UnstructuredExpectation;

const EXPECTED: Record<string, Expectation> = {
  'defect-complete.txt': {
    structured: true,
    form: 'defect',
    version: 1,
    fieldCount: 9,
    duplicates: [],
    trivial: ['references'],
    securityClaim: false,
  },
  'defect-no-response.txt': {
    structured: true,
    form: 'defect',
    version: 1,
    fieldCount: 9,
    duplicates: [],
    trivial: ['authoritative-basis', 'references'],
    securityClaim: false,
  },
  'defect-duplicate-label.txt': {
    structured: true,
    form: 'defect',
    version: 1,
    fieldCount: 8,
    duplicates: ['actual-behavior'],
    trivial: ['references'],
    securityClaim: false,
  },
  'defect-label-in-fence.txt': {
    structured: true,
    form: 'defect',
    version: 1,
    fieldCount: 9,
    duplicates: [],
    trivial: ['references'],
    securityClaim: false,
  },
  'defect-headings-in-comment.txt': {
    structured: true,
    form: 'defect',
    version: 1,
    fieldCount: 9,
    duplicates: [],
    trivial: [],
    securityClaim: false,
  },
  'defect-deleted-label.txt': {
    structured: false,
    reason: 'no-template-match',
  },
  'defect-severity.txt': {
    structured: true,
    form: 'defect',
    version: 1,
    fieldCount: 9,
    duplicates: [],
    trivial: [],
    securityClaim: false,
  },
  'defect-injection.txt': {
    structured: true,
    form: 'defect',
    version: 1,
    fieldCount: 9,
    duplicates: [],
    trivial: ['references'],
    securityClaim: false,
  },
  'defect-security-checked.txt': {
    structured: true,
    form: 'defect',
    version: 1,
    fieldCount: 9,
    duplicates: [],
    trivial: ['references'],
    securityClaim: true,
  },
  'defect-security-unchecked.txt': {
    structured: true,
    form: 'defect',
    version: 1,
    fieldCount: 9,
    duplicates: [],
    trivial: ['proposed-scope', 'references'],
    securityClaim: false,
  },
  'proposal-complete.txt': {
    structured: true,
    form: 'proposal',
    version: 1,
    fieldCount: 5,
    duplicates: [],
    trivial: ['existing-decision'],
    securityClaim: null,
  },
  'proposal-missing-benefit.txt': {
    structured: true,
    form: 'proposal',
    version: 1,
    fieldCount: 5,
    duplicates: [],
    trivial: ['benefit', 'existing-decision'],
    securityClaim: null,
  },
  'unstructured.txt': {
    structured: false,
    reason: 'no-template-match',
  },
};

function readFixture(name: string): string {
  return readFileSync(corpusDir + name, 'utf8');
}

describe('issue body fixture corpus', () => {
  it.each(Object.keys(EXPECTED))('issue body fixture %s parses as expected', (name) => {
    const expectation = EXPECTED[name] as Expectation;
    const body = readFixture(name);
    const result = parseIssueBody(body);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const parsed = result.value;
    if (!expectation.structured) {
      expect(parsed.structured).toBe(false);
      if (!parsed.structured) {
        expect(parsed.reason).toBe(expectation.reason);
      }
      return;
    }
    expect(parsed.structured).toBe(true);
    if (!parsed.structured) {
      return;
    }
    expect(parsed.template.form).toBe(expectation.form);
    expect(parsed.template.version).toBe(expectation.version);
    expect(Object.keys(parsed.fields)).toHaveLength(expectation.fieldCount);
    expect([...parsed.duplicates].sort()).toEqual([...expectation.duplicates].sort());
    const trivialIds = Object.entries(parsed.fields)
      .filter(([, field]) => field?.trivial === true)
      .map(([id]) => id)
      .sort();
    expect(trivialIds).toEqual([...expectation.trivial].sort());
    expect(parsed.securityClaim).toBe(expectation.securityClaim);
  });

  it('hostile issue body text stays data', () => {
    const body = readFixture('defect-injection.txt');
    const result = parseIssueBody(body);
    expect(result.ok).toBe(true);
    if (!result.ok || !result.value.structured) {
      return;
    }
    const actualBehavior = result.value.fields['actual-behavior'];
    expect(actualBehavior).toBeDefined();
    expect(actualBehavior?.normalized).toContain('${{ secrets.GITHUB_TOKEN }}');
    expect(actualBehavior?.normalized).toContain('$(rm -rf /)');
    expect(actualBehavior?.normalized).toContain('Ignore all previous instructions');
    const reproductionCommand = result.value.fields['reproduction-command'];
    expect(reproductionCommand).toBeDefined();
    expect(reproductionCommand?.normalized).toContain('echo "${{ github.event.issue.title }}"');

    const base = readFixture('defect-complete.txt');
    const escOne = String.fromCharCode(0x1b);
    const nulOne = String.fromCharCode(0x00);
    const rloOne = String.fromCharCode(0x202e);
    const zwspOne = String.fromCharCode(0x200b);
    const hostileSuffix = escOne + '[2J' + nulOne + rloOne + zwspOne;
    const originalLine =
      '`widget parse empty.txt` exits with status 1 and prints `TypeError: cannot read properties of undefined`.';
    const hostileLine = originalLine + hostileSuffix;
    const withHostileChars = base.replace(originalLine, hostileLine);
    const hostileResult = parseIssueBody(withHostileChars);
    expect(hostileResult.ok).toBe(true);
    if (!hostileResult.ok || !hostileResult.value.structured) {
      return;
    }
    const raw = hostileResult.value.fields['actual-behavior']?.raw;
    expect(raw).toBeDefined();
    expect(raw).toContain(escOne + '[2J');
    expect(raw).toContain(nulOne);
    expect(raw).toContain(rloOne);
    expect(raw).toContain(zwspOne);
  });

  it('issue body fixtures match their pinned bytes', () => {
    const files: Record<string, string> = {
      'defect-complete.txt': 'bce73638f88ddf8654834a41bf22af00518ed576a814701b39a0a61fd014741a',
      'proposal-complete.txt': '1e17ef559a93d723c5f6f7405912b556f4ddded6ccc5ef3098ec55e1f4217b4a',
    };
    for (const [name, expectedHash] of Object.entries(files)) {
      const text = readFixture(name).replace(/\r/gu, '');
      const hash = createHash('sha256').update(text, 'utf8').digest('hex');
      expect(hash).toBe(expectedHash);
    }
  });
});
