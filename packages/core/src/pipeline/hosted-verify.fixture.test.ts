import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { fixedClock } from '../clock.js';
import { ok } from '../result.js';
import { createStoreWorld } from '../evidence/store-world.test.js';
import { verifyRunDirectory } from '../evidence/verify.js';
import { readGateEnvironment, readPublishEnvironment } from './hosted-environment.js';
import type { HostedGateEnvironment, HostedPublishEnvironment } from './hosted-environment.js';
import { createHostedWorld, gateEnvironment, publishEnvironment, WORLD_REPOSITORY, WORLD_RUN_ID } from './hosted-world.test.js';
import type { HostedWorld } from './hosted-world.test.js';
import type { HostedGateDeps, HostedGateResult } from './hosted-gate.js';
import { runHostedGate } from './hosted-gate.js';
import type { HostedPublishDeps, HostedPublishFiles, HostedPublishResult } from './hosted-publish.js';
import { runHostedPublish } from './hosted-publish.js';

function payload(name: string): Uint8Array {
  const url = new URL('../../../../fixtures/events/' + name, import.meta.url);
  return new Uint8Array(readFileSync(fileURLToPath(url)));
}

function eventNameFor(name: string): string {
  return name.startsWith('pull-request-target') ? 'pull_request_target' : 'issues';
}

function environmentFor(world: HostedWorld, name: string, overrides?: Readonly<Record<string, string>>): HostedGateEnvironment {
  const env = readGateEnvironment(gateEnvironment(world, { GITHUB_EVENT_NAME: eventNameFor(name), ...overrides }));
  if (!env.ok) {
    throw new Error('test environment failed to build');
  }
  return env.value;
}

function buildGateDeps(world: HostedWorld): HostedGateDeps {
  return {
    fetch: world.fetch,
    sleep: async () => undefined,
    clock: fixedClock('2026-09-28T10:00:00.000Z'),
    attachmentResolver: world.resolver,
    attachmentTransport: world.transport,
    mask: () => undefined,
    writeSummary: async () => undefined,
  };
}

async function gate(world: HostedWorld, name: string, overrides?: Readonly<Record<string, string>>): Promise<HostedGateResult> {
  const environment = environmentFor(world, name, overrides);
  return runHostedGate({ environment, payload: payload(name) }, buildGateDeps(world));
}

type SucceededGate = Extract<HostedGateResult, { ok: true }>;

function upload(world: HostedWorld, gateResult: SucceededGate, runId: number, createdAt: string) {
  const ownershipFile = gateResult.files.find((f) => f.name === 'ownership');
  if (ownershipFile === undefined) {
    throw new Error('expected an ownership file to upload');
  }
  return world.addArtifact({
    name: gateResult.outputs['ownership_artifact'] as string,
    createdAt,
    workflowRunId: runId,
    recordBytes: ownershipFile.bytes,
  });
}

function gateFilesOf(gateResult: SucceededGate): HostedPublishFiles {
  const find = (name: string): Uint8Array | null => gateResult.files.find((f) => f.name === name)?.bytes ?? null;
  return { handoff: find('handoff'), gateContext: find('gate-context'), closure: find('closure') };
}

async function publish(
  world: HostedWorld,
  gateResult: SucceededGate,
): Promise<{ readonly result: HostedPublishResult; readonly summaries: string[] }> {
  const environment = readPublishEnvironment(publishEnvironment(world, gateResult.outputs));
  if (!environment.ok) {
    throw new Error('test publish environment failed to build');
  }
  const summaries: string[] = [];
  const deps: HostedPublishDeps = {
    fetch: world.fetch,
    sleep: async (ms: number) => {
      world.requests.push({ method: 'SLEEP', host: '', path: String(ms) });
    },
    clock: fixedClock('2026-09-28T10:00:30.000Z'),
    attachmentResolver: world.resolver,
    attachmentTransport: world.transport,
    mask: () => undefined,
    writeSummary: async (t: string) => {
      summaries.push(t);
      world.requests.push({ method: 'SUMMARY', host: '', path: '' });
    },
    version: () => ok('0.0.2'),
  };
  const result = await runHostedPublish(
    { environment: environment.value as HostedPublishEnvironment, files: gateFilesOf(gateResult) },
    deps,
  );
  return { result, summaries };
}

