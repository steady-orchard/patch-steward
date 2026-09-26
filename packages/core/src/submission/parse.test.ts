import { describe, expect, it } from 'vitest';
import { parseIssueBody, parsePullRequestBody } from './parse.js';
import type { StructuredSubmissionBody, UnstructuredSubmissionBody } from './parse.js';
import { FIELD_MAPPING_REGISTRY, DEFECT_FORM_MAPPING_V1 } from './field-mapping.js';
import type { FieldMappingRegistry, IssueFormMapping } from './field-mapping.js';

function issueBody(sections: ReadonlyArray<readonly [string, string]>): string {
  return sections.map(([label, value]) => `### ${label}\n\n${value}\n\n`).join('');
}

const DEFECT: ReadonlyArray<readonly [string, string]> = [
  ['Expected behavior', 'The parser accepts an empty file.'],
  ['Authoritative basis', 'docs/format.md says empty input is valid.'],
  ['Actual behavior', 'It throws.'],
  ['Affected version', '1.2.3'],
  ['Reproduction command', '```shell\nwidget parse empty.txt\n```'],
  ['Expected result', 'Exit status 0.'],
  ['Proposed scope', '_No response_'],
  ['References', '_No response_'],
  ['Security claim', '- [ ] This report claims a security problem'],
];

const PROPOSAL: ReadonlyArray<readonly [string, string]> = [
  ['Problem', 'Slow.'],
  ['Benefit', 'Faster.'],
  ['Existing decision', '_No response_'],
  ['Proposed scope', 'Cache.'],
  ['References', '_No response_'],
];

function prBody(sections: ReadonlyArray<readonly [string, string]>, marker = true): string {
  const prefix = marker ? '<!-- patch-steward:pr-template v1 -->\n\n<!--\nhelp text\n-->\n\n' : '';
  return prefix + sections.map(([heading, value]) => `## ${heading}\n\n${value}\n\n`).join('');
}

const PR: ReadonlyArray<readonly [string, string]> = [
  ['Category', 'bugfix'],
  ['Problem', 'Crash on empty input.'],
  ['Benefit', 'Empty files parse.'],
  ['Intended behavior', 'Empty input yields an empty document.'],
  ['Acceptance criteria', '- empty input returns []'],
  ['Linked issue', 'Fixes #29'],
  ['Regression test', 'packages/x/src/parse.test.ts: parses empty input'],
  ['Test scaffolding', '<!-- Non-test files the regression test needs. -->'],
  ['Reproduction command', '`pnpm vitest run packages/x/src/parse.test.ts`'],
  ['Expected result', 'Exit status 0.'],
  ['References', '<!-- Documents, specifications, decisions. -->'],
];

function expectStructured(result: ReturnType<typeof parseIssueBody>): StructuredSubmissionBody {
  if (!result.ok) {
    throw new Error('expected ok result');
  }
  if (!result.value.structured) {
    throw new Error('expected structured body');
  }
  return result.value;
}

function expectUnstructured(result: ReturnType<typeof parseIssueBody>): UnstructuredSubmissionBody {
  if (!result.ok) {
    throw new Error('expected ok result');
  }
  if (result.value.structured) {
    throw new Error('expected unstructured body');
  }
  return result.value;
}

