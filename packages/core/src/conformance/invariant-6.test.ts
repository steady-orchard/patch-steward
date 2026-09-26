import { describe, expect, it } from 'vitest';

import { createGitHubClient } from '../github/client.js';
import type { GitHubFetch } from '../github/client.js';
import { createGitHubBudget } from '../github/budget.js';
import type { GitHubRepositoryRef } from '../github/reader.js';
import { DEFAULT_CHECKLIST_POLICY } from '../submission/default-checklist.js';
import { parseIssueBody, parsePullRequestBody } from '../submission/parse.js';
import { checkContract } from '../submission/contract.js';
import type { IssueContractInput, PullRequestContractInput } from '../submission/contract.js';
import { assessAttachmentsStatically } from '../submission/attachments.js';
import type { CaptureContext } from '../submission/intake.js';
import { captureIssue, capturePullRequest } from '../submission/intake.js';
import type {
  AttachmentAddress,
  AttachmentResolver,
  AttachmentTransport,
  AttachmentTransportResponse,
} from '../net/attachment-fetch.js';
import { contentHash } from '../hash.js';

const HEAD_SHA = 'a'.repeat(40);
const BASE_SHA = 'b'.repeat(40);
const POLICY_REVISION = 'd'.repeat(40);
const REPO: GitHubRepositoryRef = { owner: 'octo', name: 'demo' };

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

interface FakeUser {
  readonly login: string;
  readonly id: number;
  readonly type: string;
  readonly created_at: string;
}

const FIRST_TIME_USER: FakeUser = { login: 'first-timer', id: 1, type: 'User', created_at: '2026-09-25T00:00:00Z' };
const MAINTAINER_USER: FakeUser = { login: 'maintainer-bot[bot]', id: 2, type: 'Bot', created_at: '2010-01-01T00:00:00Z' };

function issueResponse(number: number, body: string | null, user: FakeUser, association: string): unknown {
  return { number, title: 'issue title', body, state: 'open', user, author_association: association };
}

function pullRequestResponse(options: {
  readonly number: number;
  readonly body: string | null;
  readonly user: FakeUser;
  readonly association: string;
}): unknown {
  return {
    number: options.number,
    title: 'pr title',
    body: options.body,
    state: 'open',
    draft: false,
    head: { sha: HEAD_SHA, ref: 'feature' },
    base: { sha: BASE_SHA, ref: 'main' },
    user: options.user,
    author_association: options.association,
    changed_files: 1,
  };
}

function fileEntry(filename: string, status = 'modified'): unknown {
  return { filename, status };
}

function fakeResolver(): AttachmentResolver {
  return async (): Promise<readonly AttachmentAddress[]> => [{ address: '140.82.112.3', family: 4 }];
}

function bodyFrom(bytes: Uint8Array): AsyncIterable<Uint8Array> {
  return {
    [Symbol.asyncIterator]() {
      let sent = false;
      return {
        async next(): Promise<IteratorResult<Uint8Array>> {
          if (!sent) {
            sent = true;
            return { done: false, value: bytes };
          }
          return { done: true, value: undefined };
        },
      };
    },
  };
}

function fakeTransport(): AttachmentTransport {
  return async (): Promise<AttachmentTransportResponse> => ({
    kind: 'response',
    status: 200,
    location: null,
    body: bodyFrom(new Uint8Array()),
    close: () => undefined,
  });
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
    attachmentResolver: fakeResolver(),
    attachmentTransport: fakeTransport(),
    authorResponses: [],
  };
}

