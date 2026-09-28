import { mkdir, readFile, stat, writeFile, appendFile } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';

export const STAGING_ROOT = 'steward';

export const STAGING_PATHS = Object.freeze({
  handoff: 'handoff/handoff.json',
  'gate-context': 'handoff/gate-context.json',
  ownership: 'ownership/ownership.json',
  closure: 'closure/closure.json',
});

export type StagingFileName = keyof typeof STAGING_PATHS;

export function stagingPath(tempRoot: string, name: StagingFileName): string {
  if (!isAbsolute(tempRoot)) throw new RangeError('tempRoot must be absolute');
  return join(tempRoot, STAGING_ROOT, ...STAGING_PATHS[name].split('/'));
}

export async function writeStagingFile(tempRoot: string, name: StagingFileName, bytes: Uint8Array): Promise<void> {
  const target = stagingPath(tempRoot, name);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, bytes, { flag: 'wx' });
}

export type BoundedRead =
  | { readonly kind: 'ok'; readonly bytes: Uint8Array }
  | { readonly kind: 'missing' }
  | { readonly kind: 'too-large' }
  | { readonly kind: 'unreadable' };

export async function readBoundedFile(filePath: string, maxBytes: number): Promise<BoundedRead> {
  let info;
  try {
    info = await stat(filePath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return { kind: 'missing' };
    return { kind: 'unreadable' };
  }
  if (!info.isFile()) return { kind: 'unreadable' };
  if (info.size > maxBytes) return { kind: 'too-large' };
  try {
    const bytes = await readFile(filePath);
    if (bytes.length > maxBytes) return { kind: 'too-large' };
    return { kind: 'ok', bytes };
  } catch {
    return { kind: 'unreadable' };
  }
}

export async function appendTextFile(filePath: string, text: string): Promise<void> {
  await appendFile(filePath, text, 'utf8');
}
