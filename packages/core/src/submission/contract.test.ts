import { describe, expect, it } from 'vitest';
import {
  CONTRACT_DISPOSITIONS,
  checkContract,
  contractRequiredFields,
  type ContractDisposition,
  type ContractInput,
  type ContractRepository,
  type IssueContractInput,
  type LinkedIssueCheck,
  type PullRequestContractInput,
} from './contract.js';
import { parseIssueBody, parsePullRequestBody } from './parse.js';
import type { ParsedSubmissionBody } from './parse.js';
import { DEFAULT_CHECKLIST_POLICY } from './default-checklist.js';
import { SUBMISSION_ATTACHMENT_RULES, type AttachmentAssessment, type AttachmentAssessmentSet } from './attachments.js';
import type { ResolvedPolicy } from '../policy/schema.js';
import type { StewardFailure } from '../result.js';
import type { ContentHash } from '../hash.js';

const REPO: ContractRepository = { fullName: 'octo/widgets', defaultBranch: 'main' };
const EMPTY_ATTACHMENTS: AttachmentAssessmentSet = { limit: 5, countExceeded: false, items: [] };

function parsedIssue(text: string): ParsedSubmissionBody {
  const result = parseIssueBody(text);
  if (!result.ok) {
    throw new Error('unexpected parse failure');
  }
  return result.value;
}

function parsedPr(text: string): ParsedSubmissionBody {
  const result = parsePullRequestBody(text);
  if (!result.ok) {
    throw new Error('unexpected parse failure');
  }
  return result.value;
}

function defectBody(overrides: Partial<Record<string, string>> = {}): string {
  const f = {
    'Expected behavior': 'It should return 200.',
    'Authoritative basis': 'docs/api.md#status',
    'Actual behavior': 'It returns 500.',
    'Affected version': '2.0.0',
    'Reproduction command': 'npm run repro',
    'Expected result': 'HTTP 200',
    'Proposed scope': 'fix handler',
    References: '_No response_',
    ...overrides,
  };
  return [
    '### Expected behavior',
    '',
    f['Expected behavior'],
    '',
    '### Authoritative basis',
    '',
    f['Authoritative basis'],
    '',
    '### Actual behavior',
    '',
    f['Actual behavior'],
    '',
    '### Affected version',
    '',
    f['Affected version'],
    '',
    '### Reproduction command',
    '',
    f['Reproduction command'],
    '',
    '### Expected result',
    '',
    f['Expected result'],
    '',
    '### Proposed scope',
    '',
    f['Proposed scope'],
    '',
    '### References',
    '',
    f.References,
    '',
    '### Security claim',
    '',
    '- [ ] This report claims a security problem',
  ].join('\n');
}

function proposalBody(overrides: Partial<Record<string, string>> = {}): string {
  const f = {
    Problem: 'Users cannot filter results.',
    Benefit: 'Faster triage.',
    'Existing decision': '_No response_',
    'Proposed scope': 'Add a filter flag.',
    References: '_No response_',
    ...overrides,
  };
  return [
    '### Problem',
    '',
    f.Problem,
    '',
    '### Benefit',
    '',
    f.Benefit,
    '',
    '### Existing decision',
    '',
    f['Existing decision'],
    '',
    '### Proposed scope',
    '',
    f['Proposed scope'],
    '',
    '### References',
    '',
    f.References,
  ].join('\n');
}

function prBody(overrides: Partial<Record<string, string>> = {}): string {
  const f = {
    Category: 'bugfix',
    Problem: 'It fails.',
    Benefit: 'Users are unblocked.',
    'Intended behavior': 'It succeeds.',
    'Acceptance criteria': '- passes',
    'Linked issue': 'Fixes #1',
    'Regression test': 'test/x.test.ts',
    'Test scaffolding': '_No response_',
    'Reproduction command': 'npm test',
    'Expected result': 'green',
    References: 'docs/spec.md',
    ...overrides,
  };
  return [
    '<!-- patch-steward:pr-template v1 -->',
    '',
    '## Category',
    '',
    f.Category,
    '',
    '## Problem',
    '',
    f.Problem,
    '',
    '## Benefit',
    '',
    f.Benefit,
    '',
    '## Intended behavior',
    '',
    f['Intended behavior'],
    '',
    '## Acceptance criteria',
    '',
    f['Acceptance criteria'],
    '',
    '## Linked issue',
    '',
    f['Linked issue'],
    '',
    '## Regression test',
    '',
    f['Regression test'],
    '',
    '## Test scaffolding',
    '',
    f['Test scaffolding'],
    '',
    '## Reproduction command',
    '',
    f['Reproduction command'],
    '',
    '## Expected result',
    '',
    f['Expected result'],
    '',
    '## References',
    '',
    f.References,
  ].join('\n');
}

