import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { verifyRunDirectory } from './verify.js';
import { recordTypeForPath } from './layout.js';
import { publishRunEvidence } from './publish.js';
import type { RunEvidenceInput } from './publish.js';
import { prepareFindings, decisionFindings } from './assemble.js';
import type { RunAssemblyInput } from './assemble.js';
import type { HandoffFinding } from '../pipeline/handoff.js';
import { CONTRACT_FINDING_MESSAGES } from '../submission/contract.js';
import { decideOutcome } from '../decision/table.js';
import type { DecisionResult } from '../decision/table.js';
import { submissionRecordSchema } from '../records/submission.js';
import type { SubmissionRecord } from '../records/submission.js';
import type { LoadedPolicy } from '../policy/loader.js';
import { DEFAULT_CHECKLIST_POLICY } from '../submission/default-checklist.js';
import { prettyJson } from './pretty-json.js';
import { contentHash, canonicalJsonHash } from '../hash.js';
import type { ClassificationInput } from '../report/templates.js';

const RUN_ID = 'local-20260927T101500Z-3f9a1c2e';

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

function buildInput(evidenceDir: string): RunEvidenceInput {
  const submission = makeSubmission();
  const findings = makeFindings();
  const loadedPolicy = trustedPolicy;
  const prepared = prepareFindings(findings, {
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
    credentials: [],
    localRun: true,
    createdAt: '2026-09-27T10:15:03.000Z',
  };
}

function mkTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'patch-steward-verify-exec-'));
}

function rmTmpDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

let sourceStore: string;
let runDirRelative: readonly string[];

beforeAll(async () => {
  sourceStore = mkTmpDir();
  const input = buildInput(sourceStore);
  const result = await publishRunEvidence(input);
  if (!result.ok) {
    throw new Error('test setup: publishRunEvidence failed');
  }
  runDirRelative = ['octo', 'demo', 'runs', 'pr-12', RUN_ID];
});

afterAll(() => {
  rmTmpDir(sourceStore);
});

function freshRunDir(): { root: string; runDir: string } {
  const root = mkTmpDir();
  fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  fs.cpSync(sourceStore, root, { recursive: true });
  const runDir = path.join(root, ...runDirRelative);
  return { root, runDir };
}

type Json = Record<string, unknown>;

function sha(n: string): string {
  return 'sha256:' + n.repeat(64);
}

function junit(): Json {
  return {
    tests: 2,
    passed: 1,
    failed: 1,
    errored: 0,
    skipped: 0,
    duration_ms: 5,
    cases: [
      { identity: 'a', status: 'pass', duration_ms: 1, identity_truncated: false },
      { identity: 'b', status: 'fail', duration_ms: 2, identity_truncated: false },
    ],
    cases_truncated: false,
  };
}

function resultEntry(extra: Json): Json {
  return { path: 'report.xml', content_hash: sha('1'), bytes: 10, format: 'junit-xml', ...extra };
}

function execRecord(seq: number, results: Json[], output: Json): Json {
  const id = String(seq).padStart(4, '0');
  return {
    schema_version: 1,
    record_type: 'execution-record',
    run_id: RUN_ID,
    run_attempt: 1,
    plan_entry: 'entry-' + id,
    command: ['npm', 'test'],
    kind: 'command',
    runner: 'container',
    working_directory: '.',
    expected: 'exit-zero',
    limits: {
      execution_seconds: 60,
      output_head_bytes: 1024,
      output_tail_bytes: 1024,
      output_stream_bytes: 4096,
      cpus: null,
      memory_mb: null,
      pids: null,
      scratch_mb: null,
    },
    environment: {
      image_digest: null,
      tool_versions: [],
      image: { source: 'registry', reference: 'node:24', digest: sha('2'), id: null, runner_tree_id: null, cached: false },
    },
    exit: { code: 0, signal: null, timed_out: false },
    output: { head: 'h', tail: 't', truncated: false, total_bytes: 2, ...output },
    result_files: results,
    test_identity: null,
    commits: { head: 'c'.repeat(40), base: null, merge: null },
    admissibility: 'evidence',
  };
}

