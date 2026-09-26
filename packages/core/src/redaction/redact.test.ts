import { describe, expect, it } from 'vitest';
import { REDACTION_INPUT_MAX_BYTES } from '../policy/bounds.js';
import { redactionMarker } from './detectors.js';
import { applyRedactionRules, redactText } from './redact.js';

const DETECTOR_SAMPLES: readonly { id: string; sample: string }[] = [
  { id: 'github-token', sample: 'ghp_' + 'A1b2C3d4'.repeat(4) + 'E5f6' },
  {
    id: 'private-key',
    sample: '-----BEGIN ' + 'RSA PRIVATE KEY-----\nMIIEow' + 'IBAAKCAQEA\n-----END ' + 'RSA PRIVATE KEY-----',
  },
  { id: 'aws-access-key-id', sample: 'AKIA' + 'ABCDEFGHIJKLMNOP' },
  { id: 'provider-api-key', sample: 'sk-' + 'proj-' + 'a'.repeat(24) },
  { id: 'jwt', sample: 'eyJ' + 'hbGciOiJIUzI1NiJ9' + '.' + 'eyJzdWIiOiIxMjM0In0' + '.' + 'abcdefghijKLMNOP' },
  { id: 'authorization-header', sample: 'Authorization: ' + 'Basic ' + 'dXNlcjpwYXNzd29yZA==' },
  { id: 'bearer-token', sample: 'Bearer ' + 'abcdefghijklmnopqrstuvwxyz012345' },
  { id: 'url-credentials', sample: 'https://' + 'deploy:' + 's3cr3tvalue' + '@example.com/repo.git' },
];

const DETECTOR_SAMPLE_IDS: readonly string[] = [
  'private-key',
  'github-token',
  'aws-access-key-id',
  'provider-api-key',
  'jwt',
  'authorization-header',
  'bearer-token',
  'url-credentials',
];

describe('redactText', { timeout: 20000 }, () => {
  it.each(DETECTOR_SAMPLE_IDS)('redacts built-in detector sample %s', async (id) => {
    const entry = DETECTOR_SAMPLES.find((candidate) => candidate.id === id);
    if (!entry) throw new Error(`missing detector sample for ${id}`);
    const { sample } = entry;
    const result = await redactText('before ' + sample + ' after');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.text).toContain(redactionMarker(id));
    expect(result.value.text).not.toContain(sample);
    expect(result.value.counts).toContainEqual({ id, count: 1 });
  });

  it('redacts known secret values exactly', async () => {
    const result = await redactText('x s3cr3t-value-123 y', { knownSecrets: ['s3cr3t-value-123'] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.text).toBe('x [REDACTED:known-secret] y');
  });

  it('applies policy patterns after built-ins', async () => {
    const result = await redactText('see INTERNAL-1234', {
      policyPatterns: [{ id: 'internal-id', pattern: 'INTERNAL-[0-9]{4}' }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.text).toBe('see [REDACTED:internal-id]');
  });

  it('rejects a policy pattern outside the safe subset', async () => {
    const result = await redactText('anything', { policyPatterns: [{ id: 'bad', pattern: '(a+)+$' }] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('redaction.invalid-pattern');
    expect(result.failure.cause).toBe('policy-invalid');
  });

  it('fails closed when input exceeds the size bound', async () => {
    const tooLong = await redactText('x'.repeat(11), { maxInputBytes: 10 });
    expect(tooLong.ok).toBe(false);
    if (!tooLong.ok) expect(tooLong.failure.code).toBe('redaction.input-too-large');

    const tooLongBytes = await redactText('é'.repeat(6), { maxInputBytes: 10 });
    expect(tooLongBytes.ok).toBe(false);
    if (!tooLongBytes.ok) expect(tooLongBytes.failure.code).toBe('redaction.input-too-large');
  });

  it('fails closed when the time bound elapses', async () => {
    const result = await applyRedactionRules(
      'a'.repeat(40) + '!',
      [{ id: 'catastrophic', kind: 'regex', value: '(a+)+$', flags: 'g' }],
      { maxInputBytes: 1024, timeoutMs: 200 },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('redaction.timeout');
    }
  });

  it('caller bounds above the steward bounds are lowered', async () => {
    const result = await redactText('x'.repeat(REDACTION_INPUT_MAX_BYTES + 1), { maxInputBytes: 10 ** 12 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe('redaction.input-too-large');
  });

  it('zero-length matches are left unchanged', async () => {
    const result = await applyRedactionRules('abc', [{ id: 'z', kind: 'regex', value: 'x*', flags: 'g' }], {
      maxInputBytes: 1024,
      timeoutMs: 2000,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.text).toBe('abc');
    expect(result.value.counts).toEqual([]);
  });

  it('failures carry outcome inconclusive', async () => {
    const result = await redactText('anything', { policyPatterns: [{ id: 'bad', pattern: '(a+)+$' }] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.outcome).toBe('inconclusive');
  });
});
