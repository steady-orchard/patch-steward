import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { GitHubFetch, ScreenResult } from '@patch-steward/core';
import { err, fixedClock, fixedRandom, screenPublishFailure, screenSubmission } from '@patch-steward/core';

import { CLI_LOCAL_RUN_NOTICE, cliNonAuthoritativeNotice, renderJsonLine } from './conventions.js';
import { escapeTerminalText } from './preflight-output.js';
import {
  SCREEN_POLICY_MISSING_MESSAGE,
  SCREEN_TOKEN_REJECTED_MESSAGE,
  screenFailureJson,
  screenResultErrors,
  screenResultJson,
  screenTextStdout,
} from './screen-output.js';

const corpusRoot = fileURLToPath(new URL('../../../fixtures/', import.meta.url));
const templatePolicyPath = fileURLToPath(new URL('../../../templates/policy/policy.yml', import.meta.url));

const T_BASE = '/repos/steady-orchard/patch-steward-testbed-public';
const Y_BASE = '/repos/example-owner/example-repo';

function readJsonFixture(relPath: string): unknown {
  const text = readFileSync(join(corpusRoot, relPath), 'utf8').replace(/\r\n/g, '\n');
  return JSON.parse(text);
}

function readTextFixture(relPath: string): string {
  return readFileSync(join(corpusRoot, relPath), 'utf8').replace(/\r\n/g, '\n');
}

type RouteMap = Record<string, unknown | number>;

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

async function noopSleep(): Promise<void> {
  return undefined;
}