function writeFiles(runDir: string, files: Record<string, string | Buffer | null>): void {
  const manifestPath = path.join(runDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
    files: { path: string; bytes: number; sha256: string; record_type: string | null; content_hash: string | null }[];
  };
  for (const [rel, content] of Object.entries(files)) {
    const target = path.join(runDir, ...rel.split('/'));
    manifest.files = manifest.files.filter((f) => f.path !== rel);
    if (content === null) {
      fs.rmSync(target, { force: true });
      continue;
    }
    const bytes = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
    const recordType = recordTypeForPath(rel);
    let hashValue: string | null = null;
    if (typeof recordType === 'string') {
      const h = canonicalJsonHash(JSON.parse(bytes.toString('utf8')));
      if (!h.ok) {
        throw new Error('canonicalJsonHash failed');
      }
      hashValue = h.value;
    }
    manifest.files.push({
      path: rel,
      bytes: bytes.length,
      sha256: contentHash(bytes),
      record_type: recordType ?? null,
      content_hash: hashValue,
    });
  }
  manifest.files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const pretty = prettyJson(manifest);
  if (!pretty.ok) {
    throw new Error('prettyJson failed');
  }
  fs.writeFileSync(manifestPath, pretty.value);
}

function rec(value: Json): string {
  const pretty = prettyJson(value);
  if (!pretty.ok) {
    throw new Error('prettyJson failed');
  }
  return pretty.value;
}

const OUT1 = 'executions/execution-0001/output.txt';
const OUT2 = 'executions/execution-0002/output.txt';
const RES1 = 'executions/execution-0001/result-1.xml';

function record1(): Json {
  return execRecord(
    1,
    [
      resultEntry({ status: 'parsed', error_code: null, junit: junit(), stored_omitted: false, stored_path: RES1 }),
      resultEntry({
        status: 'parsed',
        error_code: null,
        junit: junit(),
        stored_omitted: true,
        stored_omitted_reason: 'evidence-budget',
        stored_path: null,
      }),
      resultEntry({
        status: 'missing',
        content_hash: null,
        bytes: 0,
        error_code: null,
        junit: null,
        stored_omitted: false,
        stored_path: null,
      }),
    ],
    { stored_path: OUT1 },
  );
}

function record2(): Json {
  return execRecord(
    2,
    [
      resultEntry({
        status: 'malformed',
        error_code: 'junit-malformed',
        junit: null,
        stored_omitted: true,
        stored_omitted_reason: 'redaction-input',
        stored_path: null,
      }),
    ],
    { stored_path: OUT2 },
  );
}

function goodRun(): { root: string; runDir: string } {
  const made = freshRunDir();
  writeFiles(made.runDir, {
    'executions/execution-0001.json': rec(record1()),
    'executions/execution-0002.json': rec(record2()),
    [OUT1]: 'x'.repeat(100),
    [RES1]: '<testsuite/>',
    [OUT2]: '',
  });
  return made;
}

async function expectReason(mutate: (runDir: string) => void, reason: string): Promise<void> {
  const { root, runDir } = goodRun();
  try {
    mutate(runDir);
    const result = await verifyRunDirectory(runDir);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('report.evidence-invalid');
      expect(result.failure.details?.[0]?.message).toBe(reason);
    }
  } finally {
    rmTmpDir(root);
  }
}

async function expectOk(mutate: (runDir: string) => void): Promise<void> {
  const { root, runDir } = goodRun();
  try {
    mutate(runDir);
    const result = await verifyRunDirectory(runDir);
    expect(result.ok).toBe(true);
  } finally {
    rmTmpDir(root);
  }
}

