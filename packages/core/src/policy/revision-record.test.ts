import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

import { canonicalJsonHash } from '../hash.js';
import { parseStrictYaml } from '../strict-yaml.js';
import { validatePolicy } from './validate.js';
import { resolvePolicy } from './resolve.js';
import type { LoadedPolicy } from './loader.js';
import { policyRevisionRecord, policyRevisionRecordSchema } from './revision-record.js';

const templateBytes = fs.readFileSync(fileURLToPath(new URL('../../../../templates/policy/policy.yml', import.meta.url)));

function loadedTemplatePolicy(): LoadedPolicy {
  const raw = parseStrictYaml(templateBytes, { maxBytes: 262144, maxDepth: 32, maxNodes: 20000 });
  if (!raw.ok) {
    throw new Error('template failed to parse');
  }
  const validated = validatePolicy(raw.value);
  if (!validated.ok) {
    throw new Error('template failed to validate');
  }
  const resolved = resolvePolicy(validated.value);
  if (!resolved.ok) {
    throw new Error('template failed to resolve');
  }
  return {
    revision: { kind: 'git-tree', id: 'c'.repeat(40), commit: 'd'.repeat(40), ref: 'main' },
    policy: resolved.value,
    authoritative: true,
  };
}

describe('policy revision record', () => {
  test('record policy-revision accepts a fixture instance', () => {
    const loaded = loadedTemplatePolicy();
    const result = policyRevisionRecord(loaded, { stewardVersion: '0.0.2', loadedAt: '2026-09-26T12:00:00Z' });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(canonicalJsonHash(result.value).ok).toBe(true);
  });

  test('record policy-revision rejects an unknown key', () => {
    const loaded = loadedTemplatePolicy();
    const built = policyRevisionRecord(loaded, { stewardVersion: '0.0.2', loadedAt: '2026-09-26T12:00:00Z' });
    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }
    const candidate = { ...built.value, extra_key: 'nope' };
    const parsed = policyRevisionRecordSchema.safeParse(candidate);
    expect(parsed.success).toBe(false);
  });

  test('record policy-revision rejects a wrong schema_version', () => {
    const loaded = loadedTemplatePolicy();
    const built = policyRevisionRecord(loaded, { stewardVersion: '0.0.2', loadedAt: '2026-09-26T12:00:00Z' });
    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }
    const candidate = { ...built.value, schema_version: 2 };
    const parsed = policyRevisionRecordSchema.safeParse(candidate);
    expect(parsed.success).toBe(false);
  });

  test('record policy-revision rejects an authoritative local file', () => {
    const loaded = loadedTemplatePolicy();
    const localLoaded: LoadedPolicy = {
      revision: { kind: 'local-file', id: `local:${'e'.repeat(64)}`, path: '/tmp/policy.yml' },
      policy: loaded.policy,
      authoritative: true,
    };
    const built = policyRevisionRecord(localLoaded, { stewardVersion: '0.0.2', loadedAt: '2026-09-26T12:00:00Z' });
    expect(built.ok).toBe(false);
  });

  test('record policy-revision accepts a local file revision', () => {
    const loaded = loadedTemplatePolicy();
    const localLoaded: LoadedPolicy = {
      revision: { kind: 'local-file', id: `local:${'e'.repeat(64)}`, path: '/tmp/policy.yml' },
      policy: loaded.policy,
      authoritative: false,
    };
    const built = policyRevisionRecord(localLoaded, { stewardVersion: '0.0.2', loadedAt: '2026-09-26T12:00:00Z' });
    expect(built.ok).toBe(true);
  });
});
