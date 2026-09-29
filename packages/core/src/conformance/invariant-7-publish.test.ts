import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { verifyRunDirectory } from '../evidence/verify.js';
import { prepareRunEvidence, publishRunEvidence } from '../evidence/publish.js';
import type { RunEvidenceInput, RunExecutionEvidence } from '../evidence/publish.js';
import { prepareFindings, decisionFindings } from '../evidence/assemble.js';
import type { RunAssemblyInput } from '../evidence/assemble.js';
import type { HandoffFinding } from '../pipeline/handoff.js';
import { CONTRACT_FINDING_MESSAGES } from '../submission/contract.js';
import { decideOutcome } from '../decision/table.js';
import type { DecisionResult } from '../decision/table.js';
import { submissionRecordSchema } from '../records/submission.js';
import type { SubmissionRecord } from '../records/submission.js';
import type { ExecutionRecord } from '../records/execution-record.js';
import type { LoadedPolicy } from '../policy/loader.js';
import { DEFAULT_CHECKLIST_POLICY } from '../submission/default-checklist.js';
import { OutputCaptureBuffer } from '../execution/output-capture.js';
import type { ExecutionPlanEntry } from '../execution/plan.js';
import { executionResultsTransportSchema } from '../execution/transport.js';
import type { ExecutionResultsTransport } from '../execution/transport.js';
import { buildCompletedExecution } from '../runner/record.js';
import type { ExecutionRecordFacts, CompletedExecution } from '../runner/record.js';
import { redactTexts } from '../redaction/redact.js';
import type { EvidenceRedactFn } from '../evidence/redact-records.js';
import type { ClassificationInput } from '../report/templates.js';

const RUN_ID = 'local-20260927T101500Z-3f9a1c2e';
const PARSED = '<testsuites><testsuite name="s"><testcase classname="c" name="t"/></testsuite></testsuites>';
const MALFORMED = '<testsuites><testsuite';
const PAD = 10000;
const LARGE = 99999;
const enc = new TextEncoder();
const RUNNER = {
  runtime: 'docker' as const,
  serverVersion: '29.8.0',
  reference: 'docker.io/library/busybox:1.37.0',
  imageDigest: 'sha256:' + 'd'.repeat(64),
};

const trustedPolicy: LoadedPolicy = {
  revision: { kind: 'git-tree', id: 'b'.repeat(40), commit: 'a'.repeat(40), ref: 'main' },
  policy: DEFAULT_CHECKLIST_POLICY,
  authoritative: true,
};

function withRunBytes(policy: LoadedPolicy, runBytes: number): LoadedPolicy {
  return {
    ...policy,
    policy: {
      ...policy.policy,
      limits: { ...policy.policy.limits, evidence: { ...policy.policy.limits.evidence, run_bytes: runBytes } },
    },
  };
}

function makeSubmission(): SubmissionRecord {
  return submissionRecordSchema.parse({
    schema_version: 1,
    record_type: 'submission',
    repository: 'octo/demo',
    type: 'pull_request',
    number: 12,
    snapshot_hash: 'sha256:' + '5'.repeat(64),
    target_branch: 'main',
    head_commit: 'c'.repeat(40),
    issue_kind: null,
    category: 'bugfix',
    fields: { category: 'bugfix' },
    linked_evidence_hashes: [],
    author_responses: [],
    shared_head_pull_requests: [],
    contract_results: [],
    trusted_paths_changed: false,
    execution_sensitive_paths_changed: false,
    template: { form: 'pull_request', version: 1 },
    attachments: [],
    claim_scope_hash: null,
  });
}

function makeFindings(): readonly HandoffFinding[] {
  return [
    {
      stage: 'contract',
      severity: 'blocking',
      code: 'submission.field-missing',
      detail: null,
      field: 'regression-test',
      subjects: [],
      message: CONTRACT_FINDING_MESSAGES['submission.field-missing'],
    },
    {
      stage: 'contract',
      severity: 'uncertain',
      code: 'submission.execution-sensitive-change',
      detail: null,
      field: null,
      subjects: ['package.json'],
      message: CONTRACT_FINDING_MESSAGES['submission.execution-sensitive-change'],
    },
  ];
}

