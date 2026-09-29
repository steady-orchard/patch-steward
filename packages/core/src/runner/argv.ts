import {
  SANDBOX_CHECKOUT_PATH,
  SANDBOX_GID,
  SANDBOX_PLATFORM,
  SANDBOX_SCRATCH_PATH,
  SANDBOX_UID,
  SANDBOX_WORK_PATH,
} from '../policy/bounds.js';
import {
  RUNNER_IMAGE_REPOSITORY,
  RUNTIME_LABEL_MANAGED,
  RUNTIME_LABEL_RUN,
  RUNTIME_LABEL_RUNNER_TREE,
  RUNTIME_LABEL_TEST,
  type ContainerRuntimeName,
  type RuntimeLabels,
} from './types.js';

export interface ContainerResources {
  readonly cpus: number;
  readonly memoryMb: number;
  readonly pids: number;
  readonly scratchMb: number;
}

export interface ContainerCreateSpec {
  readonly labels: RuntimeLabels;
  readonly network: 'none' | 'egress';
  readonly resources: ContainerResources;
  readonly volume: string;
  readonly workingDirectory: string;
  readonly imageReference: string;
  readonly run: readonly string[];
}

function labelArgs(labels: RuntimeLabels): string[] {
  const out = ['--label', `${RUNTIME_LABEL_MANAGED}=true`, '--label', `${RUNTIME_LABEL_RUN}=${labels.runId}`];
  if (labels.testNonce !== null) out.push('--label', `${RUNTIME_LABEL_TEST}=${labels.testNonce}`);
  return out;
}

export function runtimeCreateArgs(runtime: ContainerRuntimeName, spec: ContainerCreateSpec): string[] {
  const [entrypoint, ...rest] = spec.run;
  if (entrypoint === undefined) throw new TypeError('run must have at least one element');
  const { cpus, memoryMb, pids, scratchMb } = spec.resources;
  const workdir = spec.workingDirectory === '.' ? SANDBOX_CHECKOUT_PATH : `${SANDBOX_CHECKOUT_PATH}/${spec.workingDirectory}`;
  return [
    'create',
    ...labelArgs(spec.labels),
    '--platform',
    SANDBOX_PLATFORM,
    '--pull',
    'never',
    '--user',
    `${SANDBOX_UID}:${SANDBOX_GID}`,
    '--read-only',
    ...(runtime === 'podman' ? ['--read-only-tmpfs=false'] : []),
    ...(spec.network === 'none' ? ['--network', 'none'] : []),
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    '--pids-limit',
    String(pids),
    '--memory',
    `${memoryMb}m`,
    '--memory-swap',
    `${memoryMb}m`,
    '--cpus',
    String(cpus),
    '--ulimit',
    'core=0:0',
    '--ipc',
    'private',
    '--cgroupns',
    'private',
    '--hostname',
    'patch-steward',
    '--log-driver',
    'none',
    '--tmpfs',
    `${SANDBOX_SCRATCH_PATH}:rw,exec,nosuid,nodev,size=${scratchMb}m,mode=1777`,
    '--mount',
    // Podman rejects the volume-nocopy mount option; its volumes only copy image content up into an empty volume.
    `type=volume,src=${spec.volume},dst=${SANDBOX_WORK_PATH}${runtime === 'podman' ? '' : ',volume-nocopy'}`,
    '--workdir',
    workdir,
    '--env',
    'HOME=/tmp',
    '--env',
    'TMPDIR=/tmp',
    '--env',
    'CI=true',
    '--entrypoint',
    entrypoint,
    spec.imageReference,
    ...rest,
  ];
}

export function runtimeWorkProbeCreateArgs(labels: RuntimeLabels, imageReference: string): string[] {
  return [
    'create',
    ...labelArgs(labels),
    '--platform',
    SANDBOX_PLATFORM,
    '--pull',
    'never',
    '--user',
    `${SANDBOX_UID}:${SANDBOX_GID}`,
    '--read-only',
    '--read-only-tmpfs=false',
    '--network',
    'none',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    '--log-driver',
    'none',
    '--entrypoint',
    '/bin/true',
    imageReference,
  ];
}

export function runtimeVolumeCreateArgs(labels: RuntimeLabels): string[] {
  return ['volume', 'create', ...labelArgs(labels)];
}

export function runtimeCopyInArgs(containerId: string): string[] {
  return ['cp', '-a', '-', `${containerId}:${SANDBOX_WORK_PATH}`];
}