function basePolicy(): ResolvedPolicy {
  return structuredClone(DEFAULT_CHECKLIST_POLICY);
}

function baseChangedPaths(): PullRequestContractInput['changedPaths'] {
  return { kind: 'complete', changes: [{ kind: 'modified', path: 'src/x.ts', previousPath: null }] };
}

function failure(code: string): StewardFailure {
  return { code, cause: 'github-unavailable', outcome: 'inconclusive', message: `unavailable: ${code}`, details: [] };
}

function baseIssue(overrides: Partial<IssueContractInput> = {}): IssueContractInput {
  return {
    type: 'issue',
    repository: REPO,
    policy: basePolicy(),
    body: parsedIssue(defectBody()),
    requestedKind: null,
    attachments: EMPTY_ATTACHMENTS,
    ...overrides,
  };
}

function basePr(overrides: Partial<PullRequestContractInput> = {}): PullRequestContractInput {
  return {
    type: 'pull_request',
    repository: REPO,
    policy: basePolicy(),
    body: parsedPr(prBody()),
    changedPaths: baseChangedPaths(),
    linkedIssue: { status: 'exists', number: 1, contentHash: 'sha256:abc' as ContentHash },
    sharedHeads: { status: 'not-applicable' },
    proposedPolicy: { status: 'not-read' },
    attachments: EMPTY_ATTACHMENTS,
    ...overrides,
  };
}

function attachmentItem(overrides: Partial<AttachmentAssessment>): AttachmentAssessment {
  return {
    url: 'https://github.com/user-attachments/files/1/a.txt',
    fields: [],
    required: false,
    format: 'txt',
    status: 'pending',
    rule: null,
    reason: null,
    bytes: null,
    contentHash: null,
    entries: null,
    ...overrides,
  };
}

describe('contract disposition cannot be pass', () => {
  it('contract disposition cannot be pass', () => {
    expect(CONTRACT_DISPOSITIONS).not.toContain('pass');

    type PassDisposition = Extract<ContractDisposition, 'pass'>;
    const noPass: [PassDisposition] extends [never] ? true : false = true;
    expect(noPass).toBe(true);
  });
});

const PRECEDENCE_SCENARIOS: Record<string, () => { input: ContractInput; expected: ContractDisposition }> = {
  'shared head over everything': () => ({
    input: basePr({
      sharedHeads: { status: 'known', pullRequests: [7] },
      proposedPolicy: { status: 'unavailable', failure: failure('policy.unavailable') },
      changedPaths: {
        kind: 'complete',
        changes: [
          { kind: 'modified', path: 'docs/readme.md', previousPath: null },
          { kind: 'modified', path: '.github/patch-steward/policy.yml', previousPath: null },
        ],
      },
    }),
    expected: 'needs-changes',
  }),
  'blocking over inconclusive': () => ({
    input: basePr({
      body: parsedPr(prBody({ 'Intended behavior': '_No response_' })),
      linkedIssue: { status: 'unavailable', number: 1, failure: failure('github.unavailable') },
    }),
    expected: 'needs-changes',
  }),
  'inconclusive over uncertain': () => ({
    input: basePr({
      proposedPolicy: { status: 'unavailable', failure: failure('policy.unavailable') },
      changedPaths: {
        kind: 'complete',
        changes: [
          { kind: 'modified', path: 'docs/readme.md', previousPath: null },
          { kind: 'modified', path: '.github/patch-steward/policy.yml', previousPath: null },
        ],
      },
    }),
    expected: 'inconclusive',
  }),
  'uncertain over met': () => ({
    input: basePr({
      changedPaths: { kind: 'complete', changes: [{ kind: 'modified', path: 'docs/readme.md', previousPath: null }] },
    }),
    expected: 'uncertain',
  }),
  'met without findings': () => ({
    input: basePr(),
    expected: 'met',
  }),
};

