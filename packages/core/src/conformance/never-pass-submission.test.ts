import { describe, expect, it } from 'vitest';

import { createGitHubClient } from '../github/client.js';
import type { GitHubFetch } from '../github/client.js';
import { createGitHubBudget } from '../github/budget.js';
import type { GitHubRepositoryRef } from '../github/reader.js';
import { DEFAULT_CHECKLIST_POLICY } from '../submission/default-checklist.js';
import { parseIssueBody } from '../submission/parse.js';
import { buildIssueSnapshot } from '../submission/snapshot.js';
import { checkContract, CONTRACT_DISPOSITIONS } from '../submission/contract.js';
import type { ContractResult } from '../submission/contract.js';
import { SUBMISSION_ATTACHMENT_RULES } from '../submission/attachments.js';
import type { AttachmentAssessment, AttachmentAssessmentSet } from '../submission/attachments.js';
import { ATTACHMENT_UNAVAILABLE_REASONS } from '../net/attachment-fetch.js';
import type { ContractDisposition } from '../submission/contract.js';
import type { CaptureContext } from '../submission/intake.js';
import { buildSubmissionRecord, captureIssue, capturePullRequest } from '../submission/intake.js';
import { outcomeSchema, failureCauseSchema } from '../index.js';

const REPO: GitHubRepositoryRef = { owner: 'octo', name: 'demo' };
const POLICY_REVISION = 'd'.repeat(40);
const HEAD_SHA = 'a'.repeat(40);
const BASE_SHA = 'b'.repeat(40);

const DEFECT_COMPLETE_BODY = [
  '### Expected behavior',
  '',
  '`widget parse` accepts an empty file and prints an empty document.',
  '',
  '### Authoritative basis',
  '',
  'docs/format.md, section "Empty input": an empty file is a valid document.',
  '',
  '### Actual behavior',
  '',
  '`widget parse empty.txt` exits with status 1 and prints `TypeError: cannot read properties of undefined`.',
  '',
  '### Affected version',
  '',
  '1.4.2',
  '',
  '### Reproduction command',
  '',
  '```shell',
  'touch empty.txt',
  'widget parse empty.txt',
  '```',
  '',
  '### Expected result',
  '',
  'Exit status 0 and the output `[]`.',
  '',
  '### Proposed scope',
  '',
  'Handle empty input in the parser entry point only.',
  '',
  '### References',
  '',
  '_No response_',
  '',
  '### Security claim',
  '',
  '- [ ] This report claims a security problem',
].join('\n');

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

type RouteMap = Record<string, (url: URL) => Response>;

function routedFetch(routes: RouteMap): GitHubFetch {
  return (url: string) => {
    const parsed = new URL(url);
    const handler = routes[parsed.pathname];
    if (!handler) {
      throw new Error(`unrouted path ${parsed.pathname}`);
    }
    return Promise.resolve(handler(parsed));
  };
}

function repoResponse(): unknown {
  return { full_name: 'octo/demo', default_branch: 'main', private: false };
}

function pullRequestResponse(number: number, body: string | null): unknown {
  return {
    number,
    title: 'pr title',
    body,
    state: 'open',
    draft: false,
    head: { sha: HEAD_SHA, ref: 'feature' },
    base: { sha: BASE_SHA, ref: 'main' },
    user: null,
    author_association: 'NONE',
    changed_files: 1,
  };
}

function bugfixBody(): string {
  return [
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
    'It succeeds.',
    '',
    '## Acceptance criteria',
    '',
    '- passes',
    '',
    '## Linked issue',
    '',
    'Fixes #29',
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
    '## Expected result',
    '',
    'green',
    '',
    '## References',
    '',
    'docs/spec.md',
  ].join('\n');
}

function makeContext(fetch: GitHubFetch): CaptureContext {
  const client = createGitHubClient({
    token: null,
    budget: createGitHubBudget({ requests: 50, retriesPerRequest: 0 }),
    fetch,
  });
  return {
    client,
    repository: REPO,
    policy: structuredClone(DEFAULT_CHECKLIST_POLICY),
    policyRevision: POLICY_REVISION,
    attachmentResolver: async () => [],
    attachmentTransport: async () => ({ kind: 'error', reason: 'network' }),
    authorResponses: [],
  };
}

function baseAttachmentItem(overrides: Partial<AttachmentAssessment>): AttachmentAssessment {
  return {
    url: 'https://github.com/user-attachments/files/1/log.txt',
    fields: ['reproduction-command'],
    required: true,
    format: 'log',
    status: 'violation',
    rule: null,
    reason: null,
    bytes: null,
    contentHash: null,
    entries: null,
    ...overrides,
  };
}

function emptyAttachmentSet(): AttachmentAssessmentSet {
  return { limit: 5, countExceeded: false, items: [] };
}

function issueContractFor(attachments: AttachmentAssessmentSet): ContractResult {
  const bodyResult = parseIssueBody(DEFECT_COMPLETE_BODY);
  if (!bodyResult.ok) {
    throw new Error('fixture body failed to parse');
  }
  return checkContract({
    type: 'issue',
    repository: { fullName: 'octo/demo', defaultBranch: 'main' },
    policy: DEFAULT_CHECKLIST_POLICY,
    body: bodyResult.value,
    requestedKind: null,
    attachments,
  });
}

