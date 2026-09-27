export interface CredentialDetector {
  readonly id: string;
  readonly source: string;
  readonly flags: string;
}

export const BUILT_IN_DETECTORS: readonly CredentialDetector[] = Object.freeze([
  Object.freeze({
    id: 'private-key',
    source: String.raw`-----BEGIN [A-Z0-9 ]{0,40}PRIVATE KEY-----(?:[\s\S]*?-----END [A-Z0-9 ]{0,40}PRIVATE KEY-----|[\s\S]*$)`,
    flags: 'g',
  }),
  Object.freeze({
    id: 'github-token',
    source: String.raw`\b(?:gh[opusr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})`,
    flags: 'g',
  }),
  Object.freeze({
    id: 'aws-access-key-id',
    source: String.raw`\b(?:AKIA|ASIA)[A-Z0-9]{16}\b`,
    flags: 'g',
  }),
  Object.freeze({
    id: 'provider-api-key',
    source: String.raw`\bsk-[A-Za-z0-9_-]{20,}`,
    flags: 'g',
  }),
  Object.freeze({
    id: 'jwt',
    source: String.raw`\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}`,
    flags: 'g',
  }),
  Object.freeze({
    id: 'authorization-header',
    source: String.raw`\bAuthorization[ \t]*:[ \t]*[A-Za-z]+[ \t]+[A-Za-z0-9._~+/=-]{8,}`,
    flags: 'gi',
  }),
  Object.freeze({
    id: 'bearer-token',
    source: String.raw`\bBearer[ \t]+[A-Za-z0-9._~+/=-]{16,}`,
    flags: 'gi',
  }),
  Object.freeze({
    id: 'url-credentials',
    source: String.raw`\b[A-Za-z][A-Za-z0-9+.-]{0,31}://[^\s/?#@:]{1,256}:[^\s/?#@]{1,256}@`,
    flags: 'g',
  }),
  Object.freeze({
    id: 'npm-token',
    source: String.raw`\bnpm_[A-Za-z0-9]{36}\b`,
    flags: 'g',
  }),
  Object.freeze({
    id: 'pypi-token',
    source: String.raw`\bpypi-AgE[A-Za-z0-9_-]{50,}`,
    flags: 'g',
  }),
  Object.freeze({
    id: 'gitlab-token',
    source: String.raw`\b(?:glpat|gldt|glrt|glptt|glcbt|glimt|glagent|gloas|glsoat|glffct|glft)-[A-Za-z0-9_.-]{20,}`,
    flags: 'g',
  }),
  Object.freeze({
    id: 'slack-token',
    source: String.raw`\b(?:xox[abeoprs]|xapp)-[A-Za-z0-9-]{10,}`,
    flags: 'g',
  }),
  Object.freeze({
    id: 'slack-webhook',
    source: String.raw`\bhttps://hooks\.slack\.com/(?:services|workflows|triggers)/[A-Za-z0-9/_-]{20,}`,
    flags: 'g',
  }),
  Object.freeze({
    id: 'stripe-key',
    source: String.raw`\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}`,
    flags: 'g',
  }),
  Object.freeze({
    id: 'stripe-webhook-secret',
    source: String.raw`\bwhsec_[A-Za-z0-9]{24,}`,
    flags: 'g',
  }),
  Object.freeze({
    id: 'google-api-key',
    source: String.raw`\bAIza[0-9A-Za-z_-]{35}`,
    flags: 'g',
  }),
  Object.freeze({
    id: 'google-oauth-client-secret',
    source: String.raw`\bGOCSPX-[A-Za-z0-9_-]{28}`,
    flags: 'g',
  }),
  Object.freeze({
    id: 'google-oauth-access-token',
    source: String.raw`\bya29\.[0-9A-Za-z_-]{20,}`,
    flags: 'g',
  }),
  Object.freeze({
    id: 'huggingface-token',
    source: String.raw`\bhf_[A-Za-z]{34}\b`,
    flags: 'g',
  }),
  Object.freeze({
    id: 'docker-hub-token',
    source: String.raw`\bdckr_pat_[A-Za-z0-9_-]{27,}`,
    flags: 'g',
  }),
  Object.freeze({
    id: 'sendgrid-key',
    source: String.raw`\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b`,
    flags: 'g',
  }),
  Object.freeze({
    id: 'shopify-token',
    source: String.raw`\bshp(?:at|ca|pa|ss)_[a-fA-F0-9]{32}\b`,
    flags: 'g',
  }),
  Object.freeze({
    id: 'digitalocean-token',
    source: String.raw`\bdo[por]_v1_[a-f0-9]{64}\b`,
    flags: 'g',
  }),
]);

export function redactionMarker(id: string): string {
  return `[REDACTED:${id}]`;
}

export function findCredentialDetector(text: string): string | null {
  for (const detector of BUILT_IN_DETECTORS) {
    const flags = detector.flags.replace('g', '');
    const regex = new RegExp(detector.source, flags);
    if (regex.test(text)) {
      return detector.id;
    }
  }
  return null;
}

export function redactBuiltInCredentials(text: string): string {
  let result = text;
  for (const detector of BUILT_IN_DETECTORS) {
    const regex = new RegExp(detector.source, detector.flags);
    result = result.replace(regex, redactionMarker(detector.id));
  }
  return result;
}
