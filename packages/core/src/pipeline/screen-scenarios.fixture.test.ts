import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';

import { fixedClock, fixedRandom } from '../clock.js';
import { exactValueForms } from '../redaction/redact.js';
import { maskCodeSpans, reportDenylistMatches } from '../report/denylist.js';
import { reportCharacterViolations } from '../report/escape.js';
import type { GitHubFetch } from '../github/client.js';
import type { GitHubRepositoryRef } from '../github/reader.js';
import type {
  AttachmentAddress,
  AttachmentResolver,
  AttachmentTransport,
  AttachmentTransportResponse,
} from '../net/attachment-fetch.js';
import { screenSubmission } from './screen.js';

const TESTBED_REPO: GitHubRepositoryRef = { owner: 'steady-orchard', name: 'patch-steward-testbed-public' };
const EXAMPLE_REPO: GitHubRepositoryRef = { owner: 'example-owner', name: 'example-repo' };
const T_BASE = '/repos/steady-orchard/patch-steward-testbed-public';
const Y_BASE = '/repos/example-owner/example-repo';
const CLOCK = fixedClock('2026-09-27T10:15:00.000Z');
const RANDOM = fixedRandom('3f9a1c2e');
const SENTINEL = 'sentinel-' + 'Q7wZ'.repeat(6);

const REQUIRED_CASES = [
  'issue-defect-complete',
  'issue-unstructured',
  'pr-bugfix-complete',
  'pr-field-missing',
  'pr-execution-sensitive',
  'pr-shared-head',
  'issue-required-attachment-unavailable',
  'pr-linked-issue-unavailable',
  'synthetic-published-policy',
  'synthetic-local-policy-file',
  'testbed-no-published-policy',
  'invalid-policy-file',
  'unwritable-evidence-directory',
  'sentinel-token',
] as const;

const corpusRoot = fileURLToPath(new URL('../../../../fixtures/', import.meta.url));
const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const expectationsPath = fileURLToPath(new URL('../../../../fixtures/screen/expectations.json', import.meta.url));

interface CaseSubmission {
  readonly type: 'issue' | 'pull_request';
  readonly number: number;
}

interface CaseReplace {
  readonly from: string;
  readonly to: string;
}

interface CasePolicy {
  readonly source: 'trusted-branch' | 'local-file';
  readonly path?: string;
}

interface CaseExpect {
  readonly exit_status: number;
  readonly run_directory: boolean;
  readonly outcome?: string;
  readonly finding_codes?: readonly string[];
  readonly contributing_codes?: readonly string[];
  readonly causes?: readonly string[];
  readonly authoritative?: boolean;
  readonly policy_revision?: string;
  readonly error_code?: string;
  readonly token_absent?: boolean;
}

interface Case {
  readonly name: string;
  readonly repository: 'testbed' | 'synthetic';
  readonly submission: CaseSubmission;
  readonly body: string | null;
  readonly replace?: readonly CaseReplace[];
  readonly files?: string;
  readonly shared_head?: readonly number[];
  readonly linked_issue?: string;
  readonly attachments?: string;
  readonly policy: CasePolicy;
  readonly token?: string;
  readonly evidence_dir?: string;
  readonly expect: CaseExpect;
}

interface Expectations {
  readonly cases: readonly Case[];
}

const expectations: Expectations = JSON.parse(readFileSync(expectationsPath, 'utf8')) as Expectations;

const tmpDirs: string[] = [];

function makeTmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'm5-scn-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tmpDirs.length > 0) {
    const dir = tmpDirs.pop();
    if (dir !== undefined) {
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  }
});

function readFixtureText(relPath: string): string {
  return readFileSync(join(corpusRoot, relPath), 'utf8').replace(/\r\n/g, '\n');
}

function readJsonFixture(relPath: string): unknown {
  return JSON.parse(readFixtureText(relPath));
}

function fixtureExists(relPath: string): boolean {
  return existsSync(join(corpusRoot, relPath));
}

function repoRootPath(relPath: string): string {
  return join(repositoryRoot, relPath);
}

