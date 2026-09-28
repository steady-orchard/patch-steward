import { describe, expect, it } from 'vitest';

import { prepareWaitingEvidence } from './prepare-waiting.js';
import type { WaitingEvidenceInput } from './prepare-waiting.js';
import { evidenceManifestSchema } from './manifest.js';
import { waitingRecordSchema } from '../records/waiting.js';
import { metricsEventRecordSchema } from '../records/metrics-event.js';
import { submissionRecordSchema } from '../records/submission.js';
import type { SubmissionRecord } from '../records/submission.js';
import type { LoadedPolicy } from '../policy/loader.js';
import { DEFAULT_CHECKLIST_POLICY } from '../submission/default-checklist.js';
import { z } from 'zod';

const trustedPolicy: LoadedPolicy = {
  revision: { kind: 'git-tree', id: 'b'.repeat(40), commit: 'a'.repeat(40), ref: 'main' },
  policy: DEFAULT_CHECKLIST_POLICY,
  authoritative: true,
};

function makeSubmission(fieldsExtra: Record<string, string> = {}): SubmissionRecord {
  return submissionRecordSchema.parse({
    schema_version: 1,
    record_type: 'submission',
    repository: 'octo/demo',
    type: 'pull_request',
    number: 12,
    snapshot_hash: 'sha256:' + '5'.repeat(64),
    target_branch: 'main',
    head_commit: 'c'.repeat(40),
    issue_kind: null,
    category: 'bugfix',
    fields: { category: 'bugfix', ...fieldsExtra },
    linked_evidence_hashes: [],
    author_responses: [],
    shared_head_pull_requests: [],
    contract_results: [],
    trusted_paths_changed: false,
    execution_sensitive_paths_changed: false,
    template: { form: 'pull_request', version: 1 },
    attachments: [],
    claim_scope_hash: null,
  });
}

function buildInput(overrides: Partial<WaitingEvidenceInput> = {}): WaitingEvidenceInput {
  return {
    runId: 36081628326,
    runAttempt: 1,
    startedAt: '2026-09-28T10:00:00.000Z',
    queuedAt: '2026-09-28T10:00:04.000Z',
    finishedAt: '2026-09-28T10:00:20.000Z',
    phases: [
      { phase: 'gate', seconds: 4, recordedAt: '2026-09-28T10:00:04.000Z' },
      { phase: 'publish', seconds: 6, recordedAt: '2026-09-28T10:00:20.000Z' },
    ],
    stewardVersion: '0.0.2',
    loadedPolicy: trustedPolicy,
    policyLoadedAt: '2026-09-28T10:00:00.000Z',
    submission: makeSubmission(),
    baseCommit: null,
    mode: 'observe',
    githubRequests: 20,
    retries: 0,
    waiting: {
      reason: 'daily-runs',
      counts: { daily_count: 51, daily_limit: 50, author_count: 1, author_limit: 2 },
      arrivalAt: '2026-09-28T10:00:05Z',
    },
    logLines: ['disposition queued'],
    credentials: [],
    ...overrides,
  };
}

function decode(bytes: Uint8Array): unknown {
  return JSON.parse(Buffer.from(bytes).toString('utf8'));
}

