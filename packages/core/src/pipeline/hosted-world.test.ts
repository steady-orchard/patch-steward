import * as fs from 'node:fs';
import { generateKeyPairSync } from 'node:crypto';
import { crc32 } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { loadPolicy } from '../policy/loader.js';
import type { GitHubRepositoryRef } from '../github/reader.js';
import { readGitTree, readRepository } from '../github/reader.js';
import { createGitHubClient } from '../github/client.js';
import type { GitHubFetchInit } from '../github/client.js';
import { createGitHubBudget } from '../github/budget.js';
import { lookupAppBotUserId, mintInstallationToken } from '../github/app-auth.js';
import type { AppCredentials } from '../github/app-auth.js';
import type { GitHubAnyFetch, GitHubWriteFetchInit } from '../github/writer.js';
import { readOwnershipListing } from '../github/artifacts.js';
import { encodeOwnershipRecord } from '../ownership/record.js';
import type { OwnershipRecord } from '../ownership/record.js';
import { captureIssue, capturePullRequest } from '../submission/intake.js';
import type { CaptureContext } from '../submission/intake.js';
import { readCapRunLists } from '../github/runs.js';
import { authenticateEvent } from '../ownership/events.js';
import type { EventEnvironment } from '../ownership/events.js';
import type { AttachmentAddress, AttachmentResolver, AttachmentTransport } from '../net/attachment-fetch.js';
import { gitBlobId } from '../evidence/blob-id.js';

// Identity constants for the shared hosted world. Kept exact so callers can assert against them.
export const WORLD_REPOSITORY = 'steady-orchard/patch-steward-testbed-public';
export const WORLD_REPOSITORY_REF: GitHubRepositoryRef = { owner: 'steady-orchard', name: 'patch-steward-testbed-public' };
export const WORLD_REPOSITORY_ID = 1376317064;
export const WORLD_DEFAULT_BRANCH = 'master';
export const WORLD_EVIDENCE_REPOSITORY = 'steady-orchard/patch-steward-testbed-evidence';
export const WORLD_APP_ID = '4993303';
export const WORLD_INSTALLATION_ID = 162868612;
export const WORLD_BOT_ID = 331019482;
export const WORLD_AUTHOR_ID = 2095171;
export const WORLD_MAINTAINER_ID = 1000001;
export const WORLD_RUN_ID = 36081628326;
export const WORLD_NOW = '2026-09-28T10:00:00.000Z';
export const WORLD_ARTIFACT_HOST = 'productionresultssa0.blob.core.windows.net';

const REPO_PATH = `/repos/${WORLD_REPOSITORY}`;
const EVIDENCE_REPO_PATH = `/repos/${WORLD_EVIDENCE_REPOSITORY}`;

// --- shapes -----------------------------------------------------------------

export interface WorldRequest {
  readonly method: string;
  readonly host: string;
  readonly path: string;
}

export interface WorldHandlerRequest {
  readonly method: string;
  readonly url: URL;
  readonly body: unknown;
}

export type WorldHandler = (request: WorldHandlerRequest) => Response | undefined;

export interface WorldIssue {
  number: number;
  id: number;
  title: string;
  body: string | null;
  updatedAt: string;
  userId: number;
  state: 'open' | 'closed';
}

export interface WorldPull {
  number: number;
  id: number;
  title: string;
  body: string | null;
  updatedAt: string;
  userId: number;
  state: 'open' | 'closed';
  merged: boolean;
  headSha: string;
  baseRef: string;
  baseSha: string;
  files: { filename: string; status: string }[];
}

export interface WorldArtifactInput {
  readonly name: string;
  readonly createdAt: string;
  readonly workflowRunId: number;
  readonly id?: number;
  readonly expiresAt?: string;
  readonly expired?: boolean;
  readonly recordBytes?: Uint8Array;
  readonly zip?: Uint8Array | null;
}

export interface WorldArtifact {
  readonly id: number;
  readonly name: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly expired: boolean;
  readonly workflowRunId: number;
  readonly zip: Uint8Array | null;
}

export interface WorldRunItem {
  readonly id: number;
  readonly path: string;
  readonly event: string;
  readonly status: string;
  readonly createdAt: string;
  readonly displayTitle: string;
}

export interface HostedWorldOptions {
  readonly policyText?: string | null;
  readonly handlers?: readonly WorldHandler[];
}

export interface HostedWorld {
  readonly fetch: GitHubAnyFetch;
  readonly resolver: AttachmentResolver;
  readonly transport: AttachmentTransport;
  readonly requests: WorldRequest[];
  readonly credentials: AppCredentials;
  readonly tokens: string[];
  readonly issues: Map<number, WorldIssue>;
  readonly pulls: Map<number, WorldPull>;
  readonly runs: { readonly createdToday: WorldRunItem[]; readonly inProgress: WorldRunItem[]; readonly queued: WorldRunItem[] };
  policyTreeId(): string | null;
  policyCommit(): string;
  setPolicy(text: string | null): void;
  setHeadPolicy(headSha: string, text: string): void;
  addArtifact(input: WorldArtifactInput): WorldArtifact;
  removeArtifact(id: number): void;
  artifacts(): readonly WorldArtifact[];
  override(handler: WorldHandler): void;
}

