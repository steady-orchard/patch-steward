import { RUN_DISPLAY_TITLE_MAX_LENGTH } from '../policy/bounds.js';
import { err, ok } from '../result.js';
import type { Result } from '../result.js';
import type { CapState, SenderType } from '../vocabulary.js';

export const STEWARD_WRAPPER_PATHS = ['.github/workflows/steward-pr.yml', '.github/workflows/steward-issues.yml'] as const;

export interface RunNameFields {
  readonly kind: 'pr' | 'issue';
  readonly number: number;
  readonly authorId: number;
  readonly eventName: string;
  readonly action: string;
  readonly senderId: number;
  readonly senderType: SenderType;
}

export interface RunListItem {
  readonly id: number;
  readonly path: string;
  readonly event: string;
  readonly status: string;
  readonly createdAt: string;
  readonly displayTitle: string;
}

export interface RunListQueryResult {
  readonly items: readonly RunListItem[];
  readonly totalCount: number;
  readonly complete: boolean;
}

export interface CapEvaluationInput {
  readonly createdToday: RunListQueryResult;
  readonly inProgress: RunListQueryResult;
  readonly queued: RunListQueryResult;
  readonly now: Date;
  readonly botUserId: number;
  readonly authorId: number;
  readonly currentRunId: number;
  readonly dailyLimit: number;
  readonly authorLimit: number;
}

export interface CapEvaluation {
  readonly state: CapState;
  readonly dailyCount: number;
  readonly dailyLimit: number;
  readonly authorCount: number;
  readonly authorLimit: number;
}

export type CapsFailureCode = 'caps.run-list-unavailable';

const RUN_NAME_PATTERN =
  /^steward (pr|issue) ([1-9][0-9]{0,9}) author ([1-9][0-9]{0,19}) event ([a-z_]{1,64}) ([a-z_]{1,64}) sender ([1-9][0-9]{0,19}) (User|Bot|Organization|Mannequin)$/;

function isSafeIntegerString(text: string): boolean {
  return Number.isSafeInteger(Number(text));
}

export function buildRunName(fields: RunNameFields): string {
  const noun = fields.kind === 'pr' ? 'pr' : 'issue';
  const title = `steward ${noun} ${fields.number} author ${fields.authorId} event ${fields.eventName} ${fields.action} sender ${fields.senderId} ${fields.senderType}`;
  if (parseRunName(title) === null) {
    throw new RangeError('buildRunName produced a title that does not parse');
  }
  return title;
}

export function parseRunName(title: string): RunNameFields | null {
  if (title.length > RUN_DISPLAY_TITLE_MAX_LENGTH) {
    return null;
  }
  const match = RUN_NAME_PATTERN.exec(title);
  if (match === null) {
    return null;
  }
  const [, kind, number, authorId, eventName, action, senderId, senderType] = match;
  if (
    kind === undefined ||
    number === undefined ||
    authorId === undefined ||
    eventName === undefined ||
    action === undefined ||
    senderId === undefined ||
    senderType === undefined
  ) {
    return null;
  }
  if (!isSafeIntegerString(number) || !isSafeIntegerString(authorId) || !isSafeIntegerString(senderId)) {
    return null;
  }
  return {
    kind: kind === 'pr' ? 'pr' : 'issue',
    number: Number(number),
    authorId: Number(authorId),
    eventName,
    action,
    senderId: Number(senderId),
    senderType: senderType as SenderType,
  };
}

export function runListQueryDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function isCounted(item: RunListItem): boolean {
  const matchesPath = STEWARD_WRAPPER_PATHS.some((path) => item.path === path || item.path.startsWith(`${path}@`));
  if (!matchesPath) {
    return false;
  }
  return item.event === 'pull_request_target' || item.event === 'issues';
}

function isSentByBot(item: RunListItem, botUserId: number): boolean {
  const fields = parseRunName(item.displayTitle);
  return fields !== null && fields.senderId === botUserId;
}

function createdOnDate(item: RunListItem, date: string): boolean {
  const parsed = new Date(item.createdAt);
  if (Number.isNaN(parsed.getTime())) {
    return true;
  }
  return runListQueryDate(parsed) === date;
}

function distinctCountedIds(items: readonly RunListItem[], predicate: (item: RunListItem) => boolean): ReadonlySet<number> {
  const ids = new Set<number>();
  for (const item of items) {
    if (isCounted(item) && predicate(item)) {
      ids.add(item.id);
    }
  }
  return ids;
}

export function evaluateCaps(input: CapEvaluationInput): Result<CapEvaluation, CapsFailureCode> {
  if (!input.inProgress.complete || !input.queued.complete) {
    return err('caps.run-list-unavailable', 'github-unavailable', 'The run list could not be read completely.');
  }

  let dailyCount: number;
  if (input.createdToday.totalCount > 1000) {
    dailyCount = input.createdToday.totalCount;
  } else {
    if (!input.createdToday.complete) {
      return err('caps.run-list-unavailable', 'github-unavailable', 'The run list could not be read completely.');
    }
    const today = runListQueryDate(input.now);
    const dailyIds = distinctCountedIds(
      input.createdToday.items,
      (item) => item.id !== input.currentRunId && createdOnDate(item, today) && !isSentByBot(item, input.botUserId),
    );
    dailyCount = 1 + dailyIds.size;
  }

  const authorIds = new Set<number>();
  for (const result of [input.inProgress, input.queued]) {
    for (const item of distinctCountedIds(
      result.items,
      (item) =>
        item.id !== input.currentRunId &&
        (item.status === 'queued' || item.status === 'in_progress') &&
        parseRunName(item.displayTitle)?.authorId === input.authorId,
    )) {
      authorIds.add(item);
    }
  }
  const authorCount = 1 + authorIds.size;

  const state: CapState =
    dailyCount > input.dailyLimit ? 'daily-runs' : authorCount > input.authorLimit ? 'per-author-concurrent-runs' : 'within';

  return ok({
    state,
    dailyCount,
    dailyLimit: input.dailyLimit,
    authorCount,
    authorLimit: input.authorLimit,
  });
}
