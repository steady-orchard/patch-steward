import type { Result } from '../result.js';
import { ok, err } from '../result.js';
import type { GitReadOptions, GitFailureCode } from './reader.js';
import { runGitCommand, decodeGitOutput } from './command.js';

export const UPSTREAM_REMOTE_NAMES = ['upstream', 'origin'] as const;

export interface GitHubRemote {
  readonly remote: string;
  readonly owner: string;
  readonly name: string;
}

function isControlChar(codePoint: number): boolean {
  return codePoint < 0x20 || codePoint === 0x7f;
}

function hasControlChar(text: string): boolean {
  for (let index = 0; index < text.length; index += 1) {
    if (isControlChar(text.charCodeAt(index))) {
      return true;
    }
  }
  return false;
}

export async function listRemoteNames(options: GitReadOptions): Promise<Result<readonly string[], GitFailureCode>> {
  const result = await runGitCommand(options, ['remote'], options.maxOutputBytes);
  if (!result.ok) {
    return result;
  }
  const { exitCode, stdout } = result.value;
  if (exitCode !== 0) {
    return err('git.failed', 'infrastructure', 'The git process terminated abnormally.');
  }

  const decoded = decodeGitOutput(stdout);
  if (!decoded.ok) {
    return decoded;
  }

  const lines = decoded.value.split('\n');
  const names: string[] = [];
  for (let line of lines) {
    if (line.endsWith('\r')) {
      line = line.slice(0, -1);
    }
    if (line.length === 0) {
      continue;
    }
    if (line.length > 255 || hasControlChar(line)) {
      return err('git.malformed-output', 'infrastructure', 'Git produced a remote name that was malformed.');
    }
    names.push(line);
  }
  return ok(names);
}

function isInvalidRemoteName(remote: string): boolean {
  if (remote.length === 0 || remote.length > 255) {
    return true;
  }
  if (remote.charAt(0) === '-') {
    return true;
  }
  return hasControlChar(remote);
}

export async function readRemoteUrl(options: GitReadOptions, remote: string): Promise<Result<string, GitFailureCode>> {
  if (isInvalidRemoteName(remote)) {
    return err('git.invalid-ref', 'steward-defect', 'The remote name supplied was not valid.');
  }

  const result = await runGitCommand(options, ['remote', 'get-url', '--end-of-options', remote], options.maxOutputBytes);
  if (!result.ok) {
    return result;
  }
  const { exitCode, stdout } = result.value;
  if (exitCode !== 0) {
    return err('git.failed', 'infrastructure', 'The git process terminated abnormally.');
  }

  const decoded = decodeGitOutput(stdout);
  if (!decoded.ok) {
    return decoded;
  }
  let text = decoded.value;
  if (text.endsWith('\n')) {
    text = text.slice(0, -1);
  }
  if (text.endsWith('\r')) {
    text = text.slice(0, -1);
  }
  if (text.length === 0 || text.length > 2048 || hasControlChar(text)) {
    return err('git.malformed-output', 'infrastructure', 'Git produced a remote URL that was malformed.');
  }
  return ok(text);
}

const GITHUB_REMOTE_PATTERN = /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)(.*)$/i;
const OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;

export function gitHubRepositoryFromRemoteUrl(url: string): { readonly owner: string; readonly name: string } | null {
  const match = GITHUB_REMOTE_PATTERN.exec(url);
  if (!match) {
    return null;
  }
  const rest = match[1] as string;
  const parts = rest.split('/');
  if (parts.length !== 2) {
    return null;
  }
  const owner = parts[0] as string;
  let name = parts[1] as string;
  if (!OWNER_PATTERN.test(owner)) {
    return null;
  }
  if (name.endsWith('.git')) {
    name = name.slice(0, -4);
  }
  if (name === '.' || name === '..' || !REPO_PATTERN.test(name)) {
    return null;
  }
  return { owner, name };
}

export async function findUpstreamRemote(options: GitReadOptions): Promise<Result<GitHubRemote | null, GitFailureCode>> {
  const namesResult = await listRemoteNames(options);
  if (!namesResult.ok) {
    return namesResult;
  }
  const names = namesResult.value;

  for (const candidate of UPSTREAM_REMOTE_NAMES) {
    if (!names.includes(candidate)) {
      continue;
    }
    const urlResult = await readRemoteUrl(options, candidate);
    if (!urlResult.ok) {
      return urlResult;
    }
    const parsed = gitHubRepositoryFromRemoteUrl(urlResult.value);
    if (parsed !== null) {
      return ok({ remote: candidate, owner: parsed.owner, name: parsed.name });
    }
  }
  return ok(null);
}
