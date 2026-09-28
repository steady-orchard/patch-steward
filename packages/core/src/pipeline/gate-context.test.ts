import { describe, expect, it } from 'vitest';

import { submissionRecordSchema } from '../records/submission.js';
import type { SubmissionRecord } from '../records/submission.js';
import type { MetricsEventRecord } from '../records/metrics-event.js';
import { canonicalJson } from '../canonical-json.js';
import {
  classificationRecord,
  decodeClosureContext,
  decodeGateContext,
  decodeHandoffBytes,
  encodeClosureContext,
  encodeGateContext,
  gateContextClassification,
} from './gate-context.js';
import type { ClosureContextRecord, GateContextRecord, HostedRunExpectation } from './gate-context.js';

function makeSubmission(overrides: Partial<SubmissionRecord> = {}): SubmissionRecord {
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
    fields: { category: 'bugfix' },
    linked_evidence_hashes: [],
    author_responses: [],
    shared_head_pull_requests: [],
    contract_results: [],
    trusted_paths_changed: false,
    execution_sensitive_paths_changed: false,
    template: { form: 'pull_request', version: 1 },
    attachments: [],
    claim_scope_hash: null,
    ...overrides,
  });
}

function makeGateContext(overrides: Partial<GateContextRecord> = {}): GateContextRecord {
  const submission = overrides.submission ?? makeSubmission();
  return {
    schema_version: 1,
    record_type: 'gate-context',
    run: { run_id: 36081628326, run_attempt: 1 },
    repository: { full_name: 'octo/demo', id: 700001, default_branch: 'main' },
    subject: { type: 'pull_request', number: 12 },
    disposition: 'runnable',
    snapshot_hash: submission.snapshot_hash,
    policy: { revision: 'b'.repeat(40), commit: 'a'.repeat(40), ref: 'main', loaded_at: '2026-09-28T10:00:01.000Z' },
    store: { type: 'orphan-branch', repository: 'octo/demo', branch: 'steward-evidence' },
    submission,
    base_commit: 'd'.repeat(40),
    mode: 'observe',
    classification: { type: 'pull_request', category: 'bugfix', consistent: true, plausible: ['bugfix'] },
    required_stages: ['references', 'claim'],
    cap: { state: 'within', daily_count: 3, daily_limit: 50, author_count: 1, author_limit: 2 },
    github_requests: 12,
    started_at: '2026-09-28T10:00:00.000Z',
    completed_at: '2026-09-28T10:00:04.000Z',
    log_lines: ['disposition runnable'],
    ...overrides,
  } as GateContextRecord;
}

function makeClosureEvent(overrides: Partial<MetricsEventRecord> = {}): MetricsEventRecord {
  return {
    schema_version: 1,
    record_type: 'metrics-event',
    subject: { kind: 'submission', repository: 'octo/demo', type: 'pull_request', number: 12 },
    recorded_at: '2026-09-28T10:00:03.000Z',
    kind: 'maintainer-resolution',
    payload: {
      action_kind: 'resolution',
      dismissal_code: null,
      resolution: 'merged',
      paired_run: { run_id: 36081628000, run_attempt: 1 },
      paired_snapshot_hash: 'sha256:' + '5'.repeat(64),
    },
    ...overrides,
  } as MetricsEventRecord;
}

function makeClosureContext(overrides: Partial<ClosureContextRecord> = {}): ClosureContextRecord {
  return {
    schema_version: 1,
    record_type: 'closure',
    run: { run_id: 36081628326, run_attempt: 1 },
    repository: { full_name: 'octo/demo', id: 700001, default_branch: 'main' },
    subject: { type: 'pull_request', number: 12 },
    policy: { revision: 'b'.repeat(40), commit: 'a'.repeat(40), ref: 'main', loaded_at: '2026-09-28T10:00:01.000Z' },
    store: { type: 'orphan-branch', repository: 'octo/demo', branch: 'steward-evidence' },
    github_requests_remaining: 280,
    event: makeClosureEvent(),
    ...overrides,
  } as ClosureContextRecord;
}

