import * as fs from 'node:fs';
import * as path from 'node:path';

import type { ParsedSubmissionBody } from '@patch-steward/core';
import { PREFLIGHT_DRAFT_MAX_BYTES, SUBMISSION_TEXT_MAX_LENGTH, parseIssueBody, parsePullRequestBody } from '@patch-steward/core';

export const PREFLIGHT_DRAFT_FAILURE_CODES = [
  'preflight.draft-not-found',
  'preflight.draft-unreadable',
  'preflight.draft-too-large',
  'preflight.draft-invalid-utf8',
] as const;

export type PreflightDraftFailureCode = (typeof PREFLIGHT_DRAFT_FAILURE_CODES)[number];

export interface PreflightDraft {
  readonly text: string;
  readonly body: ParsedSubmissionBody;
}

export type PreflightDraftResult =
  | { readonly ok: true; readonly draft: PreflightDraft }
  | { readonly ok: false; readonly code: PreflightDraftFailureCode; readonly message: string };

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

const TOO_LARGE_BYTES_MESSAGE = `The draft exceeds ${PREFLIGHT_DRAFT_MAX_BYTES} bytes; GitHub accepts at most ${SUBMISSION_TEXT_MAX_LENGTH} characters in an issue or pull request body.`;

const TOO_LARGE_LENGTH_MESSAGE = `The draft has more than ${SUBMISSION_TEXT_MAX_LENGTH} characters, GitHub's limit for an issue or pull request body.`;

export async function readPreflightDraft(
  cwd: string,
  draftPath: string,
  type: 'issue' | 'pull_request',
): Promise<PreflightDraftResult> {
  const absolute = path.resolve(cwd, draftPath);

  let stat: fs.Stats;
  try {
    stat = await fs.promises.stat(absolute);
  } catch (error: unknown) {
    if (isErrnoException(error) && (error.code === 'ENOENT' || error.code === 'ENOTDIR')) {
      return { ok: false, code: 'preflight.draft-not-found', message: 'The draft file does not exist.' };
    }
    return { ok: false, code: 'preflight.draft-unreadable', message: 'The draft file could not be read.' };
  }

  if (!stat.isFile()) {
    return { ok: false, code: 'preflight.draft-unreadable', message: 'The draft path is not a regular file.' };
  }

  if (stat.size > PREFLIGHT_DRAFT_MAX_BYTES) {
    return { ok: false, code: 'preflight.draft-too-large', message: TOO_LARGE_BYTES_MESSAGE };
  }

  let bytes: Buffer;
  try {
    bytes = await fs.promises.readFile(absolute);
  } catch {
    return { ok: false, code: 'preflight.draft-unreadable', message: 'The draft file could not be read.' };
  }

  if (bytes.length > PREFLIGHT_DRAFT_MAX_BYTES) {
    return { ok: false, code: 'preflight.draft-too-large', message: TOO_LARGE_BYTES_MESSAGE };
  }

  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return { ok: false, code: 'preflight.draft-invalid-utf8', message: 'The draft is not valid UTF-8.' };
  }

  const parsed = type === 'issue' ? parseIssueBody(text) : parsePullRequestBody(text);
  if (!parsed.ok) {
    if (parsed.failure.code === 'submission.body-too-large') {
      return { ok: false, code: 'preflight.draft-too-large', message: TOO_LARGE_LENGTH_MESSAGE };
    }
    return { ok: false, code: 'preflight.draft-invalid-utf8', message: 'The draft is not well-formed Unicode text.' };
  }

  return { ok: true, draft: { text, body: parsed.value } };
}
