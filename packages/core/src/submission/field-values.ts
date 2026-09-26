import { normalizeFieldText, isTrivialFieldValue } from './normalize.js';
import { CATEGORIES } from '../vocabulary.js';
import type { Category } from '../vocabulary.js';

export type CategoryValue =
  { readonly status: 'valid'; readonly category: Category } | { readonly status: 'missing' } | { readonly status: 'invalid' };

export function parseCategoryValue(raw: string | undefined): CategoryValue {
  if (raw === undefined || isTrivialFieldValue(raw)) {
    return { status: 'missing' };
  }
  let v = normalizeFieldText(raw).trim();
  const backtickMatch = /^`([^`]*)`$/.exec(v);
  if (backtickMatch) {
    v = (backtickMatch[1] ?? '').trim();
  }
  if (v === '' || /\s/.test(v)) {
    return { status: 'invalid' };
  }
  const lower = v.toLowerCase();
  const match = CATEGORIES.find((id) => id === lower);
  if (match) {
    return { status: 'valid', category: match };
  }
  return { status: 'invalid' };
}

export const LINKED_ISSUE_INVALID_REASONS = ['several', 'cross-repository', 'unreadable'] as const;
export type LinkedIssueInvalidReason = (typeof LINKED_ISSUE_INVALID_REASONS)[number];

export type LinkedIssueValue =
  | { readonly status: 'absent' }
  | { readonly status: 'one'; readonly number: number }
  | { readonly status: 'invalid'; readonly reason: LinkedIssueInvalidReason };

export const CLOSING_KEYWORDS = ['close', 'closes', 'closed', 'fix', 'fixes', 'fixed', 'resolve', 'resolves', 'resolved'] as const;

const REF_SOURCE = String.raw`(?:https:\/\/github\.com\/([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)\/issues\/([1-9][0-9]{0,9})|([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)#([1-9][0-9]{0,9})|#([1-9][0-9]{0,9}))`;
const REF_GLOBAL = new RegExp(String.raw`(?<![A-Za-z0-9_\/#.-])` + REF_SOURCE + String.raw`(?![A-Za-z0-9_\/#])`, 'g');
const REF_EXACT = new RegExp('^' + REF_SOURCE + '$');
const KEYWORD_PREFIX = /^(?:close|closes|closed|fix|fixes|fixed|resolve|resolves|resolved):?[ \t]+/i;

interface ParsedRef {
  readonly owner: string | undefined;
  readonly repo: string | undefined;
  readonly number: number;
}

function toRef(match: RegExpMatchArray): ParsedRef {
  if (match[1] !== undefined) {
    return { owner: match[1], repo: match[2], number: Number(match[3]) };
  }
  if (match[4] !== undefined) {
    return { owner: match[4], repo: match[5], number: Number(match[6]) };
  }
  return { owner: undefined, repo: undefined, number: Number(match[7]) };
}

function namesThisRepository(ref: ParsedRef, repository: string): boolean {
  if (ref.owner === undefined || ref.repo === undefined) {
    return true;
  }
  return `${ref.owner}/${ref.repo}`.toLowerCase() === repository.toLowerCase();
}

export function parseLinkedIssueValue(raw: string | undefined, repository: string): LinkedIssueValue {
  if (raw === undefined || isTrivialFieldValue(raw)) {
    return { status: 'absent' };
  }
  const v = normalizeFieldText(raw);

  const refs: ParsedRef[] = [];
  for (const match of v.matchAll(REF_GLOBAL)) {
    refs.push(toRef(match));
  }

  if (refs.some((ref) => !namesThisRepository(ref, repository))) {
    return { status: 'invalid', reason: 'cross-repository' };
  }

  const distinctNumbers = new Set(refs.map((ref) => ref.number));
  if (distinctNumbers.size >= 2) {
    return { status: 'invalid', reason: 'several' };
  }

  const stripped = v.replace(KEYWORD_PREFIX, '');
  const exactMatch = REF_EXACT.exec(stripped);
  if (exactMatch) {
    const ref = toRef(exactMatch);
    if (namesThisRepository(ref, repository)) {
      return { status: 'one', number: ref.number };
    }
  }
  return { status: 'invalid', reason: 'unreadable' };
}
