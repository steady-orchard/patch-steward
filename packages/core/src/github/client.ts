import { z } from 'zod';
import type { FailureCause } from '../vocabulary.js';
import { err, ok } from '../result.js';
import type { Err, FailureDetail, Result } from '../result.js';
import type { GitHubBudget } from './budget.js';
import {
  GITHUB_PAGES_MAX,
  GITHUB_PAGE_SIZE,
  GITHUB_REQUEST_TIMEOUT_MS,
  GITHUB_RESPONSE_MAX_BYTES,
  GITHUB_RETRY_WAIT_MAX_SECONDS,
} from '../policy/bounds.js';

export const GITHUB_API_BASE_URL = 'https://api.github.com';
export const GITHUB_API_VERSION = '2022-11-28';
export const GITHUB_USER_AGENT = 'patch-steward';

export const GITHUB_FAILURE_CODES = [
  'github.network',
  'github.timeout',
  'github.server-error',
  'github.rate-limited',
  'github.unauthorized',
  'github.not-found',
  'github.unexpected-status',
  'github.response-too-large',
  'github.malformed-response',
  'github.schema-mismatch',
  'github.pagination-exceeded',
  'github.pagination-invalid',
  'github.budget-exhausted',
  'github.invalid-request',
  'github.not-an-issue',
  'github.not-a-directory',
  'github.blob-too-large',
] as const;

export type GitHubFailureCode = (typeof GITHUB_FAILURE_CODES)[number];

export const GITHUB_FAILURE_CAUSES: { readonly [K in GitHubFailureCode]: FailureCause } = Object.freeze({
  'github.network': 'github-unavailable',
  'github.timeout': 'github-unavailable',
  'github.server-error': 'github-unavailable',
  'github.rate-limited': 'rate-limited',
  'github.unauthorized': 'github-unavailable',
  'github.not-found': 'github-unavailable',
  'github.unexpected-status': 'github-unavailable',
  'github.response-too-large': 'github-unavailable',
  'github.malformed-response': 'github-unavailable',
  'github.schema-mismatch': 'github-unavailable',
  'github.pagination-exceeded': 'github-unavailable',
  'github.pagination-invalid': 'github-unavailable',
  'github.budget-exhausted': 'budget-exhausted',
  'github.invalid-request': 'steward-defect',
  'github.not-an-issue': 'github-unavailable',
  'github.not-a-directory': 'github-unavailable',
  'github.blob-too-large': 'github-unavailable',
});

export function githubFailure<C extends GitHubFailureCode>(code: C, message: string, details?: readonly FailureDetail[]): Err<C> {
  return err(code, GITHUB_FAILURE_CAUSES[code], message, details ?? []);
}

export interface GitHubFetchInit {
  readonly method: 'GET';
  readonly headers: Readonly<Record<string, string>>;
  readonly signal: AbortSignal;
  readonly redirect: 'manual';
}

export type GitHubFetch = (url: string, init: GitHubFetchInit) => Promise<Response>;

export type GitHubQuery = Readonly<Record<string, string>>;

export interface GitHubClientOptions {
  readonly token: string | null;
  readonly budget: GitHubBudget;
  readonly fetch?: GitHubFetch;
  readonly timeoutMs?: number;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly now?: () => number;
}

export interface GitHubClient {
  getJson<T>(path: string, schema: z.ZodType<T>, query?: GitHubQuery): Promise<Result<T, GitHubFailureCode>>;
  getPaginated<T>(
    path: string,
    itemSchema: z.ZodType<T>,
    query?: GitHubQuery,
    maxPages?: number,
  ): Promise<Result<readonly T[], GitHubFailureCode>>;
}

const TOKEN_PATTERN = /^[\x21-\x7e]{1,4096}$/;
// eslint-disable-next-line no-control-regex -- control characters are deliberately rejected in request paths
const PATH_FORBIDDEN_PATTERN = /[?#\\\s\x00-\x1f\x7f]/;

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function defaultFetch(url: string, init: GitHubFetchInit): Promise<Response> {
  return fetch(url, init);
}

function hasDotSegment(path: string): boolean {
  return path.split('/').some((segment) => segment === '.' || segment === '..');
}

function buildUrl(path: string, query: GitHubQuery | undefined): URL | null {
  if (!path.startsWith('/') || path.startsWith('//')) return null;
  if (PATH_FORBIDDEN_PATTERN.test(path)) return null;
  if (hasDotSegment(path)) return null;
  let url: URL;
  try {
    url = new URL(GITHUB_API_BASE_URL + path);
  } catch {
    return null;
  }
  if (url.origin !== GITHUB_API_BASE_URL || url.pathname !== path) return null;
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
  }
  return url;
}

