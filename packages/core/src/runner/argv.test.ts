import { describe, expect, it } from 'vitest';
import {
  forbiddenRuntimeArguments,
  runtimeBuildArgs,
  runtimeCliEnvironment,
  runtimeCopyInArgs,
  runtimeCopyOutArgs,
  runtimeContainerExportArgs,
  runtimeCreateArgs,
  runtimeImageInspectArgs,
  runtimeInfoArgs,
  runtimeInspectArgs,
  runtimeKillArgs,
  runtimePullArgs,
  runtimeRemoveArgs,
  runtimeStartArgs,
  runtimeVersionArgs,
  runtimeVolumeCreateArgs,
  runtimeVolumeExportArgs,
  runtimeVolumeRemoveArgs,
  runtimeWaitArgs,
  runtimeWorkProbeCreateArgs,
  type ContainerCreateSpec,
} from './argv.js';

const image = 'docker.io/library/busybox@sha256:' + 'a'.repeat(64);
const id = 'f'.repeat(64);
const spec: ContainerCreateSpec = {
  labels: { runId: 'local-20261003T101500Z-3f9a1c2e', testNonce: 'n0nce' },
  network: 'none',
  resources: { cpus: 2, memoryMb: 4096, pids: 512, scratchMb: 1024 },
  volume: 'vol1',
  workingDirectory: 'pkg/app',
  imageReference: image,
  run: ['sh', '-c', 'echo hi'],
};

function dockerExpected(): string[] {
  return [
    'create',
    '--label',
    'org.patch-steward.managed=true',
    '--label',
    'org.patch-steward.run=local-20261003T101500Z-3f9a1c2e',
    '--label',
    'org.patch-steward.test=n0nce',
    '--platform',
    'linux/amd64',
    '--pull',
    'never',
    '--user',
    '65532:65532',
    '--read-only',
    '--network',
    'none',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    '--pids-limit',
    '512',
    '--memory',
    '4096m',
    '--memory-swap',
    '4096m',
    '--cpus',
    '2',
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
    '/tmp:rw,exec,nosuid,nodev,size=1024m,mode=1777',
    '--mount',
    'type=volume,src=vol1,dst=/work,volume-nocopy',
    '--workdir',
    '/work/checkout/pkg/app',
    '--env',
    'HOME=/tmp',
    '--env',
    'TMPDIR=/tmp',
    '--env',
    'CI=true',
    '--entrypoint',
    'sh',
    image,
    '-c',
    'echo hi',
  ];
}

