import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { verifyRunDirectory } from './verify.js';
import { prepareRunEvidence, publishRunEvidence } from './publish.js';
import type { RunEvidenceInput, RunExecutionEvidence } from './publish.js';
import { prepareFindings, decisionFindings } from './assemble.js';
import type { RunAssemblyInput } from './assemble.js';
import type { HandoffFinding } from '../pipeline/handoff.js';
import { CONTRACT_FINDING_MESSAGES } from '../submission/contract.js';
import { decideOutcome } from '../decision/table.js';
import type { DecisionResult } from '../decision/table.js';
import { submissionRecordSchema } from '../records/submission.js';
import type { SubmissionRecord } from '../records/submission.js';
import type { RunRecord } from '../records/run.js';
import type { ExecutionRecord } from '../records/execution-record.js';
import type { MetricsEventRecord } from '../records/metrics-event.js';
import type { LoadedPolicy } from '../policy/loader.js';
import { DEFAULT_CHECKLIST_POLICY } from '../submission/default-checklist.js';
import { OutputCaptureBuffer } from '../execution/output-capture.js';
import type { ExecutionPlanEntry } from '../execution/plan.js';
import { executionResultsTransportSchema } from '../execution/transport.js';
import type { ExecutionResultsTransport } from '../execution/transport.js';
import { buildCompletedExecution } from '../runner/record.js';
import type { ExecutionRecordFacts, CompletedExecution } from '../runner/record.js';
import type { ClassificationInput } from '../report/templates.js';

const RUN_ID = 'local-20260927T101500Z-3f9a1c2e';
const PARSED = '<testsuites><testsuite name="s"><testcase classname="c" name="t"/></testsuite></testsuites>';
const MALFORMED = '<testsuites><testsuite';
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

function capture(text: string) {
  const buffer = new OutputCaptureBuffer({ headBytes: 262144, tailBytes: 786432, streamBytes: 268435456 });
  buffer.push(enc.encode(text));
  return buffer.result();
}

