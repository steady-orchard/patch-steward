import os from 'node:os';
import { z } from 'zod';
import type { CapturedOutput } from '../execution/output-capture.js';
import { TarStreamParser } from '../archive/tar-read.js';
import {
  RUNTIME_CONTROL_OUTPUT_MAX_BYTES,
  RUNTIME_CONTROL_TIMEOUT_MS,
  RUNTIME_KILL_GRACE_MS,
  SANDBOX_WORK_PATH,
} from '../policy/bounds.js';
import type { ResolvedPolicy } from '../policy/schema.js';
import { runProcess, type ProcessRunner } from '../process/run-process.js';
import { streamProcess, type StreamProcessRunner } from '../process/stream-process.js';
import { err, ok, type Result } from '../result.js';
import {
  runtimeBuildArgs,
  runtimeContainerExportArgs,
  runtimeCopyOutArgs,
  runtimeImageInspectArgs,
  runtimePullArgs,
  runtimeRemoveArgs,
  runtimeWorkProbeCreateArgs,
} from './argv.js';
import type { RunnerBuildContext } from './build-context.js';
import { PODMAN_STDOUT_COPY_UNSUPPORTED } from './copy-out.js';
import { RUNNER_IMAGE_REPOSITORY, RUNTIME_LABEL_RUNNER_TREE, type ResolvedImage, type SelectedRuntime } from './types.js';

export interface ImageLimits {
  readonly pullSeconds: number;
  readonly buildSeconds: number;
  readonly imageBytes: number;
  readonly buildOutputStreamBytes: number;
}

export function imageLimitsFromPolicy(policy: ResolvedPolicy): ImageLimits {
  const execution = policy.limits.execution;
  return {
    pullSeconds: execution.image_pull_seconds,
    buildSeconds: execution.image_build_seconds,
    imageBytes: execution.image_bytes,
    buildOutputStreamBytes: execution.output_stream_bytes,
  };
}

export interface RunnerImageContext {
  readonly runtime: SelectedRuntime;
  readonly testNonce: string | null;
  readonly control?: ProcessRunner;
  readonly stream?: StreamProcessRunner;
  readonly runId?: string;
}

export type RunnerImageSpec =
  | { readonly source: 'registry'; readonly reference: string }
  | { readonly source: 'dockerfile'; readonly context: RunnerBuildContext };

export type ImageFailureCode =
  | 'runner.image-pull-failed'
  | 'runner.image-digest-mismatch'
  | 'runner.image-too-large'
  | 'runner.image-build-failed'
  | 'runner.inspect-invalid'
  | 'runner.create-failed'
  | 'runner.copy-failed'
  | 'runner.cleanup-failed';

export interface PreparedRunnerImage {
  readonly result: Result<ResolvedImage, ImageFailureCode>;
  readonly buildLog: CapturedOutput | null;
}

export const imageInspectSchema = z
  .array(
    z.object({
      Id: z.string(),
      RepoDigests: z.array(z.string()).nullable().optional(),
      Size: z.number().int().min(0),
      Config: z
        .object({ Labels: z.record(z.string(), z.string()).nullable().optional() })
        .nullable()
        .optional(),
      Labels: z.record(z.string(), z.string()).nullable().optional(),
    }),
  )
  .length(1);

const DIGEST = /^sha256:[0-9a-f]{64}$/;

export function imageRepository(reference: string): string {
  const unpinned = reference.replace(/@sha256:[0-9a-f]{64}$/, '');
  const slash = unpinned.lastIndexOf('/');
  const colon = unpinned.indexOf(':', slash + 1);
  return colon === -1 ? unpinned : unpinned.slice(0, colon);
}

export function normalizeImageRepository(repository: string): string {
  const slash = repository.indexOf('/');
  if (slash === -1) return `docker.io/library/${repository}`;
  const first = repository.slice(0, slash);
  if (first.includes('.') || first.includes(':') || first === 'localhost') {
    const registry = first === 'index.docker.io' ? 'docker.io' : first;
    const rest = repository.slice(slash + 1);
    if (registry === 'docker.io' && !rest.includes('/')) return `docker.io/library/${rest}`;
    return `${registry}/${rest}`;
  }
  return `docker.io/${repository}`;
}

interface Inspected {
  readonly id: string;
  readonly repoDigests: readonly string[];
  readonly size: number;
  readonly labels: Readonly<Record<string, string>>;
}

type InspectOutcome =
  { readonly kind: 'failed' } | { readonly kind: 'invalid' } | { readonly kind: 'ok'; readonly image: Inspected };

