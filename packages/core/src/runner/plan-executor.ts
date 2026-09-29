import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  emptyPlanExecution,
  executionBudgetCause,
  executionEnvironmentCause,
  type PlanExecutionContext,
  type PlanExecutionOutcome,
  type PlanExecutor,
} from '../execution/executor.js';
import type { ExecutionFailureCode } from '../execution/results.js';
import type { ExecutionResultEntry } from '../execution/transport.js';
import { githubBudgetForPolicy } from '../github/budget.js';
import { createGitHubClient, type GitHubFetch } from '../github/client.js';
import type { FetchSource } from '../materialize/fetch.js';
import { materializeCommit, materializeLimitsFromPolicy, type MaterializedCheckout } from '../materialize/materialize.js';
import type { RecordRunId } from '../records/common.js';
import type { RecordCause } from '../records/decision.js';
import type { RunnerIdentityInput } from '../records/run.js';
import { readRunnerBuildContext } from './build-context.js';
import { containerLimitsFromPolicy, runContainerExecution, type ContainerExecutionInput } from './container.js';
import { imageLimitsFromPolicy, prepareRunnerImage, type RunnerImageSpec } from './image.js';
import { selectContainerRuntime } from './runtime.js';
import type { ContainerRuntimeChoice, ContainerRuntimeName, ResolvedImage, SelectedRuntime } from './types.js';

export interface HostExecutorSteps {
  readonly selectRuntime: typeof selectContainerRuntime;
  readonly readBuildContext: typeof readRunnerBuildContext;
  readonly prepareImage: typeof prepareRunnerImage;
  readonly materialize: typeof materializeCommit;
  readonly runEntry: typeof runContainerExecution;
}

export interface HostPlanExecutorOptions {
  readonly runtime: ContainerRuntimeChoice;
  readonly hostEnv: Readonly<Record<string, string | undefined>>;
  readonly fetch?: GitHubFetch;
  readonly fetchSource?: FetchSource;
  readonly testNonce?: string | null;
  readonly binaries?: Partial<Record<ContainerRuntimeName, string>>;
  readonly steps?: Partial<HostExecutorSteps>;
}

const DEFAULT_STEPS: HostExecutorSteps = {
  selectRuntime: selectContainerRuntime,
  readBuildContext: readRunnerBuildContext,
  prepareImage: prepareRunnerImage,
  materialize: materializeCommit,
  runEntry: runContainerExecution,
};

function resultsTransport(context: PlanExecutionContext, results: ExecutionResultEntry[], causes: RecordCause[]) {
  const { plan } = context;
  return {
    transport: 'execution-results',
    transport_version: 1,
    run: { ...plan.run },
    snapshot_hash: plan.snapshot_hash,
    policy_revision: plan.policy_revision,
    results,
    causes,
  };
}

function runnerIdentity(runtime: SelectedRuntime, image: ResolvedImage): RunnerIdentityInput {
  return {
    runtime: runtime.name,
    serverVersion: runtime.serverVersion,
    reference: image.reference,
    imageDigest: image.digest ?? image.id,
  };
}

