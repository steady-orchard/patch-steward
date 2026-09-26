import { canonicalJson } from '../canonical-json.js';
import type { CanonicalJsonFailureCode } from '../canonical-json.js';
import { canonicalJsonHash } from '../hash.js';
import type { ContentHash } from '../hash.js';
import { ok } from '../result.js';
import type { Result } from '../result.js';

function removeHtmlComments(text: string): string {
  let result = '';
  let index = 0;
  for (;;) {
    const start = text.indexOf('<!--', index);
    if (start === -1) {
      result += text.slice(index);
      break;
    }
    result += text.slice(index, start);
    const end = text.indexOf('-->', start + 4);
    if (end === -1) {
      break;
    }
    index = end + 3;
  }
  return result;
}

function stripTrailingSpacesAndTabs(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      let end = line.length;
      while (end > 0) {
        const ch = line[end - 1];
        if (ch === ' ' || ch === '\t') {
          end -= 1;
        } else {
          break;
        }
      }
      return line.slice(0, end);
    })
    .join('\n');
}

function trimEmptyLines(text: string): string {
  const lines = text.split('\n');
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start] === '') {
    start += 1;
  }
  while (end > start && lines[end - 1] === '') {
    end -= 1;
  }
  return lines.slice(start, end).join('\n');
}

export function normalizeFieldText(text: string): string {
  const lfOnly = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const withoutComments = removeHtmlComments(lfOnly);
  const nfc = withoutComments.normalize('NFC');
  const trimmedLines = stripTrailingSpacesAndTabs(nfc);
  return trimEmptyLines(trimmedLines);
}

export const TRIVIAL_FIELD_VALUES = ['_No response_', 'N/A', 'NA', 'none', '-', 'TBD', 'TODO', '...'] as const;

export function isTrivialFieldValue(text: string): boolean {
  const normalized = normalizeFieldText(text);
  if (normalized === '') {
    return true;
  }
  const lower = normalized.toLowerCase();
  return TRIVIAL_FIELD_VALUES.some((value) => value.toLowerCase() === lower);
}

export const CLAIM_SCOPE_VERSION = 1;

export const CLAIM_SCOPE_FIELD_IDS = ['problem', 'benefit', 'intended-behavior', 'acceptance-criteria'] as const;

export type ClaimScopeFieldId = (typeof CLAIM_SCOPE_FIELD_IDS)[number];

export type ClaimScopeFieldState =
  { readonly state: 'present'; readonly raw: string } | { readonly state: 'absent' } | { readonly state: 'duplicate' };

export type ClaimScopeLinkedIssue =
  | { readonly state: 'absent' }
  | { readonly state: 'unresolved' }
  | { readonly state: 'resolved'; readonly repository: string; readonly number: number; readonly contentHash: ContentHash };

export interface ClaimScopeInput {
  readonly structured: boolean;
  readonly fields: Readonly<Record<ClaimScopeFieldId, ClaimScopeFieldState>>;
  readonly linkedIssue: ClaimScopeLinkedIssue;
}

export const CLAIM_SCOPE_UNAVAILABLE_REASONS = [
  'unstructured',
  'field-missing',
  'field-trivial',
  'field-duplicate',
  'linked-issue-unresolved',
] as const;

export type ClaimScopeUnavailableReason = (typeof CLAIM_SCOPE_UNAVAILABLE_REASONS)[number];

export type ClaimScope =
  | { readonly status: 'available'; readonly text: string; readonly hash: ContentHash }
  | { readonly status: 'unavailable'; readonly reason: ClaimScopeUnavailableReason; readonly field: ClaimScopeFieldId | null };

export function computeClaimScope(input: ClaimScopeInput): Result<ClaimScope, CanonicalJsonFailureCode> {
  if (!input.structured) {
    return ok({ status: 'unavailable', reason: 'unstructured', field: null });
  }

  const normalized: Partial<Record<ClaimScopeFieldId, string>> = {};

  for (const id of CLAIM_SCOPE_FIELD_IDS) {
    const fieldState = input.fields[id];
    if (fieldState.state === 'duplicate') {
      return ok({ status: 'unavailable', reason: 'field-duplicate', field: id });
    }
    if (fieldState.state === 'absent') {
      return ok({ status: 'unavailable', reason: 'field-missing', field: id });
    }
    if (isTrivialFieldValue(fieldState.raw)) {
      return ok({ status: 'unavailable', reason: 'field-trivial', field: id });
    }
    normalized[id] = normalizeFieldText(fieldState.raw);
  }

  if (input.linkedIssue.state === 'unresolved') {
    return ok({ status: 'unavailable', reason: 'linked-issue-unresolved', field: null });
  }

  const linkedProposal =
    input.linkedIssue.state === 'resolved'
      ? {
          repository: input.linkedIssue.repository,
          number: input.linkedIssue.number,
          content_hash: input.linkedIssue.contentHash,
        }
      : null;

  const object = {
    claim_scope_version: CLAIM_SCOPE_VERSION,
    problem: normalized['problem'],
    benefit: normalized['benefit'],
    'intended-behavior': normalized['intended-behavior'],
    'acceptance-criteria': normalized['acceptance-criteria'],
    'linked-proposal': linkedProposal,
  };

  const textResult = canonicalJson(object);
  if (!textResult.ok) {
    return textResult;
  }

  const hashResult = canonicalJsonHash(object);
  if (!hashResult.ok) {
    return hashResult;
  }

  return ok({ status: 'available', text: textResult.value, hash: hashResult.value });
}
