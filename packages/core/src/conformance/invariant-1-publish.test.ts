import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { verifyRunDirectory } from '../evidence/verify.js';
import { publishRunEvidence } from '../evidence/publish.js';
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
import type { ClassificationInput } from '../report/templates.js';

const RUN_ID = 'local-20260927T101500Z-3f9a1c2e';
const PARSED = '<testsuites><testsuite name="s"><testcase classname="c" name="t"/></testsuite></testsuites>';
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

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

function marker(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const INJECTIONS = [
  '${{ secrets.INJECT_X }}',
  '@inject-maintainers',
  '#9876543',
  '](https://inject.invalid)',
  '<script>inject</script>',
  '```inject',
  '$(inject-id)',
];

describe('invariant 1: execution text stays data', () => {
  it('invariant 1: injection text in output and test names never reaches the report', async () => {
    const cases = INJECTIONS.map(
      (text, i) => `<testcase classname="c${i}" name="${marker(text)}"><failure message="failed"/></testcase>`,
    ).join('');
    const xml = `<testsuites><testsuite name="s">${cases}</testsuite></testsuites>`;
    const results = transport([completed('head-test-1', [xml], INJECTIONS.join('\n') + '\n')]);
    const root = mkTmpDir();
    const published = await publishRunEvidence(buildInput(root, { executions: evidence(results) }));
    expect(published.ok).toBe(true);
    if (!published.ok) return;
    const dir = runDirOf(root);
    const report = fs.readFileSync(path.join(dir, 'report.md'), 'utf8');
    expect(report).toContain('- `head-test-1` at');
    for (const text of INJECTIONS) {
      expect(report, text).not.toContain(text);
      expect(published.value.report, text).not.toContain(text);
      expect(published.value.checkSummary, text).not.toContain(text);
      expect(published.value.reportRecord.rendered, text).not.toContain(text);
      expect(published.value.reportRecord.check_summary, text).not.toContain(text);
    }
    const output = fs.readFileSync(path.join(dir, 'executions/execution-0001/output.txt'), 'utf8');
    const record = fs.readFileSync(path.join(dir, 'executions/execution-0001.json'), 'utf8');
    expect(JSON.parse(record)).toBeTypeOf('object');
    for (const text of INJECTIONS) {
      expect(output, text).toContain(text);
      expect(JSON.parse(record).output.head as string, text).toContain(text);
    }
    expect((await verifyRunDirectory(dir)).ok).toBe(true);
  });

  it('invariant 1: injection text in a result file is stored as data', async () => {
    const comment = `<!-- ${INJECTIONS.map(marker).join(' ')} -->`;
    const results = transport([completed('head-test-1', [PARSED + comment])]);
    const root = mkTmpDir();
    const published = await publishRunEvidence(buildInput(root, { executions: evidence(results) }));
    expect(published.ok).toBe(true);
    const dir = runDirOf(root);
    const stored = fs.readFileSync(path.join(dir, 'executions/execution-0001/result-1.xml'), 'utf8');
    for (const text of INJECTIONS) {
      expect(stored, text).toContain(marker(text));
    }
    const record = readJson<ExecutionRecord>(path.join(dir, 'executions/execution-0001.json'));
    expect(record.result_files[0]?.stored_path).toBe('executions/execution-0001/result-1.xml');
    const report = fs.readFileSync(path.join(dir, 'report.md'), 'utf8');
    for (const text of INJECTIONS) {
      expect(report, text).not.toContain(text);
    }
    expect((await verifyRunDirectory(dir)).ok).toBe(true);
  });
});
