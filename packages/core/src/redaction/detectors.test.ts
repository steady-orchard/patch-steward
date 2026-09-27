import { describe, expect, it } from 'vitest';
import { BUILT_IN_DETECTORS, findCredentialDetector, redactBuiltInCredentials, redactionMarker } from './detectors.js';

const samples: Record<string, string> = {
  'private-key': '-----BEGIN ' + 'RSA PRIVATE KEY-----\nMIIEow' + 'IBAAKCAQEA\n-----END ' + 'RSA PRIVATE KEY-----',
  'github-token': 'ghp_' + 'A1b2C3d4'.repeat(4) + 'E5f6',
  'aws-access-key-id': 'AKIA' + 'ABCDEFGHIJKLMNOP',
  'provider-api-key': 'sk-' + 'proj-' + 'a'.repeat(24),
  jwt: 'eyJ' + 'hbGciOiJIUzI1NiJ9' + '.' + 'eyJzdWIiOiIxMjM0In0' + '.' + 'abcdefghijKLMNOP',
  'authorization-header': 'Authorization: ' + 'Basic ' + 'dXNlcjpwYXNzd29yZA==',
  'bearer-token': 'Bearer ' + 'abcdefghijklmnopqrstuvwxyz012345',
  'url-credentials': 'https://' + 'deploy:' + 's3cr3tvalue' + '@example.com/repo.git',
  'npm-token': 'npm_' + 'A1b2C3d4E5'.repeat(3) + 'F6g7H8',
  'pypi-token': 'pypi-' + 'AgE' + 'IcHlwaS5vcmc'.repeat(5),
  'gitlab-token': 'glpat' + '-' + 'A1b2C3d4E5f6G7h8I9j0',
  'slack-token': 'xox' + 'b-' + '1234567890-' + 'abcdefghij',
  'slack-webhook': 'https://hooks.' + 'slack.com/services/' + 'T0000AAAA/B0000BBBB/' + 'C1d2E3f4G5h6I7j8K9l0M1n2',
  'stripe-key': 'sk' + '_live_' + 'A1b2C3d4E5f6G7h8',
  'stripe-webhook-secret': 'whsec' + '_' + 'A1b2C3d4'.repeat(3),
  'google-api-key': 'AIza' + 'Sy' + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6q',
  'google-oauth-client-secret': 'GOCSPX' + '-' + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4',
  'google-oauth-access-token': 'ya29' + '.' + 'A1b2C3d4E5f6G7h8I9j0',
  'huggingface-token': 'hf' + '_' + 'AbCdEfGhIj'.repeat(3) + 'KlMn',
  'docker-hub-token': 'dckr' + '_pat_' + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n',
  'sendgrid-key': 'SG' + '.' + 'A1b2C3d4E5f6G7h8I9j0K1' + '.' + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0U1v',
  'shopify-token': 'shp' + 'at_' + 'a1b2c3d4'.repeat(4),
  'digitalocean-token': 'do' + 'p_v1_' + 'a1b2c3d4'.repeat(8),
};

const ids = Object.keys(samples);

const negatives = [
  'task-force members',
  'Bearer tokens are rejected',
  'https://example.com/a@b',
  'https://user@example.com',
  'docker.io/library/debian:stable-slim',
  'steward:queued',
  'Authorization header required',
  'sk-short',
  'gho_short',
  "a maintainer's acceptance of its claim",
];

describe('detectors', () => {
  it.each(ids)('findCredentialDetector detects %s sample', (id) => {
    const sample = samples[id]!;
    expect(findCredentialDetector('before ' + sample + ' after')).toBe(id);
  });

  it.each(ids)('redactBuiltInCredentials replaces %s sample with its marker', (id) => {
    const sample = samples[id]!;
    const output = redactBuiltInCredentials('before ' + sample + ' after');
    expect(output).toContain(redactionMarker(id));
    expect(output).not.toContain(sample);
  });

  it('findCredentialDetector returns null for ordinary text', () => {
    for (const text of negatives) {
      expect(findCredentialDetector(text)).toBeNull();
    }
  });

  it('truncated private key block is redacted to the end of input', () => {
    const input = 'x ' + '-----BEGIN ' + 'PRIVATE KEY-----\nabc\ndef';
    expect(redactBuiltInCredentials(input)).toBe('x ' + redactionMarker('private-key'));
  });

  it('repeated calls do not leak regex state', () => {
    const text = 'before ' + samples['github-token'] + ' after';
    expect(findCredentialDetector(text)).toBe('github-token');
    expect(findCredentialDetector(text)).toBe('github-token');
  });

  it('built-in detectors keep the eight original entries first, then the fifteen token formats', () => {
    expect(BUILT_IN_DETECTORS.map((d) => d.id)).toEqual([
      'private-key',
      'github-token',
      'aws-access-key-id',
      'provider-api-key',
      'jwt',
      'authorization-header',
      'bearer-token',
      'url-credentials',
      'npm-token',
      'pypi-token',
      'gitlab-token',
      'slack-token',
      'slack-webhook',
      'stripe-key',
      'stripe-webhook-secret',
      'google-api-key',
      'google-oauth-client-secret',
      'google-oauth-access-token',
      'huggingface-token',
      'docker-hub-token',
      'sendgrid-key',
      'shopify-token',
      'digitalocean-token',
    ]);
  });

  it('built-in detector list is frozen and ordered', () => {
    expect(BUILT_IN_DETECTORS.map((d) => d.id)).toEqual(ids);
    expect(Object.isFrozen(BUILT_IN_DETECTORS)).toBe(true);
    for (const detector of BUILT_IN_DETECTORS) {
      expect(Object.isFrozen(detector)).toBe(true);
    }
  });
});
