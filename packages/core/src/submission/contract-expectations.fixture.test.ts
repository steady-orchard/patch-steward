import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseIssueBody, parsePullRequestBody } from './parse.js';
import { DEFAULT_CHECKLIST_POLICY } from './default-checklist.js';
import { assessAttachmentsStatically } from './attachments.js';
import { proposedPolicyFromBytes } from './proposed-policy.js';
import { checkContract, contractRequiredFields, linkedIssueReference } from './contract.js';
import type {
  ContractInput,
  ContractRepository,
  IssueContractInput,
  LinkedIssueCheck,
  PullRequestContractInput,
  SharedHeadCheck,
} from './contract.js';
import type { ResolvedPolicy } from '../policy/schema.js';
import type { PathChange } from './paths.js';

const corpusDir = fileURLToPath(new URL('../../../../fixtures/submissions/', import.meta.url));
const expectationsPath = fileURLToPath(new URL('../../../../fixtures/submissions/expectations.json', import.meta.url));

interface ExpectedResult {
  readonly template?: string | null;
  readonly codes: readonly string[];
  readonly disposition: string;
  readonly fields?: readonly string[];
  readonly details?: readonly string[];
  readonly enforced?: boolean;
  readonly effective_mode?: string;
  readonly category?: string | null;
  readonly request_contains?: string;
  readonly proposed_status?: string;
  readonly proposed_error_code?: string;
}

interface Case {
  readonly name: string;
  readonly body: string;
  readonly type: 'issue' | 'pull_request';
  readonly policy: string;
  readonly diff?: string;
  readonly linked_issue?: string;
  readonly shared_heads?: readonly number[];
  readonly proposed_policy?: string;
  readonly expect: ExpectedResult;
}

interface Expectations {
  readonly cases: readonly Case[];
}

const expectations: Expectations = JSON.parse(readFileSync(expectationsPath, 'utf8')) as Expectations;

const REPOSITORY: ContractRepository = { fullName: 'steady-orchard/patch-steward-testbed-public', defaultBranch: 'master' };

