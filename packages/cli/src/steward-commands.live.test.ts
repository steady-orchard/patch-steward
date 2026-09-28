import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { createGitHubBudget, createGitHubClient, readRepository } from '@patch-steward/core';

import type { ScreenCommandContext } from './screen-command.js';
import { runScreenCommand } from './screen-command.js';
import type { ReportCommandContext } from './report-command.js';
import { runReportCommand } from './report-command.js';
import { CLI_LOCAL_RUN_NOTICE } from './conventions.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const TEMPLATE = path.join(root, 'templates', 'policy', 'policy.yml');
const REPO = 'steady-orchard/patch-steward-testbed-public';
const FORK = 'jambolo/patch-steward-testbed-public';

const token = typeof process.env.GH_TOKEN === 'string' && process.env.GH_TOKEN !== '' ? process.env.GH_TOKEN : null;

let offline = false;
let ev: string;

function makeIo(): { io: { stdout: (t: string) => void; stderr: (t: string) => void }; stdout: string[]; stderr: string[] } {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    io: {
      stdout: (t: string) => stdout.push(t),
      stderr: (t: string) => stderr.push(t),
    },
    stdout,
    stderr,
  };
}

function countManifests(dir: string): number {
  if (!fs.existsSync(dir)) {
    return 0;
  }
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      count += countManifests(full);
    } else if (entry.name === 'manifest.json') {
      count += 1;
    }
  }
  return count;
}

beforeAll(async () => {
  const client = createGitHubClient({ token, budget: createGitHubBudget({ requests: 5, retriesPerRequest: 1 }) });
  const result = await readRepository(client, { owner: 'steady-orchard', name: 'patch-steward-testbed-public' });
  if (!result.ok && (result.failure.code === 'github.network' || result.failure.code === 'github.timeout')) {
    offline = true;
    console.warn('live tests skipped: GitHub is unreachable');
  }
  ev = fs.mkdtempSync(path.join(os.tmpdir(), 'm5-live-'));
});

afterAll(() => {
  fs.rmSync(ev, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

let runDir: string;

describe('steward commands live', () => {
  test('live: screen issue 29 under a local policy file needs changes', async (ctx) => {
    if (offline) {
      ctx.skip();
      return;
    }
    const { io, stdout } = makeIo();
    const context: ScreenCommandContext = { cwd: root, io, env: process.env };
    const exit = await runScreenCommand(
      ['--issue', '29', '--repo', REPO, '--policy-file', TEMPLATE, '--evidence-dir', ev],
      context,
    );
    expect(exit).toBe(1);
    const lines = stdout.join('').split('\n');
    expect(lines[0]).toBe(CLI_LOCAL_RUN_NOTICE);
    expect(lines[1]?.startsWith('non-authoritative: screened under a local policy file (local:')).toBe(true);
    expect(lines.some((line) => line === 'outcome: needs-changes')).toBe(true);
    expect(lines.some((line) => line.startsWith('run directory: '))).toBe(true);

    const issueRunsDir = path.join(ev, 'steady-orchard', 'patch-steward-testbed-public', 'runs', 'issue-29');
    const entries = fs.readdirSync(issueRunsDir);
    expect(entries.length).toBe(1);
    runDir = path.join(issueRunsDir, entries[0] as string);
    expect(fs.existsSync(path.join(runDir, 'manifest.json'))).toBe(true);
  });

  test('live: screen pr 26 json is non-authoritative and needs changes', async (ctx) => {
    if (offline) {
      ctx.skip();
      return;
    }
    const { io, stdout } = makeIo();
    const context: ScreenCommandContext = { cwd: root, io, env: process.env };
    const exit = await runScreenCommand(
      ['--pr', '26', '--repo', REPO, '--policy-file', TEMPLATE, '--evidence-dir', ev, '--json'],
      context,
    );
    expect(exit).toBe(1);
    const output = stdout.join('');
    expect(output.match(/\n/g)?.length ?? 0).toBe(1);
    expect(output.endsWith('\n')).toBe(true);
    const parsed = JSON.parse(output) as { authoritative: boolean; policy: { source: string }; outcome: string };
    expect(parsed.authoritative).toBe(false);
    expect(parsed.policy.source).toBe('local-file');
    expect(parsed.outcome).toBe('needs-changes');
    expect(output.includes('"authoritative":false')).toBe(true);
    expect(output.includes('"source":"local-file"')).toBe(true);
    expect(output.includes('"outcome":"needs-changes"')).toBe(true);
  });

  test('live: screen without a published policy exits 2 and writes no run', async (ctx) => {
    if (offline) {
      ctx.skip();
      return;
    }
    const before = countManifests(ev);
    const { io, stdout, stderr } = makeIo();
    const context: ScreenCommandContext = { cwd: root, io, env: process.env };
    const exit = await runScreenCommand(['--issue', '29', '--repo', FORK, '--evidence-dir', ev], context);
    expect(exit).toBe(2);
    expect(stdout.join('')).toBe('');
    expect(stderr.join('').includes('screen.policy-missing')).toBe(true);
    expect(countManifests(ev)).toBe(before);
  });

  test('live: report of a live run shows the non-authoritative notice', async (ctx) => {
    if (offline) {
      ctx.skip();
      return;
    }
    const { io, stdout } = makeIo();
    const context: ReportCommandContext = { cwd: root, io };
    const exit = await runReportCommand([runDir], context);
    expect(exit).toBe(1);
    expect(stdout.join('').includes('Non-authoritative:')).toBe(true);
  });

  test('live: the resolved token appears in no stored file', (ctx) => {
    if (token === null) {
      ctx.skip();
      return;
    }
    const offenders: string[] = [];
    function walk(dir: string): void {
      if (!fs.existsSync(dir)) {
        return;
      }
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (fs.readFileSync(full, 'utf8').includes(token as string)) {
          offenders.push(full);
        }
      }
    }
    walk(ev);
    expect(offenders).toEqual([]);
  });
});