describe('contract precedence', () => {
  it.each(Object.keys(PRECEDENCE_SCENARIOS))('contract precedence: %s', (name) => {
    const scenario = PRECEDENCE_SCENARIOS[name];
    if (!scenario) {
      throw new Error('missing scenario');
    }
    const { input, expected } = scenario();
    const result = checkContract(input);
    expect(result.disposition).toBe(expected);
  });
});

describe('complete defect issue meets the contract', () => {
  it('complete defect issue meets the contract', () => {
    const result = checkContract(baseIssue());
    expect(result.disposition).toBe('met');
    expect(result.findings).toEqual([]);
    expect(result.requests).toEqual([]);
    expect(result.category).toBeNull();
    expect(result.enforced).toBe(false);
    expect(result.effective_mode).toBe('observe');
    expect(result.template).toEqual({ form: 'defect', version: 1 });
  });
});

describe('missing and trivial issue fields request changes', () => {
  it('missing and trivial issue fields request changes', () => {
    const result = checkContract(
      baseIssue({
        body: parsedIssue(defectBody({ 'Expected behavior': '_No response_', 'Authoritative basis': '_No response_' })),
      }),
    );
    expect(result.disposition).toBe('needs-changes');
    const codes = result.findings.map((f) => f.code);
    expect(codes).toEqual(['submission.field-missing', 'submission.field-missing']);
    expect(result.findings.map((f) => f.field)).toEqual(['expected-behavior', 'authoritative-basis']);
    expect(result.requests).toHaveLength(2);
  });
});

describe('duplicated fields request changes without missing findings', () => {
  it('duplicated fields request changes without missing findings', () => {
    const body = [
      '### Expected behavior',
      '',
      'It should return 200.',
      '',
      '### Expected behavior',
      '',
      'duplicate section',
      '',
      '### Authoritative basis',
      '',
      'docs/api.md#status',
      '',
      '### Actual behavior',
      '',
      'It returns 500.',
      '',
      '### Affected version',
      '',
      '2.0.0',
      '',
      '### Reproduction command',
      '',
      'npm run repro',
      '',
      '### Expected result',
      '',
      'HTTP 200',
      '',
      '### Proposed scope',
      '',
      'fix handler',
      '',
      '### References',
      '',
      '_No response_',
      '',
      '### Security claim',
      '',
      '- [ ] This report claims a security problem',
    ].join('\n');
    const result = checkContract(baseIssue({ body: parsedIssue(body) }));
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.code).toBe('submission.field-duplicate');
    expect(result.findings[0]?.field).toBe('expected-behavior');
    expect(result.disposition).toBe('needs-changes');
  });
});

describe('unstructured bodies request changes with the template link', () => {
  it('unstructured bodies request changes with the template link', () => {
    const issueResult = checkContract(baseIssue({ body: parsedIssue('just some random text without headings') }));
    expect(issueResult.findings[0]?.code).toBe('submission.unstructured');
    expect(issueResult.requests[0]?.text).toBe(
      "Rewrite the issue using one of the repository's issue forms: https://github.com/octo/widgets/issues/new/choose",
    );

    const prResult = checkContract(
      basePr({
        repository: { fullName: 'octo/widgets', defaultBranch: 'release/1.0' },
        body: parsedPr('no marker here at all'),
      }),
    );
    expect(prResult.findings[0]?.code).toBe('submission.unstructured');
    expect(prResult.requests[0]?.text).toBe(
      'Rewrite the pull request description using the pull request template: https://github.com/octo/widgets/blob/release/1.0/.github/pull_request_template.md',
    );
  });
});

