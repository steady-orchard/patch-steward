import { z } from 'zod';

import { EVENT_PAYLOAD_MAX_BYTES } from '../policy/bounds.js';
import { recordPositiveIntSchema, recordRepositorySchema, recordTimestampSchema } from '../records/common.js';
import { err, ok } from '../result.js';
import type { Result } from '../result.js';
import { ISSUE_EVENT_ACTIONS, PULL_REQUEST_EVENT_ACTIONS, senderTypeSchema, wrapperEventNameSchema } from '../vocabulary.js';
import type {
  IssueEventAction,
  PullRequestEventAction,
  ResolutionKind,
  SenderType,
  SubmissionType,
  WrapperEventName,
} from '../vocabulary.js';

export interface EventEnvironment {
  readonly eventName: string;
  readonly repository: string;
  readonly repositoryId: string;
  readonly ref: string;
  readonly serverUrl: string;
  readonly apiUrl: string;
  readonly runId: string;
  readonly runAttempt: string;
}

export interface AuthenticatedEvent {
  readonly eventName: WrapperEventName;
  readonly action: PullRequestEventAction | IssueEventAction;
  readonly repository: { readonly fullName: string; readonly id: number; readonly defaultBranch: string };
  readonly subject: { readonly type: SubmissionType; readonly number: number };
  readonly objectId: number;
  readonly objectUpdatedAt: string;
  readonly authorId: number;
  readonly senderId: number;
  readonly senderType: SenderType;
  readonly merged: boolean | null;
  readonly closure: boolean;
  readonly runId: number;
  readonly runAttempt: number;
}

export type EventAuthenticationFailureCode = 'gate.event-invalid';

export interface EventIdentity {
  readonly name: WrapperEventName;
  readonly action: PullRequestEventAction | IssueEventAction;
  readonly object_id: number;
  readonly object_updated_at: string;
  readonly sender_id: number;
  readonly sender_type: SenderType;
}

const userSchema = z.object({ id: recordPositiveIntSchema });

const repositorySchema = z.object({
  id: recordPositiveIntSchema,
  full_name: recordRepositorySchema,
  default_branch: z.string().min(1).max(255),
});

const senderSchema = z.object({ id: recordPositiveIntSchema, type: senderTypeSchema });

const pullRequestTargetPayloadSchema = z.object({
  action: z.string().max(64),
  number: recordPositiveIntSchema,
  pull_request: z.object({
    id: recordPositiveIntSchema,
    number: recordPositiveIntSchema,
    updated_at: recordTimestampSchema,
    user: userSchema,
    merged: z.boolean().nullable().optional(),
  }),
  repository: repositorySchema,
  sender: senderSchema,
});

const issuesPayloadSchema = z.object({
  action: z.string().max(64),
  issue: z.object({
    id: recordPositiveIntSchema,
    number: recordPositiveIntSchema,
    updated_at: recordTimestampSchema,
    user: userSchema,
    pull_request: z.unknown().optional(),
  }),
  repository: repositorySchema,
  sender: senderSchema,
});

const RUN_ID_PATTERN = /^[1-9][0-9]{0,19}$/;
const RUN_ATTEMPT_PATTERN = /^[1-9][0-9]{0,4}$/;

function fail(token: string): Result<AuthenticatedEvent, EventAuthenticationFailureCode> {
  return err('gate.event-invalid', 'infrastructure', 'The triggering event failed authentication.', [
    { code: 'gate.event-invalid', path: token, message: 'The triggering event failed authentication.', line: null, column: null },
  ]);
}