function buildHeaders(token: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    accept: 'application/vnd.github+json',
    'x-github-api-version': GITHUB_API_VERSION,
    'user-agent': GITHUB_USER_AGENT,
  };
  if (token !== null) {
    headers['authorization'] = `Bearer ${token}`;
  }
  return headers;
}

type AttemptOutcome =
  | { readonly kind: 'ok'; readonly value: unknown; readonly linkHeader: string | null }
  | { readonly kind: 'retry'; readonly waitMs: number; readonly failure: Err<GitHubFailureCode> }
  | { readonly kind: 'final'; readonly failure: Err<GitHubFailureCode> };

type BodyReadOutcome =
  | { readonly kind: 'ok'; readonly bytes: Uint8Array }
  | { readonly kind: 'too-large' }
  | { readonly kind: 'timeout' }
  | { readonly kind: 'network-retry' };

interface LinkResult {
  readonly nextUrl: string | null;
}

function parseLinkHeader(linkHeader: string | null): Result<LinkResult, GitHubFailureCode> {
  if (linkHeader === null || linkHeader.trim() === '') {
    return ok({ nextUrl: null });
  }
  const parts = linkHeader.split(',');
  const nextUrls: string[] = [];
  const partPattern = /^\s*<([^<>\s]+)>\s*;\s*rel="([a-z ]+)"\s*$/;
  for (const part of parts) {
    const match = partPattern.exec(part);
    if (!match) {
      return githubFailure('github.pagination-invalid', 'The Link header could not be parsed.');
    }
    const target = match[1] as string;
    const rels = (match[2] as string).split(' ');
    if (rels.includes('next')) {
      nextUrls.push(target);
    }
  }
  if (nextUrls.length > 1) {
    return githubFailure('github.pagination-invalid', 'The Link header names more than one next page.');
  }
  if (nextUrls.length === 0) {
    return ok({ nextUrl: null });
  }
  const nextUrl = nextUrls[0] as string;
  let parsed: URL;
  try {
    parsed = new URL(nextUrl);
  } catch {
    return githubFailure('github.pagination-invalid', 'The next page link is not a valid URL.');
  }
  if (parsed.origin !== GITHUB_API_BASE_URL) {
    return githubFailure('github.pagination-invalid', 'The next page link is not on the GitHub API origin.');
  }
  return ok({ nextUrl });
}

