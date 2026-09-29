import { describe, expect, it } from 'vitest';
import { OutputCaptureBuffer } from '../execution/output-capture.js';
import type { ExecutionPlanEntry } from '../execution/plan.js';
import { executionResultEntrySchema } from '../execution/transport.js';
import { executionRecordSchema } from '../records/execution-record.js';
import { buildCompletedExecution, type ExecutionRecordFacts, type ResultFileRead } from './record.js';

const SAMPLE = '<testsuites><testsuite name="s"><testcase classname="c" name="t"/></testsuite></testsuites>';
const enc = new TextEncoder();

function entry(overrides: Partial<ExecutionPlanEntry> = {}): ExecutionPlanEntry {
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
    result_files: [],
    ...overrides,
  } as ExecutionPlanEntry;
}

const containerEnvironment = {
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

function capture(text: string, headBytes = 262144, tailBytes = 786432, streamBytes = 268435456) {
  const buffer = new OutputCaptureBuffer({ headBytes, tailBytes, streamBytes });
  buffer.push(enc.encode(text));
  return buffer.result();
}

function facts(overrides: Partial<ExecutionRecordFacts> = {}): ExecutionRecordFacts {
  return {
    runId: 123,
    runAttempt: 1,
    entry: entry(),
    runner: 'container',
    environment: containerEnvironment,
    limits,
    timing,
    exit: { code: 0, signal: null, timedOut: false, oomKilled: false, outputLimited: false },
    capture: capture(''),
    resultFiles: [],
    resultTestCases: 1000,
    checkout,
    ...overrides,
  };
}

function expectValid(result: ReturnType<typeof buildCompletedExecution>): void {
  expect(executionResultEntrySchema.safeParse(result).success).toBe(true);
  expect(executionRecordSchema.safeParse(result.record).success).toBe(true);
}

const declared = (n: number) => Array.from({ length: n }, (_, i) => ({ path: `r${i}.xml`, format: 'junit-xml' as const }));

describe('execution record builder', () => {
  it('builds a container record that validates', () => {
    const result = buildCompletedExecution(
      facts({
        entry: entry({ result_files: declared(1) }),
        exit: { code: 1, signal: null, timedOut: false, oomKilled: false, outputLimited: false },
        capture: capture('hello'),
        resultFiles: [{ kind: 'file', bytes: enc.encode(SAMPLE) }],
      }),
    );
    expectValid(result);
    expect(result.record.admissibility).toBe('evidence');
    expect(result.record.runner).toBe('container');
    expect(result.record.exit.code).toBe(1);
    expect(result.record.output.head + result.record.output.tail).toBe('hello');
    expect(result.record.output.stored_path).toBeNull();
    expect(result.record.result_files[0]?.junit?.tests).toBe(1);
    expect(result.result_texts).toEqual([{ position: 1, decoded_bytes: SAMPLE.length, text: SAMPLE }]);
    expect(result.record.commits.head).toBe(entry().commit);
  });

  it('builds an unsandboxed claim record', () => {
    const result = buildCompletedExecution(
      facts({
        runner: 'unsandboxed',
        environment: {
          image_digest: null,
          tool_versions: [],
          runtime: { name: 'host', client_version: null, server_version: null, os: 'win32', arch: 'x64' },
          image: null,
          platform: 'win32/x64',
          network: 'egress',
        } as ExecutionRecordFacts['environment'],
        limits: { ...limits, cpus: null, memory_mb: null, pids: null, scratch_mb: null } as ExecutionRecordFacts['limits'],
        checkout: null,
      }),
    );
    expectValid(result);
    expect(result.record.admissibility).toBe('claim');
    expect('checkout' in result.record).toBe(false);
  });

  it('records each result file status', () => {
    const reads: ResultFileRead[] = [
      { kind: 'file', bytes: enc.encode(SAMPLE) },
      { kind: 'file', bytes: enc.encode('not xml') },
      { kind: 'missing' },
      { kind: 'not-regular' },
      { kind: 'too-large', declaredBytes: 999 },
    ];
    const result = buildCompletedExecution(facts({ entry: entry({ result_files: declared(5) }), resultFiles: reads }));
    expectValid(result);
    const files = result.record.result_files;
    expect(files.map((f) => f.status)).toEqual(['parsed', 'malformed', 'missing', 'not-regular', 'too-large']);
    expect(files.map((f) => f.content_hash === null)).toEqual([false, false, true, true, true]);
    expect(files.map((f) => f.bytes)).toEqual([SAMPLE.length, 'not xml'.length, 0, 0, 999]);
    expect(files.map((f) => f.error_code !== null)).toEqual([false, true, false, false, false]);
    expect(result.result_texts.map((t) => t.position)).toEqual([1, 2]);
  });

  it('omits a result file the redactor cannot take', () => {
    const result = buildCompletedExecution(
      facts({
        entry: entry({ result_files: declared(1) }),
        resultFiles: [{ kind: 'file', bytes: new Uint8Array(2796203).fill(0xff) }],
      }),
    );
    expectValid(result);
    const file = result.record.result_files[0];
    expect(file?.status).toBe('malformed');
    expect(file?.stored_omitted).toBe(true);
    expect(file?.stored_omitted_reason).toBe('redaction-input');
    expect(result.result_texts).toEqual([{ position: 1, decoded_bytes: 8388609, text: null }]);
  });

  it('splits a large capture into two parts', () => {
    const result = buildCompletedExecution(facts({ capture: capture('x'.repeat(100), 10, 10, 1000000) }));
    expectValid(result);
    expect(result.output.parts).toHaveLength(2);
    expect(result.output.omitted_bytes).toBe(80);
    expect(result.record.output.truncated).toBe(true);
    expect(result.record.output.total_bytes).toBe(100);
  });

  it('builds a dependency step record', () => {
    const result = buildCompletedExecution(
      facts({
        entry: entry({
          id: 'head-dependency-step',
          kind: 'dependency-step',
          command_id: null,
          network: 'egress',
          result_files: [],
        }),
      }),
    );
    expectValid(result);
    expect(result.record.kind).toBe('dependency-step');
    expect(result.record.result_files).toEqual([]);
    expect(result.result_texts).toEqual([]);
  });

  it('rejects reads that do not match declarations', () => {
    expect(() => buildCompletedExecution(facts({ entry: entry({ result_files: declared(1) }), resultFiles: [] }))).toThrow(
      TypeError,
    );
  });
});
