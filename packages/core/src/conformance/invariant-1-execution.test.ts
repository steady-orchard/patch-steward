import { beforeEach, describe, expect, test, vi } from 'vitest';

const spy = vi.hoisted(() => ({ calls: [] as { fn: string; file: string }[] }));

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();

  function wrap<T>(fn: T, name: string): T {
    return ((...args: unknown[]) => {
      spy.calls.push({ fn: name, file: String(args[0]) });
      return Reflect.apply(fn as (...a: unknown[]) => unknown, undefined, args);
    }) as T;
  }

  return {
    ...actual,
    execFile: wrap(actual.execFile, 'execFile'),
    execFileSync: wrap(actual.execFileSync, 'execFileSync'),
    spawn: wrap(actual.spawn, 'spawn'),
    spawnSync: wrap(actual.spawnSync, 'spawnSync'),
    exec: wrap(actual.exec, 'exec'),
    execSync: wrap(actual.execSync, 'execSync'),
    fork: wrap(actual.fork, 'fork'),
  };
});

import { OutputCaptureBuffer } from '../execution/output-capture.js';
import type { ExecutionPlanEntry } from '../execution/plan.js';
import { executionResultEntrySchema } from '../execution/transport.js';
import { parseJunitXml } from '../junit/parse.js';
import { executionRecordSchema } from '../records/execution-record.js';
import { executedCommandItem } from '../report/templates.js';
import { buildCompletedExecution } from '../runner/record.js';
import type { ExecutionRecordFacts } from '../runner/record.js';

const HOSTILE = [
  '$(touch /tmp/pwned) `id` ; rm -rf / && echo owned',
  '**bold** [link](https://example.invalid) <img src=x>',
  '@octocat #1 owner/repo#2',
  '${{ secrets.GITHUB_TOKEN }}',
  '</testcase><testcase name="forged"/>',
] as const;

const enc = new TextEncoder();

function entry(withResult: boolean): ExecutionPlanEntry {
  return {
    id: 'head-test',
    kind: 'command',
    command_id: 'test',
    run: ['sh', 'run.sh'],
    working_directory: '.',
    commit_role: 'head',
    commit: 'c'.repeat(40),
    overlay: 'none',
    expected: 'exit-zero',
    network: 'none',
    result_files: withResult ? [{ path: 'r.xml', format: 'junit-xml' }] : [],
  } as ExecutionPlanEntry;
}

const environment = {
  image_digest: 'sha256:' + 'd'.repeat(64),
  tool_versions: [
    { name: 'docker-client', version: '29.8.0' },
    { name: 'docker-server', version: '29.8.0' },
  ],
  runtime: { name: 'docker', client_version: '29.8.0', server_version: '29.8.0', os: 'linux', arch: 'amd64' },
  image: {
    source: 'registry',
    reference: 'docker.io/library/busybox:1.37.0',
    digest: 'sha256:' + 'd'.repeat(64),
    id: 'sha256:' + 'e'.repeat(64),
    runner_tree_id: null,
    cached: false,
  },
  platform: 'linux/amd64',
  network: 'none',
} as ExecutionRecordFacts['environment'];

const limits = {
  execution_seconds: 1800,
  output_head_bytes: 262144,
  output_tail_bytes: 786432,
  output_stream_bytes: 268435456,
  cpus: 2,
  memory_mb: 4096,
  pids: 512,
  scratch_mb: 1024,
} as ExecutionRecordFacts['limits'];

const timing = {
  started_at: '2026-10-03T10:15:00.000Z',
  finished_at: '2026-10-03T10:15:02.500Z',
  duration_ms: 2500,
} as ExecutionRecordFacts['timing'];

const checkout = {
  commit: 'c'.repeat(40),
  tree: 'f'.repeat(40),
  archive_sha256: 'sha256:' + '1'.repeat(64),
  files: 3,
  bytes: 120,
  overlays: [],
  skipped_submodules: [],
} as unknown as NonNullable<ExecutionRecordFacts['checkout']>;

