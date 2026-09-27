import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { findingRecordSchema } from '../records/finding.js';
import { err } from '../result.js';
import { mapStringLeaves, mergeRedactionCounts, redactEvidenceStrings } from './redact-records.js';

const TOKEN = 'ghp_' + 'A1b2C3d4'.repeat(4) + 'E5f6';

function sampleFindingRecord(): unknown {
  return {
    schema_version: 1,
    record_type: 'finding',
    run_id: 'local-20260927T101500Z-3f9a1c2e',
    run_attempt: 1,
    finding_id: 'finding-0001',
    stage: 'contract',
    severity: 'uncertain',
    scenario: 'Execution-sensitive paths changed: `' + TOKEN + '`.',
    location: { path: null, line: null, field: null },
    evidence: [],
    basis: 'Execution-sensitive paths changed.',
    dismissal_code: null,
    code: 'submission.execution-sensitive-change',
    detail: null,
    subjects: ['ok.txt', 'dir/' + TOKEN],
    request_id: null,
  };
}

describe('redactEvidenceStrings', { timeout: 30000 }, () => {
  it('every string value at every depth is redacted', async () => {
    const result = await redactEvidenceStrings([{ value: sampleFindingRecord(), schema: findingRecordSchema }], ['log ' + TOKEN], {
      credentials: [],
      policyPatterns: [],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const record = result.value.records[0] as { scenario: string; subjects: string[] };
    expect(record.scenario).toContain('[REDACTED:github-token]');
    expect(record.scenario).not.toContain(TOKEN);
    expect(record.subjects[1]).toContain('[REDACTED:github-token]');
    expect(record.subjects[1]).not.toContain(TOKEN);
    expect(result.value.texts[0]).toBe('log [REDACTED:github-token]');
    expect(result.value.counts).toContainEqual({ id: 'github-token', count: 3 });
    expect(result.value.exactValues).toBe(0);
  });

  it('object keys and non-string values are unchanged', () => {
    const input = { [TOKEN]: 'v', n: 1, b: true, z: null, a: ['x'] };
    const inputCopy = JSON.parse(JSON.stringify(input)) as unknown;

    const result = mapStringLeaves(input, (s) => s.toUpperCase()) as Record<string, unknown>;

    expect(Object.keys(result)).toContain(TOKEN);
    expect(result[TOKEN]).toBe('V');
    expect(result.n).toBe(1);
    expect(result.b).toBe(true);
    expect(result.z).toBe(null);
    expect(result.a).toEqual(['X']);
    expect(input).toEqual(inputCopy);
  });

  it('resolved credentials are redacted in all three forms', async () => {
    const C = 's3ntinel' + '-token-' + 'value42';
    const raw = C;
    const base64 = Buffer.from(C, 'utf8').toString('base64');
    const basicAuth = Buffer.from('x-access-token:' + C, 'utf8').toString('base64');

    const result = await redactEvidenceStrings([], [raw, base64, basicAuth], {
      credentials: [C, 'short12'],
      policyPatterns: [],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.texts).toEqual(['[REDACTED:known-secret]', '[REDACTED:known-secret]', '[REDACTED:known-secret]']);
    expect(result.value.exactValues).toBe(3);
  });

  it('a record invalidated by a marker fails the write', async () => {
    const NPM = 'npm_' + 'a1b2c3d4'.repeat(4) + 'e5f6';
    const schema = z.strictObject({ id: z.string().regex(/^[a-z0-9_]+$/) });

    const result = await redactEvidenceStrings([{ value: { id: NPM }, schema }], [], {
      credentials: [],
      policyPatterns: [],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('evidence.redaction-invalidated');
    expect(result).not.toHaveProperty('value');
  });

  it('a redaction failure fails closed', async () => {
    const timeoutResult = await redactEvidenceStrings([], ['x'], {
      credentials: [],
      policyPatterns: [],
      redact: async () => err('redaction.timeout', 'infrastructure', 't'),
    });
    expect(timeoutResult.ok).toBe(false);
    if (!timeoutResult.ok) {
      expect(timeoutResult.failure.code).toBe('redaction.timeout');
      expect(timeoutResult).not.toHaveProperty('value');
    }

    const throwingResult = await redactEvidenceStrings([], ['x'], {
      credentials: [],
      policyPatterns: [],
      redact: async () => {
        throw new Error('boom');
      },
    });
    expect(throwingResult.ok).toBe(false);
    if (!throwingResult.ok) {
      expect(throwingResult.failure.code).toBe('redaction.failed');
      expect(throwingResult).not.toHaveProperty('value');
    }
  });

  it('redaction counts merge in detector order', () => {
    const merged = mergeRedactionCounts(
      [
        [{ id: 'github-token', count: 1 }],
        [
          { id: 'known-secret', count: 2 },
          { id: 'github-token', count: 1 },
          { id: 'custom', count: 1 },
        ],
      ],
      ['known-secret', 'github-token'],
    );

    expect(merged).toEqual([
      { id: 'known-secret', count: 2 },
      { id: 'github-token', count: 2 },
      { id: 'custom', count: 1 },
    ]);
  });
});
