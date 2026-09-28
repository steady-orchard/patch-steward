import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import type { GitHubWriteRequest, GitHubWriteScope } from '../github/writer.js';
import { isAllowedGitHubWrite } from '../github/writer.js';
import { createStoreWorld } from '../evidence/store-world.test.js';
import { readGateEnvironment, readPublishEnvironment } from '../pipeline/hosted-environment.js';
import {
  createHostedWorld,
  gateEnvironment,
  issuesEventPayload,
  publishEnvironment,
  WORLD_NOW,
  WORLD_RUN_ID,
} from '../pipeline/hosted-world.test.js';
import type { HostedGateDeps, HostedGateResult } from '../pipeline/hosted-gate.js';
import { runHostedGate } from '../pipeline/hosted-gate.js';
import type { HostedPublishDeps } from '../pipeline/hosted-publish.js';
import { runHostedPublish } from '../pipeline/hosted-publish.js';
import { ok } from '../result.js';
import { fixedClock } from '../clock.js';

type World = ReturnType<typeof createHostedWorld>;

function trackers(): { masks: string[]; summaries: string[] } {
  return { masks: [], summaries: [] };
}

function gateDeps(world: World, tracking: { masks: string[]; summaries: string[] }): HostedGateDeps {
  return {
    fetch: world.fetch,
    sleep: async () => undefined,
    clock: fixedClock(WORLD_NOW),
    attachmentResolver: world.resolver,
    attachmentTransport: world.transport,
    mask: (s: string) => tracking.masks.push(s),
    writeSummary: async (t: string) => {
      tracking.summaries.push(t);
    },
  };
}

function publishDeps(world: World, tracking: { masks: string[]; summaries: string[] }): HostedPublishDeps {
  return {
    fetch: world.fetch,
    sleep: async () => undefined,
    clock: fixedClock('2026-09-28T10:00:30.000Z'),
    attachmentResolver: world.resolver,
    attachmentTransport: world.transport,
    mask: (s: string) => tracking.masks.push(s),
    writeSummary: async (t: string) => {
      tracking.summaries.push(t);
    },
    version: () => ok('0.0.2'),
  };
}

function gateEnvFor(world: World, overrides?: Readonly<Record<string, string>>) {
  const result = readGateEnvironment(gateEnvironment(world, overrides));
  if (!result.ok) {
    throw new Error('test gate environment failed to build');
  }
  return result.value;
}

function publishEnvFor(world: World, gateOutputs: Readonly<Record<string, string>>, overrides?: Readonly<Record<string, string>>) {
  const result = readPublishEnvironment(publishEnvironment(world, gateOutputs, overrides));
  if (!result.ok) {
    throw new Error('test publish environment failed to build');
  }
  return result.value;
}

async function runGate(
  world: World,
  action: string,
  options?: { readonly number?: number; readonly runAttemptEnv?: Readonly<Record<string, string>> },
): Promise<HostedGateResult> {
  const environment = gateEnvFor(world, options?.runAttemptEnv);
  const payload = issuesEventPayload(world, action, options?.number !== undefined ? { number: options.number } : undefined);
  return runHostedGate({ environment, payload }, gateDeps(world, trackers()));
}

function fileBytes(gate: Extract<HostedGateResult, { readonly ok: true }>, name: string): Uint8Array | null {
  return gate.files.find((f) => f.name === name)?.bytes ?? null;
}

async function runGateAndPublish(
  world: World,
  action: string,
  options?: { readonly number?: number; readonly runAttemptEnv?: Readonly<Record<string, string>> },
): Promise<void> {
  const gate = await runGate(world, action, options);
  expect(gate.ok).toBe(true);
  if (!gate.ok) return;
  const ownershipFile = fileBytes(gate, 'ownership');
  expect(ownershipFile).not.toBeNull();
  if (ownershipFile === null) return;
  world.addArtifact({
    name: gate.outputs['ownership_artifact'] ?? '',
    createdAt: options?.runAttemptEnv?.['GITHUB_RUN_ID'] !== undefined ? '2026-09-28T10:00:09Z' : '2026-09-28T10:00:05Z',
    workflowRunId:
      options?.runAttemptEnv?.['GITHUB_RUN_ID'] !== undefined ? Number(options.runAttemptEnv['GITHUB_RUN_ID']) : WORLD_RUN_ID,
    recordBytes: ownershipFile,
  });
  const publish = await runHostedPublish(
    {
      environment: publishEnvFor(world, gate.outputs, options?.runAttemptEnv),
      files: { handoff: fileBytes(gate, 'handoff'), gateContext: fileBytes(gate, 'gate-context'), closure: null },
    },
    publishDeps(world, trackers()),
  );
  expect(publish.ok).toBe(true);
}

function listTsFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTsFiles(full));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      files.push(full);
    }
  }
  return files;
}

function relativeToPosix(root: string, file: string): string {
  return path.relative(root, file).split(path.sep).join('/');
}

describe('write allowlist', () => {
  it('only the evidence store and token endpoints are writable', () => {
    const STORE = { repository: { owner: 'o', name: 'r' }, branch: 'steward-evidence' };
    const sha = 'a'.repeat(40);
    const appScope: GitHubWriteScope = { kind: 'app' };
    const installationScope: GitHubWriteScope = { kind: 'installation', store: STORE };

    const accessTokenBody = { repositories: ['r'], permissions: { contents: 'write' } };
    const accessTokenRequest: GitHubWriteRequest = {
      method: 'POST',
      path: '/app/installations/7/access_tokens',
      body: accessTokenBody,
    };
    expect(isAllowedGitHubWrite(accessTokenRequest, appScope)).toBe(true);

    const allowed: GitHubWriteRequest[] = [
      { method: 'DELETE', path: '/installation/token', body: null },
      { method: 'POST', path: '/repos/o/r/git/blobs', body: { content: 'aGVsbG8=', encoding: 'base64' } },
      {
        method: 'POST',
        path: '/repos/o/r/git/trees',
        body: { tree: [{ path: 'a.txt', mode: '100644', type: 'blob', sha }] },
      },
      { method: 'POST', path: '/repos/o/r/git/commits', body: { message: 'm', tree: sha, parents: [] } },
      { method: 'POST', path: '/repos/o/r/git/refs', body: { ref: 'refs/heads/steward-evidence', sha } },
      { method: 'PATCH', path: '/repos/o/r/git/refs/heads/steward-evidence', body: { sha, force: false } },
    ];
    for (const request of allowed) {
      expect(isAllowedGitHubWrite(request, installationScope)).toBe(true);
    }

    const disallowed: GitHubWriteRequest[] = [
      { method: 'POST', path: '/repos/o/r/issues/1/comments', body: { body: 'x' } },
      { method: 'PATCH', path: '/repos/o/r/issues/1', body: { state: 'closed' } },
      { method: 'POST', path: '/repos/o/r/issues/1/labels', body: { labels: ['x'] } },
      { method: 'DELETE', path: '/repos/o/r/issues/1/labels/x', body: null },
      { method: 'POST', path: '/repos/o/r/check-runs', body: { name: 'x', head_sha: sha } },
      { method: 'PATCH', path: '/repos/o/r/check-runs/1', body: { status: 'completed' } },
      { method: 'POST', path: '/repos/o/r/pulls/1/reviews', body: { event: 'COMMENT' } },
      { method: 'POST', path: '/repos/o/r/pulls/1/requested_reviewers', body: { reviewers: ['x'] } },
      { method: 'POST', path: '/repos/o/r/statuses/' + sha, body: { state: 'success' } },
      { method: 'POST', path: '/repos/o/r/issues/1/reactions', body: { content: '+1' } },
      { method: 'PATCH', path: '/repos/o/r/pulls/1', body: { title: 'x' } },
      { method: 'POST', path: '/repos/o/r/actions/workflows/x/dispatches', body: { ref: 'main' } },
      { method: 'PATCH', path: '/repos/o/r/git/refs/heads/master', body: { sha, force: false } },
      { method: 'POST', path: '/repos/o/r/git/refs', body: { ref: 'refs/heads/master', sha } },
      { method: 'PATCH', path: '/repos/o/r/git/refs/heads/steward-evidence', body: { sha, force: true } },
      { method: 'DELETE', path: '/repos/o/r/git/refs/heads/steward-evidence', body: null },
      { method: 'POST', path: '/repos/other/r/git/blobs', body: { content: 'aGVsbG8=', encoding: 'base64' } },
      {
        method: 'PUT',
        path: '/repos/o/r/contents/x',
        body: { message: 'm', content: 'aGVsbG8=' },
      } as unknown as GitHubWriteRequest,
    ];
    for (const request of disallowed) {
      expect(isAllowedGitHubWrite(request, installationScope)).toBe(false);
    }
    expect(isAllowedGitHubWrite(accessTokenRequest, installationScope)).toBe(false);
    const blobRequestUnderAppScope: GitHubWriteRequest = {
      method: 'POST',
      path: '/repos/o/r/git/blobs',
      body: { content: 'aGVsbG8=', encoding: 'base64' },
    };
    expect(isAllowedGitHubWrite(blobRequestUnderAppScope, appScope)).toBe(false);
  });

  it('hosted runs send only allowlisted writes', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    await runGateAndPublish(world, 'opened');

    const issue = world.issues.get(29);
    if (issue !== undefined) {
      issue.body = `${issue.body ?? ''}\nedited by a newer run`;
    }
    const nextRunId = WORLD_RUN_ID + 1;
    await runGateAndPublish(world, 'edited', { runAttemptEnv: { GITHUB_RUN_ID: String(nextRunId) } });

    const allowedPatterns = [
      /^POST \/app\/installations\/\d+\/access_tokens$/,
      /^DELETE \/installation\/token$/,
      /^POST \/repos\/steady-orchard\/patch-steward-testbed-public\/git\/(blobs|trees|commits|refs)$/,
      /^PATCH \/repos\/steady-orchard\/patch-steward-testbed-public\/git\/refs\/heads\/steward-evidence$/,
    ];
    for (const request of world.requests) {
      if (request.method === 'GET' || request.method === 'DOWNLOAD' || request.method === 'SUMMARY') continue;
      const line = request.method + ' ' + request.path;
      expect(
        allowedPatterns.some((pattern) => pattern.test(line)),
        `unexpected write: ${line}`,
      ).toBe(true);
    }
  });

  it('the gate sends no write other than token requests', async () => {
    const world = createHostedWorld();
    const gate = await runGate(world, 'opened');
    expect(gate.ok).toBe(true);

    for (const request of world.requests) {
      if (request.method === 'GET' || request.method === 'DOWNLOAD' || request.method === 'SUMMARY') continue;
      const isTokenPost = request.method === 'POST' && /^\/app\/installations\/\d+\/access_tokens$/.test(request.path);
      const isTokenDelete = request.method === 'DELETE' && request.path === '/installation/token';
      expect(isTokenPost || isTokenDelete, `unexpected write: ${request.method} ${request.path}`).toBe(true);
    }
  });

  it('non-get requests are built only by the writer users', () => {
    const coreRoot = fileURLToPath(new URL('../', import.meta.url));
    const actionRoot = fileURLToPath(new URL('../../../action/src/', import.meta.url));

    const fetchCallers = new Set<string>();
    const methodLiteralUsers = new Set<string>();
    for (const file of listTsFiles(coreRoot)) {
      const text = fs.readFileSync(file, 'utf8');
      const relative = relativeToPosix(coreRoot, file);
      if (text.includes('fetch(')) {
        fetchCallers.add(relative);
      }
      if (/method: '(POST|PATCH|DELETE|PUT)'/.test(text)) {
        methodLiteralUsers.add(relative);
      }
    }
    expect(fetchCallers).toEqual(new Set(['github/client.ts', 'github/writer.ts']));
    expect(methodLiteralUsers).toEqual(new Set(['github/app-auth.ts', 'evidence/git-store.ts']));

    for (const file of listTsFiles(actionRoot)) {
      const text = fs.readFileSync(file, 'utf8');
      expect(text.includes('fetch('), `${file} calls fetch(`).toBe(false);
      expect(/method: '(POST|PATCH|DELETE|PUT)'/.test(text), `${file} builds a write method literal`).toBe(false);
    }
  });
});