export function hostPlanExecutor(options: HostPlanExecutorOptions): PlanExecutor {
  const steps: HostExecutorSteps = { ...DEFAULT_STEPS, ...options.steps };
  const testNonce = options.testNonce ?? null;

  return async (context) => {
    const { plan, loadedPolicy, repository, clock, signal } = context;
    const policy = loadedPolicy.policy;
    const first = plan.entries[0];
    if (first === undefined) return emptyPlanExecution(plan);

    const results: ExecutionResultEntry[] = [];
    const causes: RecordCause[] = [];
    const environmentFailure = (
      code: ExecutionFailureCode,
      subject: string | null,
      runner: RunnerIdentityInput | null,
      buildLog: PlanExecutionOutcome['buildLog'],
    ): PlanExecutionOutcome => {
      results.push({ kind: 'environment-failure', entry_id: first.id, code, subject });
      causes.push(executionEnvironmentCause(code, subject));
      return { results: resultsTransport(context, results, causes), runner, buildLog, containerSeconds: 0 };
    };

    const selected = await steps.selectRuntime({
      choice: options.runtime,
      hostEnv: options.hostEnv,
      ...(options.binaries !== undefined ? { binaries: options.binaries } : {}),
    });
    if (!selected.ok) return environmentFailure(selected.failure.code, null, null, null);
    const runtime = selected.value;

    let spec: RunnerImageSpec;
    const imageSource = policy.runner.image;
    if (imageSource.source === 'registry') {
      spec = { source: 'registry', reference: imageSource.reference };
    } else {
      const built = await steps.readBuildContext(
        loadedPolicy.revision.kind === 'git-tree'
          ? {
              kind: 'github',
              client: createGitHubClient({
                token: context.token,
                budget: githubBudgetForPolicy(policy),
                ...(options.fetch !== undefined ? { fetch: options.fetch } : {}),
              }),
              repository,
              policyTreeId: loadedPolicy.revision.id,
            }
          : { kind: 'local-file' },
        { dockerfilePath: imageSource.path, maxBytes: policy.limits.execution.build_context_bytes },
      );
      if (!built.ok) return environmentFailure(built.failure.code, null, null, null);
      spec = { source: 'dockerfile', context: built.value };
    }

    const prepared = await steps.prepareImage(
      { runtime, testNonce, runId: String(plan.run.run_id) },
      spec,
      imageLimitsFromPolicy(policy),
    );
    if (!prepared.result.ok) return environmentFailure(prepared.result.failure.code, null, null, prepared.buildLog);
    const image = prepared.result.value;
    const runner = runnerIdentity(runtime, image);

    const tempDirs: string[] = [];
    let materialized: MaterializedCheckout | null = null;
    try {
      const fetched = await steps.materialize({
        source: options.fetchSource ?? { kind: 'github', owner: repository.owner, name: repository.name },
        commit: first.commit,
        token: context.token,
        overlay: [],
        limits: materializeLimitsFromPolicy(policy),
        hostEnv: options.hostEnv,
      });
      if (!fetched.ok) {
        return environmentFailure(fetched.failure.code, fetched.failure.details[0]?.path ?? null, runner, prepared.buildLog);
      }
      materialized = fetched.value;

      let archivePath = materialized.archivePath;
      let spentMs = 0;
      const limits = containerLimitsFromPolicy(policy);
      for (const entry of plan.entries) {
        if (signal.aborted) break;
        if (spentMs >= policy.limits.execution.run_execution_seconds * 1000) {
          causes.push(executionBudgetCause('execution.time-exhausted'));
          break;
        }
        let preparedCopyPath: string | null = null;
        if (entry.kind === 'dependency-step') {
          const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-steward-prepared-'));
          tempDirs.push(dir);
          preparedCopyPath = path.join(dir, 'prepared.tar');
        }
        const ran = await steps.runEntry(
          { runtime, image, runId: plan.run.run_id as RecordRunId, runAttempt: plan.run.run_attempt, testNonce, clock },
          { entry, archivePath, checkout: materialized.checkout as ContainerExecutionInput['checkout'], limits, preparedCopyPath },
        );
        if (ran.kind === 'environment-failure') {
          results.push({ kind: 'environment-failure', entry_id: entry.id, code: ran.code, subject: ran.subject });
          causes.push(executionEnvironmentCause(ran.code, ran.subject));
          break;
        }
        results.push(ran.execution);
        spentMs += ran.durationMs;
        if (ran.dependencyFailure !== null) {
          causes.push(executionEnvironmentCause(ran.dependencyFailure, 'dependency-step'));
          break;
        }
        if (ran.preparedCopy !== null) archivePath = ran.preparedCopy.path;
      }
      return {
        results: resultsTransport(context, results, causes),
        runner,
        buildLog: prepared.buildLog,
        containerSeconds: spentMs / 1000,
      };
    } finally {
      for (const dir of tempDirs) {
        try {
          fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
        } catch {
          // cleanup must not mask the result
        }
      }
      try {
        await materialized?.dispose();
      } catch {
        // cleanup must not mask the result
      }
    }
  };
}