function crlfToLf(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

function readFixtureText(relativePath: string): string {
  return crlfToLf(readFileSync(new URL(relativePath, `file://${corpusDir}`), 'utf8'));
}

function policyFor(variant: string): ResolvedPolicy {
  const policy = structuredClone(DEFAULT_CHECKLIST_POLICY) as {
    -readonly [K in keyof ResolvedPolicy]: ResolvedPolicy[K];
  } & Record<string, unknown>;
  if (variant === 'template') {
    return policy;
  }
  if (variant === 'free-form') {
    (policy.submission as { free_form: boolean }).free_form = true;
    return policy;
  }
  if (variant === 'bugfix-enforce') {
    (policy.modes.per_category as Record<string, string>).bugfix = 'enforce';
    return policy;
  }
  if (variant === 'no-legacy-image-host') {
    (policy.submission.attachments as { destinations: string[] }).destinations = policy.submission.attachments.destinations.filter(
      (d) => d !== 'user-images.githubusercontent.com',
    );
    return policy;
  }
  throw new Error(`unknown policy variant: ${variant}`);
}

function readDiffChanges(relativePath: string): readonly PathChange[] {
  const text = readFileSync(new URL(relativePath, `file://${corpusDir}`), 'utf8');
  return JSON.parse(text) as readonly PathChange[];
}

function buildInput(testCase: Case): ContractInput {
  const policy = policyFor(testCase.policy);
  const text = readFixtureText(testCase.body);

  if (testCase.type === 'issue') {
    const bodyResult = parseIssueBody(text);
    if (!bodyResult.ok) {
      throw new Error(`failed to parse issue body for ${testCase.name}`);
    }
    const body = bodyResult.value;
    const requiredFields = contractRequiredFields(policy, { type: 'issue', body, requestedKind: null });
    const input: IssueContractInput = {
      type: 'issue',
      repository: REPOSITORY,
      policy,
      body,
      requestedKind: null,
      attachments: assessAttachmentsStatically({ body, bodyText: text, requiredFields, policy }),
    };
    return input;
  }

  const bodyResult = parsePullRequestBody(text);
  if (!bodyResult.ok) {
    throw new Error(`failed to parse pull request body for ${testCase.name}`);
  }
  const body = bodyResult.value;

  const changedPaths =
    testCase.diff === 'too-large'
      ? ({ kind: 'too-large' } as const)
      : ({ kind: 'complete', changes: readDiffChanges(testCase.diff ?? '') } as const);

  const lv = linkedIssueReference(body, REPOSITORY.fullName);
  let linkedIssue: LinkedIssueCheck;
  if (lv.status === 'one') {
    linkedIssue =
      testCase.linked_issue === 'not-found'
        ? { status: 'not-found', number: lv.number }
        : { status: 'exists', number: lv.number, contentHash: `sha256:${'0'.repeat(64)}` };
  } else {
    linkedIssue = { status: 'not-checked' };
  }

  const sharedHeads: SharedHeadCheck = { status: 'known', pullRequests: testCase.shared_heads ?? [] };

  let proposedPolicy: PullRequestContractInput['proposedPolicy'];
  if (testCase.proposed_policy === undefined) {
    proposedPolicy = { status: 'not-read' };
  } else if (testCase.proposed_policy === 'removed') {
    proposedPolicy = { status: 'read', proposed: { status: 'removed' } };
  } else {
    const bytes = Buffer.from(crlfToLf(readFileSync(new URL(testCase.proposed_policy, `file://${corpusDir}`), 'utf8')), 'utf8');
    proposedPolicy = { status: 'read', proposed: proposedPolicyFromBytes('e'.repeat(40), bytes, () => true) };
  }

  const requiredFields = contractRequiredFields(policy, { type: 'pull_request', body });
  const input: PullRequestContractInput = {
    type: 'pull_request',
    repository: REPOSITORY,
    policy,
    body,
    changedPaths,
    linkedIssue,
    sharedHeads,
    proposedPolicy,
    attachments: assessAttachmentsStatically({ body, bodyText: text, requiredFields, policy }),
  };
  return input;
}

function formattedTemplate(result: ReturnType<typeof checkContract>): string | null {
  return result.template === null ? null : `${result.template.form} v${result.template.version}`;
}

function listFixtureFiles(): readonly string[] {
  const entries = readdirSync(corpusDir, { recursive: true }) as string[];
  return entries
    .map((entry) => entry.split('\\').join('/'))
    .filter((entry) => entry !== 'expectations.json')
    .filter((entry) => {
      const segments = entry.split('/');
      const last = segments[segments.length - 1] as string;
      return last.includes('.');
    });
}

describe('submission contract fixture corpus', () => {
  it.each(expectations.cases.map((c) => [c.name, c] as const))('contract expectation: %s', (_name, testCase) => {
    const input = buildInput(testCase);
    const result = checkContract(input);
    const expected = testCase.expect;

    expect(formattedTemplate(result)).toBe(expected.template ?? null);
    expect([...result.findings.map((f) => f.code)].sort()).toEqual([...expected.codes].sort());
    expect(result.disposition).toBe(expected.disposition);

    if (expected.fields !== undefined) {
      const fields = [...new Set(result.findings.map((f) => f.field).filter((f) => f !== null))].sort();
      expect(fields).toEqual([...expected.fields].sort());
    }
    if (expected.details !== undefined) {
      const details = [...new Set(result.findings.map((f) => f.detail).filter((d) => d !== null))].sort();
      expect(details).toEqual([...expected.details].sort());
    }
    if (expected.enforced !== undefined) {
      expect(result.enforced).toBe(expected.enforced);
    }
    if (expected.effective_mode !== undefined) {
      expect(result.effective_mode).toBe(expected.effective_mode);
    }
    if (expected.category !== undefined) {
      expect(result.category).toBe(expected.category);
    }
    if (expected.request_contains !== undefined) {
      expect(result.requests.some((r) => r.text.includes(expected.request_contains as string))).toBe(true);
    }
    if (expected.proposed_status !== undefined) {
      expect(result.flags?.policy_change?.proposed?.status).toBe(expected.proposed_status);
    }
    if (expected.proposed_error_code !== undefined) {
      const proposed = result.flags?.policy_change?.proposed;
      const code = proposed && proposed.status === 'invalid' ? proposed.errors[0]?.code : undefined;
      expect(code).toBe(expected.proposed_error_code);
    }
  });

  it('every submission fixture has an expectation', () => {
    const named = new Set<string>();
    for (const c of expectations.cases) {
      named.add(c.body);
      if (c.diff !== undefined && c.diff !== 'too-large') {
        named.add(c.diff);
      }
      if (c.proposed_policy !== undefined && c.proposed_policy !== 'removed') {
        named.add(c.proposed_policy);
      }
    }
    for (const file of listFixtureFiles()) {
      expect(named.has(file), `no expectation names ${file}`).toBe(true);
    }
  });

  it('every expectation names existing files', () => {
    const files = new Set(listFixtureFiles());
    for (const c of expectations.cases) {
      expect(files.has(c.body), `missing fixture file ${c.body}`).toBe(true);
      if (c.diff !== undefined && c.diff !== 'too-large') {
        expect(files.has(c.diff), `missing fixture file ${c.diff}`).toBe(true);
      }
      if (c.proposed_policy !== undefined && c.proposed_policy !== 'removed') {
        expect(files.has(c.proposed_policy), `missing fixture file ${c.proposed_policy}`).toBe(true);
      }
    }
  });

  it('expectations cover the documented contract results', () => {
    const cases = expectations.cases;
    expect(
      cases.some((c) => c.expect.codes.includes('submission.field-duplicate') && c.expect.disposition === 'needs-changes'),
    ).toBe(true);
    expect(
      cases.some((c) => c.expect.codes.includes('submission.category-invalid') && c.expect.disposition === 'needs-changes'),
    ).toBe(true);
    expect(
      cases.some(
        (c) =>
          c.expect.codes.includes('submission.unstructured') &&
          c.expect.disposition === 'needs-changes' &&
          (c.expect.request_contains ?? '').startsWith('https://github.com/'),
      ),
    ).toBe(true);
    expect(
      cases.some(
        (c) => c.policy === 'free-form' && c.body === 'unstructured.txt' && !c.expect.codes.includes('submission.unstructured'),
      ),
    ).toBe(true);
    expect(cases.some((c) => c.expect.codes.includes('submission.category-mismatch') && c.expect.disposition === 'uncertain')).toBe(
      true,
    );
    expect(
      cases.some(
        (c) =>
          c.expect.codes.includes('submission.category-enforced-ambiguity') &&
          c.expect.disposition === 'uncertain' &&
          c.expect.enforced === true,
      ),
    ).toBe(true);
    expect(
      cases.some(
        (c) =>
          c.expect.codes.includes('submission.policy-change') &&
          c.expect.proposed_status !== undefined &&
          c.expect.effective_mode !== undefined,
      ),
    ).toBe(true);
    expect(
      cases.some((c) => c.expect.codes.includes('submission.execution-sensitive-change') && c.expect.disposition === 'uncertain'),
    ).toBe(true);
  });
});
