import { z } from 'zod';

import {
  recordRunIdSchema,
  recordPositiveIntSchema,
  recordTimestampSchema,
  recordContentHashSchema,
  recordCountSchema,
  recordIdentifierSchema,
  recordTypeSchema,
  recordList,
} from '../records/common.js';
import type { RedactionCount } from '../redaction/redact.js';
import { EVIDENCE_LOG_FILES_MAX, EVIDENCE_LOG_FILE_MAX_BYTES, EVIDENCE_RUN_FILES_MAX } from '../policy/bounds.js';
import { RUN_FILES, recordTypeForPath, runDirectoryName } from './layout.js';
import { contentHash, canonicalJsonHash } from '../hash.js';
import { err, ok } from '../result.js';
import type { Result } from '../result.js';

export const EVIDENCE_MANIFEST_VERSION = 1;

const manifestFileEntrySchema = z.strictObject({
  path: z.string().min(1).max(256),
  bytes: recordCountSchema,
  sha256: recordContentHashSchema,
  record_type: recordTypeSchema.nullable(),
  content_hash: recordContentHashSchema.nullable(),
});

export const evidenceManifestSchema = z
  .strictObject({
    manifest_version: z.literal(1),
    run_id: recordRunIdSchema,
    run_attempt: recordPositiveIntSchema,
    store_path: z.string().regex(/^runs\/(?:pr|issue)-[1-9][0-9]{0,9}\/[A-Za-z0-9-]{1,64}$/),
    created_at: recordTimestampSchema,
    files: z.array(manifestFileEntrySchema).max(EVIDENCE_RUN_FILES_MAX - 1),
    metrics: z.strictObject({
      path: z.string().regex(/^metrics\/[0-9]{4}-[0-9]{2}\/[A-Za-z0-9-]{1,64}\.json$/),
      bytes: recordCountSchema,
      sha256: recordContentHashSchema,
    }),
    redaction: z.strictObject({
      detectors: recordList(recordIdentifierSchema),
      policy_patterns: recordList(recordIdentifierSchema),
      exact_values: recordCountSchema,
      replacements: recordList(z.strictObject({ id: recordIdentifierSchema, count: z.int().min(1) })),
    }),
  })
  .superRefine((manifest, ctx) => {
    for (let index = 1; index < manifest.files.length; index += 1) {
      const previous = manifest.files[index - 1] as { path: string };
      const current = manifest.files[index] as { path: string };
      if (!(previous.path < current.path)) {
        ctx.addIssue({
          code: 'custom',
          message: 'files must be sorted by path in strictly ascending order with no duplicates',
          path: ['files', index, 'path'],
        });
      }
    }

    let logFileCount = 0;
    const seenRunFiles = new Set<string>();

    for (let index = 0; index < manifest.files.length; index += 1) {
      const file = manifest.files[index] as {
        path: string;
        bytes: number;
        record_type: string | null;
        content_hash: string | null;
      };
      const expectedRecordType = recordTypeForPath(file.path);
      if (expectedRecordType === undefined || expectedRecordType !== file.record_type) {
        ctx.addIssue({
          code: 'custom',
          message: 'file path is not part of the run layout or has the wrong record type',
          path: ['files', index, 'path'],
        });
      }

      const hasContentHash = file.content_hash !== null;
      const isRecordFile = file.record_type !== null;
      if (hasContentHash !== isRecordFile) {
        ctx.addIssue({
          code: 'custom',
          message: 'content_hash must be present exactly when record_type is non-null',
          path: ['files', index, 'content_hash'],
        });
      }

      if (file.path.startsWith('logs/')) {
        logFileCount += 1;
        if (file.bytes > EVIDENCE_LOG_FILE_MAX_BYTES) {
          ctx.addIssue({
            code: 'custom',
            message: 'log file exceeds the maximum allowed size',
            path: ['files', index, 'bytes'],
          });
        }
      }

      if (Object.values(RUN_FILES).includes(file.path as (typeof RUN_FILES)[keyof typeof RUN_FILES])) {
        seenRunFiles.add(file.path);
      }
    }

    if (logFileCount > EVIDENCE_LOG_FILES_MAX) {
      ctx.addIssue({
        code: 'custom',
        message: 'too many log files',
        path: ['files'],
      });
    }

    for (const runFile of Object.values(RUN_FILES)) {
      if (!seenRunFiles.has(runFile)) {
        ctx.addIssue({
          code: 'custom',
          message: `manifest is missing the required run file "${runFile}"`,
          path: ['files'],
        });
      }
    }

    const expectedDirectoryName = runDirectoryName(manifest.run_id, manifest.run_attempt);
    const storePathSegments = manifest.store_path.split('/');
    const storePathLastSegment = storePathSegments[storePathSegments.length - 1];
    if (storePathLastSegment !== expectedDirectoryName) {
      ctx.addIssue({
        code: 'custom',
        message: 'store_path does not end with the run directory name',
        path: ['store_path'],
      });
    }

    const metricsFileName = manifest.metrics.path.split('/').pop();
    if (metricsFileName !== `${expectedDirectoryName}.json`) {
      ctx.addIssue({
        code: 'custom',
        message: 'metrics path does not match the run directory name',
        path: ['metrics', 'path'],
      });
    }
  });

