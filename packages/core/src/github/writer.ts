import { z } from 'zod';
import type { FailureCause } from '../vocabulary.js';
import { err, ok } from '../result.js';
import type { Err, FailureDetail, Result } from '../result.js';
import type { GitHubBudget } from './budget.js';
import type { GitHubRepositoryRef } from './reader.js';
import { githubFailure, GITHUB_API_BASE_URL, GITHUB_API_VERSION, GITHUB_USER_AGENT } from './client.js';
import type { GitHubFailureCode, GitHubFetchInit } from './client.js';
import { GITHUB_REQUEST_TIMEOUT_MS, GITHUB_RESPONSE_MAX_BYTES, GITHUB_RETRY_WAIT_MAX_SECONDS } from '../policy/bounds.js';

export const GITHUB_WRITE_FAILURE_CODES = ['github.write-not-allowed', 'github.write-conflict'] as const;

export type GitHubWriteOnlyFailureCode = (typeof GITHUB_WRITE_FAILURE_CODES)[number];

export type GitHubWriteFailureCode = GitHubFailureCode | GitHubWriteOnlyFailureCode;

export const GITHUB_WRITE_FAILURE_CAUSES: { readonly [K in GitHubWriteOnlyFailureCode]: FailureCause } = Object.freeze({
  'github.write-not-allowed': 'steward-defect',
  'github.write-conflict': 'github-unavailable',
});

export function githubWriteFailure<C extends GitHubWriteOnlyFailureCode>(code: C, message: string): Err<C> {
  return err(code, GITHUB_WRITE_FAILURE_CAUSES[code], message);
}

export type GitHubWriteMethod = 'POST' | 'PATCH' | 'DELETE';

export interface GitHubWriteRequest {
  readonly method: GitHubWriteMethod;
  readonly path: string;
  readonly body: Readonly<Record<string, unknown>> | null;
}

export interface GitHubStoreScope {
  readonly repository: GitHubRepositoryRef;
  readonly branch: string;
}

export type GitHubWriteScope =
  { readonly kind: 'app' } | { readonly kind: 'installation'; readonly store: GitHubStoreScope | null };

export interface GitHubWriteFetchInit {
  readonly method: GitHubWriteMethod;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: string;
  readonly signal: AbortSignal;
  readonly redirect: 'manual';
}

export type GitHubWriteFetch = (url: string, init: GitHubWriteFetchInit) => Promise<Response>;

export type GitHubAnyFetch = (url: string, init: GitHubFetchInit | GitHubWriteFetchInit) => Promise<Response>;

export interface GitHubWriterOptions {
  readonly token: string;
  readonly scope: GitHubWriteScope;
  readonly budget: GitHubBudget;
  readonly fetch?: GitHubWriteFetch;
  readonly timeoutMs?: number;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly now?: () => number;
}

export interface GitHubWriter {
  send<T>(request: GitHubWriteRequest, schema: z.ZodType<T>): Promise<Result<T, GitHubWriteFailureCode>>;
  sendNoContent(request: GitHubWriteRequest): Promise<Result<null, GitHubWriteFailureCode>>;
}

export function githubRepositoryPath(repository: GitHubRepositoryRef): string {
  return '/repos/' + encodeURIComponent(repository.owner) + '/' + encodeURIComponent(repository.name);
}

export function githubBranchRefPath(repository: GitHubRepositoryRef, branch: string): string {
  return (
    githubRepositoryPath(repository) +
    '/git/refs/heads/' +
    branch
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/')
  );
}

const TOKEN_MIN_CODE = 33;
const TOKEN_MAX_CODE = 126;
const TOKEN_MAX_LENGTH = 4096;

