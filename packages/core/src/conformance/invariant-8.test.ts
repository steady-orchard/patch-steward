import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildIssueSnapshot, buildPullRequestSnapshot, snapshotHash } from '../index.js';
import type { IssueSnapshotInput, PullRequestSnapshotInput } from '../index.js';
import { fixedClock, fixedRandom } from '../clock.js';
import { decideOutcome } from '../decision/table.js';
import type { GitHubFetch } from '../github/client.js';
import type { GitHubRepositoryRef } from '../github/reader.js';
import { localFileRevisionId } from '../hash.js';
import type { AttachmentAddress, AttachmentResolver, AttachmentTransport } from '../net/attachment-fetch.js';
import { initialBudget } from '../pipeline/budget.js';
import { handoffRecordSchema, validateHandoff } from '../pipeline/handoff.js';
import type { HandoffRecord } from '../pipeline/handoff.js';
import { LOCAL_PHASES } from '../pipeline/phases.js';
import { localDecisionInput } from '../pipeline/publish-phase.js';
import { screenSubmission } from '../pipeline/screen.js';
import type { ScreenResult } from '../pipeline/screen.js';
import { runPhaseSequence } from '../pipeline/sequence.js';
import { ok } from '../result.js';
import { DEFAULT_CHECKLIST_POLICY } from '../submission/default-checklist.js';

function buildAndHash<Input extends IssueSnapshotInput | PullRequestSnapshotInput>(
  build: (input: Input) => { ok: boolean; value?: unknown },
  input: Input,
): { snapshot: Record<string, unknown>; hash: string } {
  const built = build(input) as { ok: boolean; value?: Record<string, unknown> };
  if (!built.ok || built.value === undefined) {
    throw new Error('expected snapshot build to succeed');
  }
  const hashed = snapshotHash(built.value as never) as { ok: boolean; value?: { toString(): string } };
  if (!hashed.ok || hashed.value === undefined) {
    throw new Error('expected snapshot hash to succeed');
  }
  return { snapshot: built.value, hash: String(hashed.value) };
}

const basePullRequestInput: PullRequestSnapshotInput = {
  repository: 'steady-orchard/patch-steward-testbed-public',
  number: 26,
  title: 'Fix empty input',
  body: 'Body text.',
  targetBranch: 'master',
  headCommit: 'a'.repeat(40),
  baseCommit: 'b'.repeat(40),
  linkedIssues: [
    { repository: 'steady-orchard/patch-steward-testbed-public', number: 29, contentHash: `sha256:${'1'.repeat(64)}` },
  ],
  attachments: [{ url: 'https://github.com/user-attachments/files/1/case.txt', contentHash: `sha256:${'2'.repeat(64)}` }],
  authorResponses: [{ requestId: 'request-1', commentId: 5825050006, contentHash: `sha256:${'3'.repeat(64)}` }],
  sharedHeadPullRequests: [27],
  policyRevision: 'c'.repeat(40),
};

const baseIssueInput: IssueSnapshotInput = {
  repository: 'steady-orchard/patch-steward-testbed-public',
  number: 29,
  title: 'Reproduce empty input crash',
  body: 'Body text.',
  attachments: [{ url: 'https://github.com/user-attachments/files/1/case.txt', contentHash: `sha256:${'2'.repeat(64)}` }],
  authorResponses: [{ requestId: 'request-1', commentId: 5825050006, contentHash: `sha256:${'3'.repeat(64)}` }],
  policyRevision: 'c'.repeat(40),
};

function pr(overrides: Partial<PullRequestSnapshotInput>): PullRequestSnapshotInput {
  return { ...basePullRequestInput, ...overrides };
}

function issue(overrides: Partial<IssueSnapshotInput>): IssueSnapshotInput {
  return { ...baseIssueInput, ...overrides };
}