describe('never-pass conformance: submission intake', () => {
  it('failure code intake.record-invalid never yields pass', () => {
    const snapshotResult = buildIssueSnapshot({
      repository: 'octo/demo',
      number: 5,
      title: 't',
      body: DEFECT_COMPLETE_BODY,
      attachments: [],
      authorResponses: [],
      policyRevision: POLICY_REVISION,
    });
    expect(snapshotResult.ok).toBe(true);
    if (!snapshotResult.ok) return;

    const bodyResult = parseIssueBody(DEFECT_COMPLETE_BODY);
    expect(bodyResult.ok).toBe(true);
    if (!bodyResult.ok) return;

    const contract = issueContractFor(emptyAttachmentSet());

    const result = buildSubmissionRecord({
      snapshot: snapshotResult.value,
      issueKind: null,
      body: bodyResult.value,
      contract,
      attachments: emptyAttachmentSet(),
      claimScopeHash: null,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('intake.record-invalid');
    expect(result.failure.outcome).toBe('inconclusive');
    expect(outcomeSchema.parse(result.failure.outcome)).not.toBe('pass');
    expect(failureCauseSchema.safeParse(result.failure.cause).success).toBe(true);
    expect(typeof result.failure.message).toBe('string');
    expect(result.failure.message.length).toBeGreaterThan(0);
  });

  it.each([...SUBMISSION_ATTACHMENT_RULES])('attachment violation %s never yields met', (rule) => {
    const attachments: AttachmentAssessmentSet =
      rule === 'count'
        ? { limit: 5, countExceeded: true, items: [] }
        : { limit: 5, countExceeded: false, items: [baseAttachmentItem({ status: 'violation', rule })] };

    const contract = issueContractFor(attachments);
    expect(contract.disposition).toBe('needs-changes');
  });

  it.each([...ATTACHMENT_UNAVAILABLE_REASONS])('required attachment unavailable for %s is inconclusive', (reason) => {
    const attachments: AttachmentAssessmentSet = {
      limit: 5,
      countExceeded: false,
      items: [baseAttachmentItem({ status: 'unavailable', rule: null, reason, required: true })],
    };
    const contract = issueContractFor(attachments);
    expect(contract.disposition).toBe('inconclusive');
    const entry = contract.inconclusive.find((i) => i.cause === 'attachment-fetch-failed');
    expect(entry).toBeDefined();
  });

  it.each([...ATTACHMENT_UNAVAILABLE_REASONS])('optional attachment unavailable for %s is advisory', (reason) => {
    const attachments: AttachmentAssessmentSet = {
      limit: 5,
      countExceeded: false,
      items: [baseAttachmentItem({ status: 'unavailable', rule: null, reason, required: false })],
    };
    const contract = issueContractFor(attachments);
    expect(contract.disposition).toBe('met');
    const finding = contract.findings.find((f) => f.code === 'submission.attachment-unavailable');
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('advisory');
  });

  it('contract dispositions never include pass', () => {
    expect((CONTRACT_DISPOSITIONS as readonly string[]).includes('pass')).toBe(false);
    for (const disposition of CONTRACT_DISPOSITIONS) {
      const parsed = outcomeSchema.safeParse(disposition);
      expect(!parsed.success || parsed.data !== 'pass').toBe(true);
    }

    type PassDisposition = Extract<ContractDisposition, 'pass'>;
    const noPass: [PassDisposition] extends [never] ? true : false = true;
    expect(noPass).toBe(true);
  });

  it('capture read failures never yield a contract result', async () => {
    const failingFetch: GitHubFetch = () => Promise.resolve(jsonResponse({}, 500));
    const context = makeContext(failingFetch);

    const issueResult = await captureIssue(context, 5);
    expect(issueResult.ok).toBe(false);
    if (!issueResult.ok) {
      expect(issueResult.failure.outcome).toBe('inconclusive');
    }

    const prResult = await capturePullRequest(context, 40);
    expect(prResult.ok).toBe(false);
    if (!prResult.ok) {
      expect(prResult.failure.outcome).toBe('inconclusive');
    }
  });

  it('capture partial read failures end inconclusive', async () => {
    const routes: RouteMap = {
      '/repos/octo/demo': () => jsonResponse(repoResponse()),
      '/repos/octo/demo/pulls/40': () => jsonResponse(pullRequestResponse(40, bugfixBody())),
      '/repos/octo/demo/pulls/40/files': () => jsonResponse([{ filename: 'src/parse.ts', status: 'modified' }]),
      '/repos/octo/demo/issues/29': () => jsonResponse({}, 500),
      [`/repos/octo/demo/commits/${HEAD_SHA}/pulls`]: () => jsonResponse({}, 500),
    };
    const context = makeContext(routedFetch(routes));
    const result = await capturePullRequest(context, 40);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.contract.disposition).toBe('inconclusive');
  });
});
