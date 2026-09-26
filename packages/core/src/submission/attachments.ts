import type { ParsedSubmissionBody } from './parse.js';
import { normalizeFieldText } from './normalize.js';
import { SUBMISSION_FIELD_IDS } from '../submission-fields.js';
import type { SubmissionFieldId } from '../submission-fields.js';
import type { ResolvedPolicy } from '../policy/schema.js';
import { ATTACHMENT_URL_MAX_LENGTH } from '../policy/bounds.js';
import type { ContentHash } from '../hash.js';
import type { ArchiveEntry } from '../net/archive.js';
import type { AttachmentUnavailableReason } from '../net/attachment-fetch.js';

export const DEFAULT_ATTACHMENT_DESTINATIONS = [
  'github.com',
  'objects.githubusercontent.com',
  'github-production-user-asset-6210df.s3.amazonaws.com',
  'user-images.githubusercontent.com',
  'private-user-images.githubusercontent.com',
] as const;

export const ATTACHMENT_IMAGE_HOSTS = ['user-images.githubusercontent.com', 'private-user-images.githubusercontent.com'] as const;

export const SUBMISSION_ATTACHMENT_RULES = [
  'count',
  'destination',
  'scheme',
  'userinfo',
  'format',
  'file-bytes',
  'total-bytes',
  'redirects',
  'archive',
  'decompressed-bytes',
] as const;

export type SubmissionAttachmentRule = (typeof SUBMISSION_ATTACHMENT_RULES)[number];

export const ATTACHMENT_ASSESSMENT_STATUSES = ['pending', 'fetched', 'violation', 'unavailable'] as const;

export type AttachmentAssessmentStatus = (typeof ATTACHMENT_ASSESSMENT_STATUSES)[number];

export interface AttachmentAssessment {
  readonly url: string;
  readonly fields: readonly SubmissionFieldId[];
  readonly required: boolean;
  readonly format: string | null;
  readonly status: AttachmentAssessmentStatus;
  readonly rule: SubmissionAttachmentRule | null;
  readonly reason: AttachmentUnavailableReason | null;
  readonly bytes: number | null;
  readonly contentHash: ContentHash | null;
  readonly entries: readonly ArchiveEntry[] | null;
}

export interface AttachmentAssessmentSet {
  readonly limit: number;
  readonly countExceeded: boolean;
  readonly items: readonly AttachmentAssessment[];
}

export interface AttachmentAssessmentInput {
  readonly body: ParsedSubmissionBody;
  readonly bodyText: string;
  readonly requiredFields: readonly SubmissionFieldId[];
  readonly policy: ResolvedPolicy;
}

const URL_CANDIDATE_PATTERN = /https?:\/\/[^\s<>"'`()[\]{}|\\^]+/gi;
const TRAILING_PUNCTUATION = new Set(['.', ',', ';', ':', '!', '?', '*', '_', '~']);

const GITHUB_FILES_PATTERN = /^\/user-attachments\/files\/[0-9]+\/[^/]+$/;
const GITHUB_ASSETS_PATTERN =
  /^\/user-attachments\/assets\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const GITHUB_LEGACY_FILES_PATTERN = /^\/[A-Za-z0-9-]+\/[A-Za-z0-9._-]+\/files\/[0-9]+\/[^/]+$/;

export function isAttachmentUrl(url: URL, destinations: readonly string[]): boolean {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return false;
  }
  const host = url.hostname.toLowerCase();
  if (host === 'github.com') {
    return (
      GITHUB_FILES_PATTERN.test(url.pathname) ||
      GITHUB_ASSETS_PATTERN.test(url.pathname) ||
      GITHUB_LEGACY_FILES_PATTERN.test(url.pathname)
    );
  }
  if ((ATTACHMENT_IMAGE_HOSTS as readonly string[]).includes(host)) {
    return true;
  }
  if (url.protocol === 'https:') {
    const isDefault = (DEFAULT_ATTACHMENT_DESTINATIONS as readonly string[]).some((d) => d.toLowerCase() === host);
    if (isDefault) {
      return false;
    }
    return destinations.some((d) => d.toLowerCase() === host);
  }
  return false;
}