export function runtimeStartArgs(containerId: string): string[] {
  return ['start', '-a', containerId];
}

export function runtimeInspectArgs(containerId: string): string[] {
  return ['container', 'inspect', containerId];
}

export function runtimeCopyOutArgs(containerId: string, containerPath: string): string[] {
  return ['cp', `${containerId}:${containerPath}`, '-'];
}

// Podman only: the Windows client cannot stream `cp` output to standard output, so a volume or container
// export stands in for the copy out.
export function runtimeVolumeExportArgs(volume: string): string[] {
  return ['volume', 'export', volume];
}

export function runtimeContainerExportArgs(containerId: string): string[] {
  return ['export', containerId];
}

export function runtimeKillArgs(containerId: string): string[] {
  return ['kill', containerId];
}

export function runtimeWaitArgs(containerId: string): string[] {
  return ['wait', containerId];
}

export function runtimeRemoveArgs(containerId: string): string[] {
  return ['rm', '-f', containerId];
}

export function runtimeVolumeRemoveArgs(volume: string): string[] {
  return ['volume', 'rm', volume];
}

export function runtimeVersionArgs(): string[] {
  return ['version', '--format', 'json'];
}

export function runtimeInfoArgs(): string[] {
  return ['info', '--format', 'json'];
}

export function runtimePullArgs(reference: string): string[] {
  return ['pull', '--platform', SANDBOX_PLATFORM, reference];
}

export function runtimeImageInspectArgs(reference: string): string[] {
  return ['image', 'inspect', reference];
}

export function runtimeBuildArgs(input: {
  readonly runnerTreeId: string;
  readonly dockerfilePath: string;
  readonly testNonce: string | null;
}): string[] {
  return [
    'build',
    '--platform',
    SANDBOX_PLATFORM,
    '--label',
    `${RUNTIME_LABEL_MANAGED}=true`,
    '--label',
    `${RUNTIME_LABEL_RUNNER_TREE}=${input.runnerTreeId}`,
    ...(input.testNonce !== null ? ['--label', `${RUNTIME_LABEL_TEST}=${input.testNonce}`] : []),
    '-t',
    `${RUNNER_IMAGE_REPOSITORY}:${input.runnerTreeId}`,
    '-f',
    input.dockerfilePath,
    '-',
  ];
}

export const RUNTIME_CLI_ENVIRONMENT_NAMES = [
  'PATH',
  'SystemRoot',
  'windir',
  'ComSpec',
  'PATHEXT',
  'TEMP',
  'TMP',
  'HOME',
  'USERPROFILE',
  'APPDATA',
  'LOCALAPPDATA',
  'ProgramData',
  'ProgramFiles',
  'XDG_RUNTIME_DIR',
  'XDG_CONFIG_HOME',
  'XDG_DATA_HOME',
  'DOCKER_HOST',
  'DOCKER_CONTEXT',
  'DOCKER_CONFIG',
  'DOCKER_CERT_PATH',
  'DOCKER_TLS_VERIFY',
  'CONTAINER_HOST',
  'CONTAINER_CONNECTION',
  'CONTAINERS_CONF',
  'CONTAINERS_STORAGE_CONF',
  'REGISTRY_AUTH_FILE',
] as const;

export function runtimeCliEnvironment(
  env: Readonly<Record<string, string | undefined>>,
  platform: NodeJS.Platform = process.platform,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of RUNTIME_CLI_ENVIRONMENT_NAMES) {
    if (platform === 'win32') {
      const upper = name.toUpperCase();
      const key = Object.keys(env).find((k) => k.toUpperCase() === upper && typeof env[k] === 'string');
      if (key !== undefined) out[name] = env[key] as string;
    } else {
      const value = env[name];
      if (typeof value === 'string') out[name] = value;
    }
  }
  return out;
}

export const RUNTIME_FORBIDDEN_FLAGS = [
  '-v',
  '--volume',
  '--privileged',
  '--cap-add',
  '--device',
  '--env-file',
  '--pid',
  '--userns',
  '--uts',
  '-i',
  '--interactive',
  '-t',
  '--tty',
  '--init',
  '--add-host',
  '--group-add',
  '--sysctl',
  '--gpus',
] as const;