describe('execution evidence verification', () => {
  it('a run with execution records and stored files verifies', async () => {
    await expectOk(() => undefined);
  });

  it('omitted result files of both reasons verify', async () => {
    const reasons = [...(record1()['result_files'] as Json[]), ...(record2()['result_files'] as Json[])].map(
      (e) => e['stored_omitted_reason'],
    );
    expect(reasons).toContain('evidence-budget');
    expect(reasons).toContain('redaction-input');
    await expectOk(() => undefined);
  });

  it('a stored claim record fails verification', async () => {
    await expectReason((d) => {
      const r = record1();
      r['admissibility'] = 'claim';
      delete r['runner'];
      writeFiles(d, { 'executions/execution-0001.json': rec(r) });
    }, 'a claim record is stored');
  });

  it('a missing output file fails verification', async () => {
    await expectReason((d) => writeFiles(d, { [OUT1]: null }), 'a referenced output file is not listed');
  });

  it('an unreferenced output file fails verification', async () => {
    await expectReason(
      (d) => writeFiles(d, { 'executions/execution-0003/output.txt': 'x' }),
      'an output file is not referenced by its record',
    );
  });

  it('an output file with the wrong sequence fails verification', async () => {
    await expectReason((d) => {
      const r = record1();
      r['output'] = { ...(r['output'] as Json), stored_path: OUT2 };
      writeFiles(d, { 'executions/execution-0001.json': rec(r) });
    }, 'an output file is referenced by the wrong record');
  });

  it('an output file over its bound fails verification', async () => {
    await expectReason((d) => writeFiles(d, { [OUT1]: 'x'.repeat(2177) }), 'an output file exceeds its bound');
  });

  it('an output file that is not UTF-8 fails verification', async () => {
    await expectReason((d) => writeFiles(d, { [OUT1]: Buffer.from([0xff, 0xfe]) }), 'an output file is not valid UTF-8');
  });

  it('a stored record with a null output path fails verification', async () => {
    await expectReason((d) => {
      const r = record1();
      r['output'] = { ...(r['output'] as Json), stored_path: null };
      writeFiles(d, { 'executions/execution-0001.json': rec(r) });
    }, 'an execution record has no stored output file');
  });

  it('a record without the output path key verifies', async () => {
    await expectOk((d) => {
      const r = record2();
      const output = { ...(r['output'] as Json) };
      delete output['stored_path'];
      r['output'] = output;
      writeFiles(d, { 'executions/execution-0002.json': rec(r), [OUT2]: null });
      fs.rmdirSync(path.join(d, 'executions', 'execution-0002'));
    });
  });

  it('a missing result file fails verification', async () => {
    await expectReason((d) => writeFiles(d, { [RES1]: null }), 'a referenced result file is not listed');
  });

  it('an unreferenced result file fails verification', async () => {
    await expectReason(
      (d) => writeFiles(d, { 'executions/execution-0001/result-4.xml': '<a/>' }),
      'a result file is not referenced by its entry',
    );
  });

  it('a result file with the wrong position fails verification', async () => {
    await expectReason((d) => {
      const r = record1();
      const entries = r['result_files'] as Json[];
      entries[0] = { ...(entries[0] as Json), stored_path: 'executions/execution-0001/result-2.xml' };
      writeFiles(d, {
        'executions/execution-0001.json': rec(r),
        [RES1]: null,
        'executions/execution-0001/result-2.xml': '<testsuite/>',
      });
    }, 'a result file is referenced by the wrong entry');
  });

  it('a result entry without its storage state fails verification', async () => {
    await expectReason((d) => {
      const r = record1();
      const entries = r['result_files'] as Json[];
      const first = { ...(entries[0] as Json) };
      delete first['stored_omitted'];
      delete first['stored_path'];
      entries[0] = first;
      writeFiles(d, { 'executions/execution-0001.json': rec(r), [RES1]: null });
    }, 'a result file entry lacks its storage state');
  });
});