describe('invariant 8: snapshot hash stability', () => {
  it('snapshot hash is stable under title-only edits', () => {
    const original = buildAndHash(buildPullRequestSnapshot, basePullRequestInput);
    const retitled = buildAndHash(buildPullRequestSnapshot, pr({ title: 'Fix empty input (updated)' }));
    expect(retitled.hash).toBe(original.hash);
    expect(retitled.snapshot).toEqual(original.snapshot);
    expect(retitled.snapshot).not.toHaveProperty('title');

    const originalIssue = buildAndHash(buildIssueSnapshot, baseIssueInput);
    const retitledIssue = buildAndHash(buildIssueSnapshot, issue({ title: 'Reproduce empty input crash (updated)' }));
    expect(retitledIssue.hash).toBe(originalIssue.hash);
    expect(retitledIssue.snapshot).toEqual(originalIssue.snapshot);
    expect(retitledIssue.snapshot).not.toHaveProperty('title');
  });

  it('snapshot hash changes with repository', () => {
    const original = buildAndHash(buildPullRequestSnapshot, basePullRequestInput);
    const changed = buildAndHash(
      buildPullRequestSnapshot,
      pr({
        repository: 'steady-orchard/other-repo',
        linkedIssues: [{ repository: 'steady-orchard/other-repo', number: 29, contentHash: `sha256:${'1'.repeat(64)}` }],
      }),
    );
    expect(changed.hash).not.toBe(original.hash);
  });

  it('snapshot hash changes with number', () => {
    const original = buildAndHash(buildPullRequestSnapshot, basePullRequestInput);
    const changed = buildAndHash(buildPullRequestSnapshot, pr({ number: 30 }));
    expect(changed.hash).not.toBe(original.hash);
  });

  it('snapshot hash changes with target branch', () => {
    const original = buildAndHash(buildPullRequestSnapshot, basePullRequestInput);
    const changed = buildAndHash(buildPullRequestSnapshot, pr({ targetBranch: 'develop' }));
    expect(changed.hash).not.toBe(original.hash);
  });

  it('snapshot hash changes with head commit', () => {
    const original = buildAndHash(buildPullRequestSnapshot, basePullRequestInput);
    const changed = buildAndHash(buildPullRequestSnapshot, pr({ headCommit: 'f'.repeat(40) }));
    expect(changed.hash).not.toBe(original.hash);
  });

  it('snapshot hash changes with body', () => {
    const original = buildAndHash(buildPullRequestSnapshot, basePullRequestInput);
    const changed = buildAndHash(buildPullRequestSnapshot, pr({ body: 'Different body text.' }));
    expect(changed.hash).not.toBe(original.hash);
  });

  it('snapshot hash changes with linked issue content', () => {
    const original = buildAndHash(buildPullRequestSnapshot, basePullRequestInput);
    const changed = buildAndHash(
      buildPullRequestSnapshot,
      pr({
        linkedIssues: [
          { repository: 'steady-orchard/patch-steward-testbed-public', number: 29, contentHash: `sha256:${'4'.repeat(64)}` },
        ],
      }),
    );
    expect(changed.hash).not.toBe(original.hash);
  });

  it('snapshot hash changes with attachment bytes', () => {
    const original = buildAndHash(buildPullRequestSnapshot, basePullRequestInput);
    const changed = buildAndHash(
      buildPullRequestSnapshot,
      pr({
        attachments: [{ url: 'https://github.com/user-attachments/files/1/case.txt', contentHash: `sha256:${'5'.repeat(64)}` }],
      }),
    );
    expect(changed.hash).not.toBe(original.hash);
  });

  it('snapshot hash changes with author response', () => {
    const original = buildAndHash(buildPullRequestSnapshot, basePullRequestInput);
    const changed = buildAndHash(
      buildPullRequestSnapshot,
      pr({ authorResponses: [{ requestId: 'request-1', commentId: 5825050006, contentHash: `sha256:${'6'.repeat(64)}` }] }),
    );
    expect(changed.hash).not.toBe(original.hash);
  });

  it('snapshot hash changes with shared-head set', () => {
    const original = buildAndHash(buildPullRequestSnapshot, basePullRequestInput);
    const changed = buildAndHash(buildPullRequestSnapshot, pr({ sharedHeadPullRequests: [27, 31] }));
    expect(changed.hash).not.toBe(original.hash);
  });

  it('snapshot hash changes with policy revision', () => {
    const original = buildAndHash(buildPullRequestSnapshot, basePullRequestInput);
    const changed = buildAndHash(buildPullRequestSnapshot, pr({ policyRevision: 'd'.repeat(40) }));
    expect(changed.hash).not.toBe(original.hash);
  });

  it('snapshot hash changes with issue content', () => {
    const original = buildAndHash(buildIssueSnapshot, baseIssueInput);
    const changed = buildAndHash(buildIssueSnapshot, issue({ body: 'Different body text.' }));
    expect(changed.hash).not.toBe(original.hash);
  });

  it('snapshot hash changes with issue attachment bytes', () => {
    const original = buildAndHash(buildIssueSnapshot, baseIssueInput);
    const changed = buildAndHash(
      buildIssueSnapshot,
      issue({
        attachments: [{ url: 'https://github.com/user-attachments/files/1/case.txt', contentHash: `sha256:${'7'.repeat(64)}` }],
      }),
    );
    expect(changed.hash).not.toBe(original.hash);
  });

  it('snapshot hash changes with issue author response', () => {
    const original = buildAndHash(buildIssueSnapshot, baseIssueInput);
    const changed = buildAndHash(
      buildIssueSnapshot,
      issue({ authorResponses: [{ requestId: 'request-1', commentId: 5825050006, contentHash: `sha256:${'8'.repeat(64)}` }] }),
    );
    expect(changed.hash).not.toBe(original.hash);
  });

  it('snapshot hash changes with issue policy revision', () => {
    const original = buildAndHash(buildIssueSnapshot, baseIssueInput);
    const changed = buildAndHash(buildIssueSnapshot, issue({ policyRevision: 'd'.repeat(40) }));
    expect(changed.hash).not.toBe(original.hash);
  });

  it('snapshot hash is unchanged by the base commit', () => {
    const first = buildAndHash(buildPullRequestSnapshot, basePullRequestInput);
    const second = buildAndHash(buildPullRequestSnapshot, pr({ baseCommit: 'e'.repeat(40) }));
    expect(second.hash).toBe(first.hash);
    expect(first.snapshot['base_commit']).toBe(basePullRequestInput.baseCommit);
    expect(second.snapshot['base_commit']).toBe('e'.repeat(40));
  });

  it('snapshot hash is unchanged by the trusted commit', () => {
    type TrustedKey = Extract<
      keyof PullRequestSnapshotInput | keyof IssueSnapshotInput,
      'trustedCommit' | 'trusted_commit' | 'policyCommit'
    >;
    const noTrustedKey: [TrustedKey] extends [never] ? true : false = true;
    expect(noTrustedKey).toBe(true);

    const revisionA = { kind: 'git-tree' as const, id: 'c'.repeat(40), commit: 'd'.repeat(40), ref: 'master' };
    const revisionB = { kind: 'git-tree' as const, id: 'c'.repeat(40), commit: 'e'.repeat(40), ref: 'master' };

    const first = buildAndHash(buildPullRequestSnapshot, pr({ policyRevision: revisionA.id }));
    const second = buildAndHash(buildPullRequestSnapshot, pr({ policyRevision: revisionB.id }));
    expect(second.hash).toBe(first.hash);
    expect(JSON.stringify(first.snapshot)).not.toContain(revisionA.commit);
    expect(JSON.stringify(first.snapshot)).not.toContain(revisionB.commit);
  });
});

