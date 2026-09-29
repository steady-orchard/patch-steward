import type { ExecutionResultsTransport } from '../execution/transport.js';
import type { RedactionCount, RedactionFailureCode } from '../redaction/redact.js';
import { executionRecordSchema } from '../records/execution-record.js';
import type { ExecutionRecord } from '../records/execution-record.js';
import { err, ok } from '../result.js';
import type { Result } from '../result.js';
import { executionOutputFilePath, executionResultFilePath } from './layout.js';
import { redactCapturedOutput } from './output-file.js';
import { mergeRedactionCounts } from './redact-records.js';
import type { EvidenceRedactionOptions } from './redact-records.js';
import { redactResultFileText } from './result-file.js';

export interface StoredExecutionFile {
  readonly path: string;
  readonly bytes: Uint8Array;
}

export interface StoredResultFile extends StoredExecutionFile {
  readonly sequence: number;
  readonly position: number;
}

export interface PreparedExecutionEvidence {
  readonly records: readonly ExecutionRecord[];
  readonly outputFiles: readonly StoredExecutionFile[];
  readonly resultFiles: readonly StoredResultFile[];
  readonly counts: readonly RedactionCount[];
  readonly exactValues: number;
}

export type ExecutionEvidenceFailureCode = RedactionFailureCode | 'evidence.record-invalid';

type ResultFileEntry = ExecutionRecord['result_files'][number];

const INVALID_MESSAGE = 'An execution record could not be prepared as evidence.';

function invalid(): ReturnType<typeof err<'evidence.record-invalid'>> {
  return err('evidence.record-invalid', 'steward-defect', INVALID_MESSAGE);
}

export async function prepareExecutionEvidence(
  results: ExecutionResultsTransport,
  options: EvidenceRedactionOptions,
): Promise<Result<PreparedExecutionEvidence, ExecutionEvidenceFailureCode>> {
  const records: ExecutionRecord[] = [];
  const outputFiles: StoredExecutionFile[] = [];
  const resultFiles: StoredResultFile[] = [];
  const countLists: (readonly RedactionCount[])[] = [];
  let exactValues = 0;

  for (const entry of results.results) {
    if (entry.kind !== 'completed') continue;
    const sequence = records.length + 1;
    const { record } = entry;
    if (record.limits === undefined) return invalid();

    const output = await redactCapturedOutput(
      { parts: entry.output.parts, omittedBytes: entry.output.omitted_bytes, trimmedBytes: entry.output.trimmed_bytes },
      { headBytes: record.limits.output_head_bytes, tailBytes: record.limits.output_tail_bytes },
      options,
    );
    if (!output.ok) return output;
    countLists.push(output.value.counts);
    exactValues += output.value.exactValues;

    const outputPath = executionOutputFilePath(sequence);
    outputFiles.push({ path: outputPath, bytes: new TextEncoder().encode(output.value.fileText) });

    const files: ResultFileEntry[] = [];
    for (let index = 0; index < record.result_files.length; index += 1) {
      const file = record.result_files[index] as ResultFileEntry;
      const position = index + 1;
      if (file.status === 'parsed' || file.status === 'malformed') {
        const item = entry.result_texts.find((candidate) => candidate.position === position);
        if (item === undefined) return invalid();
        if (item.text === null) {
          files.push(file);
          continue;
        }
        const redacted = await redactResultFileText(item.text, options);
        if (!redacted.ok) return redacted;
        countLists.push(redacted.value.counts);
        exactValues += redacted.value.exactValues;
        const path = executionResultFilePath(sequence, position);
        resultFiles.push({ path, bytes: redacted.value.bytes, sequence, position });
        files.push({ ...file, stored_path: path, stored_omitted: false });
      } else if (file.status === undefined) {
        files.push(file);
      } else {
        files.push({ ...file, stored_path: null, stored_omitted: false });
      }
    }

    const stored = {
      ...record,
      output: {
        ...record.output,
        head: output.value.excerpt.head,
        tail: output.value.excerpt.tail,
        truncated: output.value.excerpt.truncated,
        stored_path: outputPath,
      },
      result_files: files,
    };
    const parsed = executionRecordSchema.safeParse(stored);
    if (!parsed.success) return invalid();
    records.push(parsed.data);
  }

  return ok({
    records,
    outputFiles,
    resultFiles,
    counts: mergeRedactionCounts(countLists, []),
    exactValues,
  });
}

export function dropLastStoredResultFile(prepared: PreparedExecutionEvidence): PreparedExecutionEvidence | null {
  const last = prepared.resultFiles[prepared.resultFiles.length - 1];
  if (last === undefined) return null;
  const record = prepared.records[last.sequence - 1];
  if (record === undefined) return null;

  const files = record.result_files.map((file, index) => {
    if (index + 1 !== last.position) return file;
    return { ...file, stored_path: null, stored_omitted: true, stored_omitted_reason: 'evidence-budget' as const };
  });
  const records = prepared.records.map((candidate, index) =>
    index === last.sequence - 1 ? { ...candidate, result_files: files } : candidate,
  );

  return {
    ...prepared,
    records,
    resultFiles: prepared.resultFiles.slice(0, -1),
  };
}