async function fakeResolver(): Promise<readonly { readonly address: string; readonly family: 4 }[]> {
  return [{ address: '140.82.112.3', family: 4 }];
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

async function fakeTransport(): Promise<{
  readonly kind: 'response';
  readonly status: 200;
  readonly location: null;
  readonly body: AsyncIterable<Uint8Array>;
  readonly close: () => undefined;
}> {
  return { kind: 'response', status: 200, location: null, body: bodyFrom(new Uint8Array()), close: () => undefined };
}

const CLOCK = fixedClock('2026-09-27T10:15:00.000Z');
const RANDOM = fixedRandom('3f9a1c2e');

let tmp: string;
let LOCAL: Extract<ScreenResult, { readonly kind: 'completed' }>;
let TRUSTED: Extract<ScreenResult, { readonly kind: 'completed' }>;

describe('screen-output', { timeout: 60000 }, () => {
  beforeAll(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'm5-sout-'));

    const localRoutes: RouteMap = {
      [T_BASE]: readJsonFixture('github/testbed/repository.json'),
      [`${T_BASE}/issues/29`]: readJsonFixture('github/testbed/issue-29.json'),
    };
    const localResult = await screenSubmission({
      repository: { owner: 'steady-orchard', name: 'patch-steward-testbed-public' },
      submission: { type: 'issue', number: 29 },
      policySource: { kind: 'local-file', path: templatePolicyPath },
      token: 'token-a',
      evidenceDir: join(tmp, 'local'),
      fetch: makeFetch(localRoutes),
      sleep: noopSleep,
      attachmentResolver: fakeResolver,
      attachmentTransport: fakeTransport,
      clock: CLOCK,
      random: RANDOM,
    });
    expect(localResult.kind).toBe('completed');
    LOCAL = localResult as Extract<ScreenResult, { readonly kind: 'completed' }>;

    const issueBody = readTextFixture('submissions/defect-complete.txt');
    const trustedIssue = readJsonFixture('github/testbed/issue-29.json') as Record<string, unknown>;
    const trustedRoutes: RouteMap = {
      [Y_BASE]: { full_name: 'example-owner/example-repo', default_branch: 'main', private: false },
      [`${Y_BASE}/git/ref/heads/main`]: readJsonFixture('github/policy-directory/ref-heads-main.json'),
      [`${Y_BASE}/contents/.github`]: readJsonFixture('github/policy-directory/contents-github.json'),
      [`${Y_BASE}/git/trees/a8c2485882b52f63db71b1ec63b12f5039220e03`]: readJsonFixture('github/policy-directory/tree.json'),
      [`${Y_BASE}/git/blobs/716098133e97314ccf047f5034cc8f76161d8f0d`]: readJsonFixture('github/policy-directory/blob-policy.json'),
      [`${Y_BASE}/issues/29`]: { ...trustedIssue, body: issueBody },
    };
    const trustedResult = await screenSubmission({
      repository: { owner: 'example-owner', name: 'example-repo' },
      submission: { type: 'issue', number: 29 },
      policySource: { kind: 'trusted-branch' },
      token: 'token-a',
      evidenceDir: join(tmp, 'trusted'),
      fetch: makeFetch(trustedRoutes),
      sleep: noopSleep,
      attachmentResolver: fakeResolver,
      attachmentTransport: fakeTransport,
      clock: CLOCK,
      random: RANDOM,
    });
    expect(trustedResult.kind).toBe('completed');
    TRUSTED = trustedResult as Extract<ScreenResult, { readonly kind: 'completed' }>;
  });

  afterAll(() => {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it('screen json has the documented shape for a completed run', () => {
    const j = screenResultJson(LOCAL, {
      submission: { type: 'issue', number: 29 },
      requestedRepository: 'steady-orchard/patch-steward-testbed-public',
      policyPathShown: 'templates/policy/policy.yml',
      tokenPresent: true,
      warnings: [],
    });
    expect(Object.keys(j)).toEqual([
      'schema_version',
      'command',
      'local_run',
      'authoritative',
      'notices',
      'repository',
      'submission',
      'policy',
      'run',
      'outcome',
      'causes',
      'findings',
      'requests',
      'warnings',
      'errors',
    ]);
    expect(j.schema_version).toBe(1);
    expect(j.command).toBe('screen');
    expect(j.local_run).toBe(true);
    expect(j.authoritative).toBe(false);
    expect(j.repository).toBe('steady-orchard/patch-steward-testbed-public');
    expect(j.submission).toEqual({ type: 'issue', number: 29 });
    expect(j.run).not.toBeNull();
    expect(Object.keys(j.run as object)).toEqual(['run_id', 'run_attempt', 'directory', 'snapshot_hash']);
    expect(j.run?.run_id).toBe('local-20260927T101500Z-3f9a1c2e');
    expect(j.run?.run_attempt).toBe(1);
    expect(j.run?.directory).toBe(LOCAL.published.directory);
    expect(j.run?.snapshot_hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(j.outcome).toBe('needs-changes');
    expect(j.causes).toEqual([]);
    expect(j.findings).toEqual([
      { finding_id: 'finding-0001', code: 'submission.unstructured', severity: 'blocking', field: null, subjects: [] },
    ]);
    expect(j.requests).toEqual([{ request_id: 'R1', text: LOCAL.decision.requests[0]?.text }]);
    expect(j.warnings).toEqual([]);
    expect(j.errors).toEqual([]);
    expect(JSON.parse(renderJsonLine(j))).toEqual(j);
  });

  it('screen json policy shows the path as given', () => {
    const withPath = screenResultJson(LOCAL, {
      submission: { type: 'issue', number: 29 },
      requestedRepository: 'steady-orchard/patch-steward-testbed-public',
      policyPathShown: 'templates/policy/policy.yml',
      tokenPresent: true,
      warnings: [],
    });
    expect(Object.keys(withPath.policy as object)).toEqual(['source', 'revision', 'ref', 'commit', 'path']);
    expect(withPath.policy).toEqual({
      source: 'local-file',
      revision: LOCAL.policy.revision,
      ref: null,
      commit: null,
      path: 'templates/policy/policy.yml',
    });

    const withoutPath = screenResultJson(LOCAL, {
      submission: { type: 'issue', number: 29 },
      requestedRepository: 'steady-orchard/patch-steward-testbed-public',
      policyPathShown: null,
      tokenPresent: true,
      warnings: [],
    });
    expect(withoutPath.policy?.path).toBe(LOCAL.policy.path);
    expect(withoutPath.notices).toEqual([CLI_LOCAL_RUN_NOTICE, cliNonAuthoritativeNotice(LOCAL.policy.revision)]);
  });

  it('screen json for a trusted-branch run is authoritative', () => {
    const j = screenResultJson(TRUSTED, {
      submission: { type: 'issue', number: 29 },
      requestedRepository: 'example-owner/example-repo',
      policyPathShown: null,
      tokenPresent: true,
      warnings: [],
    });
    expect(j.authoritative).toBe(true);
    expect(j.notices).toEqual([CLI_LOCAL_RUN_NOTICE]);
    expect(j.policy).toEqual({
      source: 'trusted-branch',
      revision: 'a8c2485882b52f63db71b1ec63b12f5039220e03',
      ref: 'main',
      commit: '0123456789abcdef0123456789abcdef01234567',
      path: null,
    });
    expect(j.outcome).toBe('inconclusive');
    expect(j.causes).toEqual([
      { cause: 'stage-incomplete', code: 'pipeline.stage-incomplete', subjects: ['references', 'claim', 'reproduction'] },
    ]);
  });

  it('screen json for a failure has null run and outcome', () => {
    const context = {
      submission: { type: 'issue' as const, number: 29 },
      requestedRepository: 'steady-orchard/patch-steward-testbed-public',
      policyPathShown: null,
      tokenPresent: true,
      warnings: [],
    };

    const invalidPolicyFailure = err(
      'screen.policy-invalid',
      'policy-invalid',
      'The published policy on the default branch is invalid.',
      [{ code: 'policy.unknown-key', path: 'extra', message: 'Unknown key extra.', line: 1, column: 1 }],
    ).failure;
    const result1: ScreenResult = {
      kind: 'not-started',
      stage: 'policy',
      repository: 'steady-orchard/patch-steward-testbed-public',
      policy: null,
      failure: invalidPolicyFailure,
      exitStatus: 2,
    };
    const j1 = screenResultJson(result1, context);
    expect(Object.keys(j1)).toEqual([
      'schema_version',
      'command',
      'local_run',
      'authoritative',
      'notices',
      'repository',
      'submission',
      'policy',
      'run',
      'outcome',
      'causes',
      'findings',
      'requests',
      'warnings',
      'errors',
    ]);
    expect(j1.authoritative).toBe(false);
    expect(j1.notices).toEqual([CLI_LOCAL_RUN_NOTICE]);
    expect(j1.policy).toBeNull();
    expect(j1.run).toBeNull();
    expect(j1.outcome).toBeNull();
    expect(j1.causes).toEqual([]);
    expect(j1.findings).toEqual([]);
    expect(j1.requests).toEqual([]);
    expect(j1.errors).toEqual([
      { code: 'screen.policy-invalid', path: '', message: 'The published policy on the default branch is invalid.' },
      { code: 'policy.unknown-key', path: 'extra', message: 'Unknown key extra.' },
    ]);

    const result2: ScreenResult = {
      kind: 'not-started',
      stage: 'capture',
      repository: 'steady-orchard/patch-steward-testbed-public',
      policy: LOCAL.policy,
      failure: invalidPolicyFailure,
      exitStatus: 2,
    };
    const j2 = screenResultJson(result2, context);
    expect(j2.authoritative).toBe(false);
    expect(j2.notices).toEqual([CLI_LOCAL_RUN_NOTICE, cliNonAuthoritativeNotice(LOCAL.policy.revision)]);

    const j3 = screenFailureJson({
      submission: null,
      repository: null,
      warnings: [],
      errors: [{ code: 'usage.invalid-arguments', path: '', message: 'x' }],
    });
    expect(Object.keys(j3)).toEqual([
      'schema_version',
      'command',
      'local_run',
      'authoritative',
      'notices',
      'repository',
      'submission',
      'policy',
      'run',
      'outcome',
      'causes',
      'findings',
      'requests',
      'warnings',
      'errors',
    ]);
    expect(j3.submission).toBeNull();
    expect(j3.notices).toEqual([CLI_LOCAL_RUN_NOTICE]);
  });

  it('screen maps a rejected token to screen.token-rejected', () => {
    const result: ScreenResult = {
      kind: 'not-started',
      stage: 'repository',
      repository: null,
      policy: null,
      failure: err('github.unauthorized', 'github-unavailable', 'GitHub rejected the credentials.').failure,
      exitStatus: 2,
    };
    const context = {
      submission: { type: 'issue' as const, number: 29 },
      requestedRepository: 'steady-orchard/patch-steward-testbed-public',
      policyPathShown: null,
      tokenPresent: true,
      warnings: [],
    };
    const withToken = screenResultErrors(result, context);
    expect(withToken).toEqual([{ code: 'screen.token-rejected', path: '', message: SCREEN_TOKEN_REJECTED_MESSAGE }]);

    const withoutToken = screenResultErrors(result, { ...context, tokenPresent: false });
    expect(withoutToken[0]?.code).toBe('github.unauthorized');

    const j = screenResultJson(result, context);
    expect(j.repository).toBe('steady-orchard/patch-steward-testbed-public');
  });

  it('screen maps a missing repository to screen.repository-unavailable', () => {
    const failure = err('github.not-found', 'github-unavailable', 'Not found.').failure;
    const result: ScreenResult = {
      kind: 'not-started',
      stage: 'repository',
      repository: null,
      policy: null,
      failure,
      exitStatus: 2,
    };
    const context = {
      requestedRepository: 'steady-orchard/patch-steward-testbed-public',
      tokenPresent: true,
    };
    expect(screenResultErrors(result, context)).toEqual([
      {
        code: 'screen.repository-unavailable',
        path: '',
        message: 'The repository steady-orchard/patch-steward-testbed-public does not exist or the token cannot read it.',
      },
    ]);
    expect(screenResultErrors(result, { ...context, tokenPresent: false })[0]?.message).toBe(
      'The repository steady-orchard/patch-steward-testbed-public does not exist or is private; set GH_TOKEN or GITHUB_TOKEN, or log in with gh.',
    );

    const captureResult: ScreenResult = { ...result, stage: 'capture' };
    expect(screenResultErrors(captureResult, context)[0]?.code).toBe('github.not-found');
  });

  it('screen policy-missing error names --policy-file', () => {
    const failure = err(
      'screen.policy-missing',
      'policy-unavailable',
      'The repository has no published policy on its default branch.',
    ).failure;
    const result: ScreenResult = {
      kind: 'not-started',
      stage: 'policy',
      repository: 'steady-orchard/patch-steward-testbed-public',
      policy: null,
      failure,
      exitStatus: 2,
    };
    const errors = screenResultErrors(result, {
      requestedRepository: 'steady-orchard/patch-steward-testbed-public',
      tokenPresent: true,
    });
    expect(errors).toEqual([{ code: 'screen.policy-missing', path: '', message: SCREEN_POLICY_MISSING_MESSAGE }]);
    expect(errors[0]?.message).toContain('--policy-file');
  });

  it('screen publish failure lists the underlying code', () => {
    const result: ScreenResult = {
      kind: 'publish-failed',
      repository: LOCAL.repository,
      policy: LOCAL.policy,
      run: { run_id: 'local-20260927T101500Z-3f9a1c2e', run_attempt: 1, snapshot_hash: 'sha256:' + '1'.repeat(64) },
      failure: screenPublishFailure(err('evidence.write-failed', 'infrastructure', 'The evidence could not be written.').failure),
      exitStatus: 2,
    };
    const j = screenResultJson(result, {
      submission: { type: 'issue', number: 29 },
      requestedRepository: 'steady-orchard/patch-steward-testbed-public',
      policyPathShown: null,
      tokenPresent: true,
      warnings: [],
    });
    expect(j.errors[0]?.code).toBe('screen.evidence-write-failed');
    expect(j.errors[1]?.code).toBe('evidence.write-failed');
    expect(j.run).toEqual({
      run_id: 'local-20260927T101500Z-3f9a1c2e',
      run_attempt: 1,
      directory: null,
      snapshot_hash: 'sha256:' + '1'.repeat(64),
    });
    expect(j.outcome).toBeNull();
    expect(j.policy?.source).toBe('local-file');
  });

  it('screen text lists notices, policy, submission, outcome, and run directory', () => {
    const localText = screenTextStdout(LOCAL, 'templates/policy/policy.yml');
    expect(localText).toBe(
      [
        CLI_LOCAL_RUN_NOTICE,
        cliNonAuthoritativeNotice(LOCAL.policy.revision),
        'policy: local file templates/policy/policy.yml revision ' + LOCAL.policy.revision,
        'submission: issue 29 (steady-orchard/patch-steward-testbed-public)',
        'outcome: needs-changes',
        'request R1: ' + escapeTerminalText(LOCAL.decision.requests[0]?.text ?? ''),
        'run directory: ' + escapeTerminalText(LOCAL.published.directory),
      ].join('\n') + '\n',
    );

    const trustedText = screenTextStdout(TRUSTED, null);
    expect(trustedText).toBe(
      [
        CLI_LOCAL_RUN_NOTICE,
        'policy: example-owner/example-repo main commit 0123456789abcdef0123456789abcdef01234567 revision a8c2485882b52f63db71b1ec63b12f5039220e03',
        'submission: issue 29 (example-owner/example-repo)',
        'outcome: inconclusive',
        'cause: stage-incomplete',
        'run directory: ' + escapeTerminalText(TRUSTED.published.directory),
      ].join('\n') + '\n',
    );
  });

  it('screen text escapes derived values', () => {
    const evil: Extract<ScreenResult, { readonly kind: 'completed' }> = {
      ...LOCAL,
      repository: 'evil\u001bname/x',
    };
    const rtlOverride = String.fromCharCode(0x202e);
    const text = screenTextStdout(evil, `p${rtlOverride}.yml`);
    expect(text).toContain('submission: issue 29 (evil\\u001bname/x)');
    expect(text).toContain('policy: local file p\\u202e.yml revision ' + LOCAL.policy.revision);
    const forbidden = [...text].filter((ch) => {
      const c = ch.codePointAt(0) ?? 0;
      return c <= 0x08 || (c >= 0x0b && c <= 0x1f) || c === 0x7f || (c >= 0x202a && c <= 0x202e);
    });
    expect(forbidden).toEqual([]);
  });
});
