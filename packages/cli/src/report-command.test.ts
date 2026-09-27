import { fileURLToPath } from 'node:url';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { fixedClock, fixedRandom, ok, screenSubmission, verifyRunDirectory } from '@patch-steward/core';
import type { GitHubFetch } from '@patch-steward/core';

import { CLI_LOCAL_RUN_NOTICE } from './conventions.js';
import type { ReportCommandContext } from './report-command.js';
import { REPORT_INTERNAL_ERROR_MESSAGE, REPORT_USAGE, runReportCommand } from './report-command.js';

const corpusRoot = fileURLToPath(new URL('../../../fixtures/', import.meta.url));
const TEMPLATE = fileURLToPath(new URL('../../../templates/policy/policy.yml', import.meta.url));

const CLOCK = fixedClock('2026-09-27T10:15:00.000Z');
const RANDOM = fixedRandom('3f9a1c2e');

const T = '/repos/steady-orchard/patch-steward-testbed-public';
const Y = '/repos/example-owner/example-repo';

function readJsonFixture(relPath: string): unknown {
  return JSON.parse(readFileSync(join(corpusRoot, relPath), 'utf8').replace(/\r\n/g, '\n'));
}

function readTextFixture(relPath: string): string {
  return readFileSync(join(corpusRoot, relPath), 'utf8').replace(/\r\n/g, '\n');
}

function makeFetch(routes: Record<string, unknown>): GitHubFetch {
  return (url: string) => {
    const pathname = new URL(url).pathname;
    if (!(pathname in routes)) {
      return Promise.resolve(new Response('{}', { status: 404 }));
    }
    return Promise.resolve(new Response(JSON.stringify(routes[pathname]), { status: 200 }));
  };
}

function attachmentTransport() {
  return async () => ({
    kind: 'response' as const,
    status: 200,
    location: null,
    body: (async function* (): AsyncGenerator<Uint8Array> {
      yield new Uint8Array();
    })(),
    close: () => undefined,
  });
}

const tmpDirs: string[] = [];

function makeTmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'm5-rep-'));
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

async function makeRun(kind: 'needs' | 'trusted' | 'pass'): Promise<{ root: string; directory: string }> {
  const root = makeTmpDir();

  if (kind === 'trusted') {
    const issue = readJsonFixture('github/testbed/issue-29.json') as Record<string, unknown>;
    const body = readTextFixture('submissions/defect-complete.txt');
    const routes: Record<string, unknown> = {
      [Y]: { full_name: 'example-owner/example-repo', default_branch: 'main', private: false },
      [`${Y}/git/ref/heads/main`]: readJsonFixture('github/policy-directory/ref-heads-main.json'),
      [`${Y}/contents/.github`]: readJsonFixture('github/policy-directory/contents-github.json'),
      [`${Y}/git/trees/a8c2485882b52f63db71b1ec63b12f5039220e03`]: readJsonFixture('github/policy-directory/tree.json'),
      [`${Y}/git/blobs/716098133e97314ccf047f5034cc8f76161d8f0d`]: readJsonFixture('github/policy-directory/blob-policy.json'),
      [`${Y}/issues/29`]: { ...issue, body },
    };
    const result = await screenSubmission({
      repository: { owner: 'example-owner', name: 'example-repo' },
      submission: { type: 'issue', number: 29 },
      policySource: { kind: 'trusted-branch' },
      token: 'token-a',
      evidenceDir: root,
      fetch: makeFetch(routes),
      sleep: async () => undefined,
      attachmentResolver: async () => [{ address: '140.82.112.3', family: 4 }],
      attachmentTransport: attachmentTransport(),
      clock: CLOCK,
      random: RANDOM,
    });
    if (result.kind !== 'completed') {
      throw new Error(`expected a completed run, got ${result.kind}`);
    }
    return { root, directory: result.published.directory };
  }

  const issue = readJsonFixture('github/testbed/issue-29.json') as Record<string, unknown>;
  const routes: Record<string, unknown> = {
    [T]: readJsonFixture('github/testbed/repository.json'),
    [`${T}/issues/29`]: kind === 'pass' ? { ...issue, body: readTextFixture('submissions/defect-complete.txt') } : issue,
  };

  const result = await screenSubmission({
    repository: { owner: 'steady-orchard', name: 'patch-steward-testbed-public' },
    submission: { type: 'issue', number: 29 },
    policySource: { kind: 'local-file', path: TEMPLATE },
    token: 'token-a',
    evidenceDir: root,
    fetch: makeFetch(routes),
    sleep: async () => undefined,
    attachmentResolver: async () => [{ address: '140.82.112.3', family: 4 }],
    attachmentTransport: attachmentTransport(),
    clock: CLOCK,
    random: RANDOM,
    ...(kind === 'pass'
      ? {
          decide: () => ({
            kind: 'outcome' as const,
            outcome: 'pass' as const,
            row: 9,
            contributing_findings: [],
            unmet_requirements: [],
            requests: [],
            causes: [],
          }),
        }
      : {}),
  });
  if (result.kind !== 'completed') {
    throw new Error(`expected a completed run, got ${result.kind}`);
  }
  return { root, directory: result.published.directory };
}