function buildInput(
  evidenceDir: string,
  extra: { executions?: RunExecutionEvidence; credentials?: readonly string[]; policy?: LoadedPolicy } = {},
): RunEvidenceInput {
  const submission = makeSubmission();
  const loadedPolicy = extra.policy ?? trustedPolicy;
  const prepared = prepareFindings(makeFindings(), {
    repository: submission.repository,
    defaultBranch: 'main',
    submissionType: submission.type,
    template: submission.template ?? null,
    category: submission.category,
    headCommit: submission.head_commit,
    policy: loadedPolicy.policy,
    policyChange: null,
  });
  if (!prepared.ok) {
    throw new Error('test setup: prepareFindings failed');
  }
  const decisionResult: DecisionResult = decideOutcome({
    freshness: 'current',
    capacity: 'available',
    admission: 'not-required',
    findings: decisionFindings(prepared.value),
    causes: [],
    requiredStages: ['references', 'claim'],
    stageResults: [],
    requirements: [],
  });
  if (decisionResult.kind !== 'outcome') {
    throw new Error('test setup: decision did not resolve to an outcome');
  }

  const assembly: RunAssemblyInput = {
    runId: RUN_ID,
    runAttempt: 1,
    startedAt: '2026-09-27T10:15:00.000Z',
    gateCompletedAt: '2026-09-27T10:15:01.000Z',
    finishedAt: '2026-09-27T10:15:03.000Z',
    phases: [{ phase: 'gate', seconds: 1, recordedAt: '2026-09-27T10:15:01.000Z' }],
    stewardVersion: '0.0.0-test',
    loadedPolicy,
    policyLoadedAt: '2026-09-27T10:15:00.500Z',
    submission,
    baseCommit: 'd'.repeat(40),
    mode: 'observe',
    findings: prepared.value,
    decision: decisionResult,
    githubRequests: 7,
    retries: 0,
  };

  const classification: ClassificationInput = { type: 'pull_request', category: 'bugfix', consistent: true, plausible: ['bugfix'] };

  return {
    evidenceDir,
    assembly,
    classification,
    defaultBranch: 'main',
    logLines: ['gate: complete'],
    credentials: extra.credentials ?? [],
    localRun: true,
    createdAt: '2026-09-27T10:15:03.000Z',
    ...(extra.executions !== undefined ? { executions: extra.executions } : {}),
  };
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
  started_at: '2026-09-27T10:15:01.000Z',
  finished_at: '2026-09-27T10:15:02.500Z',
  duration_ms: 1500,
} as ExecutionRecordFacts['timing'];

function capture(input: string | Uint8Array) {
  const buffer = new OutputCaptureBuffer({ headBytes: 262144, tailBytes: 786432, streamBytes: 268435456 });
  buffer.push(typeof input === 'string' ? enc.encode(input) : input);
  return buffer.result();
}

function completed(id: string, files: readonly string[], output: string | Uint8Array = 'ok\n'): CompletedExecution {
  const entry = {
    id,
    kind: 'command',
    command_id: 'test',
    run: ['npm', 'test'],
    working_directory: '.',
    commit_role: 'head',
    commit: 'c'.repeat(40),
    overlay: 'none',
    expected: 'exit-zero',
    network: 'none',
    result_files: files.map((_, i) => ({ path: `r${i}.xml`, format: 'junit-xml' as const })),
  } as ExecutionPlanEntry;
  return buildCompletedExecution({
    runId: RUN_ID as ExecutionRecordFacts['runId'],
    runAttempt: 1,
    entry,
    runner: 'container',
    environment,
    limits,
    timing,
    exit: { code: 0, signal: null, timedOut: false, oomKilled: false, outputLimited: false },
    capture: capture(output),
    resultFiles: files.map((text) => ({ kind: 'file' as const, bytes: enc.encode(text) })),
    resultTestCases: 1000,
    checkout: null,
  });
}

function transport(results: readonly CompletedExecution[]): ExecutionResultsTransport {
  return executionResultsTransportSchema.parse({
    transport: 'execution-results',
    transport_version: 1,
    run: { run_id: RUN_ID, run_attempt: 1 },
    snapshot_hash: 'sha256:' + '5'.repeat(64),
    policy_revision: trustedPolicy.revision.id,
    results,
    causes: [],
  });
}

function twoRecords(extraOutput = 'ok\n', extraXml = ''): ExecutionResultsTransport {
  return transport([
    completed('head-test-1', [PARSED + extraXml, MALFORMED], extraOutput),
    completed('head-test-2', [MALFORMED, PARSED + extraXml], extraOutput),
  ]);
}