describe('waiting evidence', () => {
  it('waiting evidence holds the waiting run files', async () => {
    const result = await prepareWaitingEvidence(buildInput());
    if (!result.ok) throw new Error('expected ok');
    const paths = result.value.files.map((f) => f.path);
    expect(paths).toEqual(['run.json', 'submission.json', 'policy-revision.json', 'waiting.json', 'logs/steward.txt']);
    expect(result.value.storePath).toBe('runs/pr-12/36081628326-1');
    expect(result.value.metrics.path).toBe('metrics/2026-09/36081628326-1.json');
    expect(result.value.manifest.run_kind).toBe('waiting');
    const parsedManifest = evidenceManifestSchema.safeParse(decode(result.value.manifestBytes));
    expect(parsedManifest.success).toBe(true);
    expect(paths).not.toContain('decision.json');
    expect(paths).not.toContain('report.json');
    expect(paths).not.toContain('report.md');
  });

  it('the waiting record carries reason, counts, and arrival', async () => {
    const input = buildInput();
    const result = await prepareWaitingEvidence(input);
    if (!result.ok) throw new Error('expected ok');
    const waitingFile = result.value.files.find((f) => f.path === 'waiting.json')!;
    const parsed = waitingRecordSchema.parse(decode(waitingFile.bytes));
    expect(parsed.reason).toBe('daily-runs');
    expect(parsed.counts).toEqual(input.waiting.counts);
    expect(parsed.arrival_at).toBe('2026-09-28T10:00:05Z');
    expect(parsed.snapshot_hash).toBe(input.submission.snapshot_hash);
    expect(parsed.policy_revision).toBe('b'.repeat(40));
  });

  it('waiting metrics record the queued transition', async () => {
    const result = await prepareWaitingEvidence(buildInput());
    if (!result.ok) throw new Error('expected ok');
    const events = z.array(metricsEventRecordSchema).parse(decode(result.value.metrics.bytes));
    expect(events[0]!.kind).toBe('state-transition');
    expect(events[0]!.payload).toEqual({ from: null, to: 'queued' });
    expect(events[1]!.kind).toBe('latency');
    expect((events[1] as { payload: { stage: string } }).payload.stage).toBe('gate');
    expect(events[2]!.kind).toBe('latency');
    expect((events[2] as { payload: { stage: string } }).payload.stage).toBe('publish');
    expect(events[3]!.kind).toBe('cost');
    for (const event of events) {
      if ('to' in (event.payload as Record<string, unknown>)) {
        expect((event.payload as { to: unknown }).to).toBe('queued');
      }
    }
  });

  it('the waiting run record carries the budget and times', async () => {
    const result = await prepareWaitingEvidence(buildInput());
    if (!result.ok) throw new Error('expected ok');
    expect(result.value.run.run_id).toBe(36081628326);
    expect(result.value.run.run_attempt).toBe(1);
    expect(result.value.run.finished_at).toBe('2026-09-28T10:00:20.000Z');
    expect(result.value.run.budget.github_requests).toBe(20);
  });

  it('waiting evidence redacts credentials', async () => {
    const sentinel = 'ghp' + '_' + 'W'.repeat(36);
    const input = buildInput({ logLines: ['disposition queued', sentinel], credentials: [sentinel] });
    const result = await prepareWaitingEvidence(input);
    if (!result.ok) throw new Error('expected ok');
    for (const file of result.value.files) {
      expect(Buffer.from(file.bytes).toString('utf8')).not.toContain(sentinel);
    }
    expect(Buffer.from(result.value.metrics.bytes).toString('utf8')).not.toContain(sentinel);
    expect(Buffer.from(result.value.manifestBytes).toString('utf8')).not.toContain(sentinel);
    expect(result.value.manifest.redaction.exact_values).toBeGreaterThanOrEqual(1);
  });

  it('waiting evidence over the byte limit is rejected', async () => {
    const policy: LoadedPolicy = {
      ...trustedPolicy,
      policy: {
        ...DEFAULT_CHECKLIST_POLICY,
        limits: {
          ...DEFAULT_CHECKLIST_POLICY.limits,
          evidence: { ...DEFAULT_CHECKLIST_POLICY.limits.evidence, run_bytes: 65536 },
        },
      },
    };
    const submission = makeSubmission({ problem: 'x'.repeat(60000) });
    const result = await prepareWaitingEvidence(buildInput({ loadedPolicy: policy, submission }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('evidence.too-large');
    }
  });

  it('an inconsistent waiting reason fails the record', async () => {
    const input = buildInput({
      waiting: {
        reason: 'daily-runs',
        counts: { daily_count: 3, daily_limit: 50, author_count: 1, author_limit: 2 },
        arrivalAt: '2026-09-28T10:00:05Z',
      },
    });
    const result = await prepareWaitingEvidence(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('evidence.record-invalid');
    }
  });
});