describe('invariant 8: local run binding', { timeout: 60000 }, () => {
  const REPOSITORY: GitHubRepositoryRef = { owner: 'octo', name: 'demo' };
  const BASE = '/repos/octo/demo';
  const CLOCK = fixedClock('2026-09-27T10:15:00.000Z');
  const RANDOM = fixedRandom('3f9a1c2e');

  function policyPath(): string {
    return fileURLToPath(new URL('../../../../fixtures/policies/valid/minimal-no-llm.yml', import.meta.url));
  }

  function readTextFixture(relPath: string): string {
    return readFileSync(new URL(`../../../../fixtures/${relPath}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  }

  function makeFetch(): GitHubFetch {
    const body = readTextFixture('submissions/pr-bugfix-complete.txt');
    const routes: Record<string, unknown> = {
      [BASE]: { full_name: 'octo/demo', default_branch: 'main', private: false },
      [`${BASE}/pulls/40`]: {
        number: 40,
        title: 'pr title',
        body,
        state: 'open',
        draft: false,
        head: { sha: 'a'.repeat(40), ref: 'feature' },
        base: { sha: 'b'.repeat(40), ref: 'main' },
        user: { login: 'someone', id: 1, type: 'User' },
        author_association: 'NONE',
        changed_files: 1,
      },
      [`${BASE}/pulls/40/files`]: [{ filename: 'src/parse.ts', status: 'modified' }],
      [`${BASE}/issues/29`]: {
        number: 29,
        title: 't',
        body: 'The parser crashes on empty input.',
        state: 'open',
        user: null,
        author_association: 'NONE',
      },
      [`${BASE}/commits/${'a'.repeat(40)}/pulls`]: [],
    };
    return (url: string) => {
      const pathname = new URL(url).pathname;
      if (!(pathname in routes)) {
        return Promise.resolve(new Response('{}', { status: 404 }));
      }
      return Promise.resolve(new Response(JSON.stringify(routes[pathname]), { status: 200 }));
    };
  }

  function fakeResolver(): AttachmentResolver {
    return async (): Promise<readonly AttachmentAddress[]> => [{ address: '140.82.112.3', family: 4 }];
  }

  function fakeTransport(): AttachmentTransport {
    return async () => ({ kind: 'error' as const, reason: 'network' as const });
  }

  const G: HandoffRecord = handoffRecordSchema.parse({
    handoff_version: 1,
    phase: 'gate',
    run: { run_id: 'local-20260927T101500Z-3f9a1c2e', run_attempt: 1 },
    snapshot_hash: 'sha256:' + '5'.repeat(64),
    policy_revision: 'b'.repeat(40),
    round: 0,
    budget_remaining: initialBudget(DEFAULT_CHECKLIST_POLICY, { githubRequests: 5 }),
    early_exit: null,
    findings: [],
    causes: [],
    stage_results: [],
    next_round_plan: null,
  });
  const I: HandoffRecord = { ...G, phase: 'intake' };

  let evidenceDir: string;
  let published: Extract<ScreenResult, { readonly kind: 'completed' }>['published'];

  beforeAll(async () => {
    evidenceDir = mkdtempSync(join(tmpdir(), 'm5-inv8-'));
    const result = await screenSubmission({
      repository: REPOSITORY,
      submission: { type: 'pull_request', number: 40 },
      policySource: { kind: 'local-file', path: policyPath() },
      token: null,
      evidenceDir,
      fetch: makeFetch(),
      sleep: async () => undefined,
      attachmentResolver: fakeResolver(),
      attachmentTransport: fakeTransport(),
      clock: CLOCK,
      random: RANDOM,
    });
    expect(result.kind).toBe('completed');
    if (result.kind !== 'completed') {
      throw new Error('expected screenSubmission to complete');
    }
    published = result.published;
  });

  afterAll(() => {
    rmSync(evidenceDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it('invariant 8: handoffs bind run, attempt, snapshot, revision, and round', async () => {
    const mutations: readonly Partial<HandoffRecord>[] = [
      { run: { run_id: 'local-20260927T101500Z-00000000', run_attempt: I.run.run_attempt } },
      { run: { run_id: I.run.run_id, run_attempt: 2 } },
      { snapshot_hash: 'sha256:' + '6'.repeat(64) },
      { policy_revision: 'c'.repeat(40) },
      { round: 1 },
    ];

    for (const mutation of mutations) {
      const mutated: HandoffRecord = { ...I, ...mutation };

      const validated = validateHandoff(mutated, { previous: G, gate: G, maxRounds: 2 });
      expect(validated.ok).toBe(false);
      if (!validated.ok) {
        expect(validated.failure.code).toBe('pipeline.handoff-binding');
      }

      const result = await runPhaseSequence({
        gate: G,
        maxRounds: 2,
        timeoutMs: 1000,
        policy: DEFAULT_CHECKLIST_POLICY,
        phases: { ...LOCAL_PHASES, intake: async () => ok(mutated) },
        clock: fixedClock('2026-09-27T10:15:00.000Z'),
      });

      expect(result.last).toEqual(G);
      expect(result.causes[0]?.code).toBe('pipeline.handoff-binding');
      const decision = decideOutcome(localDecisionInput(result.last, result.causes, [], []));
      expect(decision.kind).toBe('outcome');
      if (decision.kind === 'outcome') {
        expect(decision.outcome).toBe('inconclusive');
      }
    }
  });

  it('invariant 8: report bound identifiers equal the gate snapshot and the stored submission record', () => {
    const runRecord = JSON.parse(readFileSync(join(published.directory, 'run.json'), 'utf8')) as {
      readonly commits: { readonly base: string | null };
      readonly policy_revision: string;
    };
    const submissionRecord = JSON.parse(readFileSync(join(published.directory, 'submission.json'), 'utf8')) as {
      readonly snapshot_hash: string;
      readonly head_commit: string | null;
      readonly snapshot?: { readonly head_commit?: string; readonly base_commit?: string; readonly policy_revision?: string };
    };
    const reportRecord = JSON.parse(readFileSync(join(published.directory, 'report.json'), 'utf8')) as {
      readonly bound: {
        readonly snapshot_hash: string;
        readonly head_commit: string | null;
        readonly base_commit: string | null;
        readonly policy_revision: string;
      };
    };

    expect(submissionRecord.snapshot).toBeDefined();
    const snapshot = submissionRecord.snapshot as NonNullable<typeof submissionRecord.snapshot>;
    const computedHash = snapshotHash(snapshot as never) as { readonly ok: boolean; readonly value?: unknown };
    expect(computedHash.ok).toBe(true);

    expect(reportRecord.bound.snapshot_hash).toBe(submissionRecord.snapshot_hash);
    expect(submissionRecord.snapshot_hash).toBe(String(computedHash.value));
    expect(String(computedHash.value)).toBe(published.submission.snapshot_hash);

    expect(reportRecord.bound.head_commit).toBe(submissionRecord.head_commit);
    expect(submissionRecord.head_commit).toBe(snapshot.head_commit);
    expect(snapshot.head_commit).toBe('a'.repeat(40));

    expect(reportRecord.bound.base_commit).toBe(submissionRecord.snapshot?.base_commit);
    expect(submissionRecord.snapshot?.base_commit).toBe(runRecord.commits.base);
    expect(runRecord.commits.base).toBe('b'.repeat(40));

    expect(reportRecord.bound.policy_revision).toBe(runRecord.policy_revision);
    expect(runRecord.policy_revision).toBe(snapshot.policy_revision);
  });

  it('invariant 8: a local-policy run binds the same local revision everywhere', () => {
    const expected = localFileRevisionId(readFileSync(policyPath()));
    expect(expected.startsWith('local:')).toBe(true);

    const submissionRecord = JSON.parse(readFileSync(join(published.directory, 'submission.json'), 'utf8')) as {
      readonly snapshot?: { readonly policy_revision?: string };
    };
    const runRecord = JSON.parse(readFileSync(join(published.directory, 'run.json'), 'utf8')) as {
      readonly policy_revision: string;
    };
    const reportRecord = JSON.parse(readFileSync(join(published.directory, 'report.json'), 'utf8')) as {
      readonly bound: { readonly policy_revision: string };
    };
    const policyRevisionRecord = JSON.parse(readFileSync(join(published.directory, 'policy-revision.json'), 'utf8')) as {
      readonly revision: { readonly id: string };
      readonly authoritative: boolean;
    };

    expect(submissionRecord.snapshot?.policy_revision).toBe(expected);
    expect(runRecord.policy_revision).toBe(expected);
    expect(reportRecord.bound.policy_revision).toBe(expected);
    expect(policyRevisionRecord.revision.id).toBe(expected);
    expect(policyRevisionRecord.authoritative).toBe(false);
  });
});