export interface WorldEventOptions {
  readonly number?: number;
  readonly senderId?: number;
  readonly senderType?: string;
  readonly fork?: boolean;
}

// --- private helpers ----------------------------------------------------------

// Generated once per module: every hosted world shares the same app identity key material.
const APP_PRIVATE_KEY = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
}).privateKey;

function readFixtureText(relativePath: string): string {
  const url = new URL(relativePath, import.meta.url);
  return fs.readFileSync(url, 'utf8').replace(/\r\n/g, '\n');
}

function readFixtureJson<T>(relativePath: string): T {
  const url = new URL(relativePath, import.meta.url);
  return JSON.parse(fs.readFileSync(url, 'utf8')) as T;
}

export function worldPolicyText(replacements: readonly (readonly [string, string])[] = []): string {
  let text = readFixtureText('../../../../fixtures/policies/valid/minimal-no-llm.yml');
  const branchLine = 'branch: patch-steward-evidence';
  if (!text.includes(branchLine)) {
    throw new Error('worldPolicyText: expected branch line not found in the base policy fixture');
  }
  text = text.replace(branchLine, 'branch: steward-evidence');
  for (const [from, to] of replacements) {
    if (!text.includes(from)) {
      throw new Error(`worldPolicyText: replacement source not found: ${from}`);
    }
    text = text.replace(from, to);
  }
  return text;
}

interface EntrySpec {
  readonly name: string;
  readonly data: Buffer;
}