function makeContext(overrides: Partial<ReportCommandContext> = {}): {
  context: ReportCommandContext;
  stdout: string[];
  stderr: string[];
} {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const context: ReportCommandContext = {
    cwd: overrides.cwd ?? process.cwd(),
    io: {
      stdout: (text: string) => stdout.push(text),
      stderr: (text: string) => stderr.push(text),
    },
    ...(overrides.verify !== undefined ? { verify: overrides.verify } : {}),
  };
  return { context, stdout, stderr };
}

describe('report usage errors exit 2 in text and json mode', () => {
  it('report usage errors exit 2 in text and json mode', async () => {
    const empty = makeContext();
    const exit1 = await runReportCommand([], empty.context);
    expect(exit1).toBe(2);
    expect(empty.stdout.join('')).toBe('');
    expect(empty.stderr.join('')).toBe(`error usage.invalid-arguments -: a run directory is required\n${REPORT_USAGE}\n`);

    const two = makeContext();
    const exit2 = await runReportCommand(['a', 'b', '--json'], two.context);
    expect(exit2).toBe(2);
    expect(two.stderr.join('')).toBe('');
    expect(two.stdout.length).toBe(1);
    const parsed2 = JSON.parse(two.stdout[0] as string) as { errors: { code: string; path: string; message: string }[] };
    expect(parsed2.errors[0]).toEqual({
      code: 'usage.invalid-arguments',
      path: '',
      message: 'exactly one run directory is allowed',
    });

    const bogus = makeContext();
    const exit3 = await runReportCommand(['--bogus', 'x', '--json'], bogus.context);
    void exit3;
    const parsed3 = JSON.parse(bogus.stdout[0] as string) as { errors: { code: string }[] };
    expect(parsed3.errors[0]?.code).toBe('usage.unknown-option');
  });
});

describe('non-authoritative run is labeled in report text', () => {
  it('non-authoritative run is labeled in report text', async () => {
    const { directory } = await makeRun('needs');
    const { context, stdout, stderr } = makeContext();
    const exit = await runReportCommand([directory], context);
    expect(exit).toBe(1);
    const expected = readFileSync(join(directory, 'report.md'), 'utf8');
    expect(stdout.join('')).toBe(expected);
    expect(stdout.join('')).toContain('Non-authoritative:');
    expect(stderr.join('')).toBe('');
  });
});

describe('non-authoritative run is labeled in report json', () => {
  it('non-authoritative run is labeled in report json', async () => {
    const { directory } = await makeRun('needs');
    const { context, stdout } = makeContext();
    const exit = await runReportCommand([directory, '--json'], context);
    expect(exit).toBe(1);
    expect(stdout.length).toBe(1);
    const parsed = JSON.parse(stdout[0] as string) as {
      authoritative: boolean;
      policy: { revision: string; authoritative: boolean; source: string };
      notices: string[];
      report: string;
    };
    expect(parsed.authoritative).toBe(false);
    expect(parsed.policy.revision).toMatch(/^local:[0-9a-f]{64}$/);
    expect(parsed.policy).toEqual({ revision: parsed.policy.revision, authoritative: false, source: 'local-file' });
    expect(parsed.notices).toEqual([
      CLI_LOCAL_RUN_NOTICE,
      `non-authoritative: screened under a local policy file (${parsed.policy.revision})`,
    ]);
    expect(parsed.report).toContain('Non-authoritative:');
  });
});