describe('free-form bodies raise no unstructured finding', () => {
  it('free-form bodies raise no unstructured finding', () => {
    const policy = basePolicy();
    policy.submission.free_form = true;
    const result = checkContract(baseIssue({ policy, body: parsedIssue('just free text') }));
    expect(result.findings.some((f) => f.code === 'submission.unstructured')).toBe(false);
  });
});

describe('requested issue kind must match the form', () => {
  it('requested issue kind must match the form', () => {
    const result = checkContract(baseIssue({ body: parsedIssue(defectBody()), requestedKind: 'proposal' }));
    expect(result.template).toBeNull();
    expect(result.findings[0]?.code).toBe('submission.unstructured');
  });
});

describe('category missing and invalid request changes', () => {
  it('category missing and invalid request changes', () => {
    const missing = checkContract(basePr({ body: parsedPr(prBody({ Category: '_No response_' })) }));
    expect(missing.findings.some((f) => f.code === 'submission.category-missing')).toBe(true);
    expect(missing.disposition).toBe('needs-changes');

    const invalid = checkContract(basePr({ body: parsedPr(prBody({ Category: 'bogus' })) }));
    expect(invalid.findings.some((f) => f.code === 'submission.category-invalid')).toBe(true);
    expect(invalid.disposition).toBe('needs-changes');
  });
});

describe('category mismatch is uncertain', () => {
  it('category mismatch is uncertain', () => {
    const result = checkContract(
      basePr({
        changedPaths: { kind: 'complete', changes: [{ kind: 'modified', path: 'docs/readme.md', previousPath: null }] },
      }),
    );
    const finding = result.findings.find((f) => f.code === 'submission.category-mismatch');
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('uncertain');
    expect(finding?.detail).toBe('bugfix');
    expect(finding?.subjects).toEqual(['docs', 'chore']);
    expect(result.category).toBe('bugfix');
  });
});

describe('enforced ambiguity is uncertain and enforced', () => {
  it('enforced ambiguity is uncertain and enforced', () => {
    const policy = basePolicy();
    policy.modes.per_category.chore = 'enforce';
    const result = checkContract(
      basePr({
        policy,
        body: parsedPr(prBody({ Category: 'bogus' })),
        changedPaths: { kind: 'complete', changes: [{ kind: 'modified', path: 'README.md', previousPath: null }] },
      }),
    );
    const finding = result.findings.find((f) => f.code === 'submission.category-enforced-ambiguity');
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('uncertain');
    expect(finding?.subjects).toEqual(['chore']);
    expect(result.enforced).toBe(true);
    expect(result.effective_mode).toBe('enforce');
  });
});

describe('effective mode is the strictest plausible mode', () => {
  it('effective mode is the strictest plausible mode', () => {
    const policy = basePolicy();
    policy.modes.per_category.docs = 'advise';
    const result = checkContract(
      basePr({
        policy,
        body: parsedPr(prBody({ Category: 'chore', 'Linked issue': '_No response_' })),
        changedPaths: { kind: 'complete', changes: [{ kind: 'modified', path: 'README.md', previousPath: null }] },
      }),
    );
    expect(result.plausible_categories).toEqual(['docs', 'chore']);
    expect(result.effective_mode).toBe('advise');
    expect(result.enforced).toBe(false);
  });
});

describe('required linked issue must be named', () => {
  it('required linked issue must be named', () => {
    const result = checkContract(basePr({ body: parsedPr(prBody({ 'Linked issue': '_No response_' })) }));
    const finding = result.findings.find((f) => f.code === 'submission.linked-issue-missing');
    expect(finding).toBeDefined();
    expect(finding?.detail).toBeNull();
    expect(result.disposition).toBe('needs-changes');
  });
});

