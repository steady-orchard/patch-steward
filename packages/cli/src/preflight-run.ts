import * as path from 'node:path';
import {
  GIT_OUTPUT_MAX_BYTES,
  GIT_TIMEOUT_MS,
  checkoutTopLevel,
  classifyPath,
  createPreviewWorktree,
  createUnsandboxedRunner,
  localRunId,
  redactCapturedOutput,
  resolveCommit,
  systemRandom,
  unsandboxedLimitsFromPolicy,
  workingTreeDirty,
  type Clock,
  type ExecutionPlanEntry,
  type PathChange,
  type ProcessRunner,
  type RecordRunId,
  type ResolvedPolicy,
  type StreamProcessRunner,
  type UnsandboxedExecutionResult,
  type UnsandboxedRunner,
} from '@patch-steward/core';
import {
  PREFLIGHT_RUN_NOTICE,
  preflightRunLine,
  type PreflightError,
  type PreflightRunExecution,
  type PreflightRunJunit,
  type PreflightRunPreview,
  type PreflightRunReport,
  type PreflightWarning,
} from './preflight-output.js';

export interface PreflightRunPullRequest {
  readonly head: string;
  readonly mergeBase: string;
  readonly changes: readonly PathChange[] | null;
  readonly regressionTest: boolean;
}

export interface PreflightRunInput {
  readonly policy: ResolvedPolicy;
  readonly published: boolean;
  readonly cwd: string;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly credentials: readonly string[];
  readonly pullRequest: PreflightRunPullRequest | null;
  readonly clock: Clock;
  readonly onRun?: (line: string) => void;
  readonly platform?: NodeJS.Platform;
  readonly stream?: StreamProcessRunner;
  readonly git?: ProcessRunner;
}

export interface PreflightRunOutcome {
  readonly report: PreflightRunReport;
  readonly warnings: readonly PreflightWarning[];
  readonly errors: readonly PreflightError[];
  readonly exitStatus: 0 | 1 | 2 | 3;
}

export const PREFLIGHT_RUN_WARNING_CODES = [
  'preflight.run-without-policy',
  'preflight.working-tree-dirty',
  'preflight.preview-skipped',
  'preflight.preview-unavailable',
] as const;

type ExitStatus = 0 | 1 | 2 | 3;

const EXIT_PRECEDENCE: readonly ExitStatus[] = [0, 1, 3, 2];

function worse(a: ExitStatus, b: ExitStatus): ExitStatus {
  return EXIT_PRECEDENCE.indexOf(b) > EXIT_PRECEDENCE.indexOf(a) ? b : a;
}

function emptyReport(executions: readonly PreflightRunExecution[], preview: PreflightRunPreview | null): PreflightRunReport {
  return { requested: true, notice: PREFLIGHT_RUN_NOTICE, executions, preview };
}

function failedOutcome(error: PreflightError, exitStatus: ExitStatus, warnings: readonly PreflightWarning[]): PreflightRunOutcome {
  return { report: emptyReport([], null), warnings, errors: [error], exitStatus };
}

function warning(
  code: (typeof PREFLIGHT_RUN_WARNING_CODES)[number],
  message: string,
  subjects: readonly string[] = [],
): PreflightWarning {
  return { code, message, subjects };
}

function relativeDirectory(root: string, directory: string): string {
  const rel = path.relative(root, directory).split(path.sep).join('/');
  return rel === '' ? '.' : rel;
}

function skippedExecution(entry: ExecutionPlanEntry): PreflightRunExecution {
  return {
    id: entry.id,
    argv: entry.run,
    directory: entry.working_directory,
    via_cmd: false,
    status: 'skipped',
    code: 'execution.time-exhausted',
    exit_code: null,
    signal: null,
    timed_out: false,
    output_limited: false,
    duration_ms: null,
    junit: null,
    output_tail: null,
    admissibility: 'claim',
  };
}

interface MappedExecution {
  readonly execution: PreflightRunExecution;
  readonly failed: boolean;
  readonly unavailable: boolean;
  readonly durationMs: number;
}

function sumJunit(files: readonly { readonly junit?: PreflightRunJunit | null | undefined }[]): PreflightRunJunit | null {
  const total = { tests: 0, passed: 0, failed: 0, errored: 0, skipped: 0 };
  let any = false;
  for (const file of files) {
    const j = file.junit;
    if (j === null || j === undefined) continue;
    any = true;
    total.tests += j.tests;
    total.passed += j.passed;
    total.failed += j.failed;
    total.errored += j.errored;
    total.skipped += j.skipped;
  }
  return any ? total : null;
}

