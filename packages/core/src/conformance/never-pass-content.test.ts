import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  failureCauseSchema,
  outcomeSchema,
  parseStrictYaml,
  POLICY_FILE_MAX_BYTES,
  POLICY_VALIDATION_CODES,
  POLICY_YAML_MAX_DEPTH,
  POLICY_YAML_MAX_NODES,
  STRICT_YAML_FAILURE_CODES,
  validatePolicyBytes,
} from '../index.js';
import type { PolicyValidationCode, StrictYamlFailureCode } from '../index.js';

type ContentFailureCode = StrictYamlFailureCode | PolicyValidationCode;

const templateBytes = readFileSync(fileURLToPath(new URL('../../../../templates/policy/policy.yml', import.meta.url)));

function loadTemplateRaw(): Record<string, unknown> {
  const parsed = parseStrictYaml(templateBytes, {
    maxBytes: POLICY_FILE_MAX_BYTES,
    maxDepth: POLICY_YAML_MAX_DEPTH,
    maxNodes: POLICY_YAML_MAX_NODES,
  });
  if (!parsed.ok) {
    throw new Error('template failed to parse');
  }
  return structuredClone(parsed.value) as Record<string, unknown>;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value as Record<string, unknown>;
}

function jsonBytes(raw: unknown): Uint8Array {
  return Buffer.from(JSON.stringify(raw), 'utf8');
}