describe('linked issue must be one existing issue in this repository', () => {
  it('linked issue must be one existing issue in this repository', () => {
    const several = checkContract(basePr({ body: parsedPr(prBody({ 'Linked issue': 'Fixes #1 and #2' })) }));
    const severalFinding = several.findings.find((f) => f.code === 'submission.linked-issue-invalid');
    expect(severalFinding?.detail).toBe('several');

    const cross = checkContract(basePr({ body: parsedPr(prBody({ 'Linked issue': 'other/repo#5' })) }));
    const crossFinding = cross.findings.find((f) => f.code === 'submission.linked-issue-invalid');
    expect(crossFinding?.detail).toBe('cross-repository');

    const notFound = checkContract(
      basePr({
        body: parsedPr(prBody({ 'Linked issue': 'Fixes #9' })),
        linkedIssue: { status: 'not-found', number: 9 },
      }),
    );
    const notFoundFinding = notFound.findings.find((f) => f.code === 'submission.linked-issue-invalid');
    expect(notFoundFinding?.detail).toBe('not-an-issue');
  });
});

describe('free-form pull requests cannot satisfy required linkage', () => {
  it('free-form pull requests cannot satisfy required linkage', () => {
    const policy = basePolicy();
    policy.submission.free_form = true;
    const result = checkContract(
      basePr({
        policy,
        body: parsedPr('no marker present'),
        changedPaths: { kind: 'complete', changes: [{ kind: 'modified', path: 'src/x.ts', previousPath: null }] },
      }),
    );
    const finding = result.findings.find((f) => f.code === 'submission.linked-issue-missing');
    expect(finding).toBeDefined();
    expect(finding?.detail).toBe('free-form');
  });
});

describe('shared head requests changes and names the pull requests', () => {
  it('shared head requests changes and names the pull requests', () => {
    const result = checkContract(basePr({ sharedHeads: { status: 'known', pullRequests: [10, 3] } }));
    const finding = result.findings.find((f) => f.code === 'submission.shared-head');
    expect(finding?.subjects).toEqual(['#3', '#10']);
    expect(result.disposition).toBe('needs-changes');
    const request = result.requests.find((r) => r.code === 'submission.shared-head');
    expect(request?.text).toBe(
      'Another open pull request uses the same head commit (#3, #10); push a distinct commit to this branch or close the other pull requests.',
    );
  });
});

describe('execution-sensitive change is uncertain', () => {
  it('execution-sensitive change is uncertain', () => {
    const result = checkContract(
      basePr({
        changedPaths: {
          kind: 'complete',
          changes: [
            { kind: 'modified', path: 'src/x.ts', previousPath: null },
            { kind: 'modified', path: 'package.json', previousPath: null },
          ],
        },
      }),
    );
    const finding = result.findings.find((f) => f.code === 'submission.execution-sensitive-change');
    expect(finding?.severity).toBe('uncertain');
    expect(finding?.subjects).toEqual(['package.json']);
    expect(result.flags?.execution_sensitive_paths_changed).toBe(true);
  });
});

describe('trusted path change is advisory', () => {
  it('trusted path change is advisory', () => {
    const result = checkContract(
      basePr({
        changedPaths: {
          kind: 'complete',
          changes: [
            { kind: 'modified', path: 'src/x.ts', previousPath: null },
            { kind: 'modified', path: '.github/workflows/ci.yml', previousPath: null },
          ],
        },
      }),
    );
    const finding = result.findings.find((f) => f.code === 'submission.trusted-path-change');
    expect(finding?.severity).toBe('advisory');
    expect(finding?.subjects).toEqual(['.github/workflows/ci.yml']);
    expect(result.flags?.trusted_paths_changed).toBe(true);
  });
});

describe('policy change is advisory with the proposed validation data', () => {
  it('policy change is advisory with the proposed validation data', () => {
    const result = checkContract(
      basePr({
        changedPaths: {
          kind: 'complete',
          changes: [
            { kind: 'modified', path: 'src/x.ts', previousPath: null },
            { kind: 'modified', path: '.github/patch-steward/policy.yml', previousPath: null },
          ],
        },
        proposedPolicy: { status: 'read', proposed: { status: 'valid', revision: 'abc123' } },
      }),
    );
    const finding = result.findings.find((f) => f.code === 'submission.policy-change');
    expect(finding?.severity).toBe('advisory');
    expect(finding?.detail).toBe('valid');
    expect(result.flags?.policy_change).toEqual({ changed: true, proposed: { status: 'valid', revision: 'abc123' } });
  });
});