function buildZip(specs: readonly EntrySpec[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const spec of specs) {
    const nameBuf = Buffer.from(spec.name, 'utf8');
    const crc = crc32(spec.data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(spec.data.length, 18);
    local.writeUInt32LE(spec.data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);

    const localEntry = Buffer.concat([local, nameBuf, spec.data]);
    localParts.push(localEntry);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(spec.data.length, 20);
    central.writeUInt32LE(spec.data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);

    centralParts.push(Buffer.concat([central, nameBuf]));
    offset += localEntry.length;
  }

  const localSection = Buffer.concat(localParts);
  const centralSection = Buffer.concat(centralParts);
  const cdOffset = localSection.length;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(specs.length, 8);
  eocd.writeUInt16LE(specs.length, 10);
  eocd.writeUInt32LE(centralSection.length, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([localSection, centralSection, eocd]);
}

export function ownershipArtifactZip(recordBytes: Uint8Array): Uint8Array {
  return buildZip([{ name: 'ownership.json', data: Buffer.from(recordBytes) }]);
}

function bodyFrom(chunks: readonly Uint8Array[]): AsyncIterable<Uint8Array> {
  return {
    [Symbol.asyncIterator]() {
      let i = 0;
      return {
        async next(): Promise<IteratorResult<Uint8Array>> {
          if (i < chunks.length) {
            const value = chunks[i];
            i += 1;
            if (value === undefined) return { done: true, value: undefined };
            return { done: false, value };
          }
          return { done: true, value: undefined };
        },
      };
    },
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function base64Lines(bytes: Buffer): string {
  const b64 = bytes.toString('base64');
  const lines: string[] = [];
  for (let i = 0; i < b64.length; i += 60) {
    lines.push(b64.slice(i, i + 60));
  }
  return lines.join('\n');
}

function plusDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

interface RepositoryFixture {
  readonly id: number;
  readonly full_name: string;
  readonly private: boolean;
  readonly default_branch: string;
  readonly [key: string]: unknown;
}

interface IssueFixture {
  readonly number: number;
  readonly id: number;
  readonly title: string;
  readonly body: string | null;
  readonly state: string;
  readonly updated_at: string;
  readonly user: { readonly login: string; readonly id: number; readonly type: string };
  readonly [key: string]: unknown;
}

interface PullFixture {
  readonly number: number;
  readonly id: number;
  readonly title: string;
  readonly body: string | null;
  readonly state: string;
  readonly draft: boolean;
  readonly merged: boolean;
  readonly updated_at: string;
  readonly user: { readonly login: string; readonly id: number; readonly type: string };
  readonly head: { readonly sha: string; readonly ref: string };
  readonly base: { readonly sha: string; readonly ref: string };
  readonly changed_files: number;
  readonly [key: string]: unknown;
}

interface PullFileFixture {
  readonly filename: string;
  readonly status: string;
}

const REPOSITORY_FIXTURE = readFixtureJson<RepositoryFixture>('../../../../fixtures/github/testbed/repository.json');
const ISSUE_FIXTURE = readFixtureJson<IssueFixture>('../../../../fixtures/github/testbed/issue-29.json');
const PULL_FIXTURE = readFixtureJson<PullFixture>('../../../../fixtures/github/testbed/pull-26.json');
const PULL_FILES_FIXTURE = readFixtureJson<readonly PullFileFixture[]>('../../../../fixtures/github/testbed/pull-26-files.json');

const DEFECT_BODY = readFixtureText('../../../../fixtures/submissions/defect-complete.txt');
const PR_BUGFIX_BODY = readFixtureText('../../../../fixtures/submissions/pr-bugfix-complete.txt');

const ISSUE_UPDATED_AT = '2026-09-28T09:59:00Z';

function defaultIssues(): Map<number, WorldIssue> {
  const issues = new Map<number, WorldIssue>();
  issues.set(29, {
    number: 29,
    id: 5578290556,
    title: '[scenario] defect report',
    body: DEFECT_BODY,
    updatedAt: ISSUE_UPDATED_AT,
    userId: WORLD_AUTHOR_ID,
    state: 'open',
  });
  issues.set(30, {
    number: 30,
    id: 5578312503,
    title: '[scenario] unstructured report',
    body: null,
    updatedAt: ISSUE_UPDATED_AT,
    userId: WORLD_AUTHOR_ID,
    state: 'open',
  });
  return issues;
}

function defaultPulls(): Map<number, WorldPull> {
  const pulls = new Map<number, WorldPull>();
  pulls.set(26, {
    number: 26,
    id: 4633746489,
    title: '[scenario] bug fix',
    body: PR_BUGFIX_BODY,
    updatedAt: ISSUE_UPDATED_AT,
    userId: WORLD_AUTHOR_ID,
    state: 'open',
    merged: false,
    headSha: 'b46eef5018c202bcb2470bf62e3defd7496ec65b',
    baseRef: 'probe-pa06-base',
    baseSha: '1c5c399b48a0ccca6a9989eacb6ebc2279e6a9c9',
    files: PULL_FILES_FIXTURE.map((f) => ({ filename: f.filename, status: f.status })),
  });
  return pulls;
}

const NO_POLICY_COMMIT_ID = gitBlobId(Buffer.from('commit\nno-policy'));

interface PolicyIds {
  readonly blobId: string;
  readonly treeId: string;
  readonly commitId: string;
}

function computePolicyIds(text: string): PolicyIds {
  const blobId = gitBlobId(Buffer.from(text, 'utf8'));
  const treeId = gitBlobId(Buffer.from(`tree\npolicy.yml ${blobId}`));
  const commitId = gitBlobId(Buffer.from(`commit\n${treeId}`));
  return { blobId, treeId, commitId };
}

// --- factory -------------------------------------------------------------------

export function createHostedWorld(options?: HostedWorldOptions): HostedWorld {
  const requests: WorldRequest[] = [];
  const tokens: string[] = [];
  const issues = defaultIssues();
  const pulls = defaultPulls();
  const runs = { createdToday: [] as WorldRunItem[], inProgress: [] as WorldRunItem[], queued: [] as WorldRunItem[] };
  const overrideHandlers: WorldHandler[] = [];
  const extraHandlers = options?.handlers ?? [];

  const blobs = new Map<string, string>();
  const trees = new Map<string, string>();
  const headPolicies = new Map<string, string>();

  let currentTreeId: string | null = null;
  let currentCommitId: string = NO_POLICY_COMMIT_ID;

  function applyPolicy(text: string | null): void {
    if (text === null) {
      currentTreeId = null;
      currentCommitId = NO_POLICY_COMMIT_ID;
      return;
    }
    const ids = computePolicyIds(text);
    blobs.set(ids.blobId, text);
    trees.set(ids.treeId, ids.blobId);
    currentTreeId = ids.treeId;
    currentCommitId = ids.commitId;
  }

  applyPolicy(options?.policyText === undefined ? worldPolicyText() : options.policyText);

  const artifacts = new Map<number, WorldArtifact>();
  let artifactCallCount = 0;
  let tokenCounter = 0;

  function nextToken(): string {
    const counter = tokenCounter.toString().padStart(6, '0');
    tokenCounter += 1;
    return 'gh' + 's_' + 'W'.repeat(30) + counter;
  }

  function issueResponse(issue: WorldIssue): Response {
    const payload: Record<string, unknown> = { ...ISSUE_FIXTURE };
    payload['number'] = issue.number;
    payload['id'] = issue.id;
    payload['title'] = issue.title;
    payload['body'] = issue.body;
    payload['state'] = issue.state;
    payload['updated_at'] = issue.updatedAt;
    payload['user'] = { login: 'jambolo', id: issue.userId, type: 'User' };
    delete payload['pull_request'];
    return jsonResponse(200, payload);
  }

  function pullResponse(pull: WorldPull): Response {
    const payload: Record<string, unknown> = { ...PULL_FIXTURE };
    payload['number'] = pull.number;
    payload['id'] = pull.id;
    payload['title'] = pull.title;
    payload['body'] = pull.body;
    payload['state'] = pull.state;
    payload['draft'] = false;
    payload['merged'] = pull.merged;
    payload['updated_at'] = pull.updatedAt;
    payload['user'] = { login: 'jambolo', id: pull.userId, type: 'User' };
    payload['head'] = { sha: pull.headSha, ref: 'scenario-branch' };
    payload['base'] = { sha: pull.baseSha, ref: pull.baseRef };
    payload['changed_files'] = pull.files.length;
    return jsonResponse(200, payload);
  }

  function builtin(request: WorldHandlerRequest): Response | undefined {
    const { method, url, body } = request;
    const pathname = url.pathname;

    if (method === 'GET' && pathname === REPO_PATH) {
      return jsonResponse(200, REPOSITORY_FIXTURE);
    }

    if (method === 'GET' && (pathname === `${REPO_PATH}/installation` || pathname === `${EVIDENCE_REPO_PATH}/installation`)) {
      return jsonResponse(200, { id: WORLD_INSTALLATION_ID });
    }

    if (method === 'POST' && pathname === `/app/installations/${String(WORLD_INSTALLATION_ID)}/access_tokens`) {
      const reqBody = body as { readonly permissions?: Record<string, string>; readonly repositories?: readonly string[] } | null;
      const token = nextToken();
      tokens.push(token);
      const repository = reqBody?.repositories?.[0] ?? '';
      return jsonResponse(201, {
        token,
        expires_at: '2026-09-28T11:00:00Z',
        permissions: reqBody?.permissions ?? {},
        repositories: [{ full_name: `steady-orchard/${repository}` }],
      });
    }

    if (method === 'DELETE' && pathname === '/installation/token') {
      return new Response(null, { status: 204 });
    }

    if (method === 'GET' && pathname === '/app') {
      return jsonResponse(200, { id: 4993303, slug: 'patch-steward-testbed', name: 'patch-steward-testbed' });
    }

    if (method === 'GET' && decodeURIComponent(pathname) === '/users/patch-steward-testbed[bot]') {
      return jsonResponse(200, { login: 'patch-steward-testbed[bot]', id: WORLD_BOT_ID, type: 'Bot' });
    }

    if (method === 'GET' && pathname === `${REPO_PATH}/git/ref/heads/master`) {
      return jsonResponse(200, { ref: 'refs/heads/master', object: { sha: currentCommitId, type: 'commit' } });
    }

    if (method === 'GET' && pathname === `${REPO_PATH}/contents/.github`) {
      const ref = url.searchParams.get('ref');
      const workflowsEntry = { name: 'workflows', path: '.github/workflows', sha: 'e'.repeat(40), type: 'dir', size: 0 };
      let treeId: string | null = null;
      if (ref === currentCommitId) {
        treeId = currentTreeId;
      } else if (ref !== null && headPolicies.has(ref)) {
        treeId = headPolicies.get(ref) ?? null;
      }
      const entries =
        treeId === null
          ? [workflowsEntry]
          : [{ name: 'patch-steward', path: '.github/patch-steward', sha: treeId, type: 'dir', size: 0 }, workflowsEntry];
      return jsonResponse(200, entries);
    }

    const treesMatch = /^\/repos\/steady-orchard\/patch-steward-testbed-public\/git\/trees\/([^/:]+)$/.exec(pathname);
    if (method === 'GET' && treesMatch !== null) {
      const treeId = treesMatch[1] as string;
      const blobId = trees.get(treeId);
      if (blobId === undefined) return jsonResponse(404, { message: 'Not Found' });
      const text = blobs.get(blobId) ?? '';
      return jsonResponse(200, {
        sha: treeId,
        truncated: false,
        tree: [{ path: 'policy.yml', mode: '100644', type: 'blob', sha: blobId, size: Buffer.byteLength(text, 'utf8') }],
      });
    }

    const blobsMatch = /^\/repos\/steady-orchard\/patch-steward-testbed-public\/git\/blobs\/([^/]+)$/.exec(pathname);
    if (method === 'GET' && blobsMatch !== null) {
      const blobId = blobsMatch[1] as string;
      const text = blobs.get(blobId);
      if (text === undefined) return jsonResponse(404, { message: 'Not Found' });
      const bytes = Buffer.from(text, 'utf8');
      return jsonResponse(200, { sha: blobId, size: bytes.length, encoding: 'base64', content: base64Lines(bytes) });
    }

    const issueMatch = /^\/repos\/steady-orchard\/patch-steward-testbed-public\/issues\/([1-9][0-9]*)$/.exec(pathname);
    if (method === 'GET' && issueMatch !== null) {
      const number = Number(issueMatch[1]);
      const issue = issues.get(number);
      if (issue === undefined) return jsonResponse(404, { message: 'Not Found' });
      return issueResponse(issue);
    }

    const pullFilesMatch = /^\/repos\/steady-orchard\/patch-steward-testbed-public\/pulls\/([1-9][0-9]*)\/files$/.exec(pathname);
    if (method === 'GET' && pullFilesMatch !== null) {
      const number = Number(pullFilesMatch[1]);
      const pull = pulls.get(number);
      if (pull === undefined) return jsonResponse(404, { message: 'Not Found' });
      return jsonResponse(
        200,
        pull.files.map((f) => ({ filename: f.filename, status: f.status })),
      );
    }

    const pullMatch = /^\/repos\/steady-orchard\/patch-steward-testbed-public\/pulls\/([1-9][0-9]*)$/.exec(pathname);
    if (method === 'GET' && pullMatch !== null) {
      const number = Number(pullMatch[1]);
      const pull = pulls.get(number);
      if (pull === undefined) return jsonResponse(404, { message: 'Not Found' });
      return pullResponse(pull);
    }

    const commitPullsMatch = /^\/repos\/steady-orchard\/patch-steward-testbed-public\/commits\/([0-9a-f]{40})\/pulls$/.exec(
      pathname,
    );
    if (method === 'GET' && commitPullsMatch !== null) {
      const sha = commitPullsMatch[1] as string;
      const matches = Array.from(pulls.values())
        .filter((p) => p.headSha === sha)
        .map((p) => ({ number: p.number, state: p.state, head: { sha: p.headSha } }));
      return jsonResponse(200, matches);
    }

    if (method === 'GET' && pathname === `${REPO_PATH}/actions/artifacts`) {
      const name = url.searchParams.get('name');
      const items = Array.from(artifacts.values()).filter((a) => a.name === name);
      return jsonResponse(200, {
        total_count: items.length,
        artifacts: items.map((a) => ({
          id: a.id,
          node_id: `A_${String(a.id)}`,
          name: a.name,
          size_in_bytes: a.zip?.length ?? 0,
          url: `https://api.github.com${REPO_PATH}/actions/artifacts/${String(a.id)}`,
          archive_download_url: `https://api.github.com${REPO_PATH}/actions/artifacts/${String(a.id)}/zip`,
          expired: a.expired,
          created_at: a.createdAt,
          updated_at: a.createdAt,
          expires_at: a.expiresAt,
          workflow_run: {
            id: a.workflowRunId,
            repository_id: WORLD_REPOSITORY_ID,
            head_repository_id: WORLD_REPOSITORY_ID,
            head_branch: 'master',
            head_sha: 'f'.repeat(40),
          },
        })),
      });
    }

    const artifactZipMatch = /^\/repos\/steady-orchard\/patch-steward-testbed-public\/actions\/artifacts\/([1-9][0-9]*)\/zip$/.exec(
      pathname,
    );
    if (method === 'GET' && artifactZipMatch !== null) {
      const id = Number(artifactZipMatch[1]);
      if (!artifacts.has(id)) return jsonResponse(404, { message: 'Not Found' });
      return new Response(null, {
        status: 302,
        headers: { location: `https://${WORLD_ARTIFACT_HOST}/actions-results/${String(id)}/ownership.zip?sig=${'q'.repeat(16)}` },
      });
    }

    if (method === 'GET' && pathname === `${REPO_PATH}/actions/runs`) {
      let items: readonly WorldRunItem[];
      if (url.searchParams.has('created')) {
        items = runs.createdToday;
      } else if (url.searchParams.get('status') === 'in_progress') {
        items = runs.inProgress;
      } else if (url.searchParams.get('status') === 'queued') {
        items = runs.queued;
      } else {
        items = [];
      }
      return jsonResponse(200, {
        total_count: items.length,
        workflow_runs: items.map((item) => ({
          id: item.id,
          name: 'steward',
          display_title: item.displayTitle,
          path: item.path,
          event: item.event,
          status: item.status,
          conclusion: null,
          created_at: item.createdAt,
          run_attempt: 1,
          head_branch: 'master',
        })),
      });
    }

    return undefined;
  }

  const fetchImpl: GitHubAnyFetch = async (url: string, init: GitHubFetchInit | GitHubWriteFetchInit): Promise<Response> => {
    const parsed = new URL(url);
    let body: unknown;
    const withBody = init as { readonly body?: string };
    if (typeof withBody.body === 'string') {
      try {
        body = JSON.parse(withBody.body);
      } catch {
        body = undefined;
      }
    }
    requests.push({ method: init.method, host: parsed.host, path: parsed.pathname + parsed.search });
    const handlerRequest: WorldHandlerRequest = { method: init.method, url: parsed, body };

    for (const handler of overrideHandlers) {
      const answer = handler(handlerRequest);
      if (answer !== undefined) return answer;
    }
    for (const handler of extraHandlers) {
      const answer = handler(handlerRequest);
      if (answer !== undefined) return answer;
    }
    const answer = builtin(handlerRequest);
    if (answer !== undefined) return answer;
    return jsonResponse(404, { message: 'Not Found' });
  };

  const resolver: AttachmentResolver = async (): Promise<readonly AttachmentAddress[]> => [{ address: '140.82.112.3', family: 4 }];

  const transport: AttachmentTransport = async (req) => {
    requests.push({ method: 'DOWNLOAD', host: req.url.hostname, path: req.url.pathname + req.url.search });
    const match = /^\/actions-results\/([1-9][0-9]*)\/ownership\.zip$/.exec(req.url.pathname);
    if (match !== null) {
      const id = Number(match[1]);
      const artifact = artifacts.get(id);
      if (artifact !== undefined && artifact.zip !== null) {
        return { kind: 'response', status: 200, location: null, body: bodyFrom([artifact.zip]), close: () => undefined };
      }
    }
    return { kind: 'response', status: 404, location: null, body: bodyFrom([]), close: () => undefined };
  };

  const credentials: AppCredentials = { appId: WORLD_APP_ID, privateKey: APP_PRIVATE_KEY };

  return {
    fetch: fetchImpl,
    resolver,
    transport,
    requests,
    credentials,
    tokens,
    issues,
    pulls,
    runs,
    policyTreeId(): string | null {
      return currentTreeId;
    },
    policyCommit(): string {
      return currentCommitId;
    },
    setPolicy(text: string | null): void {
      applyPolicy(text);
    },
    setHeadPolicy(headSha: string, text: string): void {
      const ids = computePolicyIds(text);
      blobs.set(ids.blobId, text);
      trees.set(ids.treeId, ids.blobId);
      headPolicies.set(headSha, ids.treeId);
    },
    addArtifact(input: WorldArtifactInput): WorldArtifact {
      const id = input.id ?? 900 + artifactCallCount;
      artifactCallCount += 1;
      const expiresAt = input.expiresAt ?? plusDays(input.createdAt, 90);
      const expired = input.expired ?? false;
      let zip: Uint8Array | null;
      if (input.zip !== undefined) {
        zip = input.zip;
      } else if (input.recordBytes !== undefined) {
        zip = ownershipArtifactZip(input.recordBytes);
      } else {
        zip = null;
      }
      const artifact: WorldArtifact = {
        id,
        name: input.name,
        createdAt: input.createdAt,
        expiresAt,
        expired,
        workflowRunId: input.workflowRunId,
        zip,
      };
      artifacts.set(id, artifact);
      return artifact;
    },
    removeArtifact(id: number): void {
      artifacts.delete(id);
    },
    artifacts(): readonly WorldArtifact[] {
      return Array.from(artifacts.values());
    },
    override(handler: WorldHandler): void {
      overrideHandlers.push(handler);
    },
  };
}

function repositoryPayload(): Record<string, unknown> {
  return {
    id: WORLD_REPOSITORY_ID,
    name: 'patch-steward-testbed-public',
    full_name: WORLD_REPOSITORY,
    private: false,
    default_branch: WORLD_DEFAULT_BRANCH,
  };
}

function senderPayload(options: WorldEventOptions | undefined): Record<string, unknown> {
  const senderId = options?.senderId ?? WORLD_AUTHOR_ID;
  const senderType = options?.senderType ?? 'User';
  const login = senderId === WORLD_AUTHOR_ID ? 'jambolo' : 'actor';
  return { login, id: senderId, type: senderType };
}

export function issuesEventPayload(world: HostedWorld, action: string, options?: WorldEventOptions): Uint8Array {
  const issue = world.issues.get(options?.number ?? 29);
  if (issue === undefined) {
    throw new Error('issuesEventPayload: unknown issue number');
  }
  const payload = {
    action,
    issue: {
      id: issue.id,
      number: issue.number,
      title: issue.title,
      body: issue.body,
      state: issue.state,
      updated_at: issue.updatedAt,
      user: { login: 'jambolo', id: issue.userId },
    },
    repository: repositoryPayload(),
    sender: senderPayload(options),
  };
  return new TextEncoder().encode(JSON.stringify(payload));
}

export function pullRequestEventPayload(world: HostedWorld, action: string, options?: WorldEventOptions): Uint8Array {
  const pull = world.pulls.get(options?.number ?? 26);
  if (pull === undefined) {
    throw new Error('pullRequestEventPayload: unknown pull request number');
  }
  const fork = options?.fork === true;
  const payload = {
    action,
    number: pull.number,
    pull_request: {
      id: pull.id,
      number: pull.number,
      title: pull.title,
      body: pull.body,
      state: pull.state,
      merged: pull.merged,
      updated_at: pull.updatedAt,
      user: { login: 'jambolo', id: pull.userId },
      head: {
        sha: pull.headSha,
        ref: 'scenario-branch',
        repo: { full_name: fork ? 'jambolo/patch-steward-testbed-public' : WORLD_REPOSITORY, fork },
      },
      base: { ref: pull.baseRef, sha: pull.baseSha, repo: { full_name: WORLD_REPOSITORY } },
    },
    repository: repositoryPayload(),
    sender: senderPayload(options),
  };
  return new TextEncoder().encode(JSON.stringify(payload));
}

export function gateEnvironment(world: HostedWorld, overrides?: Readonly<Record<string, string>>): Record<string, string> {
  return {
    GITHUB_EVENT_NAME: 'issues',
    GITHUB_EVENT_PATH: '/tmp/steward-world/event.json',
    GITHUB_REPOSITORY: WORLD_REPOSITORY,
    GITHUB_REPOSITORY_ID: String(WORLD_REPOSITORY_ID),
    GITHUB_REF: 'refs/heads/master',
    GITHUB_SERVER_URL: 'https://github.com',
    GITHUB_API_URL: 'https://api.github.com',
    GITHUB_RUN_ID: String(WORLD_RUN_ID),
    GITHUB_RUN_ATTEMPT: '1',
    RUNNER_TEMP: '/tmp/steward-world',
    GITHUB_OUTPUT: '/tmp/steward-world/output',
    GITHUB_STEP_SUMMARY: '/tmp/steward-world/summary',
    PATCH_STEWARD_APP_ID: WORLD_APP_ID,
    PATCH_STEWARD_APP_PRIVATE_KEY: world.credentials.privateKey,
    ...overrides,
  };
}

export function publishEnvironment(
  world: HostedWorld,
  gateOutputs: Readonly<Record<string, string>>,
  overrides?: Readonly<Record<string, string>>,
): Record<string, string> {
  return {
    ...gateEnvironment(world),
    STEWARD_GATE_DISPOSITION: gateOutputs['disposition'] ?? '',
    STEWARD_GATE_RECORD_ONLY: gateOutputs['record_only'] ?? 'false',
    STEWARD_GATE_SNAPSHOT_HASH: gateOutputs['snapshot_hash'] ?? '',
    STEWARD_GATE_POLICY_REVISION: gateOutputs['policy_revision'] ?? '',
    ...overrides,
  };
}

function eventEnvironmentFromGate(env: Record<string, string>): EventEnvironment {
  return {
    eventName: env['GITHUB_EVENT_NAME'] ?? '',
    repository: env['GITHUB_REPOSITORY'] ?? '',
    repositoryId: env['GITHUB_REPOSITORY_ID'] ?? '',
    ref: env['GITHUB_REF'] ?? '',
    serverUrl: env['GITHUB_SERVER_URL'] ?? '',
    apiUrl: env['GITHUB_API_URL'] ?? '',
    runId: env['GITHUB_RUN_ID'] ?? '',
    runAttempt: env['GITHUB_RUN_ATTEMPT'] ?? '',
  };
}

function testClient(world: HostedWorld) {
  const budget = createGitHubBudget({ requests: 20, retriesPerRequest: 0 });
  return createGitHubClient({ token: `test-token-${'a'.repeat(20)}`, budget, fetch: world.fetch });
}

// --- self-checks --------------------------------------------------------------

describe('hosted world', () => {
  it('the world serves the trusted policy from the default branch', async () => {
    const world = createHostedWorld();
    const client = testClient(world);
    const result = await loadPolicy({ kind: 'github', client, repository: WORLD_REPOSITORY_REF, branch: 'master' });
    expect(result.ok).toBe(true);
    if (result.ok && result.value.revision.kind === 'git-tree') {
      expect(result.value.revision.id).toBe(world.policyTreeId());
      expect(result.value.revision.commit).toBe(world.policyCommit());
    }
  });

  it('the world serves any policy tree by id', async () => {
    const world = createHostedWorld();
    const client = testClient(world);
    const firstTreeId = world.policyTreeId();
    expect(firstTreeId).not.toBeNull();

    world.setPolicy(worldPolicyText([['daily_runs: 50', 'daily_runs: 1']]));
    const secondTreeId = world.policyTreeId();
    expect(secondTreeId).not.toBe(firstTreeId);

    const oldTreeResult = await readGitTree(client, WORLD_REPOSITORY_REF, firstTreeId as string, true);
    expect(oldTreeResult.ok).toBe(true);

    world.setPolicy(null);
    const failedLoad = await loadPolicy({ kind: 'github', client, repository: WORLD_REPOSITORY_REF, branch: 'master' });
    expect(failedLoad.ok).toBe(false);
    if (!failedLoad.ok) {
      expect(failedLoad.failure.code).toBe('policy-source.not-published');
    }
  });

  it('the world mints tokens for the requested scope', async () => {
    const world = createHostedWorld();
    const budget = createGitHubBudget({ requests: 20, retriesPerRequest: 0 });

    const targetToken = await mintInstallationToken(world.credentials, WORLD_REPOSITORY_REF, 'gate-target', {
      budget,
      fetch: world.fetch,
    });
    expect(targetToken.ok).toBe(true);
    if (targetToken.ok) {
      expect(world.tokens).toContain(targetToken.value.secret());
    }

    const storeToken = await mintInstallationToken(
      world.credentials,
      { owner: 'steady-orchard', name: 'patch-steward-testbed-evidence' },
      'publish-store',
      { budget, fetch: world.fetch },
    );
    expect(storeToken.ok).toBe(true);
    if (storeToken.ok) {
      expect(world.tokens).toContain(storeToken.value.secret());
    }
  });

  it('the world answers the app bot user', async () => {
    const world = createHostedWorld();
    const budget = createGitHubBudget({ requests: 20, retriesPerRequest: 0 });
    const tokenResult = await mintInstallationToken(world.credentials, WORLD_REPOSITORY_REF, 'gate-target', {
      budget,
      fetch: world.fetch,
    });
    expect(tokenResult.ok).toBe(true);
    if (!tokenResult.ok) return;

    const botResult = await lookupAppBotUserId(world.credentials, tokenResult.value, { budget, fetch: world.fetch });
    expect(botResult.ok).toBe(true);
    if (botResult.ok) {
      expect(botResult.value).toBe(WORLD_BOT_ID);
    }
  });

  it('the world lists and serves ownership artifacts', async () => {
    const world = createHostedWorld();
    const client = testClient(world);

    const record: OwnershipRecord = {
      schema_version: 1,
      record_type: 'ownership',
      repository: WORLD_REPOSITORY,
      subject: { type: 'issue', number: 29 },
      run_id: WORLD_RUN_ID,
      run_attempt: 1,
      check_id: null,
      snapshot_hash: `sha256:${'a'.repeat(64)}`,
      policy_revision: world.policyTreeId() as string,
      disposition: 'runnable',
      admission: 'not-required',
      cap: { state: 'within', daily_count: 1, daily_limit: 50, author_count: 1, author_limit: 2 },
      event: {
        name: 'issues',
        action: 'opened',
        object_id: 5578290556,
        object_updated_at: ISSUE_UPDATED_AT,
        sender_id: WORLD_AUTHOR_ID,
        sender_type: 'User',
      },
      author_id: WORLD_AUTHOR_ID,
      created_at: '2026-09-28T10:00:05Z',
    };
    const encoded = encodeOwnershipRecord(record);
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;

    const artifact = world.addArtifact({
      name: 'steward-ownership-issue-29',
      createdAt: '2026-09-28T10:00:05Z',
      workflowRunId: WORLD_RUN_ID,
      recordBytes: encoded.value,
    });

    const read = await readOwnershipListing(
      client,
      WORLD_REPOSITORY_REF,
      { type: 'issue', number: 29 },
      { resolver: world.resolver, transport: world.transport },
    );
    expect(read.kind).toBe('unique');
    if (read.kind === 'unique') {
      expect(read.record.kind).toBe('valid');
      if (read.record.kind === 'valid') {
        expect(read.record.record).toEqual(record);
      }
    }
    expect(world.requests.some((r) => r.method === 'DOWNLOAD')).toBe(true);

    world.removeArtifact(artifact.id);
    const readAfterRemoval = await readOwnershipListing(
      client,
      WORLD_REPOSITORY_REF,
      { type: 'issue', number: 29 },
      { resolver: world.resolver, transport: world.transport },
    );
    expect(readAfterRemoval.kind).toBe('none');
  });

  it('the world captures its issues and pull requests', async () => {
    const world = createHostedWorld();
    const client = testClient(world);
    const loaded = await loadPolicy({ kind: 'github', client, repository: WORLD_REPOSITORY_REF, branch: 'master' });
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    const context: CaptureContext = {
      client,
      repository: WORLD_REPOSITORY_REF,
      policy: loaded.value.policy,
      policyRevision: loaded.value.revision.kind === 'git-tree' ? loaded.value.revision.id : '',
      attachmentResolver: world.resolver,
      attachmentTransport: world.transport,
      authorResponses: [],
    };

    const defectCapture = await captureIssue(context, 29);
    expect(defectCapture.ok).toBe(true);
    if (defectCapture.ok) {
      expect(defectCapture.value.contract.disposition).not.toBe('needs-changes');
      expect(defectCapture.value.contract.disposition).not.toBe('inconclusive');
    }

    const unstructuredCapture = await captureIssue(context, 30);
    expect(unstructuredCapture.ok).toBe(true);
    if (unstructuredCapture.ok) {
      expect(unstructuredCapture.value.contract.disposition).toBe('needs-changes');
    }

    const pullCapture = await capturePullRequest(context, 26);
    expect(pullCapture.ok).toBe(true);
  });

  it('the world lists tagged runs', async () => {
    const world = createHostedWorld();
    const client = testClient(world);
    world.runs.createdToday.push({
      id: 1,
      path: '.github/workflows/steward.yml',
      event: 'issues',
      status: 'completed',
      createdAt: WORLD_NOW,
      displayTitle: 'steward',
    });

    const result = await readCapRunLists(client, WORLD_REPOSITORY_REF, new Date(WORLD_NOW));
    expect(result.createdToday.items.length).toBe(1);
    expect(result.failure).toBeNull();
  });

  it('the world records requests and applies overrides first', async () => {
    const world = createHostedWorld();
    const client = testClient(world);
    world.override((request) => {
      if (request.url.pathname.endsWith('/actions/artifacts')) {
        return new Response(null, { status: 500 });
      }
      return undefined;
    });

    const read = await readOwnershipListing(
      client,
      WORLD_REPOSITORY_REF,
      { type: 'issue', number: 29 },
      { resolver: world.resolver, transport: world.transport },
    );
    expect(read.kind).toBe('unavailable');
    expect(
      world.requests.some((r) => r.method === 'GET' && r.host === 'api.github.com' && r.path.includes('/actions/artifacts')),
    ).toBe(true);
  });

  it('world payloads authenticate against the world environment', () => {
    const world = createHostedWorld();
    const issuesEnv = eventEnvironmentFromGate(gateEnvironment(world));

    const editedResult = authenticateEvent(issuesEnv, issuesEventPayload(world, 'edited'));
    expect(editedResult.ok).toBe(true);

    const prEnv: EventEnvironment = { ...issuesEnv, eventName: 'pull_request_target' };
    const openedResult = authenticateEvent(prEnv, pullRequestEventPayload(world, 'opened'));
    expect(openedResult.ok).toBe(true);

    const pull = world.pulls.get(26);
    expect(pull).toBeDefined();
    if (pull !== undefined) {
      pull.merged = true;
    }
    const closedResult = authenticateEvent(prEnv, pullRequestEventPayload(world, 'closed'));
    expect(closedResult.ok).toBe(true);
    if (closedResult.ok) {
      expect(closedResult.value.merged).toBe(true);
    }
  });

  it('extra handlers answer before the built-in routes', async () => {
    const world = createHostedWorld({
      handlers: [
        (request) => {
          if (request.method === 'GET' && request.url.pathname === REPO_PATH) {
            return jsonResponse(200, { full_name: WORLD_REPOSITORY, default_branch: 'trunk', private: false });
          }
          return undefined;
        },
      ],
    });
    const client = testClient(world);
    const result = await readRepository(client, WORLD_REPOSITORY_REF);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.defaultBranch).toBe('trunk');
    }
  });
});