function requireOk(result: HostedGateResult): SucceededGate {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error('expected gate to succeed');
  }
  return result;
}

function materialize(files: ReadonlyMap<string, Uint8Array>): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'm6-verify-'));
  for (const [storePath, bytes] of files) {
    const segments = storePath.split('/');
    const target = path.join(root, ...segments);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, bytes);
  }
  return root;
}

describe('hosted run directories', () => {
  const roots: string[] = [];

  afterEach(() => {
    while (roots.length > 0) {
      const dir = roots.pop() as string;
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it('a hosted issue run directory verifies like a local run', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    const first = requireOk(await gate(world, 'issues-opened.json'));
    upload(world, first, WORLD_RUN_ID, '2026-09-28T10:00:05Z');
    const { result } = await publish(world, first);
    expect(result.ok).toBe(true);

    const root = materialize(store.files(WORLD_REPOSITORY));
    roots.push(root);

    const runDirectory = path.join(root, WORLD_REPOSITORY, 'runs', 'issue-29', `${String(WORLD_RUN_ID)}-1`);
    const verified = await verifyRunDirectory(runDirectory);
    expect(verified.ok).toBe(true);
    if (!verified.ok) {
      throw new Error('expected the run directory to verify');
    }
    expect(verified.value.metrics).toBe('verified');
    expect(verified.value.warnings.length).toBe(0);
    if (result.ok) {
      expect(verified.value.decision.outcome).toBe(result.outputs.status);
    }
  });

  it('a hosted pull request run directory verifies like a local run', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    const first = requireOk(await gate(world, 'pull-request-target-opened.json'));
    upload(world, first, WORLD_RUN_ID, '2026-09-28T10:00:05Z');
    const { result } = await publish(world, first);

    const evidenceCommit = result.ok ? result.outputs.evidence_commit : result.evidenceCommit;
    expect(evidenceCommit).not.toBeNull();

    const root = materialize(store.files(WORLD_REPOSITORY));
    roots.push(root);

    const runDirectory = path.join(root, WORLD_REPOSITORY, 'runs', 'pr-26', `${String(WORLD_RUN_ID)}-1`);
    const verified = await verifyRunDirectory(runDirectory);
    expect(verified.ok).toBe(true);
    if (!verified.ok) {
      throw new Error('expected the run directory to verify');
    }
    expect(verified.value.metrics).toBe('verified');
  });

  it('every committed store file is listed by a manifest or is a metrics file', async () => {
    const store = createStoreWorld();
    const world = createHostedWorld({ handlers: [store.handler] });
    const first = requireOk(await gate(world, 'issues-opened.json'));
    upload(world, first, WORLD_RUN_ID, '2026-09-28T10:00:05Z');
    const { result } = await publish(world, first);
    expect(result.ok).toBe(true);

    const files = store.files(WORLD_REPOSITORY);
    const runPrefix = `${WORLD_REPOSITORY}/runs/issue-29/${String(WORLD_RUN_ID)}-1/`;
    const manifestPath = `${runPrefix}manifest.json`;
    const manifestBytes = files.get(manifestPath);
    expect(manifestBytes).toBeDefined();
    const manifest = JSON.parse(Buffer.from(manifestBytes as Uint8Array).toString('utf8')) as {
      files: readonly { path: string }[];
    };
    const manifestFilePaths = new Set(manifest.files.map((f) => f.path));

    for (const storePath of files.keys()) {
      if (storePath.startsWith(runPrefix)) {
        const relative = storePath.slice(runPrefix.length);
        if (relative !== 'manifest.json') {
          expect(manifestFilePaths.has(relative)).toBe(true);
        }
      } else {
        expect(storePath.startsWith(`${WORLD_REPOSITORY}/metrics/`)).toBe(true);
      }
    }
  });
});