export function createGitHubClient(options: GitHubClientOptions): GitHubClient {
  const doFetch = options.fetch ?? defaultFetch;
  const timeoutMs = options.timeoutMs ?? GITHUB_REQUEST_TIMEOUT_MS;
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const token = options.token;
  const budget = options.budget;

  function tokenIsValid(): boolean {
    return token === null || TOKEN_PATTERN.test(token);
  }

  async function readBoundedBody(response: Response, signal: AbortSignal): Promise<BodyReadOutcome> {
    const contentLength = response.headers.get('content-length');
    if (contentLength !== null && /^\d+$/.test(contentLength) && Number(contentLength) > GITHUB_RESPONSE_MAX_BYTES) {
      void response.body?.cancel().catch(() => undefined);
      return { kind: 'too-large' };
    }
    if (response.body === null) {
      return { kind: 'ok', bytes: new Uint8Array(0) };
    }
    if (signal.aborted) {
      return { kind: 'timeout' };
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    const onAbort = (): void => {
      void reader.cancel().catch(() => undefined);
    };
    signal.addEventListener('abort', onAbort);
    try {
      for (;;) {
        let step: ReadableStreamReadResult<Uint8Array>;
        try {
          step = await reader.read();
        } catch {
          if (signal.aborted) {
            return { kind: 'timeout' };
          }
          return { kind: 'network-retry' };
        }
        if (signal.aborted) {
          return { kind: 'timeout' };
        }
        if (step.done) break;
        total += step.value.byteLength;
        if (total > GITHUB_RESPONSE_MAX_BYTES) {
          void reader.cancel().catch(() => undefined);
          return { kind: 'too-large' };
        }
        chunks.push(step.value);
      }
      const combined = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return { kind: 'ok', bytes: combined };
    } finally {
      signal.removeEventListener('abort', onAbort);
    }
  }

  async function attempt(url: URL, retriesUsed: number): Promise<AttemptOutcome> {
    const headers = buildHeaders(token);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await doFetch(url.href, {
        method: 'GET',
        headers,
        signal: controller.signal,
        redirect: 'manual',
      });
    } catch {
      clearTimeout(timer);
      if (controller.signal.aborted) {
        return { kind: 'final', failure: githubFailure('github.timeout', 'The request timed out.') };
      }
      return {
        kind: 'retry',
        waitMs: 1000 * (retriesUsed + 1),
        failure: githubFailure('github.network', 'A network error occurred while contacting the GitHub API.'),
      };
    }
    try {
      const status = response.status;
      if (status >= 200 && status <= 299) {
        const bodyResult = await readBoundedBody(response, controller.signal);
        if (bodyResult.kind === 'too-large') {
          return {
            kind: 'final',
            failure: githubFailure('github.response-too-large', 'The response body exceeds the allowed size.'),
          };
        }
        if (bodyResult.kind === 'timeout') {
          return { kind: 'final', failure: githubFailure('github.timeout', 'The request timed out.') };
        }
        if (bodyResult.kind === 'network-retry') {
          return {
            kind: 'retry',
            waitMs: 1000 * (retriesUsed + 1),
            failure: githubFailure('github.network', 'A network error occurred while reading the response body.'),
          };
        }
        let text: string;
        try {
          text = new TextDecoder('utf-8', { fatal: true }).decode(bodyResult.bytes);
        } catch {
          return { kind: 'final', failure: githubFailure('github.malformed-response', 'The response body is not valid UTF-8.') };
        }
        if (text === '') {
          return { kind: 'final', failure: githubFailure('github.malformed-response', 'The response body is empty.') };
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          return { kind: 'final', failure: githubFailure('github.malformed-response', 'The response body is not valid JSON.') };
        }
        return { kind: 'ok', value: parsed, linkHeader: response.headers.get('link') };
      }
      void response.body?.cancel().catch(() => undefined);
      if (status === 401) {
        return {
          kind: 'final',
          failure: githubFailure('github.unauthorized', 'The GitHub API rejected the request as unauthorized.'),
        };
      }
      if (status === 404) {
        return { kind: 'final', failure: githubFailure('github.not-found', 'The requested GitHub resource was not found.') };
      }
      if (status === 403 || status === 429) {
        const retryAfter = response.headers.get('retry-after');
        let waitMs: number | null = null;
        if (retryAfter !== null) {
          if (/^\d{1,6}$/.test(retryAfter)) {
            waitMs = Number(retryAfter) * 1000;
          } else {
            return {
              kind: 'final',
              failure: githubFailure('github.rate-limited', 'The GitHub API rate limit response could not be parsed.'),
            };
          }
        } else {
          const remaining = response.headers.get('x-ratelimit-remaining');
          if (remaining === '0') {
            const reset = response.headers.get('x-ratelimit-reset');
            if (reset !== null && /^\d{1,12}$/.test(reset)) {
              waitMs = Math.max(0, Number(reset) * 1000 - now());
            } else {
              return {
                kind: 'final',
                failure: githubFailure('github.rate-limited', 'The GitHub API rate limit reset time could not be parsed.'),
              };
            }
          } else if (status === 429) {
            waitMs = GITHUB_RETRY_WAIT_MAX_SECONDS * 1000;
          } else {
            return {
              kind: 'final',
              failure: githubFailure('github.unauthorized', 'The GitHub API rejected the request as forbidden.'),
            };
          }
        }
        if (waitMs > GITHUB_RETRY_WAIT_MAX_SECONDS * 1000) {
          return {
            kind: 'final',
            failure: githubFailure('github.rate-limited', 'The GitHub API rate limit wait exceeds the allowed maximum.'),
          };
        }
        return {
          kind: 'retry',
          waitMs,
          failure: githubFailure('github.rate-limited', 'The GitHub API responded with a rate limit.'),
        };
      }
      if (status >= 500 && status <= 599) {
        return {
          kind: 'retry',
          waitMs: 1000 * (retriesUsed + 1),
          failure: githubFailure('github.server-error', 'The GitHub API responded with a server error.'),
        };
      }
      return {
        kind: 'final',
        failure: githubFailure('github.unexpected-status', `The GitHub API responded with an unexpected status ${String(status)}.`),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  interface PageResponse {
    readonly value: unknown;
    readonly linkHeader: string | null;
  }

  async function requestOnce(url: URL): Promise<Result<PageResponse, GitHubFailureCode>> {
    let retriesUsed = 0;
    for (;;) {
      if (!budget.tryCharge()) {
        return githubFailure('github.budget-exhausted', 'The GitHub request budget for this run is exhausted.');
      }
      const outcome = await attempt(url, retriesUsed);
      if (outcome.kind === 'ok') {
        return ok({ value: outcome.value, linkHeader: outcome.linkHeader });
      }
      if (outcome.kind === 'final') {
        return outcome.failure;
      }
      if (retriesUsed < budget.limits.retriesPerRequest) {
        retriesUsed += 1;
        await sleep(outcome.waitMs);
        continue;
      }
      return outcome.failure;
    }
  }

  async function getJson<T>(path: string, schema: z.ZodType<T>, query?: GitHubQuery): Promise<Result<T, GitHubFailureCode>> {
    if (!tokenIsValid()) {
      return githubFailure('github.invalid-request', 'The GitHub token is not a valid header value.');
    }
    const url = buildUrl(path, query);
    if (url === null) {
      return githubFailure('github.invalid-request', `The GitHub request path "${path}" is not valid.`);
    }
    const result = await requestOnce(url);
    if (!result.ok) return result;
    const parsed = schema.safeParse(result.value.value);
    if (!parsed.success) {
      const details: FailureDetail[] = parsed.error.issues.slice(0, 10).map((issue) => ({
        code: 'github.schema-mismatch',
        path: issue.path.join('.'),
        message: issue.message,
        line: null,
        column: null,
      }));
      return githubFailure('github.schema-mismatch', 'The GitHub API response did not match the expected schema.', details);
    }
    return ok(parsed.data);
  }

  async function getPaginated<T>(
    path: string,
    itemSchema: z.ZodType<T>,
    query?: GitHubQuery,
    maxPages?: number,
  ): Promise<Result<readonly T[], GitHubFailureCode>> {
    if (!tokenIsValid()) {
      return githubFailure('github.invalid-request', 'The GitHub token is not a valid header value.');
    }
    const limit = Math.min(Math.max(maxPages ?? GITHUB_PAGES_MAX, 1), GITHUB_PAGES_MAX);
    const firstUrl = buildUrl(path, { ...(query ?? {}), per_page: String(GITHUB_PAGE_SIZE) });
    if (firstUrl === null) {
      return githubFailure('github.invalid-request', `The GitHub request path "${path}" is not valid.`);
    }
    const items: T[] = [];
    const arraySchema = z.array(itemSchema);
    let currentUrl: URL | null = firstUrl;
    let pageNumber = 0;
    while (currentUrl !== null) {
      pageNumber += 1;
      const result = await requestOnce(currentUrl);
      if (!result.ok) return result;
      const parsed = arraySchema.safeParse(result.value.value);
      if (!parsed.success) {
        const details: FailureDetail[] = parsed.error.issues.slice(0, 10).map((issue) => ({
          code: 'github.schema-mismatch',
          path: issue.path.join('.'),
          message: issue.message,
          line: null,
          column: null,
        }));
        return githubFailure('github.schema-mismatch', 'The GitHub API response did not match the expected schema.', details);
      }
      items.push(...parsed.data);

      const linkResult = parseLinkHeader(result.value.linkHeader);
      if (!linkResult.ok) return linkResult;
      if (linkResult.value.nextUrl === null) {
        currentUrl = null;
      } else {
        if (pageNumber >= limit) {
          return githubFailure('github.pagination-exceeded', 'The response has more pages than the allowed maximum.');
        }
        let parsedNext: URL;
        try {
          parsedNext = new URL(linkResult.value.nextUrl);
        } catch {
          return githubFailure('github.pagination-invalid', 'The next page link is not a valid URL.');
        }
        currentUrl = parsedNext;
      }
    }
    return ok(items);
  }

  return { getJson, getPaginated };
}