describe('issue body parsing', () => {
  it('issue parse: a complete defect body matches defect v1', () => {
    const body = expectStructured(parseIssueBody(issueBody(DEFECT)));
    expect(body.template).toEqual({ form: 'defect', version: 1 });
    expect(body.duplicates).toEqual([]);
    expect(Object.keys(body.fields)).toHaveLength(9);
    const trivialIds = Object.entries(body.fields)
      .filter(([, field]) => field?.trivial)
      .map(([id]) => id)
      .sort();
    expect(trivialIds).toEqual(['proposed-scope', 'references']);
    expect(body.securityClaim).toBe(false);
  });

  it('issue parse: a complete proposal body matches proposal v1', () => {
    const body = expectStructured(parseIssueBody(issueBody(PROPOSAL)));
    expect(body.template).toEqual({ form: 'proposal', version: 1 });
    expect(Object.keys(body.fields)).toHaveLength(5);
    expect(body.securityClaim).toBeNull();
  });

  it('issue parse: label headings inside fences and comments are ignored', () => {
    const withFence = DEFECT.map(([label, value]) =>
      label === 'Reproduction command' ? ([label, '```\n### Actual behavior\n```'] as const) : ([label, value] as const),
    );
    const bodyFence = expectStructured(parseIssueBody(issueBody(withFence)));
    expect(bodyFence.duplicates).toEqual([]);

    const withComment = DEFECT.map(([label, value]) =>
      label === 'References' ? ([label, '<!--\n### Expected behavior\n-->\nsee docs'] as const) : ([label, value] as const),
    );
    const bodyComment = expectStructured(parseIssueBody(issueBody(withComment)));
    expect(bodyComment.duplicates).toEqual([]);
    expect(bodyComment.fields['references']?.trivial).toBe(false);
  });

  it('issue parse: a duplicated label heading is reported', () => {
    const body = expectStructured(parseIssueBody(issueBody(DEFECT) + '### Actual behavior\n\nAgain\n'));
    expect(body.duplicates).toEqual(['actual-behavior']);
    expect(body.fields['actual-behavior']).toBeUndefined();
    expect(body.template).toEqual({ form: 'defect', version: 1 });
  });

  it('issue parse: headings that are not labels are field content', () => {
    const value = 'It throws.\n\n### Stack trace\n\nat parse()';
    const withStackTrace = DEFECT.map(([label, original]) =>
      label === 'Actual behavior' ? ([label, value] as const) : ([label, original] as const),
    );
    const body = expectStructured(parseIssueBody(issueBody(withStackTrace)));
    expect(body.fields['actual-behavior']?.raw).toBe(value);
  });

  it('issue parse: a missing label heading leaves the body unstructured', () => {
    const withoutAffectedVersion = DEFECT.filter(([label]) => label !== 'Affected version');
    const bodyMissing = expectUnstructured(parseIssueBody(issueBody(withoutAffectedVersion)));
    expect(bodyMissing).toEqual({ structured: false, reason: 'no-template-match' });

    const bodyPlain = expectUnstructured(parseIssueBody('Please fix the crash.\n'));
    expect(bodyPlain).toEqual({ structured: false, reason: 'no-template-match' });
  });

  it('issue parse: the newest matching mapping version wins', () => {
    const v2Fields = DEFECT_FORM_MAPPING_V1.fields.map((field) =>
      field.id === 'references' ? { ...field, label: 'Links' } : field,
    );
    const v2: IssueFormMapping = { form: 'defect', version: 2, fields: v2Fields };
    const registry: FieldMappingRegistry = {
      ...FIELD_MAPPING_REGISTRY,
      defect: [v2, DEFECT_FORM_MAPPING_V1],
    };

    const withLinks = DEFECT.map(([label, value]) => [label === 'References' ? 'Links' : label, value] as const);
    const bodyLinks = expectStructured(parseIssueBody(issueBody(withLinks), registry));
    expect(bodyLinks.template).toEqual({ form: 'defect', version: 2 });

    const bodyReferences = expectStructured(parseIssueBody(issueBody(DEFECT), registry));
    expect(bodyReferences.template).toEqual({ form: 'defect', version: 1 });

    const withBoth = issueBody(DEFECT) + '### Links\n\nsee also\n';
    const bodyBoth = expectStructured(parseIssueBody(withBoth, registry));
    expect(bodyBoth.template).toEqual({ form: 'defect', version: 2 });
  });

  it('issue parse: no response values are trivial', () => {
    const body = expectStructured(parseIssueBody(issueBody(DEFECT)));
    expect(body.fields['proposed-scope']?.trivial).toBe(true);
    expect(body.fields['proposed-scope']?.normalized).toBe('_No response_');
    expect(body.fields['references']?.trivial).toBe(true);
    expect(body.fields['references']?.normalized).toBe('_No response_');
  });

  it('issue parse: the security checkbox is parsed', () => {
    const checked = DEFECT.map(([label, value]) =>
      label === 'Security claim' ? ([label, '- [X] This report claims a security problem'] as const) : ([label, value] as const),
    );
    expect(expectStructured(parseIssueBody(issueBody(checked))).securityClaim).toBe(true);

    const checkedLower = DEFECT.map(([label, value]) =>
      label === 'Security claim' ? ([label, '- [x] This report claims a security problem'] as const) : ([label, value] as const),
    );
    expect(expectStructured(parseIssueBody(issueBody(checkedLower))).securityClaim).toBe(true);

    expect(expectStructured(parseIssueBody(issueBody(DEFECT))).securityClaim).toBe(false);
  });
});