function fail(code: ImageFailureCode, message: string, buildLog: CapturedOutput | null = null): PreparedRunnerImage {
  return { result: err(code, 'environment-unavailable', message), buildLog };
}

async function inspect(ctx: RunnerImageContext, reference: string): Promise<InspectOutcome> {
  const control = ctx.control ?? runProcess;
  const run = await control(ctx.runtime.binary, runtimeImageInspectArgs(reference), {
    cwd: os.tmpdir(),
    env: ctx.runtime.env,
    timeoutMs: RUNTIME_CONTROL_TIMEOUT_MS,
    maxOutputBytes: RUNTIME_CONTROL_OUTPUT_MAX_BYTES,
  });
  if (!run.ok || run.value.exitCode !== 0) return { kind: 'failed' };
  let json: unknown;
  try {
    json = JSON.parse(run.value.stdout.toString('utf8'));
  } catch {
    return { kind: 'invalid' };
  }
  const parsed = imageInspectSchema.safeParse(json);
  const entry = parsed.success ? parsed.data[0] : undefined;
  if (entry === undefined) return { kind: 'invalid' };
  let id: string;
  if (DIGEST.test(entry.Id)) id = entry.Id;
  else if (/^[0-9a-f]{64}$/.test(entry.Id)) id = `sha256:${entry.Id}`;
  else return { kind: 'invalid' };
  return {
    kind: 'ok',
    image: { id, repoDigests: entry.RepoDigests ?? [], size: entry.Size, labels: entry.Config?.Labels ?? entry.Labels ?? {} },
  };
}

const INVALID_INSPECT = 'The runner image inspection output is invalid.';

async function prepareRegistry(ctx: RunnerImageContext, reference: string, limits: ImageLimits): Promise<PreparedRunnerImage> {
  const control = ctx.control ?? runProcess;
  const pull = await control(ctx.runtime.binary, runtimePullArgs(reference), {
    cwd: os.tmpdir(),
    env: ctx.runtime.env,
    timeoutMs: limits.pullSeconds * 1000,
    maxOutputBytes: RUNTIME_CONTROL_OUTPUT_MAX_BYTES,
  });
  if (!pull.ok || pull.value.exitCode !== 0) return fail('runner.image-pull-failed', 'The runner image could not be pulled.');
  const inspected = await inspect(ctx, reference);
  if (inspected.kind === 'failed') return fail('runner.image-pull-failed', 'The pulled runner image could not be inspected.');
  if (inspected.kind === 'invalid') return fail('runner.inspect-invalid', INVALID_INSPECT);
  const image = inspected.image;
  const repository = imageRepository(reference);
  const want = normalizeImageRepository(repository);
  const pinned = /@(sha256:[0-9a-f]{64})$/.exec(reference);
  let digest: string | null = null;
  for (const entry of image.repoDigests) {
    const at = entry.lastIndexOf('@');
    if (at === -1) continue;
    const candidate = entry.slice(at + 1);
    if (normalizeImageRepository(entry.slice(0, at)) !== want || !DIGEST.test(candidate)) continue;
    // Podman may list several repository digests (for example a manifest list and its platform manifest); a pinned
    // reference must match the pinned one exactly, so keep searching past a different digest.
    if (pinned !== null && candidate !== pinned[1]) {
      digest ??= candidate;
      continue;
    }
    digest = candidate;
    break;
  }
  if (digest === null) return fail('runner.image-digest-mismatch', 'The pulled image has no repository digest for the reference.');
  if (reference.includes('@sha256:') && pinned?.[1] !== digest) {
    return fail('runner.image-digest-mismatch', 'The pulled image digest differs from the pinned digest.');
  }
  if (image.size > limits.imageBytes) return fail('runner.image-too-large', 'The runner image exceeds the size limit.');
  return {
    result: ok({
      source: 'registry',
      reference,
      digest,
      id: image.id,
      runnerTreeId: null,
      cached: false,
      runReference: `${repository}@${digest}`,
    }),
    buildLog: null,
  };
}