const CREATE_VALUE_FLAGS: Readonly<Record<string, RegExp>> = {
  '--label': /^org\.patch-steward\.(managed=true|run=\S+|test=\S+)$/,
  '--platform': /^linux\/amd64$/,
  '--pull': /^never$/,
  '--user': /^65532:65532$/,
  '--network': /^none$/,
  '--cap-drop': /^ALL$/,
  '--security-opt': /^no-new-privileges$/,
  '--pids-limit': /^[1-9][0-9]*$/,
  '--cpus': /^[1-9][0-9]*$/,
  '--memory': /^[1-9][0-9]*m$/,
  '--memory-swap': /^[1-9][0-9]*m$/,
  '--ulimit': /^core=0:0$/,
  '--ipc': /^private$/,
  '--cgroupns': /^private$/,
  '--hostname': /^patch-steward$/,
  '--log-driver': /^none$/,
  '--tmpfs': /^\/tmp:rw,exec,nosuid,nodev,size=[1-9][0-9]*m,mode=1777$/,
  '--mount': /^type=volume,src=[A-Za-z0-9][A-Za-z0-9_.-]*,dst=\/work(,volume-nocopy)?$/,
  '--env': /^(HOME=\/tmp|TMPDIR=\/tmp|CI=true)$/,
  '--entrypoint': /^.+$/s,
};

function genericViolations(token: string, subcommand: string): string[] {
  const out: string[] = [];
  const forbidden = RUNTIME_FORBIDDEN_FLAGS.some((f) => token === f || token.startsWith(`${f}=`));
  if (forbidden && !(subcommand === 'build' && token === '-t')) out.push(`forbidden option ${token}`);
  if (token.includes('docker.sock') || token.includes('podman.sock')) out.push(`socket path ${token}`);
  return out;
}

function validWorkdir(value: string): boolean {
  if (value === SANDBOX_CHECKOUT_PATH) return true;
  return value.startsWith(`${SANDBOX_CHECKOUT_PATH}/`) && !value.split('/').includes('..');
}

function createViolations(args: readonly string[]): string[] {
  const out: string[] = [];
  let i = 1;
  while (i < args.length) {
    const token = args[i] as string;
    if (!token.startsWith('-')) return out;
    if (token === '--read-only' || token === '--read-only-tmpfs=false') {
      i += 1;
      continue;
    }
    const pattern = CREATE_VALUE_FLAGS[token];
    if (pattern !== undefined || token === '--workdir') {
      const value = args[i + 1];
      if (value === undefined) {
        out.push(`missing value for ${token}`);
        return out;
      }
      const ok = pattern === undefined ? validWorkdir(value) : pattern.test(value);
      if (!ok) out.push(`invalid value for ${token}`);
      i += 2;
      continue;
    }
    const found = genericViolations(token, 'create');
    out.push(...(found.length > 0 ? found : [`unexpected option ${token}`]));
    i += 1;
  }
  out.push('missing image');
  return out;
}

const VOLUME_EXPORT_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,254}$/;

function copyViolations(args: readonly string[]): string[] {
  const inbound = args.length === 4 && args[1] === '-a' && args[2] === '-' && /^[0-9a-f]{64}:\/work$/.test(args[3] as string);
  const outbound = args.length === 3 && args[2] === '-' && /^[0-9a-f]{64}:\/work(\/checkout(\/.*)?)?$/s.test(args[1] as string);
  return inbound || outbound ? [] : ['cp must stream through standard input or output'];
}

function exportViolations(args: readonly string[]): string[] {
  if (args[0] === 'export') {
    return args.length === 2 && /^[0-9a-f]{64}$/.test(args[1] as string) ? [] : ['export takes exactly one container id'];
  }
  return args.length === 3 && args[1] === 'export' && VOLUME_EXPORT_NAME.test(args[2] as string)
    ? []
    : ['volume export takes exactly one volume name'];
}

export function forbiddenRuntimeArguments(args: readonly string[]): string[] {
  const subcommand = args[0] ?? '';
  if (subcommand === 'create') return createViolations(args);
  const out: string[] = [];
  for (const token of args) out.push(...genericViolations(token, subcommand));
  if (subcommand === 'cp') out.push(...copyViolations(args));
  if (subcommand === 'export' || (subcommand === 'volume' && args[1] === 'export')) out.push(...exportViolations(args));
  if (subcommand === 'build') {
    if (args[args.length - 1] !== '-') out.push('build context must be standard input');
    for (const token of args) {
      if (['--secret', '--ssh', '--build-arg', '--network'].some((f) => token === f || token.startsWith(`${f}=`))) {
        out.push(`forbidden option ${token}`);
      }
    }
  }
  return out;
}