export function authenticateEvent(
  environment: EventEnvironment,
  payload: Uint8Array,
): Result<AuthenticatedEvent, EventAuthenticationFailureCode> {
  try {
    if (payload.byteLength > EVENT_PAYLOAD_MAX_BYTES) {
      return fail('payload-size');
    }

    const eventNameResult = wrapperEventNameSchema.safeParse(environment.eventName);
    if (!eventNameResult.success) {
      return fail('event-name');
    }
    const eventName = eventNameResult.data;

    let text: string;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(payload);
    } catch {
      return fail('payload-encoding');
    }

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return fail('payload-json');
    }

    let repository: { fullName: string; id: number; defaultBranch: string };
    let senderId: number;
    let senderType: SenderType;
    let action: PullRequestEventAction | IssueEventAction;
    let subject: { type: SubmissionType; number: number };
    let objectId: number;
    let objectUpdatedAt: string;
    let authorId: number;
    let merged: boolean | null;
    let closure: boolean;

    if (eventName === 'pull_request_target') {
      const parsed = pullRequestTargetPayloadSchema.safeParse(raw);
      if (!parsed.success) {
        return fail('payload-schema');
      }
      const data = parsed.data;
      const actionResult = z.enum(PULL_REQUEST_EVENT_ACTIONS).safeParse(data.action);
      if (!actionResult.success) {
        return fail('action');
      }
      action = actionResult.data;
      if (data.number !== data.pull_request.number) {
        return fail('pull-request-number');
      }
      repository = { fullName: data.repository.full_name, id: data.repository.id, defaultBranch: data.repository.default_branch };
      senderId = data.sender.id;
      senderType = data.sender.type;
      subject = { type: 'pull_request', number: data.pull_request.number };
      objectId = data.pull_request.id;
      objectUpdatedAt = data.pull_request.updated_at;
      authorId = data.pull_request.user.id;
      merged = data.pull_request.merged === true;
      closure = action === 'closed';
    } else {
      const parsed = issuesPayloadSchema.safeParse(raw);
      if (!parsed.success) {
        return fail('payload-schema');
      }
      const data = parsed.data;
      const actionResult = z.enum(ISSUE_EVENT_ACTIONS).safeParse(data.action);
      if (!actionResult.success) {
        return fail('action');
      }
      action = actionResult.data;
      if (data.issue.pull_request !== undefined) {
        return fail('issue-is-pull-request');
      }
      repository = { fullName: data.repository.full_name, id: data.repository.id, defaultBranch: data.repository.default_branch };
      senderId = data.sender.id;
      senderType = data.sender.type;
      subject = { type: 'issue', number: data.issue.number };
      objectId = data.issue.id;
      objectUpdatedAt = data.issue.updated_at;
      authorId = data.issue.user.id;
      merged = null;
      closure = action === 'closed' || action === 'deleted';
    }

    if (repository.fullName !== environment.repository) {
      return fail('repository');
    }
    if (String(repository.id) !== environment.repositoryId) {
      return fail('repository-id');
    }
    if (environment.ref !== 'refs/heads/' + repository.defaultBranch) {
      return fail('ref');
    }
    if (environment.serverUrl !== 'https://github.com') {
      return fail('server-url');
    }
    if (environment.apiUrl !== 'https://api.github.com') {
      return fail('api-url');
    }
    if (!RUN_ID_PATTERN.test(environment.runId) || !Number.isSafeInteger(Number(environment.runId))) {
      return fail('run-id');
    }
    if (!RUN_ATTEMPT_PATTERN.test(environment.runAttempt)) {
      return fail('run-attempt');
    }

    return ok({
      eventName,
      action,
      repository,
      subject,
      objectId,
      objectUpdatedAt,
      authorId,
      senderId,
      senderType,
      merged,
      closure,
      runId: Number(environment.runId),
      runAttempt: Number(environment.runAttempt),
    });
  } catch {
    return fail('payload-json');
  }
}

export function eventIdentity(event: AuthenticatedEvent): EventIdentity {
  return {
    name: event.eventName,
    action: event.action,
    object_id: event.objectId,
    object_updated_at: event.objectUpdatedAt,
    sender_id: event.senderId,
    sender_type: event.senderType,
  };
}

export function stewardConcurrencyGroup(repositoryId: number, type: SubmissionType, number: number): string {
  if (!Number.isSafeInteger(repositoryId) || repositoryId <= 0 || !Number.isSafeInteger(number) || number <= 0) {
    throw new RangeError('repositoryId and number must be positive safe integers');
  }
  const word = type === 'pull_request' ? 'pr' : 'issue';
  return 'steward-' + String(repositoryId) + '-' + word + '-' + String(number);
}

export function closureResolution(event: AuthenticatedEvent): ResolutionKind | null {
  if (!event.closure) {
    return null;
  }
  if (event.eventName === 'issues' && event.action === 'deleted') {
    return 'deleted';
  }
  if (event.merged === true) {
    return 'merged';
  }
  if (event.senderId === event.authorId) {
    return 'closed-by-author';
  }
  return 'closed-by-maintainer';
}