const CONTENT_TRIGGERS: { readonly [K in ContentFailureCode]: () => Uint8Array } = {
  'yaml.too-large': () => Buffer.alloc(POLICY_FILE_MAX_BYTES + 1, 0x61),
  'yaml.invalid-utf8': () => Uint8Array.from([0x76, 0xc3, 0x28]),
  'yaml.syntax': () => Buffer.from('version: [1\n', 'utf8'),
  'yaml.empty': () => Buffer.from('', 'utf8'),
  'yaml.multi-document': () => Buffer.from('version: 1\n---\nversion: 1\n', 'utf8'),
  'yaml.duplicate-key': () => Buffer.from('version: 1\nversion: 1\n', 'utf8'),
  'yaml.directive': () => Buffer.from('%YAML 1.2\n---\nversion: 1\n', 'utf8'),
  'yaml.alias': () => Buffer.from('a: &x 1\nb: *x\n', 'utf8'),
  'yaml.anchor': () => Buffer.from('a: &x 1\n', 'utf8'),
  'yaml.explicit-tag': () => Buffer.from('a: !!str 1\n', 'utf8'),
  'yaml.non-string-key': () => Buffer.from('1: a\n', 'utf8'),
  'yaml.forbidden-key': () => Buffer.from('__proto__: 1\n', 'utf8'),
  'yaml.too-deep': () => Buffer.from('['.repeat(40) + ']'.repeat(40) + '\n', 'utf8'),
  'yaml.too-many-nodes': () => Buffer.from('[' + '0,'.repeat(20001) + '0]\n', 'utf8'),

  'policy.version-missing': () => {
    const raw = loadTemplateRaw();
    delete raw.version;
    return jsonBytes(raw);
  },
  'policy.version-unsupported': () => {
    const raw = loadTemplateRaw();
    raw.version = 2;
    return jsonBytes(raw);
  },
  'policy.unknown-key': () => {
    const raw = loadTemplateRaw();
    raw.extra = 1;
    return jsonBytes(raw);
  },
  'policy.missing-key': () => {
    const raw = loadTemplateRaw();
    delete raw.follow_through;
    return jsonBytes(raw);
  },
  'policy.invalid-value': () => {
    const raw = loadTemplateRaw();
    raw.policy_change = 'sometimes';
    return jsonBytes(raw);
  },
  'policy.limit-out-of-bounds': () => {
    const raw = loadTemplateRaw();
    asRecord(asRecord(raw.runner).resources).cpus = 5;
    return jsonBytes(raw);
  },
  'policy.undeclared-reference': () => {
    const raw = loadTemplateRaw();
    const platforms = asRecord(raw.execution).platforms as unknown[];
    asRecord(platforms[0]).commands = ['test', 'nope'];
    return jsonBytes(raw);
  },
  'policy.duplicate-id': () => {
    const raw = loadTemplateRaw();
    const commands = asRecord(raw.execution).commands as unknown[];
    commands.push(structuredClone(commands[0]));
    return jsonBytes(raw);
  },
  'policy.invalid-path': () => {
    const raw = loadTemplateRaw();
    const commands = asRecord(raw.execution).commands as unknown[];
    asRecord(commands[0]).working_directory = '../outside';
    return jsonBytes(raw);
  },
  'policy.llm-pairing': () => {
    const raw = loadTemplateRaw();
    asRecord(asRecord(raw.llm).auth).type = 'env';
    return jsonBytes(raw);
  },
  'policy.llm-base-url': () => {
    const raw = loadTemplateRaw();
    raw.llm = {
      provider: 'openai-compatible',
      model: 'example-model',
      auth: { type: 'env' },
      options: { base_url: 'http://llm.example.com/v1' },
      generation: { temperature: null },
      required_capabilities: { structured_output: 'any' },
      admission: 'all',
      limits: {
        model_calls_per_run: 40,
        retries_per_call: 2,
        repair_attempts_per_session: 1,
        call_seconds: 120,
        daily_inference_runs: 30,
        tokens_per_run: 400000,
        output_tokens_per_call: 4096,
      },
    };
    return jsonBytes(raw);
  },
  'policy.stage-conflict': () => {
    const raw = loadTemplateRaw();
    asRecord(raw.stages).challenge_rounds = 0;
    return jsonBytes(raw);
  },
  'policy.label-name': () => {
    const raw = loadTemplateRaw();
    asRecord(asRecord(raw.labels).status).queued = 'steward:triage';
    return jsonBytes(raw);
  },
  'policy.dismissal-code': () => {
    const raw = loadTemplateRaw();
    raw.dismissal_codes = [{ code: 'duplicate', definition: 'Redefined.' }];
    return jsonBytes(raw);
  },
  'policy.redaction-pattern': () => {
    const raw = loadTemplateRaw();
    asRecord(raw.evidence).redaction_patterns = [{ id: 'bad', pattern: '(a+)+$' }];
    return jsonBytes(raw);
  },
  'policy.credential-value': () => {
    const raw = loadTemplateRaw();
    asRecord(raw.supported_behavior).description = 'token ' + 'ghp_' + 'A1b2C3d4'.repeat(4) + 'E5f6';
    return jsonBytes(raw);
  },
};

const CONTENT_FAILURE_CODES = Object.keys(CONTENT_TRIGGERS) as ContentFailureCode[];

describe('never-pass content conformance', () => {
  it.each(CONTENT_FAILURE_CODES)('failure code %s never yields pass', (code) => {
    const bytes = CONTENT_TRIGGERS[code as ContentFailureCode]();
    const result = validatePolicyBytes(bytes);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    const failure = result.failure;
    expect(failure.code).toBe(code);
    expect(failure.outcome).toBe('inconclusive');
    expect(outcomeSchema.parse(failure.outcome)).not.toBe('pass');
    expect(failureCauseSchema.safeParse(failure.cause).success).toBe(true);
    expect('value' in result).toBe(false);
    expect(failure.details.length).toBeGreaterThan(0);
    expect(failure.details.some((detail) => detail.code === code)).toBe(true);
  });

  it('content failure table covers every YAML and policy validation code', () => {
    const expected = [...STRICT_YAML_FAILURE_CODES, ...POLICY_VALIDATION_CODES].slice().sort();
    expect(CONTENT_FAILURE_CODES.slice().sort()).toEqual(expected);
  });

  it('the unmutated template validates as JSON text', () => {
    const raw = loadTemplateRaw();
    const result = validatePolicyBytes(jsonBytes(raw));
    expect(result.ok).toBe(true);
  });
});
