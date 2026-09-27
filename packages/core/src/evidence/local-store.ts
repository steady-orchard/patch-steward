import fs from 'node:fs/promises';
import path from 'node:path';

import { EVIDENCE_RUN_FILES_MAX } from '../policy/bounds.js';
import { err, ok } from '../result.js';
import type { Result } from '../result.js';
import { RUN_MANIFEST_FILE, recordTypeForPath, storePathToPlatform } from './layout.js';

export interface EvidenceFs {
  readonly mkdir: (path: string, options: { readonly exclusive: boolean }) => Promise<void>;
  readonly writeFileExclusive: (path: string, data: Uint8Array) => Promise<void>;
  readonly rename: (from: string, to: string) => Promise<void>;
  readonly exists: (path: string) => Promise<boolean>;
  readonly remove: (path: string) => Promise<void>;
}

const RENAME_RETRYABLE_CODES = new Set(['EPERM', 'EACCES', 'EBUSY']);
const RENAME_MAX_ATTEMPTS = 5;
const RENAME_RETRY_DELAY_MS = 100;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function renameWithRetry(from: string, to: string): Promise<void> {
  for (let attempt = 1; attempt <= RENAME_MAX_ATTEMPTS; attempt += 1) {
    try {
      await fs.rename(from, to);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      const isLastAttempt = attempt === RENAME_MAX_ATTEMPTS;
      // WHY: Windows reports transient sharing violations (antivirus, indexer) on directory
      // renames; this tolerates the system call and is not an evidence-write retry.
      if (isLastAttempt || !code || !RENAME_RETRYABLE_CODES.has(code)) {
        throw error;
      }
      const targetExists = await fs
        .lstat(to)
        .then(() => true)
        .catch(() => false);
      if (targetExists) {
        throw error;
      }
      await sleep(RENAME_RETRY_DELAY_MS);
    }
  }
}

export const nodeEvidenceFs: EvidenceFs = {
  mkdir: async (path: string, options: { readonly exclusive: boolean }): Promise<void> => {
    if (options.exclusive) {
      await fs.mkdir(path);
    } else {
      await fs.mkdir(path, { recursive: true });
    }
  },
  writeFileExclusive: async (path: string, data: Uint8Array): Promise<void> => {
    await fs.writeFile(path, data, { flag: 'wx' });
  },
  rename: async (from: string, to: string): Promise<void> => {
    await renameWithRetry(from, to);
  },
  exists: async (path: string): Promise<boolean> => {
    try {
      await fs.lstat(path);
      return true;
    } catch {
      return false;
    }
  },
  remove: async (path: string): Promise<void> => {
    await fs.rm(path, { recursive: true, force: true, maxRetries: 3 });
  },
};

export interface RunDirectoryWrite {
  readonly storeRoot: string;
  readonly storePath: string;
  readonly stagingPath: string;
  readonly files: readonly { readonly path: string; readonly bytes: Uint8Array }[];
  readonly metrics: { readonly path: string; readonly bytes: Uint8Array };
  readonly manifest: Uint8Array;
}

export type LocalStoreFailureCode =
  'evidence.layout-invalid' | 'evidence.too-many-files' | 'evidence.run-exists' | 'evidence.write-failed';

const STORE_PATH_PATTERN = /^runs\/(?:pr|issue)-[1-9][0-9]{0,9}\/[A-Za-z0-9-]{1,64}$/;
const STAGING_PATH_PATTERN = /^runs\/\.staging\/[A-Za-z0-9-]{1,64}$/;
const METRICS_PATH_PATTERN = /^metrics\/[0-9]{4}-[0-9]{2}\/[A-Za-z0-9-]{1,64}\.json$/;

function validate(write: RunDirectoryWrite): Result<undefined, LocalStoreFailureCode> {
  const seen = new Set<string>();
  for (const file of write.files) {
    if (recordTypeForPath(file.path) === undefined) {
      return err('evidence.layout-invalid', 'steward-defect', 'The run directory layout is invalid.');
    }
    if (seen.has(file.path)) {
      return err('evidence.layout-invalid', 'steward-defect', 'The run directory layout is invalid.');
    }
    seen.add(file.path);
  }
  if (!STORE_PATH_PATTERN.test(write.storePath)) {
    return err('evidence.layout-invalid', 'steward-defect', 'The run directory layout is invalid.');
  }
  if (!STAGING_PATH_PATTERN.test(write.stagingPath)) {
    return err('evidence.layout-invalid', 'steward-defect', 'The run directory layout is invalid.');
  }
  if (!METRICS_PATH_PATTERN.test(write.metrics.path)) {
    return err('evidence.layout-invalid', 'steward-defect', 'The run directory layout is invalid.');
  }
  if (write.files.length + 1 > EVIDENCE_RUN_FILES_MAX) {
    return err('evidence.too-many-files', 'budget-exhausted', 'The run directory has too many files.');
  }
  return ok(undefined);
}

export async function writeRunDirectory(
  write: RunDirectoryWrite,
  fs: EvidenceFs = nodeEvidenceFs,
): Promise<Result<{ readonly directory: string }, LocalStoreFailureCode>> {
  const validated = validate(write);
  if (!validated.ok) {
    return validated;
  }

  const final = storePathToPlatform(write.storeRoot, write.storePath);
  const staging = storePathToPlatform(write.storeRoot, write.stagingPath);
  const metricsFile = storePathToPlatform(write.storeRoot, write.metrics.path);

  if (await fs.exists(final)) {
    return err('evidence.run-exists', 'infrastructure', 'The run directory already exists.');
  }

  let stagingIsOurs = false;
  let metricsIsOurs = false;

  const cleanup = async (): Promise<void> => {
    if (stagingIsOurs) {
      try {
        await fs.remove(staging);
      } catch {
        // best-effort
      }
    }
    if (metricsIsOurs) {
      try {
        await fs.remove(metricsFile);
      } catch {
        // best-effort
      }
    }
  };

  try {
    await fs.mkdir(path.dirname(staging), { exclusive: false });
    await fs.mkdir(staging, { exclusive: true });
    stagingIsOurs = true;

    for (const file of write.files) {
      const target = path.join(staging, ...file.path.split('/'));
      await fs.mkdir(path.dirname(target), { exclusive: false });
      await fs.writeFileExclusive(target, file.bytes);
    }

    await fs.mkdir(path.dirname(metricsFile), { exclusive: false });
    await fs.writeFileExclusive(metricsFile, write.metrics.bytes);
    metricsIsOurs = true;

    await fs.writeFileExclusive(path.join(staging, RUN_MANIFEST_FILE), write.manifest);

    await fs.mkdir(path.dirname(final), { exclusive: false });
    if (await fs.exists(final)) {
      await cleanup();
      return err('evidence.run-exists', 'infrastructure', 'The run directory already exists.');
    }
    await fs.rename(staging, final);
  } catch {
    await cleanup();
    return err('evidence.write-failed', 'infrastructure', 'The evidence write failed.');
  }

  return ok({ directory: path.resolve(final) });
}