describe('trusted-branch run is authoritative in report json', () => {
  it('trusted-branch run is authoritative in report json', async () => {
    const { directory } = await makeRun('trusted');
    const { context, stdout } = makeContext();
    const exit = await runReportCommand([directory, '--json'], context);
    expect(exit).toBe(3);
    const parsed = JSON.parse(stdout[0] as string) as {
      authoritative: boolean;
      policy: { revision: string; authoritative: boolean; source: string };
      notices: string[];
      report: string;
    };
    expect(parsed.authoritative).toBe(true);
    expect(parsed.policy).toEqual({
      revision: 'a8c2485882b52f63db71b1ec63b12f5039220e03',
      authoritative: true,
      source: 'trusted-branch',
    });
    expect(parsed.notices).toEqual([CLI_LOCAL_RUN_NOTICE]);
    expect(parsed.report).not.toContain('Non-authoritative:');
  });
});

describe('report json has the documented shape', () => {
  it('report json has the documented shape', async () => {
    const { directory } = await makeRun('needs');
    const { context, stdout } = makeContext();
    await runReportCommand([directory, '--json'], context);
    const parsed = JSON.parse(stdout[0] as string) as Record<string, unknown>;
    expect(Object.keys(parsed)).toEqual([
      'schema_version',
      'command',
      'local_run',
      'authoritative',
      'notices',
      'run',
      'submission',
      'policy',
      'outcome',
      'causes',
      'report',
      'check_summary',
      'integrity',
      'warnings',
      'errors',
    ]);
    const run = parsed.run as Record<string, unknown>;
    expect(Object.keys(run)).toEqual(['run_id', 'run_attempt', 'directory', 'started_at', 'finished_at']);
    expect(run.run_id).toBe('local-20260927T101500Z-3f9a1c2e');
    expect(run.run_attempt).toBe(1);
    expect(run.directory).toBe(resolve(directory));

    const submission = parsed.submission as Record<string, unknown>;
    expect(Object.keys(submission)).toEqual([
      'repository',
      'type',
      'number',
      'snapshot_hash',
      'target_branch',
      'head_commit',
      'base_commit',
    ]);
    expect(submission.repository).toBe('steady-orchard/patch-steward-testbed-public');
    expect(submission.type).toBe('issue');
    expect(submission.number).toBe(29);
    expect(submission.snapshot_hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(submission.target_branch).toBeNull();
    expect(submission.head_commit).toBeNull();
    expect(submission.base_commit).toBeNull();

    expect(parsed.outcome).toBe('needs-changes');
    expect(parsed.causes).toEqual([]);
    expect((parsed.check_summary as string).startsWith('**Outcome:** `needs-changes`')).toBe(true);
    expect(parsed.integrity).toEqual({ manifest: 'verified', files: 8, metrics: 'verified' });
    expect(parsed.warnings).toEqual([]);
    expect(parsed.errors).toEqual([]);
  });
});

describe('report exits 0 for a stored pass run', () => {
  it('report exits 0 for a stored pass run', async () => {
    const { directory } = await makeRun('pass');
    const { context } = makeContext();
    const exit = await runReportCommand([directory], context);
    expect(exit).toBe(0);
  });
});

describe('report exits 3 for a stored inconclusive run', () => {
  it('report exits 3 for a stored inconclusive run', async () => {
    const { directory } = await makeRun('trusted');
    const { context, stdout } = makeContext();
    const exit = await runReportCommand([directory], context);
    expect(exit).toBe(3);
    expect(stdout.join('')).toBe(readFileSync(join(directory, 'report.md'), 'utf8'));
  });
});

describe('report exits 1 for tampered evidence', () => {
  it('report exits 1 for tampered evidence', async () => {
    const { directory } = await makeRun('needs');
    const { appendFileSync } = await import('node:fs');
    appendFileSync(join(directory, 'report.md'), 'x');

    const text = makeContext();
    const exitText = await runReportCommand([directory], text.context);
    expect(exitText).toBe(1);
    expect(text.stdout.join('')).toBe('');
    expect(text.stderr.join('')).toContain('error report.evidence-invalid -: ');

    const jsonCtx = makeContext();
    const exitJson = await runReportCommand([directory, '--json'], jsonCtx.context);
    expect(exitJson).toBe(1);
    const parsed = JSON.parse(jsonCtx.stdout[0] as string) as {
      errors: { code: string }[];
      outcome: unknown;
      report: unknown;
    };
    expect(parsed.errors[0]?.code).toBe('report.evidence-invalid');
    expect(parsed.outcome).toBeNull();
    expect(parsed.report).toBeNull();
  });
});

describe('report exits 2 for a missing run directory', () => {
  it('report exits 2 for a missing run directory', async () => {
    const tmp = makeTmpDir();
    const { context, stdout } = makeContext();
    const exit = await runReportCommand([join(tmp, 'does-not-exist'), '--json'], context);
    expect(exit).toBe(2);
    const parsed = JSON.parse(stdout[0] as string) as { errors: { code: string }[] };
    expect(parsed.errors[0]?.code).toBe('report.run-unreadable');
  });
});

describe('report warns when the metrics file is missing', () => {
  it('report warns when the metrics file is missing', async () => {
    const { root, directory } = await makeRun('needs');
    const { unlinkSync } = await import('node:fs');
    unlinkSync(
      join(root, 'steady-orchard', 'patch-steward-testbed-public', 'metrics', '2026-09', 'local-20260927T101500Z-3f9a1c2e.json'),
    );

    const text = makeContext();
    const exitText = await runReportCommand([directory], text.context);
    expect(exitText).toBe(1);
    expect(text.stdout.join('')).toBe(readFileSync(join(directory, 'report.md'), 'utf8'));
    expect(text.stderr.join('')).toBe('warning report.metrics-missing: The metrics file of this run is missing.\n');

    const jsonCtx = makeContext();
    await runReportCommand([directory, '--json'], jsonCtx.context);
    const parsed = JSON.parse(jsonCtx.stdout[0] as string) as {
      integrity: { metrics: string };
      warnings: { code: string; message: string }[];
    };
    expect(parsed.integrity.metrics).toBe('missing');
    expect(parsed.warnings).toEqual([{ code: 'report.metrics-missing', message: 'The metrics file of this run is missing.' }]);
    expect(jsonCtx.stderr.join('')).toBe('');
  });
});

describe('report resolves a relative run directory against the working directory', () => {
  it('report resolves a relative run directory against the working directory', async () => {
    const { root, directory } = await makeRun('needs');
    const relativePath = relative(root, directory);
    const { context, stdout } = makeContext({ cwd: root });
    const exit = await runReportCommand([relativePath], context);
    expect(exit).toBe(1);
    expect(stdout.join('')).toBe(readFileSync(join(directory, 'report.md'), 'utf8'));
  });
});

describe('report maps an unexpected exception to steward.internal-error', () => {
  it('report maps an unexpected exception to steward.internal-error', async () => {
    const { context, stdout } = makeContext({
      verify: async () => {
        throw new Error('boom');
      },
    });
    const exit = await runReportCommand(['x', '--json'], context);
    expect(exit).toBe(2);
    const parsed = JSON.parse(stdout[0] as string) as { errors: { code: string; path: string; message: string }[] };
    expect(parsed.errors[0]).toEqual({ code: 'steward.internal-error', path: '', message: REPORT_INTERNAL_ERROR_MESSAGE });
  });
});

describe('report never prints stored text with control characters', () => {
  it('report never prints stored text with control characters', async () => {
    const { directory } = await makeRun('needs');
    const real = await verifyRunDirectory(directory);
    if (!real.ok) {
      throw new Error('expected the run to verify');
    }

    const text = makeContext({
      verify: async () => ok({ ...real.value, reportMarkdown: real.value.reportMarkdown + '\u001b[31m' }),
    });
    const exitText = await runReportCommand([directory], text.context);
    expect(exitText).toBe(1);
    expect(text.stdout.join('')).toBe('');
    expect(text.stderr.join('')).toContain('error report.evidence-invalid report.md: ');

    const jsonCtx = makeContext({
      verify: async () => ok({ ...real.value, reportMarkdown: real.value.reportMarkdown + '\u001b[31m' }),
    });
    const exitJson = await runReportCommand([directory, '--json'], jsonCtx.context);
    void exitJson;
    const parsed = JSON.parse(jsonCtx.stdout[0] as string) as { errors: { code: string; path: string; message: string }[] };
    expect(parsed.errors[0]).toEqual({
      code: 'report.evidence-invalid',
      path: 'report.md',
      message: 'report.md contains a control or format character.',
    });
    expect(jsonCtx.stdout[0]).not.toContain('\u001b');
  });
});