describe('diff too large is uncertain and sets both flags', () => {
  it('diff too large is uncertain and sets both flags', () => {
    const result = checkContract(basePr({ changedPaths: { kind: 'too-large' } }));
    const finding = result.findings.find((f) => f.code === 'submission.diff-too-large');
    expect(finding?.severity).toBe('uncertain');
    expect(result.flags).toEqual({
      trusted_paths_changed: true,
      execution_sensitive_paths_changed: true,
      policy_changed: false,
      trusted_paths: [],
      execution_sensitive_paths: [],
      policy_paths: [],
      policy_change: null,
    });
  });
});

describe('attachment rules', () => {
  it.each([...SUBMISSION_ATTACHMENT_RULES])('attachment rule: %s violation requests changes', (rule) => {
    const attachments: AttachmentAssessmentSet =
      rule === 'count'
        ? { limit: 0, countExceeded: true, items: [] }
        : {
            limit: 5,
            countExceeded: false,
            items: [attachmentItem({ status: 'violation', rule, required: false })],
          };
    const result = checkContract(baseIssue({ attachments }));
    expect(result.disposition).toBe('needs-changes');
    const finding = result.findings.find((f) => f.code === 'submission.attachment-violation');
    expect(finding?.detail).toBe(rule);
  });
});

describe('required attachment fetch failure is inconclusive', () => {
  it('required attachment fetch failure is inconclusive', () => {
    const attachments: AttachmentAssessmentSet = {
      limit: 5,
      countExceeded: false,
      items: [attachmentItem({ status: 'unavailable', required: true, reason: 'timeout' })],
    };
    const result = checkContract(baseIssue({ attachments }));
    expect(result.disposition).toBe('inconclusive');
    expect(result.inconclusive[0]?.cause).toBe('attachment-fetch-failed');
    expect(result.findings.some((f) => f.code.startsWith('submission.attachment'))).toBe(false);
  });
});

describe('optional attachment fetch failure is advisory', () => {
  it('optional attachment fetch failure is advisory', () => {
    const attachments: AttachmentAssessmentSet = {
      limit: 5,
      countExceeded: false,
      items: [attachmentItem({ status: 'unavailable', required: false, reason: 'timeout' })],
    };
    const result = checkContract(baseIssue({ attachments }));
    expect(result.disposition).toBe('met');
    const finding = result.findings.find((f) => f.code === 'submission.attachment-unavailable');
    expect(finding?.severity).toBe('advisory');
    expect(finding?.detail).toBe('timeout');
  });
});

describe('extensionless pending attachments warn that the format is unverified', () => {
  it('extensionless pending attachments warn that the format is unverified', () => {
    const url = 'https://github.com/user-attachments/files/1/no-extension';
    const attachments: AttachmentAssessmentSet = {
      limit: 5,
      countExceeded: false,
      items: [attachmentItem({ url, status: 'pending', format: null })],
    };
    const result = checkContract(baseIssue({ attachments }));
    expect(result.warnings).toEqual([{ code: 'attachment.format-unverified', subjects: [url] }]);
  });
});

describe('unavailable reads are inconclusive causes', () => {
  it('unavailable reads are inconclusive causes', () => {
    const linkedIssueUnavailable = checkContract(
      basePr({ linkedIssue: { status: 'unavailable', number: 1, failure: failure('github.linked-issue') } }),
    );
    expect(linkedIssueUnavailable.disposition).toBe('inconclusive');

    const sharedHeadsUnavailable = checkContract(
      basePr({ sharedHeads: { status: 'unavailable', failure: failure('github.shared') } }),
    );
    expect(sharedHeadsUnavailable.disposition).toBe('inconclusive');

    const proposedPolicyUnavailable = checkContract(
      basePr({
        changedPaths: {
          kind: 'complete',
          changes: [
            { kind: 'modified', path: 'src/x.ts', previousPath: null },
            { kind: 'modified', path: '.github/patch-steward/policy.yml', previousPath: null },
          ],
        },
        proposedPolicy: { status: 'unavailable', failure: failure('policy.unavailable') },
      }),
    );
    expect(proposedPolicyUnavailable.disposition).toBe('inconclusive');

    const notChecked: LinkedIssueCheck = { status: 'not-checked' };
    const linkedIssueNotChecked = checkContract(basePr({ linkedIssue: notChecked }));
    expect(linkedIssueNotChecked.disposition).toBe('inconclusive');
    expect(linkedIssueNotChecked.inconclusive[0]?.code).toBe('contract.linked-issue-unchecked');
  });
});