describe('pull request body parsing', () => {
  it('pull request parse: the marker selects the template version', () => {
    const body = expectStructured(parsePullRequestBody(prBody(PR)));
    expect(body.template).toEqual({ form: 'pull_request', version: 1 });
    expect(Object.keys(body.fields)).toHaveLength(11);
    expect(body.duplicates).toEqual([]);
    const trivialIds = Object.entries(body.fields)
      .filter(([, field]) => field?.trivial)
      .map(([id]) => id)
      .sort();
    expect(trivialIds).toEqual(['references', 'test-scaffolding']);
    expect(body.securityClaim).toBeNull();
  });

  it('pull request parse: a missing, conflicting, or unknown marker leaves the body unstructured', () => {
    expect(expectUnstructured(parsePullRequestBody(prBody(PR, false)))).toEqual({
      structured: false,
      reason: 'marker-missing',
    });

    const conflict = '<!-- patch-steward:pr-template v1 -->\n<!-- patch-steward:pr-template v2 -->\n';
    expect(expectUnstructured(parsePullRequestBody(conflict))).toEqual({
      structured: false,
      reason: 'marker-conflict',
    });

    const sameTwice =
      '<!-- patch-steward:pr-template v1 -->\n<!-- patch-steward:pr-template v1 -->\n' +
      PR.map(([heading, value]) => `## ${heading}\n\n${value}\n\n`).join('');
    const structured = expectStructured(parsePullRequestBody(sameTwice));
    expect(structured.template).toEqual({ form: 'pull_request', version: 1 });

    const unknownVersion = '<!-- patch-steward:pr-template v2 -->\n## Category\n\nbugfix\n';
    expect(expectUnstructured(parsePullRequestBody(unknownVersion))).toEqual({
      structured: false,
      reason: 'marker-version-unknown',
    });

    const markerInFence = '```\n<!-- patch-steward:pr-template v1 -->\n```\n';
    expect(expectUnstructured(parsePullRequestBody(markerInFence))).toEqual({
      structured: false,
      reason: 'marker-missing',
    });
  });

  it('pull request parse: an unknown section ends the previous field', () => {
    const withNotes = PR.map(([heading, value]) =>
      heading === 'Problem' ? ([heading, 'Crash.\n\n## Notes\n\nextra notes'] as const) : ([heading, value] as const),
    );
    const bodyNotes = expectStructured(parsePullRequestBody(prBody(withNotes)));
    expect(bodyNotes.fields['problem']?.raw).toBe('Crash.');

    const withDeeper = PR.map(([heading, value]) =>
      heading === 'Problem' ? ([heading, 'Crash.\n\n### Details\n\nmore'] as const) : ([heading, value] as const),
    );
    const bodyDeeper = expectStructured(parsePullRequestBody(prBody(withDeeper)));
    expect(bodyDeeper.fields['problem']?.raw).toBe('Crash.\n\n### Details\n\nmore');
  });

  it('pull request parse: a duplicated heading is reported', () => {
    const withDuplicate = PR.map(([heading, value]) =>
      heading === 'Problem' ? ([heading, 'Crash.\n\n## problem\n\nagain'] as const) : ([heading, value] as const),
    );
    const body = expectStructured(parsePullRequestBody(prBody(withDuplicate)));
    expect(body.duplicates).toEqual(['problem']);
  });

  it('pull request parse: headings compare case-insensitively', () => {
    const source = prBody(PR).replace('## Category', '##   CATEGORY ');
    const body = expectStructured(parsePullRequestBody(source));
    expect(body.fields['category']?.raw).toBe('bugfix');
  });
});

describe('body parse', () => {
  it('body parse: an oversize body is rejected', () => {
    const oversize = 'a'.repeat(65537);
    const resultIssue = parseIssueBody(oversize);
    expect(resultIssue.ok).toBe(false);
    if (!resultIssue.ok) {
      expect(resultIssue.failure.code).toBe('submission.body-too-large');
      expect(resultIssue.failure.outcome).toBe('inconclusive');
    }
    const resultPr = parsePullRequestBody(oversize);
    expect(resultPr.ok).toBe(false);
    if (!resultPr.ok) {
      expect(resultPr.failure.code).toBe('submission.body-too-large');
      expect(resultPr.failure.outcome).toBe('inconclusive');
    }

    const atLimit = 'a'.repeat(65536);
    expect(parseIssueBody(atLimit).ok).toBe(true);
    expect(parsePullRequestBody(atLimit).ok).toBe(true);
  });

  it('body parse: malformed Unicode is rejected', () => {
    const body = 'text \ud800 more';
    const resultIssue = parseIssueBody(body);
    expect(resultIssue.ok).toBe(false);
    if (!resultIssue.ok) {
      expect(resultIssue.failure.code).toBe('submission.body-malformed');
    }
  });

  it('body parse: control characters and hostile text stay data', () => {
    const hostile = 'x \u001b[31m y \u0000 z ‮ w ​ ' + '${{ secrets.GITHUB_TOKEN }} $(rm -rf /) `id`';
    const withHostile = DEFECT.map(([label, value]) =>
      label === 'Actual behavior' ? ([label, hostile] as const) : ([label, value] as const),
    );
    const body = expectStructured(parseIssueBody(issueBody(withHostile)));
    expect(body.fields['actual-behavior']?.raw).toBe(hostile);
  });

  it('body parse: CRLF bodies parse like LF bodies', () => {
    const lfBody = issueBody(DEFECT);
    const crlfBody = lfBody.replace(/\n/g, '\r\n');
    const lfResult = expectStructured(parseIssueBody(lfBody));
    const crlfResult = expectStructured(parseIssueBody(crlfBody));
    expect(crlfResult.template).toEqual(lfResult.template);
    expect(Object.keys(crlfResult.fields).sort()).toEqual(Object.keys(lfResult.fields).sort());
    for (const id of Object.keys(lfResult.fields)) {
      expect(crlfResult.fields[id as keyof typeof crlfResult.fields]?.normalized).toBe(
        lfResult.fields[id as keyof typeof lfResult.fields]?.normalized,
      );
    }
    expect(crlfResult.fields['reproduction-command']?.raw).toContain('\r\n');
  });
});