type RouteValue = unknown | number;
type RouteMap = Record<string, RouteValue>;

function makeFetch(routes: RouteMap): GitHubFetch {
  return (url: string) => {
    const pathname = new URL(url).pathname;
    if (!(pathname in routes)) {
      return Promise.resolve(new Response('{}', { status: 404 }));
    }
    const value = routes[pathname];
    if (typeof value === 'number') {
      return Promise.resolve(new Response('{}', { status: value }));
    }
    return Promise.resolve(new Response(JSON.stringify(value), { status: 200 }));
  };
}

function withBody(fixture: unknown, body: string | null): unknown {
  if (body === null) return fixture;
  return { ...(fixture as Record<string, unknown>), body };
}

function fakeResolver(): AttachmentResolver {
  return async (): Promise<readonly AttachmentAddress[]> => [{ address: '140.82.112.3', family: 4 }];
}

function bodyFrom(bytes: Uint8Array): AsyncIterable<Uint8Array> {
  return {
    [Symbol.asyncIterator]() {
      let sent = false;
      return {
        async next(): Promise<IteratorResult<Uint8Array>> {
          if (!sent) {
            sent = true;
            return { done: false, value: bytes };
          }
          return { done: true, value: undefined };
        },
      };
    },
  };
}

function fakeTransport(kind: string | undefined): AttachmentTransport {
  if (kind === 'error') {
    return async (): Promise<AttachmentTransportResponse> => ({ kind: 'error', reason: 'network' });
  }
  return async (): Promise<AttachmentTransportResponse> => ({
    kind: 'response',
    status: 200,
    location: null,
    body: bodyFrom(new Uint8Array([104, 105])),
    close: () => undefined,
  });
}

async function noopSleep(): Promise<void> {
  return undefined;
}

function applyReplacements(text: string, replace: readonly CaseReplace[] | undefined, token: string | undefined): string {
  if (replace === undefined) return text;
  const forms = token !== undefined ? exactValueForms(token) : [];
  let result = text;
  for (const rule of replace) {
    const occurrences = result.split(rule.from).length - 1;
    if (occurrences !== 1) {
      throw new Error(`expected exactly one occurrence of "${rule.from}"`);
    }
    const to = rule.to
      .replace('{token-basic-auth-base64}', forms[2] ?? '')
      .replace('{token-base64}', forms[1] ?? '')
      .replace('{token}', forms[0] ?? '');
    result = result.split(rule.from).join(to);
  }
  return result;
}

interface PathChangeLike {
  readonly kind: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied' | 'type-changed';
  readonly path: string;
  readonly previousPath: string | null;
}

function statusForKind(kind: PathChangeLike['kind']): string {
  switch (kind) {
    case 'added':
      return 'added';
    case 'modified':
      return 'modified';
    case 'deleted':
      return 'removed';
    case 'renamed':
      return 'renamed';
    case 'copied':
      return 'copied';
    case 'type-changed':
      return 'changed';
  }
}

function filesOverrideToGitHubItems(changes: readonly PathChangeLike[]): readonly unknown[] {
  return changes.map((change) => ({
    filename: change.path,
    status: statusForKind(change.kind),
    ...(change.previousPath !== null ? { previous_filename: change.previousPath } : {}),
  }));
}