async function mapResult(
  entry: ExecutionPlanEntry,
  result: UnsandboxedExecutionResult,
  root: string,
  policy: ResolvedPolicy,
  credentials: readonly string[],
): Promise<MappedExecution> {
  if (result.kind !== 'completed') {
    return {
      execution: {
        id: entry.id,
        argv: entry.run,
        directory: entry.working_directory,
        via_cmd: false,
        status: result.kind,
        code: result.code,
        exit_code: null,
        signal: null,
        timed_out: false,
        output_limited: false,
        duration_ms: null,
        junit: null,
        output_tail: null,
        admissibility: 'claim',
      },
      failed: false,
      unavailable: true,
      durationMs: 0,
    };
  }
  const { record, output } = result.execution;
  const timedOut = record.exit.timed_out === true;
  const outputLimited = record.exit.output_limited === true;
  const failed = record.exit.code !== 0 || timedOut || outputLimited;
  let tail: string | null = null;
  if (failed) {
    const limits = policy.limits.execution;
    const redacted = await redactCapturedOutput(
      { parts: output.parts, omittedBytes: output.omitted_bytes, trimmedBytes: output.trimmed_bytes },
      { headBytes: limits.output_head_bytes, tailBytes: limits.output_tail_bytes },
      { credentials, policyPatterns: policy.evidence.redaction_patterns },
    );
    tail = redacted.ok ? redacted.value.excerpt.head + redacted.value.excerpt.tail : null;
  }
  const durationMs = record.timing?.duration_ms ?? 0;
  return {
    execution: {
      id: entry.id,
      argv: result.argv,
      directory: relativeDirectory(root, result.directory),
      via_cmd: result.viaCmd,
      status: 'completed',
      code: null,
      exit_code: record.exit.code,
      signal: record.exit.signal,
      timed_out: timedOut,
      output_limited: outputLimited,
      duration_ms: record.timing?.duration_ms ?? null,
      junit: sumJunit(record.result_files),
      output_tail: tail,
      admissibility: 'claim',
    },
    failed,
    unavailable: false,
    durationMs,
  };
}

function hasTestPath(change: PathChange): boolean {
  return classifyPath(change.path) === 'test' || (change.previousPath !== null && classifyPath(change.previousPath) === 'test');
}

type PreviewPlan =
  { readonly kind: 'run'; readonly changes: readonly PathChange[] } | { readonly kind: 'skip'; readonly message: string };

function planPreview(pullRequest: PreflightRunPullRequest): PreviewPlan {
  if (!pullRequest.regressionTest) return { kind: 'skip', message: 'No regression test is declared; the preview did not run.' };
  if (pullRequest.changes === null) return { kind: 'skip', message: 'The changed paths are incomplete; the preview did not run.' };
  const testChanges = pullRequest.changes.filter(hasTestPath);
  if (testChanges.length === 0) return { kind: 'skip', message: 'No test path changed; the preview did not run.' };
  return { kind: 'run', changes: testChanges };
}

function commandEntry(
  command: ResolvedPolicy['execution']['commands'][number],
  role: 'head' | 'base',
  commit: string,
): ExecutionPlanEntry {
  return {
    id: `${role}-${command.id}`,
    kind: 'command',
    command_id: command.id,
    run: [...command.run],
    working_directory: command.working_directory,
    commit_role: role,
    commit,
    overlay: 'none',
    expected: 'exit-zero',
    network: 'none',
    result_files: command.result_files.map(({ path: p, format }) => ({ path: p, format })),
  };
}