function completed(id: string, files: readonly string[], output = 'ok\n'): CompletedExecution {
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

// The policy floor for the run byte limit is 64 KiB, so the stored result files are padded past it.
function padded(): ExecutionResultsTransport {
  return twoRecords('out', `<!--${'x'.repeat(20000)} -->`);
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

describe('publish with executions', () => {
  it('stores execution records, output files, and result files that verify', async () => {
    const root = mkTmpDir();
    const input = buildInput(root, { executions: evidence(twoRecords()) });
    const published = await publishRunEvidence(input);
    expect(published.ok).toBe(true);
    const dir = runDirOf(root);
    const files = listFiles(dir);
    for (const expected of [
      'executions/execution-0001.json',
      'executions/execution-0001/output.txt',
      'executions/execution-0001/result-1.xml',
      'executions/execution-0001/result-2.xml',
      'executions/execution-0002.json',
      'executions/execution-0002/output.txt',
      'executions/execution-0002/result-1.xml',
      'executions/execution-0002/result-2.xml',
    ]) {
      expect(files).toContain(expected);
    }
    const run = readJson<RunRecord>(path.join(dir, 'run.json'));
    expect(run.budget.executions).toBe(2);
    expect(typeof run.runner_identity).toBe('string');
    expect(readJson<ExecutionRecord>(path.join(dir, 'executions/execution-0001.json')).output.stored_path).toBe(
      'executions/execution-0001/output.txt',
    );

    const prepared = await prepareRunEvidence(input);
    expect(prepared.ok).toBe(true);
    if (prepared.ok) {
      const events = JSON.parse(Buffer.from(prepared.value.metrics.bytes).toString('utf8')) as MetricsEventRecord[];
      const cost = events.find((e) => e.kind === 'cost');
      expect(cost?.kind === 'cost' ? cost.payload.container_seconds : null).toBe(3);
    }

    const report = fs.readFileSync(path.join(dir, 'report.md'), 'utf8');
    expect(report).toContain('- `head-test-1` at');
    expect(report).toContain('- `head-test-2` at');
    expect(report).toContain('- Runner: ');
    expect(report).not.toContain('no execution in this run');

    expect((await verifyRunDirectory(dir)).ok).toBe(true);
  });

  it('drops result files in evidence-budget order and still verifies', async () => {
    const full = await prepareRunEvidence(
      buildInput(mkTmpDir(), { executions: evidence(padded()), policy: withRunBytes(trustedPolicy, 99999) }),
    );
    expect(full.ok).toBe(true);
    if (!full.ok) return;
    const total =
      full.value.files.reduce((sum, f) => sum + f.bytes.length, 0) +
      full.value.metrics.bytes.length +
      full.value.manifestBytes.length;

    const root = mkTmpDir();
    const input = buildInput(root, { executions: evidence(padded()), policy: withRunBytes(trustedPolicy, total - 1) });
    const published = await publishRunEvidence(input);
    expect(published.ok).toBe(true);
    const dir = runDirOf(root);
    const files = listFiles(dir);
    expect(files).not.toContain('executions/execution-0002/result-2.xml');
    expect(files).toContain('executions/execution-0002/result-1.xml');
    expect(files).toContain('executions/execution-0001/result-2.xml');

    const second = readJson<ExecutionRecord>(path.join(dir, 'executions/execution-0002.json'));
    const entry = second.result_files[1];
    expect(entry?.stored_omitted).toBe(true);
    expect(entry?.stored_omitted_reason).toBe('evidence-budget');
    expect(entry?.stored_path).toBeNull();
    expect(entry?.junit).not.toBeNull();
    expect((await verifyRunDirectory(dir)).ok).toBe(true);
  });

  it('omits a redaction-input result file and still verifies', async () => {
    const base = completed('head-test-1', [MALFORMED]);
    const first = base.record.result_files[0];
    if (first === undefined) throw new Error('test setup: no result file');
    const omitted = {
      ...base,
      record: { ...base.record, result_files: [{ ...first, stored_omitted: true, stored_omitted_reason: 'redaction-input' }] },
      result_texts: [{ position: 1, decoded_bytes: 8388609, text: null }],
    } as CompletedExecution;
    const root = mkTmpDir();
    const published = await publishRunEvidence(buildInput(root, { executions: evidence(transport([omitted])) }));
    expect(published.ok).toBe(true);
    const dir = runDirOf(root);
    expect(listFiles(dir)).not.toContain('executions/execution-0001/result-1.xml');
    const entry = readJson<ExecutionRecord>(path.join(dir, 'executions/execution-0001.json')).result_files[0];
    expect(entry?.stored_omitted).toBe(true);
    expect(entry?.stored_omitted_reason).toBe('redaction-input');
    expect((await verifyRunDirectory(dir)).ok).toBe(true);
  });

  it('ends evidence.too-many-files over the run file bound', async () => {
    const files = Array.from({ length: 20 }, () => PARSED);
    const results = Array.from({ length: 190 }, (_, i) => completed(`head-test-${i + 1}`, files));
    const root = mkTmpDir();
    const published = await publishRunEvidence(buildInput(root, { executions: evidence(transport(results)) }));
    expect(published.ok).toBe(false);
    if (!published.ok) {
      expect(published.failure.code).toBe('evidence.too-many-files');
      expect(published.failure.cause).toBe('budget-exhausted');
    }
    expect(fs.readdirSync(root)).toEqual([]);
  });

  it('stores the redacted image build log', async () => {
    const secret = 'ghp_' + 'Ab1Cd2Ef3Gh4Ij5Kl6Mn7Op8Qr9St0Uv1Wx2';
    const root = mkTmpDir();
    const published = await publishRunEvidence(
      buildInput(root, { executions: evidence(twoRecords(), `step 1\ntoken ${secret}\nstep 2\n`) }),
    );
    expect(published.ok).toBe(true);
    const dir = runDirOf(root);
    const logPath = path.join(dir, 'logs/image-build.txt');
    expect(fs.existsSync(logPath)).toBe(true);
    const text = fs.readFileSync(logPath, 'utf8');
    expect(text).toContain('step 1');
    expect(text).not.toContain(secret);
    expect((await verifyRunDirectory(dir)).ok).toBe(true);
  });

  it('redacts the resolved token from every execution file', async () => {
    const token = 'zq' + 'Xv7' + 'Lm2Pn' + '9Rt4Ys' + '8Wd3Fk';
    const root = mkTmpDir();
    const published = await publishRunEvidence(
      buildInput(root, {
        credentials: [token],
        executions: evidence(twoRecords(`out ${token}\n`, `<!-- ${token} -->`), `build ${token}\n`),
      }),
    );
    expect(published.ok).toBe(true);
    const dir = runDirOf(root);
    const files = listFiles(dir);
    expect(files).toContain('logs/image-build.txt');
    for (const file of files) {
      expect(fs.readFileSync(path.join(dir, file)).includes(token), file).toBe(false);
    }
  });

  it('keeps a run without executions unchanged', async () => {
    const root = mkTmpDir();
    const published = await publishRunEvidence(buildInput(root));
    expect(published.ok).toBe(true);
    const dir = runDirOf(root);
    expect(listFiles(dir)).toEqual([
      'decision.json',
      'findings/finding-0001.json',
      'findings/finding-0002.json',
      'logs/steward.txt',
      'manifest.json',
      'policy-revision.json',
      'report.json',
      'report.md',
      'run.json',
      'submission.json',
    ]);
    expect(readJson<RunRecord>(path.join(dir, 'run.json')).budget.executions).toBe(0);
    expect(readJson<RunRecord>(path.join(dir, 'run.json')).runner_identity).toBeNull();
  });
});