function buildRoutes(testCase: Case, resolvedBody: string | null): RouteMap {
  const routes: RouteMap = {};

  if (testCase.repository === 'testbed') {
    routes[T_BASE] = readJsonFixture('github/testbed/repository.json');
    if (testCase.policy.source === 'trusted-branch') {
      routes[`${T_BASE}/git/ref/heads/master`] = readJsonFixture('github/testbed/ref-heads-master.json');
      routes[`${T_BASE}/contents/.github`] = readJsonFixture('github/testbed/contents-github.json');
    }

    if (testCase.submission.type === 'issue') {
      routes[`${T_BASE}/issues/${testCase.submission.number}`] = withBody(
        readJsonFixture('github/testbed/issue-29.json'),
        resolvedBody,
      );
    } else {
      const n = testCase.submission.number;
      const pull = readJsonFixture(`github/testbed/pull-${n}.json`) as Record<string, unknown>;
      let pullOverride = withBody(pull, resolvedBody) as Record<string, unknown>;

      if (testCase.files !== undefined) {
        const changes = readJsonFixture(`submissions/${testCase.files}`) as readonly PathChangeLike[];
        pullOverride = { ...pullOverride, changed_files: changes.length };
        routes[`${T_BASE}/pulls/${n}/files`] = filesOverrideToGitHubItems(changes);
      } else {
        routes[`${T_BASE}/pulls/${n}/files`] = readJsonFixture(`github/testbed/pull-${n}-files.json`);
      }
      routes[`${T_BASE}/pulls/${n}`] = pullOverride;

      const head = pullOverride.head as { sha: string };
      const headSha = head.sha;
      if (testCase.shared_head !== undefined) {
        const base = (
          readJsonFixture('github/testbed/commit-pulls-b46eef5.json') as readonly Record<string, unknown>[]
        )[0] as Record<string, unknown>;
        const numbers = [n, ...testCase.shared_head];
        routes[`${T_BASE}/commits/${headSha}/pulls`] = numbers.map((number) => ({
          ...base,
          number,
          state: 'open',
          head: { ...(base.head as Record<string, unknown>), sha: headSha },
        }));
      } else {
        routes[`${T_BASE}/commits/${headSha}/pulls`] = readJsonFixture('github/testbed/commit-pulls-b46eef5.json');
      }

      if (testCase.linked_issue === 'unavailable') {
        routes[`${T_BASE}/issues/29`] = 500;
      } else {
        routes[`${T_BASE}/issues/29`] = readJsonFixture('github/testbed/issue-29.json');
      }
    }
  } else {
    routes[Y_BASE] = { full_name: 'example-owner/example-repo', default_branch: 'main', private: false };
    if (testCase.policy.source === 'trusted-branch') {
      routes[`${Y_BASE}/git/ref/heads/main`] = readJsonFixture('github/policy-directory/ref-heads-main.json');
      routes[`${Y_BASE}/contents/.github`] = readJsonFixture('github/policy-directory/contents-github.json');
      routes[`${Y_BASE}/git/trees/a8c2485882b52f63db71b1ec63b12f5039220e03`] = readJsonFixture('github/policy-directory/tree.json');
      routes[`${Y_BASE}/git/blobs/716098133e97314ccf047f5034cc8f76161d8f0d`] = readJsonFixture(
        'github/policy-directory/blob-policy.json',
      );
    }
    routes[`${Y_BASE}/issues/${testCase.submission.number}`] = withBody(
      readJsonFixture('github/testbed/issue-29.json'),
      resolvedBody,
    );
  }

  return routes;
}

function policySourceFor(
  testCase: Case,
): { readonly kind: 'trusted-branch' } | { readonly kind: 'local-file'; readonly path: string } {
  if (testCase.policy.source === 'trusted-branch') return { kind: 'trusted-branch' };
  return { kind: 'local-file', path: repoRootPath(testCase.policy.path as string) };
}

function listFilesRecursively(dir: string): readonly string[] {
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir, { recursive: true }) as string[];
  return entries
    .map((entry) => entry.split('\\').join('/'))
    .filter((entry) => {
      const full = join(dir, entry);
      return existsSync(full) && statSync(full).isFile();
    });
}

function hasManifestFile(dir: string): boolean {
  return listFilesRecursively(dir).some((entry) => entry.endsWith('manifest.json'));
}

function tmpContainsAnyForm(dir: string, forms: readonly string[]): boolean {
  if (forms.length === 0) return false;
  for (const entry of listFilesRecursively(dir)) {
    const text = readFileSync(join(dir, entry), 'utf8');
    if (forms.some((form) => text.includes(form))) return true;
  }
  return false;
}

