import { describe, it, expect } from 'vitest';

import { canonicalJson } from '../canonical-json.js';
import { OWNERSHIP_RECORD_MAX_BYTES } from '../policy/bounds.js';
import {
  ownershipArtifactName,
  encodeOwnershipRecord,
  decodeOwnershipRecord,
  type OwnershipRecord,
  type OwnershipArtifactExpectation,
} from './record.js';

const SNAPSHOT_HASH = `sha256:${'a'.repeat(64)}`;
const POLICY_REVISION = 'b'.repeat(40);
const REPOSITORY = 'steady-orchard/patch-steward-testbed-public';

function approvedRecord(): OwnershipRecord {
  return {
    schema_version: 1,
    record_type: 'ownership',
    repository: REPOSITORY,
    subject: { type: 'pull_request', number: 12 },
    run_id: 36081628326,
    run_attempt: 1,
    check_id: null,
    snapshot_hash: SNAPSHOT_HASH,
    policy_revision: POLICY_REVISION,
    disposition: 'runnable',
    admission: 'not-required',
    cap: { state: 'within', daily_count: 3, daily_limit: 50, author_count: 1, author_limit: 2 },
    event: {
      name: 'pull_request_target',
      action: 'edited',
      object_id: 2345678901,
      object_updated_at: '2026-09-28T10:00:00Z',
      sender_id: 2095171,
      sender_type: 'User',
    },
    author_id: 2095171,
    created_at: '2026-09-28T10:00:05.123Z',
  };
}

function expectationFor(record: OwnershipRecord, workflowRunId: number | null = null): OwnershipArtifactExpectation {
  return {
    repository: record.repository,
    type: record.subject.type,
    number: record.subject.number,
    artifactName: ownershipArtifactName(record.subject.type, record.subject.number),
    workflowRunId,
  };
}

function assertInvalid(result: { ok: boolean; failure?: { code: string; outcome: string } }, path?: string): void {
  expect(result.ok).toBe(false);
  if (!result.ok) {
    const failure = result as unknown as {
      failure: { code: string; outcome: string; details: readonly { path: string }[] };
    };
    expect(failure.failure.code).toBe('ownership.record-invalid');
    expect(failure.failure.outcome).toBe('inconclusive');
    if (path !== undefined) {
      expect(failure.failure.details[0]?.path).toBe(path);
    }
  }
}

