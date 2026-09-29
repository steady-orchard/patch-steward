import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { tarEndOfArchive, tarEntryHeader, tarPadding } from '../archive/tar.js';
import { gitBlobId } from '../evidence/blob-id.js';
import { CatFileBatchParser, LsTreeRecordReader, commitObjectFields } from '../git/object-stream.js';
import { isObjectId } from '../git/reader.js';
import { CHECKOUT_PATH_MAX_BYTES, GIT_OUTPUT_MAX_BYTES, RECORD_LIST_MAX_ITEMS } from '../policy/bounds.js';
import { runProcess, type ProcessRunner } from '../process/run-process.js';
import { streamProcess, type StreamProcessRunner } from '../process/stream-process.js';
import { err, ok, type Err, type Result } from '../result.js';
import {
  checkCheckoutPath,
  checkOverlay,
  checkSymlinkTarget,
  treeKindForMode,
  type CheckoutTreeKind,
  type OverlayEntry,
} from './paths.js';

export interface CheckoutRepository {
  readonly repoDir: string;
  readonly env: Readonly<Record<string, string>>;
  readonly configArgs: readonly string[];
}

export interface CheckoutLimits {
  readonly checkoutFiles: number;
  readonly checkoutBytes: number;
  readonly overlayFiles: number;
  readonly overlayBytes: number;
}

export interface CheckoutArchiveInput {
  readonly repo: CheckoutRepository;
  readonly commit: string;
  readonly overlay: readonly OverlayEntry[];
  readonly limits: CheckoutLimits;
  readonly timeoutMs: number;
  readonly outputDir: string;
  readonly stream?: StreamProcessRunner;
  readonly control?: ProcessRunner;
  readonly gitBinary?: string;
}

export interface CheckoutFacts {
  readonly commit: string;
  readonly tree: string;
  readonly archive_sha256: string;
  readonly files: number;
  readonly bytes: number;
  readonly overlays: readonly { readonly path: string; readonly blob: string | null }[];
  readonly skipped_submodules: readonly string[];
}

export interface CheckoutArchive {
  readonly archivePath: string;
  readonly facts: CheckoutFacts;
}

export type CheckoutFailureCode =
  'materialize.fetch-failed' | 'materialize.checkout-too-large' | 'materialize.path-invalid' | 'materialize.overlay-rejected';

type Failure = Err<CheckoutFailureCode>;

interface BaseRecord {
  readonly mode: string;
  readonly id: string;
  readonly path: string;
}

interface OverlayFile {
  readonly kind: 'overlay';
  readonly path: string;
  readonly content: Uint8Array;
  readonly mode: '100644' | '100755';
}

type Item = { readonly kind: 'base'; readonly record: BaseRecord } | OverlayFile;

function fetchFailed(message: string): Failure {
  return err('materialize.fetch-failed', 'environment-unavailable', message);
}

function tooLarge(message: string): Failure {
  return err('materialize.checkout-too-large', 'environment-unavailable', message);
}

function pathInvalid(entryPath: string | Uint8Array, reason: string): Failure {
  const shown = typeof entryPath === 'string' ? entryPath : new TextDecoder('utf-8').decode(entryPath);
  return err('materialize.path-invalid', 'environment-unavailable', 'A checkout path is not allowed.', [
    { code: 'materialize.path-invalid', path: shown, message: reason, line: null, column: null },
  ]);
}

function overlayBlobId(commit: string, content: Uint8Array): string {
  if (commit.length === 40) return gitBlobId(content);
  return createHash('sha256')
    .update(Buffer.from(`blob ${content.length}\u0000`))
    .update(content)
    .digest('hex');
}