export type EvidenceManifest = z.output<typeof evidenceManifestSchema>;

export interface ManifestRedaction {
  readonly detectors: readonly string[];
  readonly policyPatterns: readonly string[];
  readonly exactValues: number;
  readonly replacements: readonly RedactionCount[];
}

export interface EvidenceManifestInput {
  readonly runId: string | number;
  readonly runAttempt: number;
  readonly storePath: string;
  readonly createdAt: string;
  readonly files: readonly { readonly path: string; readonly bytes: Uint8Array }[];
  readonly metrics: { readonly path: string; readonly bytes: Uint8Array };
  readonly redaction: ManifestRedaction;
}

export type EvidenceManifestFailureCode = 'evidence.manifest-invalid';

function manifestFailure(): Result<never, EvidenceManifestFailureCode> {
  return err('evidence.manifest-invalid', 'steward-defect', 'The evidence manifest could not be built.');
}

export function buildEvidenceManifest(input: EvidenceManifestInput): Result<EvidenceManifest, EvidenceManifestFailureCode> {
  const decoder = new TextDecoder('utf-8', { fatal: true });

  const fileEntries: {
    path: string;
    bytes: number;
    sha256: string;
    record_type: string | null;
    content_hash: string | null;
  }[] = [];

  for (const file of input.files) {
    const recordType = recordTypeForPath(file.path);
    if (recordType === undefined) {
      return manifestFailure();
    }

    let contentHashValue: string | null = null;
    if (recordType !== null) {
      let decoded: string;
      try {
        decoded = decoder.decode(file.bytes);
      } catch {
        return manifestFailure();
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(decoded);
      } catch {
        return manifestFailure();
      }
      const hashResult = canonicalJsonHash(parsed);
      if (!hashResult.ok) {
        return manifestFailure();
      }
      contentHashValue = hashResult.value;
    }

    fileEntries.push({
      path: file.path,
      bytes: file.bytes.length,
      sha256: contentHash(file.bytes),
      record_type: recordType,
      content_hash: contentHashValue,
    });
  }

  fileEntries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  const candidate = {
    manifest_version: EVIDENCE_MANIFEST_VERSION,
    run_id: input.runId,
    run_attempt: input.runAttempt,
    store_path: input.storePath,
    created_at: input.createdAt,
    files: fileEntries,
    metrics: {
      path: input.metrics.path,
      bytes: input.metrics.bytes.length,
      sha256: contentHash(input.metrics.bytes),
    },
    redaction: {
      detectors: input.redaction.detectors,
      policy_patterns: input.redaction.policyPatterns,
      exact_values: input.redaction.exactValues,
      replacements: input.redaction.replacements.map((replacement) => ({ id: replacement.id, count: replacement.count })),
    },
  };

  const parsed = evidenceManifestSchema.safeParse(candidate);
  if (!parsed.success) {
    return manifestFailure();
  }
  return ok(parsed.data);
}
