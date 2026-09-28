import { z } from 'zod';
import type { RunListItem, RunListQueryResult } from '../ownership/caps.js';
import { runListQueryDate } from '../ownership/caps.js';
import { RUN_LIST_PAGES_MAX } from '../policy/bounds.js';
import type { StewardFailure } from '../result.js';
import { ok } from '../result.js';
import type { Result } from '../result.js';
import type { GitHubClient, GitHubFailureCode } from './client.js';
import { githubFailure } from './client.js';
import type { GitHubRepositoryRef } from './reader.js';
import { repositoryRefFromFullName } from './reader.js';

export const githubWorkflowRunSchema = z.object({
  id: z.int().positive(),
  path: z.string().max(1024),
  event: z.string().max(64),
  status: z.string().max(64).nullable(),
  created_at: z.string().max(64),
  display_title: z.string().max(65536),
});

export type RunListFilter =
  | { readonly kind: 'created-since'; readonly date: string }
  | { readonly kind: 'status'; readonly status: 'in_progress' | 'queued' };

const CREATED_SINCE_DATE_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

export async function readRunList(
  client: GitHubClient,
  repository: GitHubRepositoryRef,
  filter: RunListFilter,
): Promise<Result<RunListQueryResult, GitHubFailureCode>> {
  if (repositoryRefFromFullName(`${repository.owner}/${repository.name}`) === null) {
    return githubFailure('github.invalid-request', 'The repository reference is not valid.');
  }
  let query: Record<string, string>;
  if (filter.kind === 'created-since') {
    if (!CREATED_SINCE_DATE_PATTERN.test(filter.date)) {
      return githubFailure('github.invalid-request', 'The created-since date is not valid.');
    }
    query = { created: `>=${filter.date}` };
  } else {
    if (filter.status !== 'in_progress' && filter.status !== 'queued') {
      return githubFailure('github.invalid-request', 'The run status filter is not valid.');
    }
    query = { status: filter.status };
  }
  const path = `/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/actions/runs`;
  const result = await client.getPaginatedList(path, 'workflow_runs', githubWorkflowRunSchema, query, RUN_LIST_PAGES_MAX);
  if (!result.ok) return result;
  const items: RunListItem[] = result.value.items.map((item) => ({
    id: item.id,
    path: item.path,
    event: item.event,
    status: item.status ?? '',
    createdAt: item.created_at,
    displayTitle: item.display_title,
  }));
  return ok({ items, totalCount: result.value.totalCount, complete: result.value.complete });
}

export interface CapRunLists {
  readonly createdToday: RunListQueryResult;
  readonly inProgress: RunListQueryResult;
  readonly queued: RunListQueryResult;
  readonly failure: StewardFailure | null;
}

const EMPTY_INCOMPLETE_RESULT: RunListQueryResult = { items: [], totalCount: 0, complete: false };

export async function readCapRunLists(client: GitHubClient, repository: GitHubRepositoryRef, now: Date): Promise<CapRunLists> {
  const createdTodayResult = await readRunList(client, repository, { kind: 'created-since', date: runListQueryDate(now) });
  if (!createdTodayResult.ok) {
    return {
      createdToday: EMPTY_INCOMPLETE_RESULT,
      inProgress: EMPTY_INCOMPLETE_RESULT,
      queued: EMPTY_INCOMPLETE_RESULT,
      failure: createdTodayResult.failure,
    };
  }

  const inProgressResult = await readRunList(client, repository, { kind: 'status', status: 'in_progress' });
  if (!inProgressResult.ok) {
    return {
      createdToday: createdTodayResult.value,
      inProgress: EMPTY_INCOMPLETE_RESULT,
      queued: EMPTY_INCOMPLETE_RESULT,
      failure: inProgressResult.failure,
    };
  }

  const queuedResult = await readRunList(client, repository, { kind: 'status', status: 'queued' });
  if (!queuedResult.ok) {
    return {
      createdToday: createdTodayResult.value,
      inProgress: inProgressResult.value,
      queued: EMPTY_INCOMPLETE_RESULT,
      failure: queuedResult.failure,
    };
  }

  return {
    createdToday: createdTodayResult.value,
    inProgress: inProgressResult.value,
    queued: queuedResult.value,
    failure: null,
  };
}
