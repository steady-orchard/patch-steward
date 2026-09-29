import fs from 'node:fs';
import path from 'node:path';

const CMD_METACHARACTERS = new Set(['(', ')', '[', ']', '%', '!', '^', '"', '`', '<', '>', '&', '|', ';', ',', ' ', '*', '?']);
const BACKSLASH = String.fromCharCode(92);
const QUOTE = '"';

export function escapeForCmd(text: string): string {
  let out = '';
  for (const ch of text) out += CMD_METACHARACTERS.has(ch) ? '^' + ch : ch;
  return out;
}

export function quoteWindowsArgument(arg: string): string {
  let out = QUOTE;
  let backslashes = 0;
  for (const ch of arg) {
    if (ch === BACKSLASH) {
      backslashes += 1;
      continue;
    }
    if (ch === QUOTE) out += BACKSLASH.repeat(backslashes * 2 + 1) + QUOTE;
    else out += BACKSLASH.repeat(backslashes) + ch;
    backslashes = 0;
  }
  return out + BACKSLASH.repeat(backslashes * 2) + QUOTE;
}

// Batch shims re-parse their arguments, so the quoted argument is caret-escaped twice.
export function cmdShimCommandLine(shimPath: string, args: readonly string[]): string {
  return [escapeForCmd(shimPath), ...args.map((arg) => escapeForCmd(escapeForCmd(quoteWindowsArgument(arg))))].join(' ');
}

export interface PlatformCommandOptions {
  readonly platform: NodeJS.Platform;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly fileExists?: (path: string) => boolean;
}

export interface PlatformCommand {
  readonly binary: string;
  readonly args: readonly string[];
  readonly windowsVerbatimArguments: boolean;
  readonly viaCmd: boolean;
}

function envLookup(env: Readonly<Record<string, string | undefined>>, name: string): string | undefined {
  const key = Object.keys(env).find((k) => k.toUpperCase() === name);
  return key === undefined ? undefined : env[key];
}

function defaultFileExists(p: string): boolean {
  return fs.statSync(p, { throwIfNoEntry: false })?.isFile() === true;
}

export function findWindowsExecutable(
  name: string,
  env: Readonly<Record<string, string | undefined>>,
  fileExists: (path: string) => boolean,
): string | null {
  const exts = (envLookup(env, 'PATHEXT') ?? '.COM;.EXE;.BAT;.CMD')
    .toLowerCase()
    .split(';')
    .filter((e) => e !== '');
  const candidates = (base: string): string[] => {
    const lower = base.toLowerCase();
    const list = exts.some((e) => lower.endsWith(e)) ? [base] : [];
    return [...list, ...exts.map((e) => base + e)];
  };
  const firstExisting = (base: string): string | null => candidates(base).find((c) => fileExists(c)) ?? null;
  if (name.includes('/') || name.includes(BACKSLASH)) return firstExisting(name);
  for (const dir of (envLookup(env, 'PATH') ?? '').split(';')) {
    if (dir === '') continue;
    const found = firstExisting(path.win32.join(dir, name));
    if (found !== null) return found;
  }
  return null;
}

export function commandForPlatform(run: readonly string[], options: PlatformCommandOptions): PlatformCommand {
  const first = run[0];
  if (first === undefined) throw new TypeError('empty command');
  const direct: PlatformCommand = { binary: first, args: run.slice(1), windowsVerbatimArguments: false, viaCmd: false };
  if (options.platform !== 'win32') return direct;
  const resolved = findWindowsExecutable(first, options.env, options.fileExists ?? defaultFileExists);
  if (resolved === null || !/\.(cmd|bat)$/i.test(resolved)) return direct;
  return {
    binary: path.win32.join(envLookup(options.env, 'SYSTEMROOT') ?? 'C:/Windows', 'System32', 'cmd.exe'),
    args: ['/d', '/s', '/c', QUOTE + cmdShimCommandLine(resolved, run.slice(1)) + QUOTE],
    windowsVerbatimArguments: true,
    viaCmd: true,
  };
}