describe('container runtime argument vectors', () => {
  it('builds the docker create arguments exactly', () => {
    expect(runtimeCreateArgs('docker', spec)).toEqual(dockerExpected());
  });

  it('builds the podman create arguments exactly', () => {
    const expected = dockerExpected();
    expected.splice(expected.indexOf('--read-only') + 1, 0, '--read-only-tmpfs=false');
    expected[expected.indexOf('--mount') + 1] = 'type=volume,src=vol1,dst=/work';
    expect(runtimeCreateArgs('podman', spec)).toEqual(expected);
  });

  it('podman /work probe: builds the probe create arguments exactly', () => {
    const rest = [
      '--platform',
      'linux/amd64',
      '--pull',
      'never',
      '--user',
      '65532:65532',
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
      image,
    ];
    expect(runtimeWorkProbeCreateArgs({ runId: 'r1', testNonce: 'n0nce' }, image)).toEqual([
      'create',
      '--label',
      'org.patch-steward.managed=true',
      '--label',
      'org.patch-steward.run=r1',
      '--label',
      'org.patch-steward.test=n0nce',
      ...rest,
    ]);
    expect(runtimeWorkProbeCreateArgs({ runId: 'r1', testNonce: null }, image)).toEqual([
      'create',
      '--label',
      'org.patch-steward.managed=true',
      '--label',
      'org.patch-steward.run=r1',
      ...rest,
    ]);
  });

  it('podman /work probe: the forbidden-argument check accepts the probe vectors', () => {
    expect(forbiddenRuntimeArguments(runtimeWorkProbeCreateArgs({ runId: 'r1', testNonce: 'n0nce' }, image))).toEqual([]);
    expect(forbiddenRuntimeArguments(runtimeWorkProbeCreateArgs({ runId: 'r1', testNonce: null }, image))).toEqual([]);
    expect(forbiddenRuntimeArguments(['cp', id + ':/work', '-'])).toEqual([]);
    expect(forbiddenRuntimeArguments(['cp', id + ':/workx', '-'])).not.toEqual([]);
    expect(forbiddenRuntimeArguments(['cp', id + ':/work/other', '-'])).not.toEqual([]);
    expect(forbiddenRuntimeArguments(['cp', id + ':/work/', '-'])).not.toEqual([]);
  });

  it('accepts exactly the docker and podman /work mount forms', () => {
    expect(forbiddenRuntimeArguments(runtimeCreateArgs('docker', spec))).toEqual([]);
    expect(forbiddenRuntimeArguments(runtimeCreateArgs('podman', spec))).toEqual([]);
    for (const runtime of ['docker', 'podman'] as const) {
      for (const option of ['volume-opt=nocopy', 'volume-opt=copy=false', 'nocopy', 'copy=false', 'volume-nocopy=true', 'ro']) {
        const args = runtimeCreateArgs(runtime, spec);
        args[args.indexOf('--mount') + 1] = `type=volume,src=vol1,dst=/work,${option}`;
        expect(forbiddenRuntimeArguments(args)).not.toEqual([]);
      }
    }
  });

  it('omits the network flag for the dependency step', () => {
    const expected = dockerExpected();
    expected.splice(expected.indexOf('--network'), 2);
    const actual = runtimeCreateArgs('docker', { ...spec, network: 'egress' });
    expect(actual).not.toContain('--network');
    expect(actual).toEqual(expected);
  });

  it('uses the checkout root as the default directory', () => {
    const args = runtimeCreateArgs('docker', { ...spec, workingDirectory: '.' });
    expect(args[args.indexOf('--workdir') + 1]).toBe('/work/checkout');
  });

  it('omits the test label outside tests', () => {
    const args = runtimeCreateArgs('docker', { ...spec, labels: { runId: 'r1', testNonce: null } });
    expect(args.some((a) => a.includes('org.patch-steward.test'))).toBe(false);
  });

  it('builds the other runtime commands exactly', () => {
    const labels = { runId: 'r1', testNonce: 'n0nce' };
    expect(runtimeVolumeCreateArgs(labels)).toEqual([
      'volume',
      'create',
      '--label',
      'org.patch-steward.managed=true',
      '--label',
      'org.patch-steward.run=r1',
      '--label',
      'org.patch-steward.test=n0nce',
    ]);
    expect(runtimeVolumeCreateArgs({ runId: 'r1', testNonce: null })).toEqual([
      'volume',
      'create',
      '--label',
      'org.patch-steward.managed=true',
      '--label',
      'org.patch-steward.run=r1',
    ]);
    expect(runtimeCopyInArgs(id)).toEqual(['cp', '-a', '-', `${id}:/work`]);
    expect(runtimeStartArgs(id)).toEqual(['start', '-a', id]);
    expect(runtimeInspectArgs(id)).toEqual(['container', 'inspect', id]);
    expect(runtimeCopyOutArgs(id, '/work/checkout/x')).toEqual(['cp', `${id}:/work/checkout/x`, '-']);
    expect(runtimeVolumeExportArgs('vol1')).toEqual(['volume', 'export', 'vol1']);
    expect(runtimeContainerExportArgs(id)).toEqual(['export', id]);
    expect(forbiddenRuntimeArguments(runtimeVolumeExportArgs('vol1'))).toEqual([]);
    expect(forbiddenRuntimeArguments(runtimeContainerExportArgs(id))).toEqual([]);
    for (const bad of [
      ['volume', 'export'],
      ['volume', 'export', 'vol1', 'extra'],
      ['volume', 'export', '--output', 'vol1'],
      ['volume', 'export', 'C:/out'],
      ['export'],
      ['export', id, '-o', 'C:/out'],
      ['export', 'abc'],
    ]) {
      expect(forbiddenRuntimeArguments(bad), bad.join(' ')).not.toEqual([]);
    }
    expect(runtimeKillArgs(id)).toEqual(['kill', id]);
    expect(runtimeWaitArgs(id)).toEqual(['wait', id]);
    expect(runtimeRemoveArgs(id)).toEqual(['rm', '-f', id]);
    expect(runtimeVolumeRemoveArgs('vol1')).toEqual(['volume', 'rm', 'vol1']);
    expect(runtimeVersionArgs()).toEqual(['version', '--format', 'json']);
    expect(runtimeInfoArgs()).toEqual(['info', '--format', 'json']);
    expect(runtimePullArgs('img:1')).toEqual(['pull', '--platform', 'linux/amd64', 'img:1']);
    expect(runtimeImageInspectArgs('img:1')).toEqual(['image', 'inspect', 'img:1']);
    const tree = 'b'.repeat(40);
    expect(runtimeBuildArgs({ runnerTreeId: tree, dockerfilePath: 'Dockerfile', testNonce: 'n0nce' })).toEqual([
      'build',
      '--platform',
      'linux/amd64',
      '--label',
      'org.patch-steward.managed=true',
      '--label',
      `org.patch-steward.runner-tree=${tree}`,
      '--label',
      'org.patch-steward.test=n0nce',
      '-t',
      `patch-steward-runner:${tree}`,
      '-f',
      'Dockerfile',
      '-',
    ]);
    const plain = runtimeBuildArgs({ runnerTreeId: tree, dockerfilePath: 'Dockerfile', testNonce: null });
    expect(plain.some((a) => a.includes('org.patch-steward.test'))).toBe(false);
  });

  it('never emits a forbidden argument', () => {
    const runs = [
      ['-v'],
      ['--privileged', '-i', '-t'],
      ['sh', '-c', 'cat /var/run/docker.sock'],
      ['C:/host/path', '--volume=/:/host'],
    ];
    for (const runtime of ['docker', 'podman'] as const) {
      for (const network of ['none', 'egress'] as const) {
        for (const workingDirectory of ['.', 'a', 'a/b c', '-v', '--privileged']) {
          for (const run of runs) {
            for (const testNonce of [null, 'n0nce']) {
              const args = runtimeCreateArgs(runtime, {
                ...spec,
                network,
                workingDirectory,
                run,
                labels: { runId: 'r1', testNonce },
              });
              expect(forbiddenRuntimeArguments(args)).toEqual([]);
            }
          }
        }
      }
    }
    const labels = { runId: 'r1', testNonce: 'n0nce' };
    const others = [
      runtimeVolumeCreateArgs(labels),
      runtimeCopyInArgs(id),
      runtimeStartArgs(id),
      runtimeInspectArgs(id),
      runtimeCopyOutArgs(id, '/work/checkout/reports/junit.xml'),
      runtimeKillArgs(id),
      runtimeWaitArgs(id),
      runtimeRemoveArgs(id),
      runtimeVolumeRemoveArgs('vol1'),
      runtimeVersionArgs(),
      runtimeInfoArgs(),
      runtimePullArgs('img:1'),
      runtimeImageInspectArgs('img:1'),
      runtimeBuildArgs({ runnerTreeId: 'b'.repeat(40), dockerfilePath: 'Dockerfile', testNonce: 'n0nce' }),
    ];
    for (const args of others) expect(forbiddenRuntimeArguments(args)).toEqual([]);
  });

  it('rejects each forbidden argument', () => {
    const base = dockerExpected();
    const at = base.indexOf(image);
    const groups: string[][] = [
      ['-v', 'C:/x:/y'],
      ['--volume=/:/host'],
      ['--privileged'],
      ['--cap-add', 'NET_ADMIN'],
      ['--device', '/dev/kvm'],
      ['--security-opt', 'seccomp=unconfined'],
      ['--security-opt', 'apparmor=unconfined'],
      ['--security-opt', 'label=disable'],
      ['--env-file', 'host.env'],
      ['--env', 'GH_TOKEN'],
      ['--network', 'host'],
      ['--network', 'container:other'],
      ['--pid', 'host'],
      ['--ipc', 'host'],
      ['--userns', 'host'],
      ['--uts', 'host'],
      ['-i'],
      ['-t'],
      ['--init'],
      ['--add-host', 'h:10.0.0.1'],
      ['--group-add', '0'],
      ['--sysctl', 'net.ipv4.ip_forward=1'],
      ['--gpus', 'all'],
      ['--mount', 'type=bind,src=C:/x,dst=/y'],
      ['--mount', 'type=volume,src=/var/run/docker.sock,dst=/s'],
    ];
    for (const group of groups) {
      const args = [...base.slice(0, at), ...group, ...base.slice(at)];
      expect(forbiddenRuntimeArguments(args), group.join(' ')).not.toEqual([]);
    }
    const others: string[][] = [
      ['cp', id + ':/work/checkout/x', 'C:/out'],
      ['cp', 'C:/in', id + ':/work'],
      ['build', '--platform', 'linux/amd64', '.'],
      ['build', '--secret', 'id=x', '-'],
      ['volume', 'create', '-v'],
    ];
    for (const args of others) expect(forbiddenRuntimeArguments(args), args.join(' ')).not.toEqual([]);
  });

  it('keeps only allowed variables for the client', () => {
    const linux = {
      PATH: 'p',
      HOME: 'h',
      DOCKER_HOST: 'd',
      GH_TOKEN: 't',
      AWS_SECRET_ACCESS_KEY: 's',
      PATCH_STEWARD_CANARY_AB12: 'c',
      path: 'lower',
    };
    expect(runtimeCliEnvironment(linux, 'linux')).toEqual({ PATH: 'p', HOME: 'h', DOCKER_HOST: 'd' });
    expect(runtimeCliEnvironment({ Path: 'P', SystemRoot: 'S', windir: 'W', GITHUB_TOKEN: 'x' }, 'win32')).toEqual({
      PATH: 'P',
      SystemRoot: 'S',
      windir: 'W',
    });
  });
});