async function prepareDockerfile(
  ctx: RunnerImageContext,
  context: RunnerBuildContext,
  limits: ImageLimits,
): Promise<PreparedRunnerImage> {
  const tag = `${RUNNER_IMAGE_REPOSITORY}:${context.runnerTreeId}`;
  let buildLog: CapturedOutput | null = null;
  let cached = true;
  let inspected = await inspect(ctx, tag);
  if (inspected.kind === 'invalid') return fail('runner.inspect-invalid', INVALID_INSPECT);
  if (inspected.kind === 'failed' || inspected.image.labels[RUNTIME_LABEL_RUNNER_TREE] !== context.runnerTreeId) {
    cached = false;
    const stream = ctx.stream ?? streamProcess;
    const built = await stream(
      ctx.runtime.binary,
      runtimeBuildArgs({ runnerTreeId: context.runnerTreeId, dockerfilePath: context.dockerfilePath, testNonce: ctx.testNonce }),
      {
        cwd: os.tmpdir(),
        env: ctx.runtime.env,
        timeoutMs: limits.buildSeconds * 1000,
        stdin: { kind: 'bytes', bytes: context.archive },
        output: {
          kind: 'capture',
          limits: { headBytes: 262144, tailBytes: 786432, streamBytes: limits.buildOutputStreamBytes },
        },
      },
    );
    if (built.ok) buildLog = built.value.captured;
    if (!built.ok || built.value.stopReason !== null || built.value.exitCode !== 0) {
      return fail('runner.image-build-failed', 'The runner image build failed.', buildLog);
    }
    inspected = await inspect(ctx, tag);
    if (inspected.kind === 'invalid') return fail('runner.inspect-invalid', INVALID_INSPECT, buildLog);
    if (inspected.kind === 'failed' || inspected.image.labels[RUNTIME_LABEL_RUNNER_TREE] !== context.runnerTreeId) {
      return fail('runner.image-build-failed', 'The built runner image could not be verified.', buildLog);
    }
  }
  if (inspected.image.size > limits.imageBytes) {
    return fail('runner.image-too-large', 'The runner image exceeds the size limit.', buildLog);
  }
  return {
    result: ok({
      source: 'dockerfile',
      reference: tag,
      digest: null,
      id: inspected.image.id,
      runnerTreeId: context.runnerTreeId,
      cached,
      runReference: inspected.image.id,
    }),
    buildLog,
  };
}

const WORK_NOT_FOUND = /no such file or directory|could not find the file/i;
const CONTAINER_ID = /^[0-9a-f]{64}$/;

function probeFailure(
  code: ImageFailureCode,
  message: string,
  details?: Parameters<typeof err>[3],
): Result<never, ImageFailureCode> {
  return details === undefined
    ? err(code, 'environment-unavailable', message)
    : err(code, 'environment-unavailable', message, details);
}

type CopyVerdict = 'pass' | 'refused' | 'copy-failed';

// Podman 6.1.2 Windows client: `cp <id>:/work -` cannot write to standard output, so the never-started probe
// container's whole filesystem is exported and only the entries at or below `work` are judged.
async function probeWorkExport(ctx: RunnerImageContext, containerId: string): Promise<CopyVerdict> {
  const stream = ctx.stream ?? streamProcess;
  const parser = new TarStreamParser();
  let sawWork = false;
  let refused = false;
  let pushFailed = false;
  const run = await stream(ctx.runtime.binary, runtimeContainerExportArgs(containerId), {
    cwd: os.tmpdir(),
    env: ctx.runtime.env,
    timeoutMs: RUNTIME_CONTROL_TIMEOUT_MS,
    stdin: { kind: 'closed' },
    output: {
      kind: 'sink',
      onStdout: (chunk) => {
        const pushed = parser.push(chunk);
        if (!pushed.ok) {
          pushFailed = true;
          return 'stop';
        }
        for (const event of pushed.value) {
          if (event.kind !== 'entry') continue;
          const at = event.entry.path;
          if (at !== SANDBOX_WORK_PATH.slice(1) && !at.startsWith(`${SANDBOX_WORK_PATH.slice(1)}/`)) continue;
          if (sawWork || at !== SANDBOX_WORK_PATH.slice(1) || event.entry.kind !== 'directory') {
            refused = true;
            return 'stop';
          }
          sawWork = true;
        }
        return 'continue';
      },
      stderrMaxBytes: RUNTIME_CONTROL_OUTPUT_MAX_BYTES,
    },
  });
  if (!run.ok) return 'copy-failed';
  const { exitCode, stopReason } = run.value;
  if (refused) return 'refused';
  if (stopReason !== null || pushFailed || exitCode !== 0) return 'copy-failed';
  return parser.finish().ok ? 'pass' : 'copy-failed';
}

