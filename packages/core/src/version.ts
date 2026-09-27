import { readFileSync } from 'node:fs';

import { err, ok, type Result } from './result.js';

export type StewardVersionFailureCode = 'steward.version-unavailable';

const SEMVER_PATTERN =
  /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

const VERSION_UNAVAILABLE_MESSAGE = 'The steward version could not be read.';

export function parseStewardVersion(text: string): Result<string, StewardVersionFailureCode> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return err('steward.version-unavailable', 'steward-defect', VERSION_UNAVAILABLE_MESSAGE);
  }

  if (typeof parsed !== 'object' || parsed === null || !('version' in parsed)) {
    return err('steward.version-unavailable', 'steward-defect', VERSION_UNAVAILABLE_MESSAGE);
  }

  const version = (parsed as { version: unknown }).version;
  if (typeof version !== 'string' || version.length > 256 || !SEMVER_PATTERN.test(version)) {
    return err('steward.version-unavailable', 'steward-defect', VERSION_UNAVAILABLE_MESSAGE);
  }

  return ok(version);
}

let cachedResult: Result<string, StewardVersionFailureCode> | undefined;

export function stewardVersion(): Result<string, StewardVersionFailureCode> {
  if (cachedResult !== undefined) {
    return cachedResult;
  }

  let text: string;
  try {
    text = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
  } catch {
    cachedResult = err('steward.version-unavailable', 'steward-defect', VERSION_UNAVAILABLE_MESSAGE);
    return cachedResult;
  }

  cachedResult = parseStewardVersion(text);
  return cachedResult;
}