export async function buildCheckoutArchive(input: CheckoutArchiveInput): Promise<Result<CheckoutArchive, CheckoutFailureCode>> {
  const { repo, commit, overlay, limits } = input;
  const stream = input.stream ?? streamProcess;
  const control = input.control ?? runProcess;
  const git = input.gitBinary ?? 'git';
  const deadline = Date.now() + input.timeoutMs;
  const remaining = (): number => Math.max(1, deadline - Date.now());

  if (!isObjectId(commit)) return fetchFailed('The commit id is not an object id.');

  const commitRun = await control(git, [...repo.configArgs, 'cat-file', 'commit', commit], {
    cwd: repo.repoDir,
    env: repo.env,
    timeoutMs: remaining(),
    maxOutputBytes: GIT_OUTPUT_MAX_BYTES,
  });
  if (!commitRun.ok || commitRun.value.exitCode !== 0) return fetchFailed('The commit object could not be read.');
  const fields = commitObjectFields(commitRun.value.stdout);
  if (fields === null) return fetchFailed('The commit object is malformed.');
  const { tree, committerTime: mtime } = fields;

  const records: BaseRecord[] = [];
  let failure = null as Failure | null;
  const reader = new LsTreeRecordReader(CHECKOUT_PATH_MAX_BYTES + 128);
  const decoder = new TextDecoder('utf-8');
  const lsRun = await stream(git, [...repo.configArgs, 'ls-tree', '-r', '-z', '--full-tree', commit], {
    cwd: repo.repoDir,
    env: repo.env,
    timeoutMs: remaining(),
    stdin: { kind: 'closed' },
    output: {
      kind: 'sink',
      stderrMaxBytes: 65536,
      onStdout: (chunk) => {
        const read = reader.push(chunk);
        if (!read.ok) {
          failure = read.reason === 'too-long' ? pathInvalid('', 'length') : fetchFailed('The tree listing is malformed.');
          return 'stop';
        }
        for (const record of read.records) {
          if (records.length + 1 > limits.checkoutFiles) {
            failure = tooLarge('The checkout has too many files.');
            return 'stop';
          }
          if (treeKindForMode(record.mode) === null) {
            failure = pathInvalid(record.path, 'mode');
            return 'stop';
          }
          if (record.type !== (record.mode === '160000' ? 'commit' : 'blob')) {
            failure = fetchFailed('The tree listing has an unexpected object type.');
            return 'stop';
          }
          const violation = checkCheckoutPath(record.path);
          if (violation !== null) {
            failure = pathInvalid(record.path, violation);
            return 'stop';
          }
          records.push({ mode: record.mode, id: record.id, path: decoder.decode(record.path) });
        }
        return 'continue';
      },
    },
  });
  if (failure !== null) return failure;
  if (!lsRun.ok || lsRun.value.stopReason !== null || lsRun.value.exitCode !== 0)
    return fetchFailed('The tree could not be listed.');
  if (!reader.finish().ok) return fetchFailed('The tree listing is truncated.');

  const skipped = records.filter((r) => r.mode === '160000').map((r) => r.path);
  if (skipped.length > RECORD_LIST_MAX_ITEMS || overlay.length > RECORD_LIST_MAX_ITEMS) {
    return tooLarge('Too many submodules or overlay entries.');
  }

  const deleted = new Set<string>();
  const replaced = new Map<string, OverlayFile>();
  const added: OverlayFile[] = [];
  if (overlay.length > 0) {
    const map = new Map<string, CheckoutTreeKind>();
    for (const r of records) {
      const kind = treeKindForMode(r.mode);
      if (kind !== null) map.set(r.path, kind);
    }
    const checked = checkOverlay(map, overlay, { maxFiles: limits.overlayFiles, maxBytes: limits.overlayBytes });
    if (!checked.ok) return checked;
    for (const entry of overlay) {
      if ('delete' in entry) {
        deleted.add(entry.path);
      } else {
        const item: OverlayFile = { kind: 'overlay', path: entry.path, content: entry.content, mode: entry.mode };
        if (map.has(entry.path)) replaced.set(entry.path, item);
        else added.push(item);
      }
    }
  }

  const items: Item[] = [];
  for (const record of records) {
    const swap = replaced.get(record.path);
    if (swap !== undefined) items.push(swap);
    else if (record.mode !== '160000' && !deleted.has(record.path)) items.push({ kind: 'base', record });
  }
  items.push(...added);

  const archivePath = path.join(input.outputDir, 'checkout.tar');
  const fd = fs.openSync(archivePath, 'wx');
  const hash = createHash('sha256');
  let succeeded = false;
  let files = 0;
  let bytes = 0;
  try {
    const write = (data: Uint8Array): void => {
      hash.update(data);
      let offset = 0;
      while (offset < data.length) offset += fs.writeSync(fd, data, offset, data.length - offset);
    };
    const dirs = new Set<string>(['checkout']);
    const writeDirs = (entryPath: string): void => {
      const segments = entryPath.split('/');
      let current = 'checkout';
      for (let i = 0; i < segments.length - 1; i += 1) {
        current += '/' + segments[i];
        if (!dirs.has(current)) {
          dirs.add(current);
          write(tarEntryHeader({ path: current, type: 'directory', mode: 0o755, size: 0, mtime }));
        }
      }
    };
    write(tarEntryHeader({ path: 'checkout', type: 'directory', mode: 0o755, size: 0, mtime }));

    let cursor = 0;
    const flushOverlays = (): void => {
      for (;;) {
        const item = items[cursor];
        if (item === undefined || item.kind !== 'overlay') return;
        writeDirs(item.path);
        write(
          tarEntryHeader({
            path: 'checkout/' + item.path,
            type: 'file',
            mode: item.mode === '100755' ? 0o755 : 0o644,
            size: item.content.length,
            mtime,
          }),
        );
        write(item.content);
        write(tarPadding(item.content.length));
        files += 1;
        bytes += item.content.length;
        cursor += 1;
      }
    };

    const needed = items.flatMap((i) => (i.kind === 'base' ? [i.record] : []));
    if (needed.length > 0) {
      const parser = new CatFileBatchParser();
      let current: BaseRecord | null = null;
      let currentSize = 0;
      let total = 0;
      let linkChunks: Uint8Array[] = [];
      const batchRun = await stream(git, [...repo.configArgs, 'cat-file', '--batch'], {
        cwd: repo.repoDir,
        env: repo.env,
        timeoutMs: remaining(),
        stdin: { kind: 'bytes', bytes: Buffer.from(needed.map((r) => r.id + '\n').join('')) },
        output: {
          kind: 'sink',
          stderrMaxBytes: 65536,
          onStdout: (chunk) => {
            const pushed = parser.push(chunk);
            if (!pushed.ok) {
              failure = fetchFailed('The object stream is malformed.');
              return 'stop';
            }
            for (const event of pushed.events) {
              if (event.kind === 'missing') {
                failure = fetchFailed('An object is missing.');
                return 'stop';
              }
              if (event.kind === 'object') {
                flushOverlays();
                const item = items[cursor];
                if (item === undefined || item.kind !== 'base' || item.record.id !== event.id || event.type !== 'blob') {
                  failure = fetchFailed('The object stream is out of order.');
                  return 'stop';
                }
                total += event.size;
                if (total > limits.checkoutBytes) {
                  failure = tooLarge('The checkout has too many bytes.');
                  return 'stop';
                }
                const isLink = item.record.mode === '120000';
                if (isLink && event.size > CHECKOUT_PATH_MAX_BYTES) {
                  failure = pathInvalid(item.record.path, 'length');
                  return 'stop';
                }
                current = item.record;
                currentSize = event.size;
                linkChunks = [];
                if (!isLink) {
                  writeDirs(current.path);
                  write(
                    tarEntryHeader({
                      path: 'checkout/' + current.path,
                      type: 'file',
                      mode: current.mode === '100755' ? 0o755 : 0o644,
                      size: event.size,
                      mtime,
                    }),
                  );
                }
              } else if (current === null) {
                failure = fetchFailed('The object stream is out of order.');
                return 'stop';
              } else if (event.kind === 'data') {
                if (current.mode === '120000') linkChunks.push(event.bytes);
                else write(event.bytes);
              } else {
                if (current.mode === '120000') {
                  const target = Buffer.concat(linkChunks);
                  let text = '';
                  let valid = checkSymlinkTarget(target) === null;
                  if (valid) {
                    try {
                      text = new TextDecoder('utf-8', { fatal: true }).decode(target);
                    } catch {
                      valid = false;
                    }
                  }
                  if (!valid) {
                    failure = pathInvalid(current.path, 'symlink-target');
                    return 'stop';
                  }
                  writeDirs(current.path);
                  write(
                    tarEntryHeader({
                      path: 'checkout/' + current.path,
                      type: 'symlink',
                      mode: 0o777,
                      size: 0,
                      mtime,
                      linkTarget: text,
                    }),
                  );
                } else {
                  write(tarPadding(currentSize));
                }
                bytes += currentSize;
                files += 1;
                cursor += 1;
                current = null;
              }
            }
            return 'continue';
          },
        },
      });
      if (failure !== null) return failure;
      if (!batchRun.ok || batchRun.value.stopReason !== null || batchRun.value.exitCode !== 0) {
        return fetchFailed('The objects could not be read.');
      }
      if (!parser.finish() || current !== null || items.slice(cursor).some((i) => i.kind === 'base')) {
        return fetchFailed('The object stream ended early.');
      }
    }
    flushOverlays();
    write(tarEndOfArchive());
    succeeded = true;
  } finally {
    fs.closeSync(fd);
    if (!succeeded) fs.rmSync(archivePath, { force: true });
  }

  return ok({
    archivePath,
    facts: {
      commit,
      tree,
      archive_sha256: 'sha256:' + hash.digest('hex'),
      files,
      bytes,
      overlays: overlay.map((e) => ({ path: e.path, blob: 'content' in e ? overlayBlobId(commit, e.content) : null })),
      skipped_submodules: skipped,
    },
  });
}
