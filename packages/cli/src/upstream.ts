import type { GitHubRemote, GitHubRepositoryRef, GitReadOptions, ProcessRunner } from '@patch-steward/core';
import { GIT_OUTPUT_MAX_BYTES, GIT_TIMEOUT_MS, findUpstreamRemote } from '@patch-steward/core';

export interface CliGitContext {
  readonly cwd: string;
  readonly gitBinary?: string;
  readonly runner?: ProcessRunner;
}

export function cliGitOptions(context: CliGitContext): GitReadOptions {
  return {
    repoDir: context.cwd,
    timeoutMs: GIT_TIMEOUT_MS,
    maxOutputBytes: GIT_OUTPUT_MAX_BYTES,
    ...(context.gitBinary !== undefined ? { gitBinary: context.gitBinary } : {}),
    ...(context.runner !== undefined ? { runner: context.runner } : {}),
  };
}

export type UpstreamResult =
  | {
      readonly ok: true;
      readonly repository: GitHubRepositoryRef;
      readonly remote: GitHubRemote | null;
      readonly trackingRemote: GitHubRemote | null;
    }
  | { readonly ok: false; readonly reason: 'git-failure'; readonly code: string; readonly message: string }
  | { readonly ok: false; readonly reason: 'no-upstream' };

export async function resolveUpstream(
  explicit: GitHubRepositoryRef | null,
  gitOptions: GitReadOptions,
  options: { readonly readRemote: boolean },
): Promise<UpstreamResult> {
  let remote: GitHubRemote | null = null;
  if (explicit === null || options.readRemote) {
    const remoteResult = await findUpstreamRemote(gitOptions);
    if (!remoteResult.ok) {
      return { ok: false, reason: 'git-failure', code: remoteResult.failure.code, message: remoteResult.failure.message };
    }
    remote = remoteResult.value;
  }

  const repository: GitHubRepositoryRef | null = explicit ?? (remote !== null ? { owner: remote.owner, name: remote.name } : null);
  if (repository === null) {
    return { ok: false, reason: 'no-upstream' };
  }

  const trackingRemote =
    remote !== null &&
    remote.owner.toLowerCase() === repository.owner.toLowerCase() &&
    remote.name.toLowerCase() === repository.name.toLowerCase()
      ? remote
      : null;

  return { ok: true, repository, remote, trackingRemote };
}
