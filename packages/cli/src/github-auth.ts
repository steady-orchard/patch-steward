import type { ProcessRunner } from '@patch-steward/core';
import { GH_AUTH_TOKEN_OUTPUT_MAX_BYTES, GH_AUTH_TOKEN_TIMEOUT_MS, runProcess } from '@patch-steward/core';

export const GITHUB_TOKEN_VARIABLES = ['GH_TOKEN', 'GITHUB_TOKEN'] as const;
export const GH_AUTH_TOKEN_ARGS = ['auth', 'token', '--hostname', 'github.com'] as const;
export const GH_ENV_EXCLUDED_VARIABLES = [
  'GH_TOKEN',
  'GITHUB_TOKEN',
  'GH_ENTERPRISE_TOKEN',
  'GITHUB_ENTERPRISE_TOKEN',
  'GH_HOST',
] as const;
export const GITHUB_AUTH_FAILURE_CODES = ['auth.token-invalid'] as const;

export type GitHubAuthFailureCode = (typeof GITHUB_AUTH_FAILURE_CODES)[number];
export type GitHubTokenSource = 'GH_TOKEN' | 'GITHUB_TOKEN' | 'gh' | 'none';

export interface GitHubAuth {
  readonly token: string | null;
  readonly source: GitHubTokenSource;
}

export interface GitHubAuthOptions {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly cwd: string;
  readonly runner?: ProcessRunner;
  readonly ghBinary?: string;
}

export type GitHubAuthResult =
  | { readonly ok: true; readonly auth: GitHubAuth }
  | { readonly ok: false; readonly code: GitHubAuthFailureCode; readonly message: string };

// Printable ASCII, no space: the same rule the core GitHub client applies to its Authorization header.
const TOKEN_PATTERN = /^[\x21-\x7e]{1,4096}$/;

export async function resolveGitHubAuth(options: GitHubAuthOptions): Promise<GitHubAuthResult> {
  for (const name of GITHUB_TOKEN_VARIABLES) {
    const value = options.env[name];
    if (value === undefined || value === '') continue;
    if (!TOKEN_PATTERN.test(value)) {
      return { ok: false, code: 'auth.token-invalid', message: `${name} is set but is not a usable GitHub token.` };
    }
    return { ok: true, auth: { token: value, source: name } };
  }

  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(options.env)) {
    if (value === undefined) continue;
    if ((GH_ENV_EXCLUDED_VARIABLES as readonly string[]).includes(key.toUpperCase())) continue;
    env[key] = value;
  }

  const result = await (options.runner ?? runProcess)(options.ghBinary ?? 'gh', [...GH_AUTH_TOKEN_ARGS], {
    cwd: options.cwd,
    env,
    timeoutMs: GH_AUTH_TOKEN_TIMEOUT_MS,
    maxOutputBytes: GH_AUTH_TOKEN_OUTPUT_MAX_BYTES,
  });

  if (!result.ok || result.value.exitCode !== 0) {
    return { ok: true, auth: { token: null, source: 'none' } };
  }

  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(result.value.stdout);
  } catch {
    return { ok: true, auth: { token: null, source: 'none' } };
  }

  text = text.endsWith('\n') ? text.slice(0, -1) : text;
  text = text.endsWith('\r') ? text.slice(0, -1) : text;

  if (!TOKEN_PATTERN.test(text)) {
    return { ok: true, auth: { token: null, source: 'none' } };
  }

  return { ok: true, auth: { token: text, source: 'gh' } };
}