describe('screen scenario fixture corpus', () => {
  it('every required screen scenario has a case', () => {
    const names = expectations.cases.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
    expect([...names].sort()).toEqual([...REQUIRED_CASES].sort());
  });

  it('every screen scenario names existing files', () => {
    for (const testCase of expectations.cases) {
      if (testCase.body !== null) {
        expect(fixtureExists(`submissions/${testCase.body}`), `missing submission fixture ${testCase.body}`).toBe(true);
      }
      if (testCase.files !== undefined) {
        expect(fixtureExists(`submissions/${testCase.files}`), `missing diff fixture ${testCase.files}`).toBe(true);
      }
      if (testCase.policy.source === 'local-file') {
        const path = testCase.policy.path as string;
        expect(existsSync(repoRootPath(path)), `missing policy file ${path}`).toBe(true);
      }
    }
  });

  it.each(expectations.cases.map((c) => [c.name, c] as const))('screen scenario %s', async (_name, testCase) => {
    const tmp = makeTmpDir();
    try {
      const rawBody = testCase.body !== null ? readFixtureText(`submissions/${testCase.body}`) : null;
      const resolvedBody = rawBody !== null ? applyReplacements(rawBody, testCase.replace, testCase.token) : null;

      const routes = buildRoutes(testCase, resolvedBody);
      const token = testCase.token === 'sentinel' ? SENTINEL : null;

      let evidenceDir: string;
      if (testCase.evidence_dir === 'file') {
        evidenceDir = join(tmp, 'not-a-directory');
        writeFileSync(evidenceDir, '');
      } else {
        evidenceDir = tmp;
      }

      const result = await screenSubmission({
        repository: testCase.repository === 'testbed' ? TESTBED_REPO : EXAMPLE_REPO,
        submission: testCase.submission,
        policySource: policySourceFor(testCase),
        token,
        evidenceDir,
        fetch: makeFetch(routes),
        sleep: noopSleep,
        attachmentResolver: fakeResolver(),
        attachmentTransport: fakeTransport(testCase.attachments),
        clock: CLOCK,
        random: RANDOM,
      });

      expect(result.exitStatus).toBe(testCase.expect.exit_status);

      if (testCase.expect.run_directory) {
        expect(result.kind).toBe('completed');
        if (result.kind !== 'completed') return;

        expect(existsSync(join(result.published.directory, 'manifest.json'))).toBe(true);
        expect(result.decision.outcome).toBe(testCase.expect.outcome);

        const findingCodes = [...result.published.findings.map((f) => f.code)].sort();
        expect(findingCodes).toEqual([...(testCase.expect.finding_codes ?? [])].sort());

        const contributingIds = new Set(result.decision.contributing_findings);
        const contributingCodes = [
          ...result.published.findings.filter((f) => contributingIds.has(f.finding_id)).map((f) => f.code),
        ].sort();
        expect(contributingCodes).toEqual([...(testCase.expect.contributing_codes ?? [])].sort());

        expect(result.decision.causes.map((c) => c.cause)).toEqual(testCase.expect.causes ?? []);

        expect(result.published.policyRevision.authoritative).toBe(testCase.expect.authoritative);
        const revisionId = result.published.policyRevision.revision.id;
        if (testCase.expect.policy_revision === 'local') {
          expect(revisionId.startsWith('local:')).toBe(true);
        } else {
          expect(revisionId).toBe(testCase.expect.policy_revision);
        }

        expect(result.published.report.includes('Non-authoritative:')).toBe(testCase.expect.authoritative === false);
        expect(reportDenylistMatches(maskCodeSpans(result.published.report))).toEqual([]);
        expect(reportCharacterViolations(result.published.report)).toEqual([]);
      } else {
        expect(result.kind).not.toBe('completed');
        if (result.kind === 'completed') return;
        expect(result.failure.code).toBe(testCase.expect.error_code);
        expect(hasManifestFile(tmp)).toBe(false);
      }

      if (testCase.expect.token_absent === true) {
        expect(tmpContainsAnyForm(tmp, exactValueForms(SENTINEL))).toBe(false);
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      const index = tmpDirs.indexOf(tmp);
      if (index >= 0) tmpDirs.splice(index, 1);
    }
  });
});