function defectBody(overrides: Partial<Record<string, string>> = {}): string {
  const f = {
    'Expected behavior': '`widget parse` accepts an empty file and prints an empty document.',
    'Authoritative basis': 'docs/format.md, section "Empty input": an empty file is a valid document.',
    'Actual behavior': '`widget parse empty.txt` exits with status 1 and prints `TypeError: cannot read properties of undefined`.',
    'Affected version': '1.4.2',
    'Reproduction command': '```shell\ntouch empty.txt\nwidget parse empty.txt\n```',
    'Expected result': 'Exit status 0 and the output `[]`.',
    'Proposed scope': 'Handle empty input in the parser entry point only.',
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

function prBody(overrides: Partial<Record<string, string>> = {}): string {
  const f = {
    Category: 'bugfix',
    Problem: '`widget parse` exits with status 1 on an empty file.',
    Benefit: 'Empty files parse like any other valid document.',
    'Intended behavior': 'An empty file parses to an empty document and exits with status 0.',
    'Acceptance criteria': '- `widget parse empty.txt` prints `[]`.\n- Exit status is 0.',
    'Linked issue': 'Fixes #29',
    'Regression test': '`src/parse.test.ts`, test `parses an empty file`',
    'Test scaffolding': '<!-- Non-test files the regression test needs. -->',
    'Reproduction command': '```shell\ntouch empty.txt\nwidget parse empty.txt\n```',
    'Expected result': 'Exit status 0 and the output `[]`.',
    References: 'docs/format.md',
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

function issueContractInput(body: string): IssueContractInput {
  const parsed = parseIssueBody(body);
  if (!parsed.ok) {
    throw new Error('expected structured body');
  }
  const requiredFields = ['expected-behavior', 'authoritative-basis', 'actual-behavior'] as const;
  const attachments = assessAttachmentsStatically({
    body: parsed.value,
    bodyText: body,
    requiredFields: [...requiredFields],
    policy: DEFAULT_CHECKLIST_POLICY,
  });
  return {
    type: 'issue',
    repository: { fullName: 'octo/demo', defaultBranch: 'main' },
    policy: DEFAULT_CHECKLIST_POLICY,
    body: parsed.value,
    requestedKind: null,
    attachments,
  };
}

function pullRequestContractInput(body: string): PullRequestContractInput {
  const parsed = parsePullRequestBody(body);
  if (!parsed.ok) {
    throw new Error('expected structured body');
  }
  const attachments = assessAttachmentsStatically({
    body: parsed.value,
    bodyText: body,
    requiredFields: [],
    policy: DEFAULT_CHECKLIST_POLICY,
  });
  return {
    type: 'pull_request',
    repository: { fullName: 'octo/demo', defaultBranch: 'main' },
    policy: DEFAULT_CHECKLIST_POLICY,
    body: parsed.value,
    changedPaths: { kind: 'complete', changes: [{ kind: 'modified', path: 'src/parse.ts', previousPath: null }] },
    linkedIssue: {
      status: 'exists',
      number: 29,
      contentHash: contentHash(new TextEncoder().encode('The parser crashes on empty input.')),
    },
    sharedHeads: { status: 'not-applicable' },
    proposedPolicy: { status: 'not-read' },
    attachments,
  };
}

describe('invariant 6 conformance', () => {
  it('severity assertions are ignored', () => {
    const plainIssue = checkContract(issueContractInput(defectBody()));
    const severeIssue = checkContract(
      issueContractInput(
        defectBody({
          'Expected behavior': '`widget parse` accepts an empty file and prints an empty document. This is critical.',
          'Authoritative basis': 'docs/format.md, section "Empty input": an empty file is a valid document. Severity: high.',
          'Actual behavior':
            '`widget parse empty.txt` exits with status 1 and prints `TypeError: cannot read properties of undefined`. P0, critical, severity: high.',
          'Affected version': '1.4.2 (P0)',
          'Expected result': 'Exit status 0 and the output `[]`. Critical.',
          'Proposed scope': 'Handle empty input in the parser entry point only. Severity: high.',
          References: 'Severity: critical (P0).',
        }),
      ),
    );
    expect(severeIssue).toEqual(plainIssue);

    const plainPr = checkContract(pullRequestContractInput(prBody()));
    const severePr = checkContract(
      pullRequestContractInput(
        prBody({
          Problem: '`widget parse` exits with status 1 on an empty file. Severity: critical, P0.',
          Benefit: 'Empty files parse like any other valid document. Severity: critical, P0.',
          References: 'docs/format.md Severity: critical, P0.',
        }),
      ),
    );
    expect(severePr).toEqual(plainPr);
  });

  it('contract ignores authorship', async () => {
    const routesFor = (user: FakeUser, association: string): RouteMap => ({
      '/repos/octo/demo': () => jsonResponse(repoResponse()),
      '/repos/octo/demo/issues/5': () => jsonResponse(issueResponse(5, defectBody(), user, association)),
      '/repos/octo/demo/pulls/40': () => jsonResponse(pullRequestResponse({ number: 40, body: prBody(), user, association })),
      '/repos/octo/demo/pulls/40/files': () => jsonResponse([fileEntry('src/parse.ts')]),
      '/repos/octo/demo/issues/29': () => jsonResponse(issueResponse(29, 'The parser crashes on empty input.', user, association)),
      [`/repos/octo/demo/commits/${HEAD_SHA}/pulls`]: () => jsonResponse([]),
    });

    const firstIssue = await captureIssue(makeContext(routedFetch(routesFor(FIRST_TIME_USER, 'FIRST_TIME_CONTRIBUTOR'))), 5);
    const secondIssue = await captureIssue(makeContext(routedFetch(routesFor(MAINTAINER_USER, 'OWNER'))), 5);
    expect(firstIssue.ok).toBe(true);
    expect(secondIssue.ok).toBe(true);
    if (!firstIssue.ok || !secondIssue.ok) return;
    expect(firstIssue.value.contract).toEqual(secondIssue.value.contract);
    expect(firstIssue.value.snapshotHash).toBe(secondIssue.value.snapshotHash);

    const firstPr = await capturePullRequest(makeContext(routedFetch(routesFor(FIRST_TIME_USER, 'FIRST_TIME_CONTRIBUTOR'))), 40);
    const secondPr = await capturePullRequest(makeContext(routedFetch(routesFor(MAINTAINER_USER, 'OWNER'))), 40);
    expect(firstPr.ok).toBe(true);
    expect(secondPr.ok).toBe(true);
    if (!firstPr.ok || !secondPr.ok) return;
    expect(firstPr.value.contract).toEqual(secondPr.value.contract);
    expect(firstPr.value.snapshotHash).toBe(secondPr.value.snapshotHash);

    const disclosedRoutes: RouteMap = {
      '/repos/octo/demo': () => jsonResponse(repoResponse()),
      '/repos/octo/demo/issues/5': () =>
        jsonResponse(
          issueResponse(
            5,
            defectBody({
              'Actual behavior':
                '`widget parse empty.txt` exits with status 1 and prints `TypeError: cannot read properties of undefined`. Generated with an AI assistant.',
            }),
            FIRST_TIME_USER,
            'FIRST_TIME_CONTRIBUTOR',
          ),
        ),
      '/repos/octo/demo/pulls/40': () =>
        jsonResponse(
          pullRequestResponse({
            number: 40,
            body: prBody({ Problem: '`widget parse` exits with status 1 on an empty file. Generated with an AI assistant.' }),
            user: FIRST_TIME_USER,
            association: 'FIRST_TIME_CONTRIBUTOR',
          }),
        ),
      '/repos/octo/demo/pulls/40/files': () => jsonResponse([fileEntry('src/parse.ts')]),
      '/repos/octo/demo/issues/29': () =>
        jsonResponse(issueResponse(29, 'The parser crashes on empty input.', FIRST_TIME_USER, 'FIRST_TIME_CONTRIBUTOR')),
      [`/repos/octo/demo/commits/${HEAD_SHA}/pulls`]: () => jsonResponse([]),
    };
    const disclosedPr = await capturePullRequest(makeContext(routedFetch(disclosedRoutes)), 40);
    expect(disclosedPr.ok).toBe(true);
    if (!disclosedPr.ok) return;
    expect(disclosedPr.value.contract.disposition).toBe(firstPr.value.contract.disposition);
    expect(disclosedPr.value.contract.findings.map((f) => f.code)).toEqual(firstPr.value.contract.findings.map((f) => f.code));
    expect(disclosedPr.value.contract.requests).toEqual(firstPr.value.contract.requests);

    const disclosedIssue = await captureIssue(makeContext(routedFetch(disclosedRoutes)), 5);
    expect(disclosedIssue.ok).toBe(true);
    if (!disclosedIssue.ok) return;
    expect(disclosedIssue.value.contract.disposition).toBe(firstIssue.value.contract.disposition);
    expect(disclosedIssue.value.contract.findings.map((f) => f.code)).toEqual(
      firstIssue.value.contract.findings.map((f) => f.code),
    );
    expect(disclosedIssue.value.contract.requests).toEqual(firstIssue.value.contract.requests);
  });

  it('contract inputs carry no authorship fields', () => {
    type ContractKeys = keyof IssueContractInput | keyof PullRequestContractInput;
    type AuthorshipKey = Extract<
      ContractKeys,
      'author' | 'user' | 'login' | 'association' | 'authorAssociation' | 'accountAge' | 'createdAt' | 'aiDisclosure' | 'aiAssisted'
    >;
    const noAuthorship: [AuthorshipKey] extends [never] ? true : false = true;
    expect(noAuthorship).toBe(true);

    const input = pullRequestContractInput(prBody());
    expect(Object.keys(input).sort()).toEqual([
      'attachments',
      'body',
      'changedPaths',
      'linkedIssue',
      'policy',
      'proposedPolicy',
      'repository',
      'sharedHeads',
      'type',
    ]);
  });
});
