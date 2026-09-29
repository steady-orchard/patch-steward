export const CONTAINER_RUNTIME_NAMES = ['docker', 'podman'] as const;
export type ContainerRuntimeName = (typeof CONTAINER_RUNTIME_NAMES)[number];
export type ContainerRuntimeChoice = 'auto' | ContainerRuntimeName;

export const RUNTIME_LABEL_MANAGED = 'org.patch-steward.managed';
export const RUNTIME_LABEL_RUN = 'org.patch-steward.run';
export const RUNTIME_LABEL_TEST = 'org.patch-steward.test';
export const RUNTIME_LABEL_RUNNER_TREE = 'org.patch-steward.runner-tree';
export const RUNNER_IMAGE_REPOSITORY = 'patch-steward-runner';

export interface SelectedRuntime {
  readonly name: ContainerRuntimeName;
  readonly binary: string;
  readonly env: Readonly<Record<string, string>>;
  readonly clientVersion: string | null;
  readonly serverVersion: string;
  readonly os: string;
  readonly arch: string;
}

export interface ResolvedImage {
  readonly source: 'registry' | 'dockerfile';
  readonly reference: string;
  readonly digest: string | null;
  readonly id: string;
  readonly runnerTreeId: string | null;
  readonly cached: boolean;
  readonly runReference: string;
}

export interface RuntimeLabels {
  readonly runId: string;
  readonly testNonce: string | null;
}