describe('requests are numbered in finding order', () => {
  it('requests are numbered in finding order', () => {
    const body = [
      '<!-- patch-steward:pr-template v1 -->',
      '',
      '## Category',
      '',
      'bugfix',
      '',
      '## Problem',
      '',
      'It fails.',
      '',
      '## Benefit',
      '',
      'Users are unblocked.',
      '',
      '## Intended behavior',
      '',
      '_No response_',
      '',
      '## Acceptance criteria',
      '',
      '- passes',
      '',
      '## Linked issue',
      '',
      '_No response_',
      '',
      '## Regression test',
      '',
      'test/x.test.ts',
      '',
      '## Test scaffolding',
      '',
      '_No response_',
      '',
      '## Reproduction command',
      '',
      'npm test',
      '',
      '## Reproduction command',
      '',
      'npm test again',
      '',
      '## Expected result',
      '',
      'green',
      '',
      '## References',
      '',
      'docs/spec.md',
    ].join('\n');
    const result = checkContract(basePr({ body: parsedPr(body) }));
    const blockingCodes = result.findings.filter((f) => f.severity === 'blocking').map((f) => f.code);
    expect(blockingCodes).toEqual(['submission.field-duplicate', 'submission.field-missing', 'submission.linked-issue-missing']);
    expect(result.requests.map((r) => r.number)).toEqual([1, 2, 3]);
    expect(result.requests.map((r) => r.code)).toEqual(blockingCodes);
  });
});

describe('finding messages and requests contain no submission text', () => {
  it('finding messages and requests contain no submission text', () => {
    const sentinel = 'SENTINEL_MARKER_TEXT_XYZ';
    const body = parsedPr(
      prBody({
        Category: sentinel,
        'Linked issue': `Fixes #1 ${sentinel}`,
        Problem: `It fails. ${sentinel}`,
        Benefit: `Users are unblocked. ${sentinel}`,
        'Acceptance criteria': `- passes ${sentinel}`,
        'Test scaffolding': sentinel,
        References: `docs/spec.md ${sentinel}`,
      }),
    );
    const result = checkContract(basePr({ body }));
    expect(result.findings.some((f) => f.code === 'submission.category-invalid')).toBe(true);
    expect(result.findings.some((f) => f.code === 'submission.linked-issue-invalid')).toBe(true);
    for (const finding of result.findings) {
      expect(finding.message).not.toContain(sentinel);
      if (finding.detail !== null) {
        expect(finding.detail).not.toContain(sentinel);
      }
      for (const subject of finding.subjects) {
        expect(subject).not.toContain(sentinel);
      }
    }
    for (const request of result.requests) {
      expect(request.text).not.toContain(sentinel);
    }
  });
});

describe('contract required fields follow the form or the declared category', () => {
  it('contract required fields follow the form or the declared category', () => {
    const policy = basePolicy();

    expect(contractRequiredFields(policy, { type: 'issue', body: parsedIssue(defectBody()), requestedKind: null })).toEqual(
      policy.submission.issue_fields.defect,
    );

    expect(contractRequiredFields(policy, { type: 'issue', body: parsedIssue(proposalBody()), requestedKind: null })).toEqual(
      policy.submission.issue_fields.proposal,
    );

    expect(contractRequiredFields(policy, { type: 'issue', body: parsedIssue(defectBody()), requestedKind: 'proposal' })).toEqual(
      [],
    );

    expect(contractRequiredFields(policy, { type: 'pull_request', body: parsedPr(prBody({ Category: 'feature' })) })).toEqual(
      policy.categories.feature.required_fields,
    );

    expect(contractRequiredFields(policy, { type: 'pull_request', body: parsedPr(prBody({ Category: 'bogus' })) })).toEqual([]);
  });
});
