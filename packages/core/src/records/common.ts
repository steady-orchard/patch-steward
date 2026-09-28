import { z } from 'zod';

import {
  RECORD_TEXT_MAX_LENGTH,
  RECORD_LIST_MAX_ITEMS,
  RECORD_IDENTIFIER_MAX_LENGTH,
  RECORD_SCHEMA_VERSION,
} from '../policy/bounds.js';

export const RECORD_TYPES = [
  'submission',
  'run',
  'execution-record',
  'finding',
  'decision',
  'report',
  'maintainer-action',
  'metrics-event',
  'policy-revision',
  'ownership',
  'waiting',
  'supersession',
] as const;

export const recordTypeSchema = z.enum(RECORD_TYPES);
export type RecordType = z.infer<typeof recordTypeSchema>;

export const recordSchemaVersionSchema = z.literal(RECORD_SCHEMA_VERSION);

export const recordTextSchema = z
  .string()
  .max(RECORD_TEXT_MAX_LENGTH)
  .refine((s) => s.isWellFormed(), 'text must be well-formed Unicode');

export const recordIdentifierSchema = z
  .string()
  .min(1)
  .max(RECORD_IDENTIFIER_MAX_LENGTH)
  .regex(/^[\x21-\x7e]+$/);

export const recordCommitIdSchema = z.string().regex(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/);

export const recordContentHashSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/);

export const recordTimestampSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/)
  .refine((s) => !Number.isNaN(Date.parse(s)), 'timestamp must be a valid UTC date-time');

export const recordRepositorySchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9._-]{1,100}$/);

export const recordLoginSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9-]{0,38}(?:\[bot\])?$/);

export const policyRevisionIdSchema = z.string().regex(/^(?:[0-9a-f]{40}|[0-9a-f]{64}|local:[0-9a-f]{64})$/);

export const recordTreeIdSchema = z.string().regex(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/);

export const recordPositiveIntSchema = z.int().min(1);

export const LOCAL_RUN_ID_PATTERN = /^local-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}$/;

export const recordRunIdSchema = z.union([recordPositiveIntSchema, z.string().regex(LOCAL_RUN_ID_PATTERN)]);

export type RecordRunId = z.infer<typeof recordRunIdSchema>;

export const recordCountSchema = z.int().min(0);

export function recordList<T extends z.ZodType>(item: T) {
  return z.array(item).max(RECORD_LIST_MAX_ITEMS);
}

export type RecordFailureCode = 'record.invalid';