function evidence(results: ExecutionResultsTransport, buildLog: string | null = null): RunExecutionEvidence {
  return { results, runner: RUNNER, buildLog: buildLog === null ? null : capture(buildLog), containerSeconds: 3 };
}

const tmpDirs: string[] = [];

function mkTmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-steward-publish-exec-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

function runDirOf(root: string): string {
  return path.join(root, 'octo', 'demo', 'runs', 'pr-12', RUN_ID);
}

function listFiles(dir: string, base = dir): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, base));
    else out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out.sort();
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

const TOKEN = 'zq' + 'Xv7' + 'Lm2Pn' + '9Rt4Ys' + '8Wd3Fk';

describe('invariant 7: execution evidence is bounded and redacted', () => {
  it('invariant 7: the resolved token is redacted from every stored execution file', async () => {
    const root = mkTmpDir();
    const results = transport([
      completed('head-test-1', [PARSED + `<!-- ${TOKEN} -->`, MALFORMED + ` ${TOKEN}`], `out ${TOKEN}\n`),
    ]);
    const published = await publishRunEvidence(
      buildInput(root, { credentials: [TOKEN], executions: evidence(results, `build ${TOKEN}\n`) }),
    );
    expect(published.ok).toBe(true);
    const dir = runDirOf(root);
    const files = listFiles(dir);
    for (const expected of [
      'executions/execution-0001/output.txt',
      'executions/execution-0001/result-1.xml',
      'executions/execution-0001/result-2.xml',
      'logs/image-build.txt',
    ]) {
      expect(files).toContain(expected);
    }
    for (const file of files) {
      expect(fs.readFileSync(path.join(dir, file)).includes(TOKEN), file).toBe(false);
    }
  });

  it('invariant 7: built-in detectors redact credentials in output and result files', async () => {
    const secret = 'ghp_' + 'Ab1Cd2Ef3Gh4Ij5Kl6Mn7Op8Qr9St0Uv1Wx2';
    const root = mkTmpDir();
    const results = transport([completed('head-test-1', [PARSED + `<!-- ${secret} -->`], `out ${secret}\n`)]);
    const published = await publishRunEvidence(buildInput(root, { executions: evidence(results) }));
    expect(published.ok).toBe(true);
    const dir = runDirOf(root);
    const files = listFiles(dir);
    expect(files).toContain('executions/execution-0001/result-1.xml');
    for (const file of files) {
      expect(fs.readFileSync(path.join(dir, file)).includes(secret), file).toBe(false);
    }
  });

  it('invariant 7: stored output files stay within head plus tail plus 128 bytes', async () => {
    const root = mkTmpDir();
    const long = 'a'.repeat(2_000_000);
    const growing = `${TOKEN}\n`.repeat(90_000);
    const results = transport([completed('head-test-1', [], long), completed('head-test-2', [], growing)]);
    const published = await publishRunEvidence(buildInput(root, { credentials: [TOKEN], executions: evidence(results) }));
    expect(published.ok).toBe(true);
    const dir = runDirOf(root);
    for (const name of ['executions/execution-0001/output.txt', 'executions/execution-0002/output.txt']) {
      expect(fs.statSync(path.join(dir, name)).size, name).toBeLessThanOrEqual(262144 + 786432 + 128);
    }
    expect(fs.readFileSync(path.join(dir, 'executions/execution-0002/output.txt')).includes(TOKEN)).toBe(false);
  });

  it('invariant 7: record excerpts stay within 65536 code units per key', async () => {
    const root = mkTmpDir();
    const astral = String.fromCodePoint(0x1f600);
    const results = transport([
      completed('head-test-1', [], 'b'.repeat(900_000)),
      completed('head-test-2', [], astral.repeat(200_000)),
    ]);
    const published = await publishRunEvidence(buildInput(root, { executions: evidence(results) }));
    expect(published.ok).toBe(true);
    const dir = runDirOf(root);
    for (const name of ['executions/execution-0001.json', 'executions/execution-0002.json']) {
      const record = readJson<ExecutionRecord>(path.join(dir, name));
      expect(record.output.head.length, name).toBeLessThanOrEqual(65536);
      expect(record.output.tail.length, name).toBeLessThanOrEqual(65536);
      expect(record.output.truncated, name).toBe(true);
    }
  });

  it('invariant 7: no redaction input above 8388608 bytes is ever built', async () => {
    const inputs: number[] = [];
    const spy: EvidenceRedactFn = (texts, options) => {
      for (const text of texts) inputs.push(Buffer.byteLength(text, 'utf8'));
      return redactTexts(texts, options);
    };
    const base = completed('head-test-1', [MALFORMED, PARSED]);
    const first = base.record.result_files[0];
    if (first === undefined) throw new Error('test setup: no result file');
    const omitted = {
      ...base,
      record: {
        ...base.record,
        result_files: [
          { ...first, stored_omitted: true, stored_omitted_reason: 'redaction-input' },
          ...base.record.result_files.slice(1),
        ],
      },
      result_texts: [{ position: 1, decoded_bytes: 8388609, text: null }, ...base.result_texts.filter((t) => t.position === 2)],
    } as CompletedExecution;
    const invalid = completed('head-test-2', [], new Uint8Array(1_100_000).fill(0xff));
    const root = mkTmpDir();
    const published = await publishRunEvidence(buildInput(root, { executions: evidence(transport([omitted, invalid])) }), {
      redact: spy,
    });
    expect(published.ok).toBe(true);
    expect(inputs.length).toBeGreaterThan(0);
    expect(Math.max(...inputs)).toBeLessThanOrEqual(8388608);
    expect(listFiles(runDirOf(root))).not.toContain('executions/execution-0001/result-1.xml');
  });

  it('invariant 7: result files drop last execution first over the evidence budget', async () => {
    const pad = '<!--' + 'x'.repeat(PAD) + ' -->';
    const results = (): ExecutionResultsTransport =>
      transport([1, 2, 3].map((n) => completed('head-test-' + n, [PARSED + pad, PARSED + pad], 'out')));
    const totalOf = async (limit: number) => {
      const prepared = await prepareRunEvidence(
        buildInput(mkTmpDir(), { executions: evidence(results()), policy: withRunBytes(trustedPolicy, limit) }),
      );
      if (!prepared.ok) throw new Error('test setup: ' + prepared.failure.code);
      const count = prepared.value.files.filter((f) => f.path.startsWith('executions/') && f.path.endsWith('.xml')).length;
      const total =
        prepared.value.files.reduce((sum, f) => sum + f.bytes.length, 0) +
        prepared.value.metrics.bytes.length +
        prepared.value.manifestBytes.length;
      return { count, total };
    };
    const full = await totalOf(LARGE);
    expect(full.count).toBe(6);
    const one = await totalOf(full.total - 1);
    expect(one.count).toBe(5);
    const two = await totalOf(one.total - 1);
    expect(two.count).toBe(4);
    expect(two.total).toBeGreaterThanOrEqual(65536);

    const root = mkTmpDir();
    const published = await publishRunEvidence(
      buildInput(root, { executions: evidence(results()), policy: withRunBytes(trustedPolicy, two.total + 50) }),
    );
    expect(published.ok).toBe(true);
    const dir = runDirOf(root);
    const files = listFiles(dir);
    for (const kept of ['0001/result-1', '0001/result-2', '0002/result-1', '0002/result-2']) {
      expect(files).toContain('executions/execution-' + kept + '.xml');
    }
    expect(files).not.toContain('executions/execution-0003/result-1.xml');
    expect(files).not.toContain('executions/execution-0003/result-2.xml');
    const third = readJson<ExecutionRecord>(path.join(dir, 'executions/execution-0003.json'));
    for (const entry of third.result_files) {
      expect(entry.stored_omitted).toBe(true);
      expect(entry.stored_omitted_reason).toBe('evidence-budget');
    }
    expect((await verifyRunDirectory(dir)).ok).toBe(true);
  });

  it('invariant 7: the image build log is bounded and redacted', async () => {
    const root = mkTmpDir();
    const log = `layer ${TOKEN}\n`.repeat(200_000);
    const published = await publishRunEvidence(buildInput(root, { credentials: [TOKEN], executions: evidence(twoRecords(), log) }));
    expect(published.ok).toBe(true);
    const file = path.join(runDirOf(root), 'logs/image-build.txt');
    expect(fs.statSync(file).size).toBeLessThanOrEqual(1048576);
    expect(fs.readFileSync(file).includes(TOKEN)).toBe(false);
  });
});