describe('ownership record', () => {
  it('ownership record accepts the approved example', () => {
    const record = approvedRecord();
    const encoded = encodeOwnershipRecord(record);
    expect(encoded.ok).toBe(true);
  });

  it('ownership artifact names follow the approved pattern', () => {
    expect(ownershipArtifactName('pull_request', 12)).toBe('steward-ownership-pr-12');
    expect(ownershipArtifactName('issue', 7)).toBe('steward-ownership-issue-7');
    expect(() => ownershipArtifactName('issue', 0)).toThrow(RangeError);
    expect(() => ownershipArtifactName('issue', -1)).toThrow(RangeError);
    expect(() => ownershipArtifactName('issue', 1.5)).toThrow(RangeError);
  });

  it('ownership records encode as canonical JSON within the bound', () => {
    const record = approvedRecord();
    const encoded = encodeOwnershipRecord(record);
    if (!encoded.ok) throw new Error('expected encode to succeed');
    const text = new TextDecoder('utf-8').decode(encoded.value);
    const canonical = canonicalJson(record);
    if (!canonical.ok) throw new Error('expected canonicalJson to succeed');
    expect(text).toBe(canonical.value);
    expect(encoded.value.length).toBeLessThanOrEqual(OWNERSHIP_RECORD_MAX_BYTES);

    const decoded = decodeOwnershipRecord(encoded.value, expectationFor(record, record.run_id));
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.value).toEqual(record);
    }
  });

  it('ownership records decode after download', () => {
    const record = approvedRecord();
    const encoded = encodeOwnershipRecord(record);
    if (!encoded.ok) throw new Error('expected encode to succeed');
    const decoded = decodeOwnershipRecord(encoded.value, expectationFor(record));
    expect(decoded.ok).toBe(true);
  });

  it('decoding rejects oversized bytes', () => {
    const record = approvedRecord();
    const bytes = new TextEncoder().encode(' '.repeat(OWNERSHIP_RECORD_MAX_BYTES + 1));
    const result = decodeOwnershipRecord(bytes, expectationFor(record));
    assertInvalid(result, 'size');
  });

  it('decoding rejects malformed JSON', () => {
    const record = approvedRecord();
    const bytes = new TextEncoder().encode('{not json');
    const result = decodeOwnershipRecord(bytes, expectationFor(record));
    assertInvalid(result, 'json');
  });

  it('decoding rejects unknown keys', () => {
    const record = approvedRecord();
    const withExtra = { ...record, extra_key: true };
    const bytes = new TextEncoder().encode(JSON.stringify(withExtra));
    const result = decodeOwnershipRecord(bytes, expectationFor(record));
    assertInvalid(result, 'schema');
  });

  it('decoding rejects a record for another repository', () => {
    const record = approvedRecord();
    const encoded = encodeOwnershipRecord(record);
    if (!encoded.ok) throw new Error('expected encode to succeed');
    const expectation = { ...expectationFor(record), repository: 'other-org/other-repo' };
    const result = decodeOwnershipRecord(encoded.value, expectation);
    assertInvalid(result, 'repository');
  });

  it('decoding rejects a record for another subject', () => {
    const record = approvedRecord();
    const encoded = encodeOwnershipRecord(record);
    if (!encoded.ok) throw new Error('expected encode to succeed');

    const otherNumberExpectation: OwnershipArtifactExpectation = {
      ...expectationFor(record),
      number: 13,
      artifactName: ownershipArtifactName('pull_request', 13),
    };
    assertInvalid(decodeOwnershipRecord(encoded.value, otherNumberExpectation), 'name');

    const otherTypeExpectation: OwnershipArtifactExpectation = {
      ...expectationFor(record),
      type: 'issue',
      artifactName: ownershipArtifactName('issue', record.subject.number),
    };
    assertInvalid(decodeOwnershipRecord(encoded.value, otherTypeExpectation), 'name');
  });

  it('decoding rejects a record from another workflow run', () => {
    const record = approvedRecord();
    const encoded = encodeOwnershipRecord(record);
    if (!encoded.ok) throw new Error('expected encode to succeed');

    const differentRun = decodeOwnershipRecord(encoded.value, expectationFor(record, record.run_id + 1));
    assertInvalid(differentRun, 'run');

    const nullRun = decodeOwnershipRecord(encoded.value, expectationFor(record, null));
    expect(nullRun.ok).toBe(true);
  });

  it('early exits carry no cap evaluation', () => {
    const record: OwnershipRecord = { ...approvedRecord(), disposition: 'early-exit', cap: null };
    expect(encodeOwnershipRecord(record).ok).toBe(true);

    const withCap: OwnershipRecord = { ...approvedRecord(), disposition: 'early-exit' };
    assertInvalid(encodeOwnershipRecord(withCap));
  });

  it('queued records require an exceeded cap', () => {
    const record: OwnershipRecord = {
      ...approvedRecord(),
      disposition: 'queued',
      cap: { state: 'daily-runs', daily_count: 51, daily_limit: 50, author_count: 1, author_limit: 2 },
    };
    expect(encodeOwnershipRecord(record).ok).toBe(true);

    const badQueued: OwnershipRecord = {
      ...approvedRecord(),
      disposition: 'queued',
      cap: { state: 'within', daily_count: 1, daily_limit: 50, author_count: 1, author_limit: 2 },
    };
    assertInvalid(encodeOwnershipRecord(badQueued));
  });

  it('runnable records require a cap within limits', () => {
    const record = approvedRecord();
    expect(encodeOwnershipRecord(record).ok).toBe(true);

    const badRunnable: OwnershipRecord = {
      ...record,
      cap: { state: 'daily-runs', daily_count: 51, daily_limit: 50, author_count: 1, author_limit: 2 },
    };
    assertInvalid(encodeOwnershipRecord(badRunnable));
  });

  it('closure actions are never committed', () => {
    const closed: OwnershipRecord = {
      ...approvedRecord(),
      event: { ...approvedRecord().event, action: 'closed' },
    };
    assertInvalid(encodeOwnershipRecord(closed));

    const deletedIssue: OwnershipRecord = {
      ...approvedRecord(),
      subject: { type: 'issue', number: 12 },
      event: {
        name: 'issues',
        action: 'deleted',
        object_id: 2345678901,
        object_updated_at: '2026-09-28T10:00:00Z',
        sender_id: 2095171,
        sender_type: 'User',
      },
    };
    assertInvalid(encodeOwnershipRecord(deletedIssue));
  });

  it('event names match the subject type', () => {
    const mismatched: OwnershipRecord = {
      ...approvedRecord(),
      event: { ...approvedRecord().event, name: 'issues' },
    };
    assertInvalid(encodeOwnershipRecord(mismatched));
  });
});
