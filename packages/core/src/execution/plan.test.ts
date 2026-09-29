import { describe, expect, it } from 'vitest';

import { executionPlanEntrySchema, planScreenExecutions } from './plan.js';
import { DEFAULT_CHECKLIST_POLICY } from '../submission/default-checklist.js';
import type { ResolvedPolicy } from '../policy/schema.js';

const commit = 'c'.repeat(40);

describe('planScreenExecutions', () => {
  it('plans nothing for an issue', () => {
    const result = planScreenExecutions({ policy: DEFAULT_CHECKLIST_POLICY, submissionType: 'issue', headCommit: commit });
    expect(result).toEqual({ entries: [], overBudget: false });
  });

  it('plans nothing without a head commit', () => {
    const result = planScreenExecutions({ policy: DEFAULT_CHECKLIST_POLICY, submissionType: 'pull_request', headCommit: null });
    expect(result).toEqual({ entries: [], overBudget: false });
  });

  it('plans the mandatory container commands for a pull request', () => {
    const policy = structuredClone(DEFAULT_CHECKLIST_POLICY);
    const result = planScreenExecutions({ policy, submissionType: 'pull_request', headCommit: commit });
    expect(result.entries).toEqual([
      {
        id: 'head-test',
        kind: 'command',
        command_id: 'test',
        run: ['make', 'test'],
        working_directory: '.',
        commit_role: 'head',
        commit,
        overlay: 'none',
        expected: 'exit-zero',
        network: 'none',
        result_files: [],
      },
    ]);
    expect(result.overBudget).toBe(false);
  });

  it('runs the dependency step first with egress', () => {
    const policy = structuredClone(DEFAULT_CHECKLIST_POLICY) as ResolvedPolicy;
    policy.runner.dependency_step = { run: ['npm', 'ci'], working_directory: '.' };
    const result = planScreenExecutions({ policy, submissionType: 'pull_request', headCommit: commit });
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]).toEqual({
      id: 'head-dependency-step',
      kind: 'dependency-step',
      command_id: null,
      run: ['npm', 'ci'],
      working_directory: '.',
      commit_role: 'head',
      commit,
      overlay: 'none',
      expected: 'exit-zero',
      network: 'egress',
      result_files: [],
    });
    expect(result.entries[1]?.id).toBe('head-test');
  });

  it('skips non-mandatory commands', () => {
    const policy = structuredClone(DEFAULT_CHECKLIST_POLICY) as ResolvedPolicy;
    const [command] = policy.execution.commands;
    if (command === undefined) throw new Error('expected a command');
    command.mandatory = false;
    const result = planScreenExecutions({ policy, submissionType: 'pull_request', headCommit: commit });
    expect(result.entries).toEqual([]);
  });

  it('skips commands only on ci-signal platforms', () => {
    const policy = structuredClone(DEFAULT_CHECKLIST_POLICY) as ResolvedPolicy;
    policy.execution.commands.push({
      id: 'lint',
      kind: 'lint',
      run: ['make', 'lint'],
      working_directory: '.',
      mandatory: true,
      result_files: [],
    });
    policy.execution.platforms.push({
      id: 'windows',
      os: 'windows',
      required: false,
      source: 'ci-signal',
      ci_workflow: '.github/workflows/ci.yml',
      commands: ['lint'],
    });
    const result = planScreenExecutions({ policy, submissionType: 'pull_request', headCommit: commit });
    expect(result.entries.map((entry) => entry.id)).toEqual(['head-test']);
  });

  it('lists a command once and in policy order', () => {
    const policy = structuredClone(DEFAULT_CHECKLIST_POLICY) as ResolvedPolicy;
    policy.execution.commands = [
      { id: 'build', kind: 'build', run: ['make', 'build'], working_directory: '.', mandatory: true, result_files: [] },
      { id: 'test', kind: 'test', run: ['make', 'test'], working_directory: '.', mandatory: true, result_files: [] },
    ];
    policy.execution.platforms = [
      { id: 'linux', os: 'linux', required: true, source: 'container', ci_workflow: null, commands: ['test', 'build'] },
      { id: 'macos', os: 'macos', required: false, source: 'container', ci_workflow: null, commands: ['build'] },
    ];
    const result = planScreenExecutions({ policy, submissionType: 'pull_request', headCommit: commit });
    expect(result.entries.map((entry) => entry.id)).toEqual(['head-build', 'head-test']);
  });

  it('copies declared result files', () => {
    const policy = structuredClone(DEFAULT_CHECKLIST_POLICY) as ResolvedPolicy;
    const [command] = policy.execution.commands;
    if (command === undefined) throw new Error('expected a command');
    command.result_files = [{ path: 'reports/junit.xml', format: 'junit-xml' }];
    const result = planScreenExecutions({ policy, submissionType: 'pull_request', headCommit: commit });
    const entry = result.entries[0];
    expect(entry?.result_files).toEqual([{ path: 'reports/junit.xml', format: 'junit-xml' }]);
    entry?.result_files.push({ path: 'extra.xml', format: 'junit-xml' });
    expect(command.result_files).toEqual([{ path: 'reports/junit.xml', format: 'junit-xml' }]);
  });

  it('flags a plan larger than the execution budget', () => {
    const policy = structuredClone(DEFAULT_CHECKLIST_POLICY) as ResolvedPolicy;
    policy.runner.dependency_step = { run: ['npm', 'ci'], working_directory: '.' };
    policy.limits.execution.executions_per_run = 1;
    const result = planScreenExecutions({ policy, submissionType: 'pull_request', headCommit: commit });
    expect(result.entries).toHaveLength(2);
    expect(result.overBudget).toBe(true);
  });

  it('planned entries satisfy the entry schema', () => {
    const policy = structuredClone(DEFAULT_CHECKLIST_POLICY) as ResolvedPolicy;
    policy.runner.dependency_step = { run: ['npm', 'ci'], working_directory: '.' };
    const result = planScreenExecutions({ policy, submissionType: 'pull_request', headCommit: commit });
    for (const entry of result.entries) {
      expect(executionPlanEntrySchema.safeParse(entry).success).toBe(true);
    }
  });

  it('the entry schema rejects inconsistent entries', () => {
    const base = {
      id: 'head-test',
      kind: 'command' as const,
      command_id: 'test',
      run: ['make', 'test'],
      working_directory: '.',
      commit_role: 'head' as const,
      commit,
      overlay: 'none' as const,
      expected: 'exit-zero' as const,
      network: 'none' as const,
      result_files: [],
    };
    expect(executionPlanEntrySchema.safeParse({ ...base, network: 'egress' }).success).toBe(false);
    expect(
      executionPlanEntrySchema.safeParse({
        id: 'head-dependency-step',
        kind: 'dependency-step',
        command_id: 'x',
        run: ['npm', 'ci'],
        working_directory: '.',
        commit_role: 'head',
        commit,
        overlay: 'none',
        expected: 'exit-zero',
        network: 'egress',
        result_files: [],
      }).success,
    ).toBe(false);
    expect(executionPlanEntrySchema.safeParse({ ...base, id: 'base-test', commit_role: 'head' }).success).toBe(false);
    expect(
      executionPlanEntrySchema.safeParse({
        id: 'head-dependency-step',
        kind: 'dependency-step',
        command_id: null,
        run: ['npm', 'ci'],
        working_directory: '.',
        commit_role: 'head',
        commit,
        overlay: 'none',
        expected: 'exit-zero',
        network: 'egress',
        result_files: [{ path: 'a.xml', format: 'junit-xml' }],
      }).success,
    ).toBe(false);
    expect(executionPlanEntrySchema.safeParse({ ...base, unknown: 'value' }).success).toBe(false);
  });
});