// eslint-disable-next-line no-control-regex -- control characters are deliberately rejected in request paths
const PATH_FORBIDDEN_PATTERN = /[?#\\\s\x00-\x1f\x7f]/;

const OBJECT_ID_PATTERN = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const ACCESS_TOKENS_PATH_PATTERN = /^\/app\/installations\/[1-9][0-9]{0,19}\/access_tokens$/;
const PERMISSION_KEY_PATTERN = /^[a-z_]{1,64}$/;

function isTokenValid(token: string): boolean {
  if (token.length < 1 || token.length > TOKEN_MAX_LENGTH) return false;
  for (let i = 0; i < token.length; i++) {
    const code = token.charCodeAt(i);
    if (code < TOKEN_MIN_CODE || code > TOKEN_MAX_CODE) return false;
  }
  return true;
}

function hasDotSegment(path: string): boolean {
  return path.split('/').some((segment) => segment === '.' || segment === '..');
}

function buildUrl(path: string): URL | null {
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
  return url;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(body: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  const actual = Object.keys(body).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length) return false;
  for (let i = 0; i < actual.length; i++) {
    if (actual[i] !== expected[i]) return false;
  }
  return true;
}

function isValidAccessTokensBody(body: Readonly<Record<string, unknown>> | null): boolean {
  if (!isPlainObject(body)) return false;
  if (!hasExactKeys(body, ['permissions', 'repositories'])) return false;
  const repositories = body['repositories'];
  if (!Array.isArray(repositories) || repositories.length !== 1) return false;
  const repository = repositories[0];
  if (typeof repository !== 'string' || repository.length < 1 || repository.length > 100) return false;
  const permissions = body['permissions'];
  if (!isPlainObject(permissions) || Array.isArray(permissions)) return false;
  const permissionKeys = Object.keys(permissions);
  if (permissionKeys.length < 1) return false;
  for (const key of permissionKeys) {
    if (!PERMISSION_KEY_PATTERN.test(key)) return false;
    const value = permissions[key];
    if (value !== 'read' && value !== 'write') return false;
  }
  return true;
}

function isValidBlobsBody(body: Readonly<Record<string, unknown>> | null): boolean {
  if (!isPlainObject(body)) return false;
  if (!hasExactKeys(body, ['content', 'encoding'])) return false;
  if (typeof body['content'] !== 'string') return false;
  if (body['encoding'] !== 'base64') return false;
  return true;
}

function isValidTreeEntry(entry: unknown): boolean {
  if (!isPlainObject(entry)) return false;
  if (!hasExactKeys(entry, ['mode', 'path', 'sha', 'type'])) return false;
  if (entry['mode'] !== '100644') return false;
  if (entry['type'] !== 'blob') return false;
  if (typeof entry['path'] !== 'string' || entry['path'].length < 1) return false;
  if (typeof entry['sha'] !== 'string' || !OBJECT_ID_PATTERN.test(entry['sha'])) return false;
  return true;
}

function isValidTreesBody(body: Readonly<Record<string, unknown>> | null): boolean {
  if (!isPlainObject(body)) return false;
  const hasBaseTree = Object.prototype.hasOwnProperty.call(body, 'base_tree');
  const expectedKeys = hasBaseTree ? ['base_tree', 'tree'] : ['tree'];
  if (!hasExactKeys(body, expectedKeys)) return false;
  if (hasBaseTree) {
    const baseTree = body['base_tree'];
    if (typeof baseTree !== 'string' || !OBJECT_ID_PATTERN.test(baseTree)) return false;
  }
  const tree = body['tree'];
  if (!Array.isArray(tree) || tree.length < 1) return false;
  return tree.every(isValidTreeEntry);
}

function isValidCommitsBody(body: Readonly<Record<string, unknown>> | null): boolean {
  if (!isPlainObject(body)) return false;
  if (!hasExactKeys(body, ['message', 'parents', 'tree'])) return false;
  if (typeof body['message'] !== 'string') return false;
  const tree = body['tree'];
  if (typeof tree !== 'string' || !OBJECT_ID_PATTERN.test(tree)) return false;
  const parents = body['parents'];
  if (!Array.isArray(parents) || parents.length > 1) return false;
  return parents.every((parent) => typeof parent === 'string' && OBJECT_ID_PATTERN.test(parent));
}

function isValidRefsCreateBody(body: Readonly<Record<string, unknown>> | null, branch: string): boolean {
  if (!isPlainObject(body)) return false;
  if (!hasExactKeys(body, ['ref', 'sha'])) return false;
  if (body['ref'] !== 'refs/heads/' + branch) return false;
  const sha = body['sha'];
  if (typeof sha !== 'string' || !OBJECT_ID_PATTERN.test(sha)) return false;
  return true;
}

function isValidRefsUpdateBody(body: Readonly<Record<string, unknown>> | null): boolean {
  if (!isPlainObject(body)) return false;
  if (!hasExactKeys(body, ['force', 'sha'])) return false;
  if (body['force'] !== false) return false;
  const sha = body['sha'];
  if (typeof sha !== 'string' || !OBJECT_ID_PATTERN.test(sha)) return false;
  return true;
}

export function isAllowedGitHubWrite(request: GitHubWriteRequest, scope: GitHubWriteScope): boolean {
  if (scope.kind === 'app') {
    return request.method === 'POST' && ACCESS_TOKENS_PATH_PATTERN.test(request.path) && isValidAccessTokensBody(request.body);
  }
  if (request.method === 'DELETE' && request.path === '/installation/token' && request.body === null) {
    return true;
  }
  const store = scope.store;
  if (store === null) return false;
  const repoPath = githubRepositoryPath(store.repository);
  if (request.method === 'POST' && request.path === repoPath + '/git/blobs') {
    return isValidBlobsBody(request.body);
  }
  if (request.method === 'POST' && request.path === repoPath + '/git/trees') {
    return isValidTreesBody(request.body);
  }
  if (request.method === 'POST' && request.path === repoPath + '/git/commits') {
    return isValidCommitsBody(request.body);
  }
  if (request.method === 'POST' && request.path === repoPath + '/git/refs') {
    return isValidRefsCreateBody(request.body, store.branch);
  }
  if (request.method === 'PATCH' && request.path === githubBranchRefPath(store.repository, store.branch)) {
    return isValidRefsUpdateBody(request.body);
  }
  return false;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function defaultFetch(url: string, init: GitHubWriteFetchInit): Promise<Response> {
  return fetch(url, init);
}

function buildHeaders(token: string, hasBody: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    accept: 'application/vnd.github+json',
    'x-github-api-version': GITHUB_API_VERSION,
    'user-agent': GITHUB_USER_AGENT,
    authorization: 'Bearer ' + token,
  };
  if (hasBody) {
    headers['content-type'] = 'application/json';
  }
  return headers;
}

type AttemptOutcome<T> =
  | { readonly kind: 'ok'; readonly value: T }
  | { readonly kind: 'retry'; readonly waitMs: number; readonly failure: Err<GitHubWriteFailureCode> }
  | { readonly kind: 'final'; readonly failure: Err<GitHubWriteFailureCode> };

type BodyReadOutcome =
  | { readonly kind: 'ok'; readonly bytes: Uint8Array }
  | { readonly kind: 'too-large' }
  | { readonly kind: 'timeout' }
  | { readonly kind: 'network-retry' };

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

function writeFailureFromGitHub(failure: Err<GitHubFailureCode>): Err<GitHubWriteFailureCode> {
  return failure;
}

export function createGitHubWriter(options: GitHubWriterOptions): GitHubWriter {
  const doFetch = options.fetch ?? defaultFetch;
  const timeoutMs = options.timeoutMs ?? GITHUB_REQUEST_TIMEOUT_MS;
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const token = options.token;
  const scope = options.scope;
  const budget = options.budget;

  function precheck(request: GitHubWriteRequest): { readonly url: URL } | { readonly failure: Err<GitHubWriteFailureCode> } {
    if (!isTokenValid(token)) {
      return { failure: githubFailure('github.invalid-request', 'The GitHub token is not a valid header value.') };
    }
    const url = buildUrl(request.path);
    if (url === null) {
      return { failure: githubFailure('github.invalid-request', `The GitHub request path "${request.path}" is not valid.`) };
    }
    if (!isAllowedGitHubWrite(request, scope)) {
      return { failure: githubWriteFailure('github.write-not-allowed', 'The GitHub write is not allowed.') };
    }
    return { url };
  }

  async function attempt(
    url: URL,
    request: GitHubWriteRequest,
    retriesUsed: number,
    expectContent: boolean,
  ): Promise<AttemptOutcome<{ readonly value: unknown } | null>> {
    const hasBody = request.body !== null;
    const headers = buildHeaders(token, hasBody);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      const init: GitHubWriteFetchInit = {
        method: request.method,
        headers,
        signal: controller.signal,
        redirect: 'manual',
        ...(hasBody ? { body: JSON.stringify(request.body) } : {}),
      };
      response = await doFetch(url.href, init);
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
      if (status === 200 || status === 201) {
        if (!expectContent) {
          void response.body?.cancel().catch(() => undefined);
          return {
            kind: 'final',
            failure: githubFailure('github.unexpected-status', 'The GitHub API responded with an unexpected status 200.'),
          };
        }
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
        return { kind: 'ok', value: { value: parsed } };
      }
      if (status === 204) {
        void response.body?.cancel().catch(() => undefined);
        if (expectContent) {
          return {
            kind: 'final',
            failure: githubFailure('github.unexpected-status', 'The GitHub API responded with an unexpected status 204.'),
          };
        }
        return { kind: 'ok', value: null };
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
      if (status === 422) {
        return {
          kind: 'final',
          failure: githubWriteFailure('github.write-conflict', 'The GitHub API rejected the write as conflicting.'),
        };
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

  async function requestOnce(
    url: URL,
    request: GitHubWriteRequest,
    expectContent: boolean,
  ): Promise<Result<{ readonly value: unknown } | null, GitHubWriteFailureCode>> {
    let retriesUsed = 0;
    for (;;) {
      if (!budget.tryCharge()) {
        return githubFailure('github.budget-exhausted', 'The GitHub request budget for this run is exhausted.');
      }
      const outcome = await attempt(url, request, retriesUsed, expectContent);
      if (outcome.kind === 'ok') {
        return ok(outcome.value);
      }
      if (outcome.kind === 'final') {
        return writeFailureFromGitHub(outcome.failure as Err<GitHubFailureCode>);
      }
      if (retriesUsed < budget.limits.retriesPerRequest) {
        retriesUsed += 1;
        await sleep(outcome.waitMs);
        continue;
      }
      return writeFailureFromGitHub(outcome.failure as Err<GitHubFailureCode>);
    }
  }

  async function send<T>(request: GitHubWriteRequest, schema: z.ZodType<T>): Promise<Result<T, GitHubWriteFailureCode>> {
    const pre = precheck(request);
    if ('failure' in pre) return pre.failure;
    const result = await requestOnce(pre.url, request, true);
    if (!result.ok) return result;
    const parsed = schema.safeParse(result.value === null ? null : result.value.value);
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

  async function sendNoContent(request: GitHubWriteRequest): Promise<Result<null, GitHubWriteFailureCode>> {
    const pre = precheck(request);
    if ('failure' in pre) return pre.failure;
    const result = await requestOnce(pre.url, request, false);
    if (!result.ok) return result;
    return ok(null);
  }

  return { send, sendNoContent };
}