export function extractAttachmentUrls(text: string, destinations: readonly string[]): string[] {
  const results: string[] = [];
  const matches = text.match(URL_CANDIDATE_PATTERN);
  if (!matches) {
    return results;
  }
  for (const match of matches) {
    let candidate = match;
    while (candidate.length > 0 && TRAILING_PUNCTUATION.has(candidate.charAt(candidate.length - 1))) {
      candidate = candidate.slice(0, -1);
    }
    let parsed: URL;
    try {
      parsed = new URL(candidate);
    } catch {
      continue;
    }
    if (isAttachmentUrl(parsed, destinations)) {
      results.push(parsed.href);
    }
  }
  return results;
}

export function attachmentFormatFromUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const pathname = parsed.pathname;
  const lastSlash = pathname.lastIndexOf('/');
  const segment = lastSlash === -1 ? pathname : pathname.slice(lastSlash + 1);
  const lastDot = segment.lastIndexOf('.');
  if (lastDot === -1) {
    return null;
  }
  const ext = segment.slice(lastDot + 1).toLowerCase();
  return ext === '' ? null : ext;
}

function staticRuleFor(url: string, format: string | null, policy: ResolvedPolicy): SubmissionAttachmentRule | null {
  if (url.length > ATTACHMENT_URL_MAX_LENGTH) {
    return 'destination';
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return 'destination';
  }
  if (parsed.protocol !== 'https:') {
    return 'scheme';
  }
  if (parsed.username !== '' || parsed.password !== '') {
    return 'userinfo';
  }
  const host = parsed.hostname.toLowerCase();
  const destinations = policy.submission.attachments.destinations;
  const hostAllowed = destinations.some((d) => d.toLowerCase() === host);
  if (parsed.port !== '' || !hostAllowed) {
    return 'destination';
  }
  if (format !== null && !policy.submission.attachments.formats.includes(format)) {
    return 'format';
  }
  return null;
}

export function assessAttachmentsStatically(input: AttachmentAssessmentInput): AttachmentAssessmentSet {
  const { body, bodyText, requiredFields, policy } = input;
  const destinations = policy.submission.attachments.destinations;
  const limit = policy.limits.attachments.count;

  const urlFields = new Map<string, SubmissionFieldId[]>();
  let freeForm = false;

  function record(url: string, fieldId: SubmissionFieldId | null): void {
    const existing = urlFields.get(url);
    if (existing) {
      if (fieldId !== null && !existing.includes(fieldId)) {
        existing.push(fieldId);
      }
      return;
    }
    urlFields.set(url, fieldId === null ? [] : [fieldId]);
  }

  if (body.structured) {
    for (const id of SUBMISSION_FIELD_IDS) {
      const field = body.fields[id];
      if (!field) {
        continue;
      }
      const urls = extractAttachmentUrls(field.normalized, destinations);
      for (const url of urls) {
        record(url, id);
      }
    }
  } else if (policy.submission.free_form) {
    freeForm = true;
    const normalized = normalizeFieldText(bodyText);
    const urls = extractAttachmentUrls(normalized, destinations);
    for (const url of urls) {
      record(url, null);
    }
  }

  const sortedUrls = Array.from(urlFields.keys()).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const items: AttachmentAssessment[] = sortedUrls.map((url) => {
    const fields = urlFields.get(url) ?? [];
    const orderedFields = SUBMISSION_FIELD_IDS.filter((id) => fields.includes(id));
    const required = freeForm || orderedFields.some((id) => requiredFields.includes(id));
    const format = attachmentFormatFromUrl(url);
    const rule = staticRuleFor(url, format, policy);
    return {
      url,
      fields: orderedFields,
      required,
      format,
      status: rule === null ? 'pending' : 'violation',
      rule,
      reason: null,
      bytes: null,
      contentHash: null,
      entries: null,
    };
  });

  return {
    limit,
    countExceeded: items.length > limit,
    items,
  };
}