function capture(text: string) {
  const buffer = new OutputCaptureBuffer({ headBytes: 262144, tailBytes: 786432, streamBytes: 268435456 });
  buffer.push(enc.encode(text));
  return buffer.result();
}

function facts(overrides: Partial<ExecutionRecordFacts>): ExecutionRecordFacts {
  return {
    runId: 123,
    runAttempt: 1,
    entry: entry(false),
    runner: 'container',
    environment,
    limits,
    timing,
    exit: { code: 1, signal: null, timedOut: false, oomKilled: false, outputLimited: false },
    capture: capture(''),
    resultFiles: [],
    resultTestCases: 1000,
    checkout,
    ...overrides,
  };
}

// XML-escaped so the hostile text is attribute data, not markup.
function xmlAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function junitDocument(): string {
  const cases = HOSTILE.map((cls, i) => {
    const name = HOSTILE[(i + 1) % HOSTILE.length] as string;
    return `<testcase classname="${xmlAttr(cls)}" name="${xmlAttr(name)}"/>`;
  });
  return `<testsuites><testsuite name="s">${cases.join('')}</testsuite></testsuites>`;
}

describe('invariant 1: execution output stays data', () => {
  beforeEach(() => {
    spy.calls.length = 0;
  });

  test('invariant 1: hostile output stays data in records', () => {
    const text = HOSTILE.join('\n');
    const result = buildCompletedExecution(facts({ capture: capture(text) }));

    expect(executionRecordSchema.safeParse(result.record).success).toBe(true);
    expect(executionResultEntrySchema.safeParse(result).success).toBe(true);
    const parts = result.output.parts.join('');
    const recorded = `${result.record.output.head}${result.record.output.tail}`;
    for (const hostile of HOSTILE) {
      expect(parts).toContain(hostile);
      expect(recorded).toContain(hostile);
    }
    expect(spy.calls).toEqual([]);
  });

  test('invariant 1: hostile test names stay data', () => {
    const bytes = enc.encode(junitDocument());
    const parsed = parseJunitXml(bytes, { maxCases: 1000 });
    expect(parsed.status).toBe('parsed');
    if (parsed.status !== 'parsed') return;

    expect(parsed.junit.tests).toBe(HOSTILE.length);
    const identities = parsed.junit.cases.map((c) => c.identity);
    expect(identities).toEqual(HOSTILE.map((cls, i) => `${cls}::${HOSTILE[(i + 1) % HOSTILE.length] as string}`));
    expect(identities.some((id) => id.startsWith('::forged'))).toBe(false);

    const result = buildCompletedExecution(facts({ entry: entry(true), resultFiles: [{ kind: 'file', bytes }] }));
    expect(executionRecordSchema.safeParse(result.record).success).toBe(true);
    expect(executionResultEntrySchema.safeParse(result).success).toBe(true);
    const stored = result.record.result_files[0]?.junit?.cases.map((c) => c.identity);
    expect(stored).toEqual(identities);
    expect(spy.calls).toEqual([]);
  });

  test('invariant 1: report items escape derived values', () => {
    const result = buildCompletedExecution(
      facts({ entry: entry(true), resultFiles: [{ kind: 'file', bytes: enc.encode(junitDocument()) }] }),
    );
    const { record } = result;
    const junit = record.result_files[0]?.junit ?? null;
    const item = executedCommandItem({
      entryId: record.plan_entry,
      commit: record.commits.head,
      exitCode: record.exit?.code ?? null,
      signal: record.exit?.signal ?? null,
      timedOut: record.exit?.timed_out ?? false,
      oomKilled: record.exit?.oom_killed ?? false,
      outputLimited: record.exit?.output_limited ?? false,
      durationMs: record.timing?.duration_ms ?? 0,
      junit: junit === null ? null : { passed: junit.passed, tests: junit.tests },
    });

    for (const hostile of HOSTILE) expect(item).not.toContain(hostile);
    expect(item).not.toContain('@');
    expect(item).not.toContain('${{');
    expect(item).toBe('`head-test` at `cccccccccccc`: exit `1`; `2.5` s; JUnit `5`/`5` passed');
  });
});