async function probeWorkCopy(ctx: RunnerImageContext, containerId: string): Promise<CopyVerdict> {
  const stream = ctx.stream ?? streamProcess;
  const parser = new TarStreamParser();
  let bytes = 0;
  let entries = 0;
  let refused = false;
  let pushFailed = false;
  const run = await stream(ctx.runtime.binary, runtimeCopyOutArgs(containerId, SANDBOX_WORK_PATH), {
    cwd: os.tmpdir(),
    env: ctx.runtime.env,
    timeoutMs: RUNTIME_CONTROL_TIMEOUT_MS,
    stdin: { kind: 'closed' },
    output: {
      kind: 'sink',
      onStdout: (chunk) => {
        bytes += chunk.length;
        const pushed = parser.push(chunk);
        if (!pushed.ok) {
          pushFailed = true;
          return 'stop';
        }
        for (const event of pushed.value) {
          if (event.kind !== 'entry') continue;
          entries += 1;
          if (entries > 1 || event.entry.kind !== 'directory' || event.entry.path !== 'work') {
            refused = true;
            return 'stop';
          }
        }
        return 'continue';
      },
      stderrMaxBytes: RUNTIME_CONTROL_OUTPUT_MAX_BYTES,
    },
  });
  if (!run.ok) return 'copy-failed';
  const { exitCode, stopReason, stderr } = run.value;
  if (stopReason === 'timeout' || stopReason === 'output-limit') return 'copy-failed';
  if (refused) return 'refused';
  if (pushFailed) return 'copy-failed';
  if (exitCode !== 0) {
    const text = new TextDecoder('utf-8').decode(stderr);
    if (bytes === 0 && PODMAN_STDOUT_COPY_UNSUPPORTED.test(text)) return probeWorkExport(ctx, containerId);
    return bytes === 0 && WORK_NOT_FOUND.test(text) ? 'pass' : 'copy-failed';
  }
  if (!parser.finish().ok) return 'copy-failed';
  return entries === 1 ? 'pass' : 'refused';
}

async function probeImageWork(ctx: RunnerImageContext, imageReference: string): Promise<Result<void, ImageFailureCode>> {
  const createFailed = probeFailure('runner.create-failed', 'The runner image probe could not be created.');
  if (ctx.runId === undefined) return createFailed;
  const control = ctx.control ?? runProcess;
  const created = await control(
    ctx.runtime.binary,
    runtimeWorkProbeCreateArgs({ runId: ctx.runId, testNonce: ctx.testNonce }, imageReference),
    {
      cwd: os.tmpdir(),
      env: ctx.runtime.env,
      timeoutMs: RUNTIME_CONTROL_TIMEOUT_MS,
      maxOutputBytes: RUNTIME_CONTROL_OUTPUT_MAX_BYTES,
    },
  );
  if (!created.ok || created.value.exitCode !== 0) return createFailed;
  const lines = created.value.stdout
    .toString('utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '');
  const probeId = lines[lines.length - 1];
  if (probeId === undefined || !CONTAINER_ID.test(probeId)) return createFailed;
  let verdict: CopyVerdict;
  let removed: Awaited<ReturnType<ProcessRunner>>;
  try {
    verdict = await probeWorkCopy(ctx, probeId);
  } finally {
    removed = await control(ctx.runtime.binary, runtimeRemoveArgs(probeId), {
      cwd: os.tmpdir(),
      env: ctx.runtime.env,
      timeoutMs: RUNTIME_KILL_GRACE_MS,
      maxOutputBytes: RUNTIME_CONTROL_OUTPUT_MAX_BYTES,
    });
  }
  if (verdict === 'refused') {
    return probeFailure('runner.create-failed', 'The runner image has a non-empty /work directory.', [
      { code: 'runner.create-failed', path: SANDBOX_WORK_PATH, message: 'image-work-not-empty', line: null, column: null },
    ]);
  }
  if (verdict === 'copy-failed')
    return probeFailure('runner.copy-failed', 'The runner image /work directory could not be inspected.');
  if (!removed.ok || removed.value.exitCode !== 0) {
    return probeFailure('runner.cleanup-failed', 'The runner image probe container could not be removed.');
  }
  return ok(undefined);
}

export async function prepareRunnerImage(
  ctx: RunnerImageContext,
  spec: RunnerImageSpec,
  limits: ImageLimits,
): Promise<PreparedRunnerImage> {
  const prepared =
    spec.source === 'registry'
      ? await prepareRegistry(ctx, spec.reference, limits)
      : await prepareDockerfile(ctx, spec.context, limits);
  if (ctx.runtime.name !== 'podman' || !prepared.result.ok) return prepared;
  const probed = await probeImageWork(ctx, prepared.result.value.runReference);
  return probed.ok ? prepared : { result: probed, buildLog: prepared.buildLog };
}
