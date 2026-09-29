import type { CapturedOutput } from '../execution/output-capture.js';
import type { ExecutionPlanEntry } from '../execution/plan.js';
import type { ExecutionResultEntry } from '../execution/transport.js';
import { outputExcerpt, splitCapturedOutput } from '../evidence/output-file.js';
import { decodeResultFile } from '../evidence/result-file.js';
import { contentHash } from '../hash.js';
import { parseJunitXml } from '../junit/parse.js';
import type { RecordRunId } from '../records/common.js';
import type { ExecutionRecord } from '../records/execution-record.js';

export type ResultFileRead =
  | { readonly kind: 'file'; readonly bytes: Uint8Array }
  | { readonly kind: 'missing' }
  | { readonly kind: 'not-regular' }
  | { readonly kind: 'too-large'; readonly declaredBytes: number };

export interface ExecutionExitFacts {
  readonly code: number | null;
  readonly signal: string | null;
  readonly timedOut: boolean;
  readonly oomKilled: boolean;
  readonly outputLimited: boolean;
}

export interface ExecutionRecordFacts {
  readonly runId: RecordRunId;
  readonly runAttempt: number;
  readonly entry: ExecutionPlanEntry;
  readonly runner: 'container' | 'unsandboxed';
  readonly environment: ExecutionRecord['environment'];
  readonly limits: NonNullable<ExecutionRecord['limits']>;
  readonly timing: NonNullable<ExecutionRecord['timing']>;
  readonly exit: ExecutionExitFacts;
  readonly capture: CapturedOutput;
  readonly resultFiles: readonly ResultFileRead[];
  readonly resultTestCases: number;
  readonly checkout: NonNullable<ExecutionRecord['checkout']> | null;
}

export type CompletedExecution = Extract<ExecutionResultEntry, { kind: 'completed' }>;

type ResultFileRecord = ExecutionRecord['result_files'][number];

export function buildCompletedExecution(facts: ExecutionRecordFacts): CompletedExecution {
  const { entry } = facts;
  if (facts.resultFiles.length !== entry.result_files.length) {
    throw new TypeError('result file reads do not match the declared result files');
  }
  const split = splitCapturedOutput(facts.capture);
  const excerpt = outputExcerpt(split);
  const resultTexts: CompletedExecution['result_texts'] = [];
  const resultFiles: ResultFileRecord[] = [];

  entry.result_files.forEach((declared, i) => {
    const read = facts.resultFiles[i];
    if (read === undefined) throw new TypeError('missing result file read');
    if (read.kind === 'file') {
      const parse = parseJunitXml(read.bytes, { maxCases: facts.resultTestCases });
      const decoded = decodeResultFile(read.bytes);
      resultFiles.push({
        path: declared.path,
        content_hash: contentHash(read.bytes),
        bytes: read.bytes.length,
        format: 'junit-xml',
        status: parse.status,
        error_code: parse.status === 'malformed' ? parse.error_code : null,
        stored_path: null,
        junit: parse.status === 'parsed' ? parse.junit : null,
        ...(decoded.text === null ? { stored_omitted: true, stored_omitted_reason: 'redaction-input' } : {}),
      } as ResultFileRecord);
      resultTexts.push({ position: i + 1, decoded_bytes: decoded.decodedBytes, text: decoded.text });
      return;
    }
    resultFiles.push({
      path: declared.path,
      content_hash: null,
      bytes: read.kind === 'too-large' ? read.declaredBytes : 0,
      format: 'junit-xml',
      status: read.kind,
      error_code: null,
      stored_path: null,
      junit: null,
    } as ResultFileRecord);
  });

  const record = {
    schema_version: 1,
    record_type: 'execution-record',
    run_id: facts.runId,
    run_attempt: facts.runAttempt,
    plan_entry: entry.id,
    command: [...entry.run],
    kind: entry.kind,
    runner: facts.runner,
    working_directory: entry.working_directory,
    expected: entry.expected,
    limits: facts.limits,
    timing: facts.timing,
    ...(facts.checkout === null ? {} : { checkout: facts.checkout }),
    environment: facts.environment,
    exit: {
      code: facts.exit.code,
      signal: facts.exit.signal,
      timed_out: facts.exit.timedOut,
      oom_killed: facts.exit.oomKilled,
      output_limited: facts.exit.outputLimited,
    },
    output: {
      head: excerpt.head,
      tail: excerpt.tail,
      truncated: excerpt.truncated,
      total_bytes: facts.capture.totalBytes,
      stored_path: null,
    },
    result_files: resultFiles,
    test_identity: null,
    commits: { head: entry.commit, base: null, merge: null },
    admissibility: facts.runner === 'container' ? 'evidence' : 'claim',
  } as ExecutionRecord;

  return {
    kind: 'completed',
    entry_id: entry.id,
    record,
    output: { parts: split.parts, omitted_bytes: split.omittedBytes, trimmed_bytes: split.trimmedBytes },
    result_texts: resultTexts,
  } as CompletedExecution;
}