export async function runPreflightExecutions(input: PreflightRunInput): Promise<PreflightRunOutcome> {
  const { policy } = input;
  if (!input.published) {
    return {
      report: emptyReport([], null),
      warnings: [
        warning('preflight.run-without-policy', 'No published policy was found; --run runs nothing under the default checklist.'),
      ],
      errors: [],
      exitStatus: 0,
    };
  }

  const gitOptions = input.git === undefined ? undefined : { runner: input.git };
  const notOwn = (p: string, message: string): PreflightError => ({ code: 'runner.not-own-checkout', path: p, message });
  const root = await checkoutTopLevel(input.cwd, gitOptions);
  if (root === null) {
    return failedOutcome(notOwn('', 'The directory is not the contributor checkout.'), 2, []);
  }

  const runnerBase = {
    processCwd: input.cwd,
    hostEnv: input.env,
    credentials: input.credentials,
    runAttempt: 1,
    clock: input.clock,
    ...(input.platform !== undefined ? { platform: input.platform } : {}),
    ...(input.git !== undefined ? { git: input.git } : {}),
    ...(input.stream !== undefined ? { stream: input.stream } : {}),
  };
  const created = await createUnsandboxedRunner({
    ...runnerBase,
    checkoutRoot: root,
    previewWorktrees: [],
    runId: localRunId(input.clock.now(), systemRandom) as RecordRunId,
  });
  if (!created.ok) {
    const detail = created.failure.details?.[0];
    return failedOutcome(notOwn(detail?.path ?? '', detail?.message ?? 'The directory is not the contributor checkout.'), 2, []);
  }
  const runner = created.value;

  const warnings: PreflightWarning[] = [];
  if ((await workingTreeDirty(root, gitOptions)) === true) {
    warnings.push(warning('preflight.working-tree-dirty', 'The working tree has uncommitted changes; commands ran on it as is.'));
  }

  let head = input.pullRequest?.head;
  if (head === undefined) {
    const resolved = await resolveCommit(
      { repoDir: root, timeoutMs: GIT_TIMEOUT_MS, maxOutputBytes: GIT_OUTPUT_MAX_BYTES, ...gitOptions },
      'HEAD',
    );
    if (!resolved.ok) {
      return failedOutcome({ code: 'preflight.head-unresolvable', path: '', message: 'HEAD could not be resolved.' }, 2, warnings);
    }
    head = resolved.value;
  }

  const mandatory = policy.execution.commands.filter((command) => command.mandatory);
  const entries = mandatory.map((command) => commandEntry(command, 'head', head));

  const previewPlan = input.pullRequest === null ? null : planPreview(input.pullRequest);
  const previewEntries: ExecutionPlanEntry[] = [];
  if (previewPlan?.kind === 'run' && input.pullRequest !== null) {
    const step = policy.runner.dependency_step;
    if (step !== null) {
      previewEntries.push({
        id: 'base-dependency-step',
        kind: 'dependency-step',
        command_id: null,
        run: [...step.run],
        working_directory: step.working_directory,
        commit_role: 'base',
        commit: input.pullRequest.mergeBase,
        overlay: 'none',
        expected: 'exit-zero',
        network: 'egress',
        result_files: [],
      });
    }
    for (const command of mandatory) {
      if (command.kind === 'test') previewEntries.push(commandEntry(command, 'base', input.pullRequest.mergeBase));
    }
  }

  const limits = policy.limits.execution;
  if (entries.length + previewEntries.length > limits.executions_per_run) {
    return failedOutcome(
      {
        code: 'preflight.run-over-budget',
        path: '',
        message: 'The commands exceed limits.execution.executions_per_run; nothing ran.',
      },
      3,
      warnings,
    );
  }

  const runLimits = unsandboxedLimitsFromPolicy(policy);
  let exitStatus: ExitStatus = 0;
  let elapsedMs = 0;
  const budgetMs = limits.run_execution_seconds * 1000;

  const runList = async (
    list: readonly ExecutionPlanEntry[],
    active: UnsandboxedRunner,
    label: (entry: ExecutionPlanEntry) => string,
    contributes: boolean,
  ): Promise<PreflightRunExecution[]> => {
    const out: PreflightRunExecution[] = [];
    for (const entry of list) {
      if (elapsedMs >= budgetMs) {
        out.push(skippedExecution(entry));
        exitStatus = worse(exitStatus, 3);
        continue;
      }
      input.onRun?.(preflightRunLine(entry.id, entry.run, label(entry)));
      const result = await active.run(entry, runLimits);
      const mapped = await mapResult(entry, result, active.root, policy, input.credentials);
      elapsedMs += mapped.durationMs;
      if (contributes) {
        if (mapped.unavailable) exitStatus = worse(exitStatus, 2);
        else if (mapped.failed) exitStatus = worse(exitStatus, 1);
      }
      out.push(mapped.execution);
    }
    return out;
  };

  const executions = await runList(entries, runner, (entry) => entry.working_directory, true);
  let preview: PreflightRunPreview | null = null;

  if (previewPlan?.kind === 'skip') {
    warnings.push(warning('preflight.preview-skipped', previewPlan.message));
  } else if (previewPlan?.kind === 'run' && input.pullRequest !== null) {
    const worktree = await createPreviewWorktree({
      checkoutRoot: root,
      mergeBase: input.pullRequest.mergeBase,
      head,
      changes: previewPlan.changes,
      limits: { overlayFiles: limits.overlay_files, overlayBytes: limits.overlay_bytes },
      ...(gitOptions ?? {}),
    });
    if (!worktree.ok) {
      warnings.push(
        warning('preflight.preview-unavailable', 'The preview did not run: ' + worktree.failure.code + '.', [
          worktree.failure.code,
        ]),
      );
    } else {
      try {
        const previewRunner = await createUnsandboxedRunner({
          ...runnerBase,
          checkoutRoot: worktree.value.root,
          previewWorktrees: [worktree.value.root],
          runId: localRunId(input.clock.now(), systemRandom) as RecordRunId,
        });
        if (!previewRunner.ok) {
          warnings.push(
            warning('preflight.preview-unavailable', 'The preview did not run: ' + previewRunner.failure.code + '.', [
              previewRunner.failure.code,
            ]),
          );
        } else {
          const before = await runList(previewEntries, previewRunner.value, () => 'preview', false);
          const unavailable = before.filter((e) => e.status === 'refused' || e.status === 'environment-failure');
          if (unavailable.length > 0) {
            warnings.push(
              warning(
                'preflight.preview-unavailable',
                'Some preview commands could not run.',
                unavailable.map((e) => e.id),
              ),
            );
          }
          const baseIds = new Set(previewEntries.map((e) => e.command_id));
          preview = {
            base: input.pullRequest.mergeBase,
            overlay_paths: [...worktree.value.overlayPaths],
            before,
            after: executions.filter((_, i) => baseIds.has(entries[i]?.command_id ?? null)),
          };
        }
      } finally {
        await worktree.value.dispose();
      }
    }
  }

  return { report: emptyReport(executions, preview), warnings, errors: [], exitStatus };
}
