import { describe, expect, it } from 'vitest';
import { OutputCaptureBuffer } from '../execution/output-capture.js';
import type { ExecutionPlanEntry } from '../execution/plan.js';
import { executionResultsTransportSchema } from '../execution/transport.js';
import type { ExecutionResultsTransport } from '../execution/transport.js';
import { executionRecordSchema } from '../records/execution-record.js';
import { err, ok } from '../result.js';
import { buildCompletedExecution } from '../runner/record.js';
import type { ExecutionRecordFacts, ResultFileRead } from '../runner/record.js';
import { dropLastStoredResultFile, prepareExecutionEvidence } from './execution-evidence.js';
import type { EvidenceRedactFn, EvidenceRedactionOptions } from './redact-records.js';

const enc = new TextEncoder();
const dec = new TextDecoder();
const SAMPLE = '<testsuites><testsuite name="s"><testcase classname="c" name="t"/></testsuite></testsuites>';
const SECRET = 'resolved-' + 'credential-' + 'value-0042';
const CAP = 8388608;

const environment = {
  image_digest: 'sha256:' + 'd'.repeat(64),
  tool_versions: [{ name: 'docker-client', version: '29.8.0' }],
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

function planEntry(id: string, count: number): ExecutionPlanEntry {
  return {
    id,
    kind: 'command',
    command_id: 'test',
    run: ['sh', 'run.sh'],
    working_directory: '.',
    commit_role: 'head',
    commit: 'c'.repeat(40),
    overlay: 'none',
    expected: 'exit-zero',
    network: 'none',
    result_files: Array.from({ length: count }, (_, i) => ({ path: `r${i}.xml`, format: 'junit-xml' as const })),
  } as ExecutionPlanEntry;
}

function completed(id: string, text: string, reads: ResultFileRead[] = []) {
  const buffer = new OutputCaptureBuffer({ headBytes: 262144, tailBytes: 786432, streamBytes: 268435456 });
  buffer.push(enc.encode(text));
  return buildCompletedExecution({
    runId: 123,
    runAttempt: 1,
    entry: planEntry(id, reads.length),
    runner: 'container',
    environment,
    limits,
    timing,
    exit: { code: 0, signal: null, timedOut: false, oomKilled: false, outputLimited: false },
    capture: buffer.result(),
    resultFiles: reads,
    resultTestCases: 1000,
    checkout,
  });
}

function transport(results: unknown[]): ExecutionResultsTransport {
  return executionResultsTransportSchema.parse({
    transport: 'execution-results',
    transport_version: 1,
    run: { run_id: 123, run_attempt: 1 },
    snapshot_hash: 'sha256:' + 'a'.repeat(64),
    policy_revision: 'b'.repeat(40),
    results,
    causes: [],
  });
}

const file = (text: string): ResultFileRead => ({ kind: 'file', bytes: enc.encode(text) });
const options: EvidenceRedactionOptions = { credentials: [SECRET], policyPatterns: [] };

async function prepare(results: unknown[], opts: EvidenceRedactionOptions = options) {
  const result = await prepareExecutionEvidence(transport(results), opts);
  if (!result.ok) throw new Error(`unexpected failure ${result.failure.code}`);
  return result.value;
}

describe('execution evidence', () => {
  it('numbers records by completed results only', async () => {
    const prepared = await prepare([
      completed('first', 'one'),
      { kind: 'environment-failure', entry_id: 'middle', code: 'runner.cleanup-failed', subject: null },
      completed('second', 'two'),
    ]);
    expect(prepared.records.map((r) => r.plan_entry)).toEqual(['first', 'second']);
    expect(prepared.outputFiles.map((f) => f.path)).toEqual([
      'executions/execution-0001/output.txt',
      'executions/execution-0002/output.txt',
    ]);
    expect(prepared.records.map((r) => r.output.stored_path)).toEqual(prepared.outputFiles.map((f) => f.path));
  });

  it('writes an output file for every record', async () => {
    const prepared = await prepare([completed('quiet', '')]);
    expect(prepared.outputFiles).toHaveLength(1);
    expect(prepared.outputFiles[0]?.bytes.length).toBe(0);
    expect(prepared.records[0]?.output.stored_path).toBe('executions/execution-0001/output.txt');
  });

  it('replaces the excerpt with the redacted excerpt', async () => {
    const prepared = await prepare([completed('leaky', `before ${SECRET} after`)]);
    const record = prepared.records[0]!;
    expect(record.output.head + record.output.tail).not.toContain(SECRET);
    expect(dec.decode(prepared.outputFiles[0]!.bytes)).not.toContain(SECRET);
    expect(record.output.head + record.output.tail).toContain('before');
    expect(prepared.exactValues).toBeGreaterThan(0);
  });

  it('stores parsed and malformed result files redacted', async () => {
    const malformed = `not xml ${SECRET}`;
    const prepared = await prepare([
      completed('files', 'out', [file(SAMPLE.replace('name="t"', `name="${SECRET}"`)), file(malformed)]),
    ]);
    expect(prepared.resultFiles.map((f) => [f.path, f.sequence, f.position])).toEqual([
      ['executions/execution-0001/result-1.xml', 1, 1],
      ['executions/execution-0001/result-2.xml', 1, 2],
    ]);
    for (const stored of prepared.resultFiles) {
      expect(dec.decode(stored.bytes)).not.toContain(SECRET);
    }
    const entries = prepared.records[0]!.result_files;
    expect(entries.map((e) => e.status)).toEqual(['parsed', 'malformed']);
    expect(entries.map((e) => e.stored_path)).toEqual([
      'executions/execution-0001/result-1.xml',
      'executions/execution-0001/result-2.xml',
    ]);
    expect(entries.map((e) => e.stored_omitted)).toEqual([false, false]);
    expect(entries.some((e) => 'stored_omitted_reason' in e)).toBe(false);
  });

  it('keeps redaction-input omissions without a file', async () => {
    const inputs: string[] = [];
    const redact: EvidenceRedactFn = (texts) => {
      inputs.push(...texts);
      return Promise.resolve(ok({ texts: [...texts], counts: [], exactValues: 0 }));
    };
    const big: ResultFileRead = { kind: 'file', bytes: new Uint8Array(2796203).fill(0xff) };
    const prepared = await prepare([completed('big', 'out', [big, file(SAMPLE)])], { ...options, redact });
    const entries = prepared.records[0]!.result_files;
    expect(entries[0]?.stored_path).toBeNull();
    expect(entries[0]?.stored_omitted).toBe(true);
    expect(entries[0]?.stored_omitted_reason).toBe('redaction-input');
    expect(entries[1]?.stored_path).toBe('executions/execution-0001/result-2.xml');
    expect(prepared.resultFiles).toHaveLength(1);
    expect(inputs).toHaveLength(2);
    expect(inputs.every((text) => Buffer.byteLength(text, 'utf8') <= CAP)).toBe(true);
    expect(inputs.some((text) => text.includes(String.fromCharCode(0xfffd)))).toBe(false);
  });

  it('marks missing and not-regular entries without a file', async () => {
    const prepared = await prepare([
      completed('gone', 'out', [{ kind: 'missing' }, { kind: 'not-regular' }, { kind: 'too-large', declaredBytes: 999 }]),
    ]);
    const entries = prepared.records[0]!.result_files;
    expect(entries.map((e) => e.status)).toEqual(['missing', 'not-regular', 'too-large']);
    expect(entries.map((e) => e.stored_path)).toEqual([null, null, null]);
    expect(entries.map((e) => e.stored_omitted)).toEqual([false, false, false]);
    expect(prepared.resultFiles).toEqual([]);
  });

  it('every stored record passes the record schema', async () => {
    const prepared = await prepare([
      completed('a', 'x', [file(SAMPLE), file('not xml'), { kind: 'missing' }]),
      completed('b', 'y'),
    ]);
    expect(prepared.records).toHaveLength(2);
    for (const record of prepared.records) {
      expect(executionRecordSchema.safeParse(record).success).toBe(true);
    }
    let next = dropLastStoredResultFile(prepared);
    while (next !== null) {
      for (const record of next.records) {
        expect(executionRecordSchema.safeParse(record).success).toBe(true);
      }
      next = dropLastStoredResultFile(next);
    }
  });

  it('drops the highest position of the last execution first', async () => {
    const prepared = await prepare([
      completed('a', 'x', [file(SAMPLE), file(SAMPLE)]),
      completed('b', 'y', [file(SAMPLE), file(SAMPLE)]),
    ]);
    const order: string[] = [];
    let current = prepared;
    for (;;) {
      const next = dropLastStoredResultFile(current);
      if (next === null) break;
      const dropped = current.resultFiles.find((f) => !next.resultFiles.includes(f))!;
      order.push(`${dropped.sequence}/${dropped.position}`);
      const entry = next.records[dropped.sequence - 1]!.result_files[dropped.position - 1]!;
      expect(entry.stored_path).toBeNull();
      expect(entry.stored_omitted).toBe(true);
      expect(entry.stored_omitted_reason).toBe('evidence-budget');
      expect(entry.junit).toEqual(current.records[dropped.sequence - 1]!.result_files[dropped.position - 1]!.junit);
      expect(next.resultFiles).toHaveLength(current.resultFiles.length - 1);
      current = next;
    }
    expect(order).toEqual(['2/2', '2/1', '1/2', '1/1']);
    expect(prepared.resultFiles).toHaveLength(4);
    expect(prepared.records[1]!.result_files[1]!.stored_omitted).toBe(false);
    expect(dropLastStoredResultFile(current)).toBeNull();
  });

  it('never drops a redaction-input omission', async () => {
    const big: ResultFileRead = { kind: 'file', bytes: new Uint8Array(2796203).fill(0xff) };
    const prepared = await prepare([completed('big', 'out', [file(SAMPLE), big])]);
    const next = dropLastStoredResultFile(prepared);
    expect(next).not.toBeNull();
    expect(next!.records[0]!.result_files[0]?.stored_omitted_reason).toBe('evidence-budget');
    expect(next!.records[0]!.result_files[1]?.stored_omitted_reason).toBe('redaction-input');
    expect(dropLastStoredResultFile(next!)).toBeNull();
  });

  it('returns a redaction failure unchanged', async () => {
    const redact: EvidenceRedactFn = () => Promise.resolve(err('redaction.failed', 'infrastructure', 'Redaction failed.'));
    const result = await prepareExecutionEvidence(transport([completed('a', 'x')]), { ...options, redact });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('redaction.failed');
    }
  });
});