const expectation: HostedRunExpectation = { runId: 36081628326, maxAttempt: 1, repository: 'octo/demo', repositoryId: 700001 };

describe('same-run records', () => {
  it('a gate context round-trips through canonical bytes', () => {
    const record = makeGateContext();
    const encoded = encodeGateContext(record);
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;
    const decoded = decodeGateContext(encoded.value, expectation);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.value).toEqual(record);
  });

  it('gate context bytes are canonical json', () => {
    const record = makeGateContext();
    const encoded = encodeGateContext(record);
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;
    const text = new TextDecoder().decode(encoded.value);
    const canonical = canonicalJson(record);
    expect(canonical.ok).toBe(true);
    if (!canonical.ok) return;
    expect(text).toBe(canonical.value);
    expect(text.endsWith('\n')).toBe(false);
  });

  it('a gate context must match its submission record', () => {
    const record = makeGateContext({ snapshot_hash: 'sha256:' + '6'.repeat(64) });
    const encoded = encodeGateContext(record);
    expect(encoded.ok).toBe(false);
    if (encoded.ok) return;
    expect(encoded.failure.code).toBe('pipeline.handoff-invalid');
  });

  it('cap presence follows the disposition', () => {
    const cap = { state: 'within' as const, daily_count: 3, daily_limit: 50, author_count: 1, author_limit: 2 };
    expect(encodeGateContext(makeGateContext({ disposition: 'early-exit', cap })).ok).toBe(false);
    expect(encodeGateContext(makeGateContext({ disposition: 'runnable', cap: null })).ok).toBe(false);
    expect(encodeGateContext(makeGateContext({ disposition: 'queued', cap })).ok).toBe(false);
    expect(
      encodeGateContext(
        makeGateContext({
          disposition: 'runnable',
          cap: { state: 'daily-runs', daily_count: 51, daily_limit: 50, author_count: 1, author_limit: 2 },
        }),
      ).ok,
    ).toBe(false);
    expect(encodeGateContext(makeGateContext({ disposition: 'early-exit', cap: null })).ok).toBe(true);
    expect(
      encodeGateContext(
        makeGateContext({
          disposition: 'queued',
          cap: { state: 'daily-runs', daily_count: 51, daily_limit: 50, author_count: 1, author_limit: 2 },
        }),
      ).ok,
    ).toBe(true);
  });

  it('an orphan-branch store must be the target repository', () => {
    const bad = makeGateContext({ store: { type: 'orphan-branch', repository: 'octo/other', branch: 'steward-evidence' } });
    expect(encodeGateContext(bad).ok).toBe(false);
    const good = makeGateContext({ store: { type: 'repository', repository: 'octo/evidence', branch: 'steward-evidence' } });
    expect(encodeGateContext(good).ok).toBe(true);
  });

  it('decoding rejects oversize, malformed, and invalid bytes', () => {
    const oversize = decodeGateContext(Buffer.alloc(8388609), expectation);
    expect(oversize.ok).toBe(false);
    if (!oversize.ok) expect(oversize.failure.details[0]?.path).toBe('size');

    const malformed = decodeGateContext(new Uint8Array([0xff, 0xfe]), expectation);
    expect(malformed.ok).toBe(false);
    if (!malformed.ok) expect(malformed.failure.details[0]?.path).toBe('encoding');

    const badJson = decodeGateContext(new TextEncoder().encode('{'), expectation);
    expect(badJson.ok).toBe(false);
    if (!badJson.ok) expect(badJson.failure.details[0]?.path).toBe('json');

    const badSchema = decodeGateContext(new TextEncoder().encode('{}'), expectation);
    expect(badSchema.ok).toBe(false);
    if (!badSchema.ok) expect(badSchema.failure.details[0]?.path).toBe('schema');

    for (const result of [oversize, malformed, badJson, badSchema]) {
      expect(!result.ok && result.failure.code === 'pipeline.handoff-invalid').toBe(true);
    }
  });

  it('decoding binds run, attempt, and repository', () => {
    const record = makeGateContext();
    const encoded = encodeGateContext(record);
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;

    const badRun = decodeGateContext(encoded.value, { ...expectation, runId: 1 });
    expect(badRun.ok).toBe(false);
    if (!badRun.ok) {
      expect(badRun.failure.code).toBe('pipeline.handoff-binding');
      expect(badRun.failure.details[0]?.path).toBe('run');
    }

    const attemptRecord = makeGateContext({ run: { run_id: 36081628326, run_attempt: 2 } });
    const attemptEncoded = encodeGateContext(attemptRecord);
    expect(attemptEncoded.ok).toBe(true);
    if (!attemptEncoded.ok) return;

    const attemptTooHigh = decodeGateContext(attemptEncoded.value, { ...expectation, maxAttempt: 1 });
    expect(attemptTooHigh.ok).toBe(false);
    if (!attemptTooHigh.ok) expect(attemptTooHigh.failure.details[0]?.path).toBe('attempt');

    const attemptOk = decodeGateContext(attemptEncoded.value, { ...expectation, maxAttempt: 3 });
    expect(attemptOk.ok).toBe(true);

    const badRepository = decodeGateContext(encoded.value, { ...expectation, repositoryId: 700002 });
    expect(badRepository.ok).toBe(false);
    if (!badRepository.ok) expect(badRepository.failure.details[0]?.path).toBe('repository');
  });

  it('a closure record round-trips and binds its event', () => {
    const record = makeClosureContext();
    const encoded = encodeClosureContext(record);
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;

    const decoded = decodeClosureContext(encoded.value, expectation);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.value).toEqual(record);

    const badRun = decodeClosureContext(encoded.value, { ...expectation, runId: 1 });
    expect(badRun.ok).toBe(false);
    if (!badRun.ok) expect(badRun.failure.details[0]?.path).toBe('run');
  });

  it('a closure event for another submission is invalid', () => {
    const badNumber = makeClosureContext({
      event: makeClosureEvent({ subject: { kind: 'submission', repository: 'octo/demo', type: 'pull_request', number: 13 } }),
    });
    expect(encodeClosureContext(badNumber).ok).toBe(false);

    const badKind = makeClosureContext({
      event: {
        schema_version: 1,
        record_type: 'metrics-event',
        subject: { kind: 'submission', repository: 'octo/demo', type: 'pull_request', number: 12 },
        recorded_at: '2026-09-28T10:00:03.000Z',
        kind: 'latency',
        payload: { stage: 'references', seconds: 1 },
      } as unknown as MetricsEventRecord,
    });
    expect(encodeClosureContext(badKind).ok).toBe(false);
  });

  it('handoff bytes decode to json or fail as invalid', () => {
    const good = decodeHandoffBytes(new TextEncoder().encode('{"a":1}'));
    expect(good.ok).toBe(true);
    if (good.ok) expect(good.value).toEqual({ a: 1 });

    const bad = decodeHandoffBytes(new TextEncoder().encode('x'));
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.failure.code).toBe('pipeline.handoff-invalid');
      expect(bad.failure.details[0]?.path).toBe('json');
    }
  });

  it('classification converts between record and report input', () => {
    const issueInput = { type: 'issue' as const, issueKind: 'defect' as const };
    expect(gateContextClassification({ ...makeGateContext(), classification: classificationRecord(issueInput) })).toEqual(
      issueInput,
    );

    const prInput = {
      type: 'pull_request' as const,
      category: 'bugfix' as const,
      consistent: true,
      plausible: ['bugfix' as const],
    };
    expect(gateContextClassification({ ...makeGateContext(), classification: classificationRecord(prInput) })).toEqual(prInput);
  });
});
