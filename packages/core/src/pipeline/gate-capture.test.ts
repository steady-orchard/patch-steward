import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import type { GitHubFetch } from '../github/client.js';
import { createGitHubClient } from '../github/client.js';
import { createGitHubBudget } from '../github/budget.js';
import type { GitHubRepositoryRef } from '../github/reader.js';
import type {
  AttachmentAddress,
  AttachmentResolver,
  AttachmentTransport,
  AttachmentTransportResponse,
} from '../net/attachment-fetch.js';
import { loadPolicy } from '../policy/loader.js';
import type { CaptureContext } from '../submission/intake.js';
import { fixedClock } from '../clock.js';
import { validateHandoff } from './handoff.js';
import { initialBudget } from './budget.js';
import type { GateInput } from './gate.js';
import { buildGateHandoff, gateCaptureSubmission, gateContractLogLines, runGate } from './gate.js';

const TESTBED_REPO: GitHubRepositoryRef = { owner: 'steady-orchard', name: 'patch-steward-testbed-public' };
const T_BASE = '/repos/steady-orchard/patch-steward-testbed-public';
const T_ISSUE_29 = `${T_BASE}/issues/29`;

function readTextFixture(relPath: string): string {
  return readFileSync(new URL(`../../../../fixtures/${relPath}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
}

function readJsonFixture(relPath: string): unknown {
  return JSON.parse(readTextFixture(relPath));
}

function templatePolicyPath(): string {
  return fileURLToPath(new URL('../../../../templates/policy/policy.yml', import.meta.url));
}

function withBody(fixture: unknown, body: string | null): unknown {
  return { ...(fixture as Record<string, unknown>), body };
}

type RouteValue = unknown | number;
type RouteMap = Record<string, RouteValue>;

function makeFetch(routes: RouteMap): GitHubFetch {
  return (url: string) => {
    const pathname = new URL(url).pathname;
    if (!(pathname in routes)) {
      return Promise.resolve(new Response('{}', { status: 404 }));
    }
    const value = routes[pathname];
    if (typeof value === 'number') {
      return Promise.resolve(new Response('{}', { status: value }));
    }
    return Promise.resolve(new Response(JSON.stringify(value), { status: 200 }));
  };
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

function testbedRepository(): unknown {
  return readJsonFixture('github/testbed/repository.json');
}

function testbedIssue29(body: string | null): unknown {
  return withBody(readJsonFixture('github/testbed/issue-29.json'), body);
}

async function makeContext(routes: RouteMap): Promise<CaptureContext> {
  const fetch = makeFetch(routes);
  const loaded = await loadPolicy({ kind: 'file', path: templatePolicyPath() });
  if (!loaded.ok) throw new Error('policy fixture failed to load');
  return {
    client: createGitHubClient({ token: null, budget: createGitHubBudget({ requests: 50, retriesPerRequest: 0 }), fetch }),
    repository: TESTBED_REPO,
    policy: loaded.value.policy,
    policyRevision: loaded.value.revision.id,
    attachmentResolver: fakeResolver(),
    attachmentTransport: fakeTransport(),
    authorResponses: [],
  };
}

describe('gate capture', () => {
  it('gate capture returns the submission, contract, and plan', async () => {
    const routes: RouteMap = {
      [T_BASE]: testbedRepository(),
      [T_ISSUE_29]: testbedIssue29(readTextFixture('submissions/defect-complete.txt')),
    };
    const context = await makeContext(routes);
    const result = await gateCaptureSubmission(context, { type: 'issue', number: 29 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const capture = result.value;
    expect(capture.submission.type).toBe('issue');
    expect(capture.submission.number).toBe(29);
    expect(capture.classification).toEqual({ type: 'issue', issueKind: 'defect' });
    expect(capture.baseCommit).toBeNull();
    expect(capture.earlyExit).toBeNull();
    expect(capture.mode).toBe(capture.contract.effective_mode);
  });

  it('gate capture reports an early exit for an unstructured issue', async () => {
    const recordedIssue = readJsonFixture('github/testbed/issue-29.json') as { readonly body: string };
    const routes: RouteMap = {
      [T_BASE]: testbedRepository(),
      [T_ISSUE_29]: testbedIssue29(recordedIssue.body),
    };
    const context = await makeContext(routes);
    const result = await gateCaptureSubmission(context, { type: 'issue', number: 29 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const capture = result.value;
    expect(capture.earlyExit).toBe('contract-needs-changes');
    expect(capture.findings.map((f) => f.code)).toContain('submission.unstructured');
  });

  it('the gate handoff binds a numeric run and the given budget', async () => {
    const routes: RouteMap = {
      [T_BASE]: testbedRepository(),
      [T_ISSUE_29]: testbedIssue29(readTextFixture('submissions/defect-complete.txt')),
    };
    const context = await makeContext(routes);
    const result = await gateCaptureSubmission(context, { type: 'issue', number: 29 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const capture = result.value;
    const budgetRemaining = initialBudget(context.policy, { githubRequests: 7 });
    const handoff = buildGateHandoff(capture, {
      run: { run_id: 36081628326, run_attempt: 2 },
      policyRevision: 'b'.repeat(40),
      budgetRemaining,
    });
    const validated = validateHandoff(handoff, { previous: null, gate: null, maxRounds: 2 });
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    expect(validated.value.run).toEqual({ run_id: 36081628326, run_attempt: 2 });
    expect(validated.value.snapshot_hash).toBe(capture.submission.snapshot_hash);
    expect(validated.value.budget_remaining).toEqual(budgetRemaining);
  });

  it('gate capture matches the local gate', async () => {
    const routes: RouteMap = {
      [T_BASE]: testbedRepository(),
      [T_ISSUE_29]: testbedIssue29(readTextFixture('submissions/defect-complete.txt')),
    };
    const context = await makeContext(routes);
    const captureResult = await gateCaptureSubmission(context, { type: 'issue', number: 29 });
    expect(captureResult.ok).toBe(true);
    if (!captureResult.ok) return;
    const capture = captureResult.value;
    const built = buildGateHandoff(capture, {
      run: { run_id: 'local-20260927T101500Z-3f9a1c2e', run_attempt: 1 },
      policyRevision: context.policyRevision,
      budgetRemaining: initialBudget(context.policy, { githubRequests: 0 }),
    }) as { readonly early_exit: unknown; readonly findings: unknown; readonly causes: unknown };

    const input: GateInput = {
      repository: TESTBED_REPO,
      submission: { type: 'issue', number: 29 },
      policySource: { kind: 'local-file', path: templatePolicyPath() },
      token: null,
      sleep: async () => undefined,
      attachmentResolver: fakeResolver(),
      attachmentTransport: fakeTransport(),
      run: { run_id: 'local-20260927T101500Z-3f9a1c2e', run_attempt: 1 },
      clock: fixedClock('2026-09-27T10:15:00.000Z'),
      fetch: makeFetch(routes),
    };
    const gateResult = await runGate(input);
    expect(gateResult.ok).toBe(true);
    if (!gateResult.ok) return;
    const handoff = gateResult.value.handoff as {
      readonly early_exit: unknown;
      readonly findings: unknown;
      readonly causes: unknown;
    };
    expect(handoff.early_exit).toEqual(built.early_exit);
    expect(handoff.findings).toEqual(built.findings);
    expect(handoff.causes).toEqual(built.causes);
    expect(gateResult.value.submission.snapshot_hash).toBe(capture.submission.snapshot_hash);
  });

  it('gate contract log lines name the disposition and causes', async () => {
    const recordedIssue = readJsonFixture('github/testbed/issue-29.json') as { readonly body: string };
    const routes: RouteMap = {
      [T_BASE]: testbedRepository(),
      [T_ISSUE_29]: testbedIssue29(recordedIssue.body),
    };
    const context = await makeContext(routes);
    const result = await gateCaptureSubmission(context, { type: 'issue', number: 29 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const lines = gateContractLogLines(result.value);
    expect(lines[0]).toBe('contract disposition needs-changes');
    for (const line of lines) {
      expect(line).toMatch(/^(contract disposition|warning|cause) /);
    }
  });

  it('gate capture passes through a capture failure', async () => {
    const routes: RouteMap = {
      [T_BASE]: testbedRepository(),
      [T_ISSUE_29]: 500,
    };
    const context = await makeContext(routes);
    const result = await gateCaptureSubmission(context, { type: 'issue', number: 29 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('github.server-error');
  });
});
