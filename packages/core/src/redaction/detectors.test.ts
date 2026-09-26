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

  it('built-in detector list is frozen and ordered', () => {
    expect(BUILT_IN_DETECTORS.map((d) => d.id)).toEqual(ids);
    expect(Object.isFrozen(BUILT_IN_DETECTORS)).toBe(true);
    for (const detector of BUILT_IN_DETECTORS) {
      expect(Object.isFrozen(detector)).toBe(true);
    }
  });
});
