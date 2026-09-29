import { z } from 'zod';

import type { ResolvedPolicy } from '../policy/schema.js';
import type { SubmissionType } from '../vocabulary.js';
import { recordIdentifierSchema, recordTextSchema, recordCommitIdSchema, recordList } from '../records/common.js';
import { RECORD_LIST_MAX_ITEMS } from '../policy/bounds.js';

export const executionPlanEntrySchema = z
  .strictObject({
    id: recordIdentifierSchema,
    kind: z.enum(['command', 'dependency-step']),
    command_id: recordIdentifierSchema.nullable(),
    run: z.array(recordTextSchema).min(1).max(RECORD_LIST_MAX_ITEMS),
    working_directory: z.string().min(1).max(65536),
    commit_role: z.enum(['head', 'base']),
    commit: recordCommitIdSchema,
    overlay: z.enum(['none', 'test-paths']),
    expected: z.enum(['exit-zero', 'exit-nonzero', 'any']),
    network: z.enum(['none', 'egress']),
    result_files: recordList(
      z.strictObject({
        path: z.string().min(1).max(65536),
        format: z.literal('junit-xml'),
      }),
    ),
  })
  .superRefine((entry, ctx) => {
    const isDependencyStep = entry.kind === 'dependency-step';
    if (isDependencyStep !== (entry.command_id === null)) {
      ctx.addIssue({
        code: 'custom',
        message: 'dependency-step entries have a null command_id and command entries have a non-null command_id',
        path: ['command_id'],
      });
    }
    const expectedId = `${entry.commit_role}-${entry.command_id ?? 'dependency-step'}`;
    if (entry.id !== expectedId) {
      ctx.addIssue({
        code: 'custom',
        message: `id must be "${expectedId}"`,
        path: ['id'],
      });
    }
    if (isDependencyStep) {
      if (entry.network !== 'egress') {
        ctx.addIssue({ code: 'custom', message: 'dependency-step entries require network "egress"', path: ['network'] });
      }
      if (entry.result_files.length > 0) {
        ctx.addIssue({ code: 'custom', message: 'dependency-step entries must not declare result files', path: ['result_files'] });
      }
    } else if (entry.network !== 'none') {
      ctx.addIssue({ code: 'custom', message: 'command entries require network "none"', path: ['network'] });
    }
  });

export type ExecutionPlanEntry = z.output<typeof executionPlanEntrySchema>;

export interface ScreenPlanInput {
  readonly policy: ResolvedPolicy;
  readonly submissionType: SubmissionType;
  readonly headCommit: string | null;
}

export interface ExecutionPlan {
  readonly entries: readonly ExecutionPlanEntry[];
  readonly overBudget: boolean;
}

export function planScreenExecutions(input: ScreenPlanInput): ExecutionPlan {
  const { policy, submissionType, headCommit } = input;
  if (submissionType !== 'pull_request' || headCommit === null) {
    return { entries: [], overBudget: false };
  }

  const entries: ExecutionPlanEntry[] = [];

  const dependencyStep = policy.runner.dependency_step;
  if (dependencyStep !== null) {
    entries.push({
      id: 'head-dependency-step',
      kind: 'dependency-step',
      command_id: null,
      run: [...dependencyStep.run],
      working_directory: dependencyStep.working_directory,
      commit_role: 'head',
      commit: headCommit,
      overlay: 'none',
      expected: 'exit-zero',
      network: 'egress',
      result_files: [],
    });
  }

  const containerCommandIds = new Set<string>();
  for (const platform of policy.execution.platforms) {
    if (platform.source === 'container') {
      for (const commandId of platform.commands) {
        containerCommandIds.add(commandId);
      }
    }
  }

  for (const command of policy.execution.commands) {
    if (command.mandatory && containerCommandIds.has(command.id)) {
      entries.push({
        id: `head-${command.id}`,
        kind: 'command',
        command_id: command.id,
        run: [...command.run],
        working_directory: command.working_directory,
        commit_role: 'head',
        commit: headCommit,
        overlay: 'none',
        expected: 'exit-zero',
        network: 'none',
        result_files: command.result_files.map(({ path, format }) => ({ path, format })),
      });
    }
  }

  const overBudget = entries.length > policy.limits.execution.executions_per_run;
  return { entries, overBudget };
}
