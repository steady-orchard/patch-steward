import { err, ok } from '../result.js';
import type { FailureDetail, Result } from '../result.js';
import { findCredentialDetector } from '../redaction/detectors.js';
import { POLICY_FILE_MAX_BYTES, POLICY_YAML_MAX_DEPTH, POLICY_YAML_MAX_NODES } from './bounds.js';
import type { PolicyValidationCode } from './catalog.js';
import { capPolicyDetails, formatExcerpt, formatPolicyPath, mapZodIssues, policyDetail, policyFailureMessage } from './messages.js';
import { checkPolicyRules } from './rules.js';
import { policySchema } from './schema.js';
import type { Policy } from './schema.js';
import { parseStrictYamlDocument } from '../strict-yaml.js';
import type { StrictYamlFailureCode, YamlPosition } from '../strict-yaml.js';

function credentialDetail(id: string, path: string): FailureDetail {
  return {
    code: 'policy.credential-value',
    path,
    message: `A credential-like value (${id}) was found at ${path}; the policy holds credential references only, never secret values.`,
    line: null,
    column: null,
  };
}

export function scanPolicyCredentials(raw: unknown): FailureDetail[] {
  const details: FailureDetail[] = [];

  function walk(node: unknown, segments: readonly PropertyKey[]): void {
    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, [...segments, index]));
      return;
    }
    if (node !== null && typeof node === 'object') {
      for (const key of Object.keys(node)) {
        const keyPath = formatPolicyPath([...segments, key]);
        const keyDetectorId = findCredentialDetector(key);
        if (keyDetectorId !== null) {
          details.push(credentialDetail(keyDetectorId, keyPath));
        }
        const value = (node as Record<string, unknown>)[key];
        if (typeof value === 'string') {
          const valueDetectorId = findCredentialDetector(value);
          if (valueDetectorId !== null) {
            details.push(credentialDetail(valueDetectorId, keyPath));
          }
        } else {
          walk(value, [...segments, key]);
        }
      }
    }
  }

  walk(raw, []);
  return details;
}

function attachPositions(details: readonly FailureDetail[], positions?: ReadonlyMap<string, YamlPosition>): FailureDetail[] {
  if (positions === undefined) {
    return [...details];
  }
  return details.map((detail) => {
    let path = detail.path;
    for (;;) {
      const position = positions.get(path);
      if (position !== undefined) {
        return { ...detail, line: position.line, column: position.column };
      }
      if (path === '') {
        return detail;
      }
      const lastDot = path.lastIndexOf('.');
      path = lastDot === -1 ? '' : path.slice(0, lastDot);
    }
  });
}

function finalize(
  details: readonly FailureDetail[],
  positions: ReadonlyMap<string, YamlPosition> | undefined,
): Result<Policy, PolicyValidationCode> {
  const withPositions = attachPositions(details, positions);
  const capped = capPolicyDetails(withPositions);
  const first = capped[0];
  if (first === undefined) {
    return err('policy.invalid-value', 'policy-invalid', 'Policy validation failed.', []);
  }
  return err(first.code as PolicyValidationCode, 'policy-invalid', policyFailureMessage(details.length, first), capped);
}

export function validatePolicy(raw: unknown, positions?: ReadonlyMap<string, YamlPosition>): Result<Policy, PolicyValidationCode> {
  if (raw === null || Array.isArray(raw) || typeof raw !== 'object') {
    return finalize([policyDetail('policy.invalid-value', '', 'The policy document must be a YAML mapping.')], positions);
  }

  if (!Object.hasOwn(raw, 'version')) {
    return finalize(
      [policyDetail('policy.version-missing', 'version', 'Required key version is missing; no default is substituted.')],
      positions,
    );
  }

  const version = (raw as Record<string, unknown>).version;
  if (version !== 1) {
    return finalize(
      [
        policyDetail(
          'policy.version-unsupported',
          'version',
          `version ${formatExcerpt(version)} is not supported; the supported policy version is 1.`,
        ),
      ],
      positions,
    );
  }

  const credentials = scanPolicyCredentials(raw);
  const parsed = policySchema.safeParse(raw);

  if (!parsed.success) {
    const details = [...mapZodIssues(parsed.error.issues, raw), ...credentials];
    return finalize(details, positions);
  }

  const details = [...checkPolicyRules(parsed.data), ...credentials];
  if (details.length === 0) {
    return ok(parsed.data);
  }
  return finalize(details, positions);
}

export function validatePolicyBytes(bytes: Uint8Array): Result<Policy, StrictYamlFailureCode | PolicyValidationCode> {
  const doc = parseStrictYamlDocument(bytes, {
    maxBytes: POLICY_FILE_MAX_BYTES,
    maxDepth: POLICY_YAML_MAX_DEPTH,
    maxNodes: POLICY_YAML_MAX_NODES,
  });
  if (!doc.ok) {
    return doc;
  }
  return validatePolicy(doc.value.value, doc.value.positions);
}
