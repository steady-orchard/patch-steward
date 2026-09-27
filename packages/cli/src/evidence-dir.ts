import * as fs from 'node:fs';
import * as path from 'node:path';

export const EVIDENCE_DIR_UNAVAILABLE_MESSAGE = 'The user data directory cannot be determined; pass --evidence-dir <dir>.';
export const EVIDENCE_INSIDE_CHECKOUT_MESSAGE =
  'The evidence directory is inside the git work tree of the current directory; never commit run directories.';

export interface EvidenceDirEnvironment {
  readonly platform: string;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly homedir: () => string;
}

export type EvidenceDirResult =
  | { readonly ok: true; readonly path: string }
  | { readonly ok: false; readonly code: 'screen.evidence-dir-unavailable'; readonly message: string };

function unavailable(): EvidenceDirResult {
  return { ok: false, code: 'screen.evidence-dir-unavailable', message: EVIDENCE_DIR_UNAVAILABLE_MESSAGE };
}

export function defaultEvidenceDir(environment: EvidenceDirEnvironment): EvidenceDirResult {
  let home: string;
  try {
    home = environment.homedir();
  } catch {
    home = '';
  }

  if (environment.platform === 'win32') {
    const lad = environment.env['LOCALAPPDATA'];
    if (lad !== undefined && lad !== '' && path.win32.isAbsolute(lad)) {
      return { ok: true, path: path.win32.join(lad, 'patch-steward', 'evidence') };
    }
    if (home !== '' && path.win32.isAbsolute(home)) {
      return { ok: true, path: path.win32.join(home, 'AppData', 'Local', 'patch-steward', 'evidence') };
    }
    return unavailable();
  }

  if (environment.platform === 'darwin') {
    if (home !== '' && path.posix.isAbsolute(home)) {
      return { ok: true, path: path.posix.join(home, 'Library', 'Application Support', 'patch-steward', 'evidence') };
    }
    return unavailable();
  }

  const xdg = environment.env['XDG_DATA_HOME'];
  if (xdg !== undefined && xdg !== '' && path.posix.isAbsolute(xdg)) {
    return { ok: true, path: path.posix.join(xdg, 'patch-steward', 'evidence') };
  }
  if (home !== '' && path.posix.isAbsolute(home)) {
    return { ok: true, path: path.posix.join(home, '.local', 'share', 'patch-steward', 'evidence') };
  }
  return unavailable();
}

async function defaultExists(candidate: string): Promise<boolean> {
  try {
    await fs.promises.lstat(candidate);
    return true;
  } catch {
    return false;
  }
}

export async function findWorkTreeRoot(
  start: string,
  exists: (candidate: string) => Promise<boolean> = defaultExists,
): Promise<string | null> {
  let dir = path.resolve(start);
  for (;;) {
    if (await exists(path.join(dir, '.git'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
}

export function isPathInside(parent: string, child: string): boolean {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel === '' || (rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel));
}

export type ResolvedEvidenceDirResult =
  | { readonly ok: true; readonly path: string; readonly warnings: readonly { readonly code: string; readonly message: string }[] }
  | { readonly ok: false; readonly code: 'screen.evidence-dir-unavailable'; readonly message: string };

export async function resolveEvidenceDir(input: {
  readonly given: string | null;
  readonly cwd: string;
  readonly environment: EvidenceDirEnvironment;
}): Promise<ResolvedEvidenceDirResult> {
  if (input.given !== null) {
    const abs = path.resolve(input.cwd, input.given);
    const root = await findWorkTreeRoot(input.cwd);
    const warnings =
      root !== null && isPathInside(root, abs)
        ? [{ code: 'screen.evidence-inside-checkout', message: EVIDENCE_INSIDE_CHECKOUT_MESSAGE }]
        : [];
    return { ok: true, path: abs, warnings };
  }

  const defaulted = defaultEvidenceDir(input.environment);
  if (!defaulted.ok) {
    return defaulted;
  }
  return { ok: true, path: defaulted.path, warnings: [] };
}
