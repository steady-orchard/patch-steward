import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isObjectId } from '../git/reader.js';
import { GIT_OUTPUT_MAX_BYTES } from '../policy/bounds.js';
import { runProcess, type ProcessRunner } from '../process/run-process.js';
import { err, ok, type Result } from '../result.js';

export type FetchSource =
  | { readonly kind: 'github'; readonly owner: string; readonly name: string }
  | { readonly kind: 'local-path'; readonly path: string };

export interface FetchCommitInput {
  readonly source: FetchSource;
  readonly commit: string;
  readonly token: string | null;
  readonly hostEnv: Readonly<Record<string, string | undefined>>;
  readonly timeoutMs: number;
  readonly runner?: ProcessRunner;
  readonly gitBinary?: string;
}

export interface FetchedRepository {
  readonly repoDir: string;
  readonly env: Readonly<Record<string, string>>;
  readonly configArgs: readonly string[];
  dispose(): Promise<void>;
}

export type FetchFailureCode = 'materialize.fetch-failed' | 'materialize.commit-mismatch';

export function githubFetchUrl(owner: string, name: string): string {
  return `https://github.com/${owner}/${name}.git`;
}

export function materializeGitEnvironment(
  hostEnv: Readonly<Record<string, string | undefined>>,
  globalConfigPath: string,
  token: string | null,
): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(hostEnv)) {
    if (value === undefined) continue;
    const upper = key.toUpperCase();
    if (upper.startsWith('GIT_') || upper === 'SSH_ASKPASS') continue;
    env[key] = value;
  }
  env['GIT_CONFIG_NOSYSTEM'] = '1';
  env['GIT_CONFIG_GLOBAL'] = globalConfigPath;
  env['GIT_TERMINAL_PROMPT'] = '0';
  if (token !== null) {
    env['GIT_CONFIG_COUNT'] = '1';
    env['GIT_CONFIG_KEY_0'] = 'http.https://github.com/.extraheader';
    env['GIT_CONFIG_VALUE_0'] = 'AUTHORIZATION: basic ' + Buffer.from('x-access-token:' + token, 'utf8').toString('base64');
  }
  return env;
}

function failFetch() {
  return err('materialize.fetch-failed', 'environment-unavailable', 'The commit could not be fetched.');
}

export async function fetchCommit(input: FetchCommitInput): Promise<Result<FetchedRepository, FetchFailureCode>> {
  const { source, commit } = input;
  if (!isObjectId(commit)) return failFetch();
  const runner = input.runner ?? runProcess;
  const binary = input.gitBinary ?? 'git';
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-steward-fetch-'));
  const remove = (): void => fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  try {
    fs.mkdirSync(path.join(root, 'hooks'));
    fs.writeFileSync(path.join(root, 'gitconfig'), '');
    const repoDir = path.join(root, 'repo.git');
    const github = source.kind === 'github';
    const env = materializeGitEnvironment(input.hostEnv, path.join(root, 'gitconfig'), github ? input.token : null);
    const configArgs = [
      '-c',
      'core.hooksPath=' + path.join(root, 'hooks'),
      '-c',
      'core.fsmonitor=false',
      '-c',
      'fetch.fsckObjects=true',
      '-c',
      'transfer.fsckObjects=true',
      '-c',
      'protocol.allow=never',
      '-c',
      github ? 'protocol.https.allow=always' : 'protocol.file.allow=always',
      '-c',
      'credential.helper=',
      '-c',
      'submodule.recurse=false',
      '-c',
      'fetch.recurseSubmodules=false',
      '-c',
      'core.askPass=',
    ];
    const url = source.kind === 'github' ? githubFetchUrl(source.owner, source.name) : source.path;
    const started = Date.now();
    const run = (args: readonly string[], cwd: string) =>
      runner(binary, args, {
        cwd,
        env,
        timeoutMs: Math.max(1, input.timeoutMs - (Date.now() - started)),
        maxOutputBytes: GIT_OUTPUT_MAX_BYTES,
      });

    const init = await run(['init', '--bare', '-q', repoDir], root);
    if (!init.ok || init.value.exitCode !== 0) {
      remove();
      return failFetch();
    }
    const fetched = await run(
      [
        ...configArgs,
        'fetch',
        '--no-tags',
        '--no-recurse-submodules',
        '--no-write-fetch-head',
        '--depth=1',
        '--end-of-options',
        url,
        commit,
      ],
      repoDir,
    );
    if (!fetched.ok || fetched.value.exitCode !== 0) {
      remove();
      return failFetch();
    }
    const verify = await run([...configArgs, 'rev-parse', '--verify', '--end-of-options', commit + '^{commit}'], repoDir);
    if (!verify.ok) {
      remove();
      return failFetch();
    }
    if (verify.value.exitCode !== 0 || verify.value.stdout.toString('utf8').replace(/[\r\n]+$/, '') !== commit) {
      remove();
      return err('materialize.commit-mismatch', 'environment-unavailable', 'The fetched object is not the requested commit.');
    }
    return ok({
      repoDir,
      env,
      configArgs,
      dispose: () => fs.promises.rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }),
    });
  } catch {
    remove();
    return failFetch();
  }
}
