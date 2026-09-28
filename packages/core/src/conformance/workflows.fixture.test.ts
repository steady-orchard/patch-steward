import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { parseStrictYaml } from '../strict-yaml.js';
import { ISSUE_EVENT_ACTIONS, PULL_REQUEST_EVENT_ACTIONS } from '../vocabulary.js';
import { STEWARD_WRAPPER_PATHS } from '../ownership/caps.js';

const SECRET_ENV = {
  PATCH_STEWARD_APP_ID: '${{ secrets.PATCH_STEWARD_APP_ID }}',
  PATCH_STEWARD_APP_PRIVATE_KEY: '${{ secrets.PATCH_STEWARD_APP_PRIVATE_KEY }}',
};

const PUBLISH_IF =
  "${{ always() && needs.gate.result == 'success' && (needs.gate.outputs.committed == 'true' || needs.gate.outputs.record_only == 'true') }}";

const PUBLISH_GROUP =
  "${{ needs.gate.outputs.concurrency_group || format('steward-{0}-run-{1}', github.repository_id, github.run_id) }}";

const GATE_OUTPUTS = {
  committed: '${{ steps.commitment.outputs.committed }}',
  record_only: '${{ steps.core.outputs.record_only }}',
  disposition: '${{ steps.core.outputs.disposition }}',
  concurrency_group: '${{ steps.core.outputs.concurrency_group }}',
  snapshot_hash: '${{ steps.core.outputs.snapshot_hash }}',
  policy_revision: '${{ steps.core.outputs.policy_revision }}',
};

const WRAPPER_USES_PREFIX = 'steady-orchard/patch-steward/.github/workflows/steward-screening.yml@';
const ALLOWED_ACTIONS = ['actions/checkout', 'actions/setup-node', 'actions/upload-artifact', 'actions/download-artifact'];

// Built by concatenation so the source never holds a contiguous probe secret name.
const PROBE_SECRET_PATTERN = new RegExp('(?<!PATCH_)STEWARD_' + 'APP_(ID|PRIVATE_KEY|CLIENT_ID)');

const USES_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(\/[A-Za-z0-9_./-]+)?@[0-9a-f]{40}$/;
const USES_LINE_PATTERN = /uses: \S+@[0-9a-f]{40} # \S/;

function crlfToLf(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

function readWorkflowText(relative: string): string {
  return crlfToLf(fs.readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8'));
}

function parseWorkflow(text: string): unknown {
  const bytes = new TextEncoder().encode(text);
  const result = parseStrictYaml(bytes, { maxBytes: 1048576, maxDepth: 64, maxNodes: 100000 });
  if (!result.ok) {
    throw new Error(`workflow did not parse: ${result.failure.message}`);
  }
  return result.value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${path} is not a mapping`);
  }
  return value;
}

function array(value: unknown, path: string): unknown[] {
  if (!isArray(value)) {
    throw new Error(`${path} is not a sequence`);
  }
  return value;
}

function str(value: unknown, path: string): string {
  if (!isString(value)) {
    throw new Error(`${path} is not a string`);
  }
  return value;
}

function jobsOf(workflow: Record<string, unknown>): Record<string, unknown> {
  return record(workflow['jobs'], 'jobs');
}

function jobOf(workflow: Record<string, unknown>, id: string): Record<string, unknown> {
  return record(jobsOf(workflow)[id], `jobs.${id}`);
}

function stepsOf(job: Record<string, unknown>): Record<string, unknown>[] {
  return array(job['steps'], 'steps').map((entry, index) => record(entry, `steps[${index}]`));
}

function stepById(steps: readonly Record<string, unknown>[], id: string): Record<string, unknown> {
  const found = steps.find((step) => step['id'] === id);
  if (found === undefined) {
    throw new Error(`step id ${id} not found`);
  }
  return found;
}

interface StringHit {
  readonly path: string;
  readonly value: string;
}

function collectStrings(value: unknown, path: string, out: StringHit[]): void {
  if (isString(value)) {
    out.push({ path, value });
    return;
  }
  if (isArray(value)) {
    value.forEach((item, index) => collectStrings(item, `${path}[${index}]`, out));
    return;
  }
  if (isRecord(value)) {
    for (const [key, item] of Object.entries(value)) {
      collectStrings(item, `${path}.${key}`, out);
    }
  }
}

function checkVerifyRuntime(job: Record<string, unknown>, mode: 'gate' | 'publish'): void {
  const steps = stepsOf(job);
  for (const step of steps) {
    if (isString(step['uses'])) {
      expect(step['uses'].startsWith('actions/checkout@')).toBe(false);
    }
    if (isString(step['run'])) {
      const run = step['run'];
      expect(run.includes('pnpm')).toBe(false);
      expect(run.includes('npm ')).toBe(false);
      expect(run.includes('corepack')).toBe(false);
      expect(run.includes('yarn')).toBe(false);
    }
  }

  const downloadIndex = steps.findIndex(
    (step) =>
      isString(step['uses']) &&
      step['uses'].startsWith('actions/download-artifact@') &&
      record(step['with'], 'with')['name'] === 'steward-runtime',
  );
  expect(downloadIndex).toBeGreaterThanOrEqual(0);

  const verifyIndex = steps.findIndex((step, index) => {
    if (index <= downloadIndex) {
      return false;
    }
    const env = step['env'];
    if (!isRecord(env) || env['RUNTIME_SHA256'] !== '${{ needs.build.outputs.runtime_sha256 }}') {
      return false;
    }
    const run = step['run'];
    if (!isString(run)) {
      return false;
    }
    return run.includes('sha256sum') && run.includes('52428800') && run.indexOf('52428800') < run.indexOf('tar -xzf');
  });
  expect(verifyIndex).toBeGreaterThan(downloadIndex);

  const coreIndex = steps.findIndex((step) => step['id'] === 'core');
  expect(coreIndex).toBeGreaterThan(verifyIndex);
  const coreStep = steps[coreIndex];
  if (coreStep === undefined) {
    throw new Error(`${mode} has no core step`);
  }
  const coreRun = str(coreStep['run'], `${mode}.core.run`);
  expect(coreRun.includes(`packages/action/dist/main.js" ${mode}`)).toBe(true);
}

const wText = readWorkflowText('../../../../.github/workflows/steward-screening.yml');
const pText = readWorkflowText('../../../../templates/workflows/steward-pr.yml');
const iText = readWorkflowText('../../../../templates/workflows/steward-issues.yml');

const W = record(parseWorkflow(wText), 'W');
const P = record(parseWorkflow(pText), 'P');
const I = record(parseWorkflow(iText), 'I');

describe('steward workflows', () => {
  it('the reusable workflow is callable only', () => {
    const on = record(W['on'], 'W.on');
    expect(Object.keys(on)).toEqual(['workflow_call']);
    const workflowCall = record(on['workflow_call'], 'W.on.workflow_call');

    const inputs = record(workflowCall['inputs'], 'W.on.workflow_call.inputs');
    expect(Object.keys(inputs)).toEqual(['steward_ref']);
    const stewardRef = record(inputs['steward_ref'], 'steward_ref');
    expect(stewardRef['required']).toBe(true);
    expect(stewardRef['type']).toBe('string');

    const secrets = record(workflowCall['secrets'], 'W.on.workflow_call.secrets');
    expect(Object.keys(secrets).sort()).toEqual(['PATCH_STEWARD_APP_ID', 'PATCH_STEWARD_APP_PRIVATE_KEY']);
    for (const key of Object.keys(secrets)) {
      expect(record(secrets[key], key)['required']).toBe(false);
    }

    expect(W['concurrency']).toBeUndefined();
    expect(W['run-name']).toBeUndefined();
  });

  it('every job declares empty permissions', () => {
    for (const [name, workflow] of [
      ['W', W],
      ['P', P],
      ['I', I],
    ] as const) {
      expect(workflow['permissions']).toEqual({});
      const jobs = jobsOf(workflow);
      for (const [id, job] of Object.entries(jobs)) {
        expect(record(job, `${name}.jobs.${id}`)['permissions']).toEqual({});
      }
    }
  });

  it('only gate and publish declare the publication environment', () => {
    const jobs = jobsOf(W);
    expect(Object.keys(jobs)).toEqual(['build', 'gate', 'publish']);

    const build = jobOf(W, 'build');
    const gate = jobOf(W, 'gate');
    const publish = jobOf(W, 'publish');
    for (const job of [gate, publish]) {
      expect(job['environment']).toEqual({ name: 'steward-publication', deployment: false });
      expect(Object.keys(record(job['environment'], 'environment')).sort()).toEqual(['deployment', 'name']);
    }
    expect('environment' in build).toBe(false);

    for (const wrapper of [P, I]) {
      for (const job of Object.values(jobsOf(wrapper))) {
        expect('environment' in record(job, 'wrapper job')).toBe(false);
      }
    }

    const gateSteps = stepsOf(gate);
    const publishSteps = stepsOf(publish);
    const gateCoreIndex = gateSteps.findIndex((step) => step['id'] === 'core');
    const publishCoreIndex = publishSteps.findIndex((step) => step['id'] === 'core');
    expect(gateCoreIndex).toBeGreaterThanOrEqual(0);
    expect(publishCoreIndex).toBeGreaterThanOrEqual(0);

    const gateCoreStep = gateSteps[gateCoreIndex];
    const publishCoreStep = publishSteps[publishCoreIndex];
    if (gateCoreStep === undefined || publishCoreStep === undefined) {
      throw new Error('gate or publish core step missing');
    }
    const gateCoreEnv = record(gateCoreStep['env'], 'gate.core.env');
    const publishCoreEnv = record(publishCoreStep['env'], 'publish.core.env');
    for (const [key, value] of Object.entries(SECRET_ENV)) {
      expect(gateCoreEnv[key]).toBe(value);
      expect(publishCoreEnv[key]).toBe(value);
    }

    const allowedPathPrefixes = [`jobs.gate.steps[${gateCoreIndex}].env.`, `jobs.publish.steps[${publishCoreIndex}].env.`];
    const strings: StringHit[] = [];
    collectStrings(W['jobs'], 'jobs', strings);
    for (const hit of strings) {
      if (hit.value.includes('secrets.')) {
        expect(allowedPathPrefixes.some((prefix) => hit.path.startsWith(prefix))).toBe(true);
      }
    }
  });

  it('the credential-free build job holds no secret', () => {
    const build = jobOf(W, 'build');
    const serialized = JSON.stringify(build);
    expect(serialized.includes('secrets.')).toBe(false);
    expect(serialized.includes('github.token')).toBe(false);
    expect('environment' in build).toBe(false);

    const steps = stepsOf(build);
    const first = steps[0];
    if (first === undefined) {
      throw new Error('build has no first step');
    }
    const firstRun = str(first['run'], 'build.steps[0].run');
    expect(firstRun.includes('^[0-9a-f]{40}$')).toBe(true);
    const firstEnv = record(first['env'], 'build.steps[0].env');
    expect(firstEnv['STEWARD_REF']).toBe('${{ inputs.steward_ref }}');

    const second = steps[1];
    if (second === undefined) {
      throw new Error('build has no second step');
    }
    const secondUses = str(second['uses'], 'build.steps[1].uses');
    expect(secondUses.startsWith('actions/checkout@')).toBe(true);
    const secondWith = record(second['with'], 'build.steps[1].with');
    expect(secondWith['repository']).toBe('steady-orchard/patch-steward');
    expect(secondWith['ref']).toBe('${{ inputs.steward_ref }}');
    expect(secondWith['path']).toBe('steward');
    expect(secondWith['persist-credentials']).toBe(false);

    const runTexts = steps.map((step) => (isString(step['run']) ? step['run'] : '')).join('\n');
    expect(runTexts.includes('corepack enable')).toBe(true);
    expect(runTexts.includes('pnpm install --frozen-lockfile --ignore-scripts')).toBe(true);
    expect(runTexts.includes('pnpm build')).toBe(true);

    const packStep = stepById(steps, 'pack');
    expect(str(packStep['run'], 'pack.run').includes('packages/action/pack-runtime.sh')).toBe(true);

    const uploadStep = steps.find((step) => isString(step['uses']) && step['uses'].startsWith('actions/upload-artifact@'));
    if (uploadStep === undefined) {
      throw new Error('build has no upload-artifact step');
    }
    const uploadWith = record(uploadStep['with'], 'upload.with');
    expect(uploadWith['name']).toBe('steward-runtime');
    expect(uploadWith['retention-days']).toBe(1);

    expect(build['outputs']).toEqual({ runtime_sha256: '${{ steps.pack.outputs.runtime_sha256 }}' });
  });

  it('gate and publish run the verified runtime without installing', () => {
    checkVerifyRuntime(jobOf(W, 'gate'), 'gate');
    checkVerifyRuntime(jobOf(W, 'publish'), 'publish');
  });

  it('every action and reusable workflow is pinned by full commit sha', () => {
    for (const job of Object.values(jobsOf(W))) {
      for (const step of stepsOf(record(job, 'job'))) {
        if (isString(step['uses'])) {
          expect(step['uses']).toMatch(USES_PATTERN);
          const name = step['uses'].split('@')[0] ?? '';
          expect(ALLOWED_ACTIONS.includes(name)).toBe(true);
        }
      }
    }

    for (const wrapper of [P, I]) {
      for (const job of Object.values(jobsOf(wrapper))) {
        const uses = record(job, 'job')['uses'];
        if (isString(uses)) {
          expect(uses).toMatch(USES_PATTERN);
        }
      }
    }

    for (const text of [wText, pText, iText]) {
      for (const line of text.split('\n')) {
        if (line.includes('uses: ')) {
          expect(line).toMatch(USES_LINE_PATTERN);
        }
      }
      expect(text.includes('pnpm/action-setup')).toBe(false);
      expect(text.includes('actions/cache')).toBe(false);
    }
  });

  it('the wrapper pin equals its steward_ref input', () => {
    for (const wrapper of [P, I]) {
      expect(Object.keys(jobsOf(wrapper))).toEqual(['screen']);
      const screen = jobOf(wrapper, 'screen');
      const uses = str(screen['uses'], 'screen.uses');
      expect(uses.startsWith(WRAPPER_USES_PREFIX)).toBe(true);
      const sha = uses.slice(WRAPPER_USES_PREFIX.length);
      expect(sha).toMatch(/^[0-9a-f]{40}$/);
      const withBlock = record(screen['with'], 'screen.with');
      const stewardRef = withBlock['steward_ref'];
      expect(typeof stewardRef).toBe('string');
      expect(stewardRef).toBe(sha);
    }
  });

  it('wrappers pass secrets by explicit mapping', () => {
    for (const [wrapper, text] of [
      [P, pText],
      [I, iText],
    ] as const) {
      const screen = jobOf(wrapper, 'screen');
      expect(screen['secrets']).toEqual(SECRET_ENV);
      expect(text.includes('inherit')).toBe(false);
    }
  });

  it('wrappers accept only the screened events', () => {
    const pOn = record(P['on'], 'P.on');
    expect(Object.keys(pOn)).toEqual(['pull_request_target']);
    const pTrigger = record(pOn['pull_request_target'], 'P.on.pull_request_target');
    expect(array(pTrigger['types'], 'P.on.pull_request_target.types')).toEqual([...PULL_REQUEST_EVENT_ACTIONS]);

    const iOn = record(I['on'], 'I.on');
    expect(Object.keys(iOn)).toEqual(['issues']);
    const iTrigger = record(iOn['issues'], 'I.on.issues');
    expect(array(iTrigger['types'], 'I.on.issues.types')).toEqual([...ISSUE_EVENT_ACTIONS]);

    expect(P['name']).toBe('steward-pr');
    expect(I['name']).toBe('steward-issues');

    const basenames = STEWARD_WRAPPER_PATHS.map((wrapperPath) => wrapperPath.split('/').pop());
    expect(basenames).toEqual(['steward-pr.yml', 'steward-issues.yml']);
  });

  it('jobs, timeouts, publish condition, and concurrency match the design', () => {
    const build = jobOf(W, 'build');
    const gate = jobOf(W, 'gate');
    const publish = jobOf(W, 'publish');

    for (const job of [build, gate, publish]) {
      expect(job['runs-on']).toBe('ubuntu-latest');
    }
    expect(build['timeout-minutes']).toBe(15);
    expect(gate['timeout-minutes']).toBe(10);
    expect(publish['timeout-minutes']).toBe(20);

    const gateNeeds = gate['needs'];
    const gateNeedsOk = gateNeeds === 'build' || (isArray(gateNeeds) && gateNeeds.length === 1 && gateNeeds[0] === 'build');
    expect(gateNeedsOk).toBe(true);

    expect(publish['needs']).toEqual(['build', 'gate']);
    expect(publish['if']).toBe(PUBLISH_IF);
    expect(publish['concurrency']).toEqual({ group: PUBLISH_GROUP, 'cancel-in-progress': false });

    expect('concurrency' in build).toBe(false);
    expect('concurrency' in gate).toBe(false);
  });

  it('gate outputs come from the core step and the commitment step', () => {
    const gate = jobOf(W, 'gate');
    expect(gate['outputs']).toEqual(GATE_OUTPUTS);

    const steps = stepsOf(gate);
    const ids = steps.map((step) => step['id']);
    expect(ids.includes('core')).toBe(true);
    expect(ids.includes('commitment')).toBe(true);

    const uploadSteps = steps.filter((step) => isString(step['uses']) && step['uses'].startsWith('actions/upload-artifact@'));
    expect(uploadSteps.length).toBe(3);
    const [handoff, closure, ownership] = uploadSteps;
    if (handoff === undefined || closure === undefined || ownership === undefined) {
      throw new Error('gate upload-artifact steps missing');
    }

    const handoffWith = record(handoff['with'], 'handoff.with');
    expect(handoffWith['name']).toBe('steward-handoff');
    expect(handoffWith['retention-days']).toBe(1);
    expect(handoffWith['if-no-files-found']).toBe('error');
    expect(handoff['if']).toBe("${{ steps.core.outputs.commit == 'true' }}");

    const closureWith = record(closure['with'], 'closure.with');
    expect(closureWith['name']).toBe('steward-closure');
    expect(closureWith['retention-days']).toBe(1);
    expect(closure['if']).toBe("${{ steps.core.outputs.record_only == 'true' }}");

    const ownershipWith = record(ownership['with'], 'ownership.with');
    expect(ownershipWith['name']).toBe('${{ steps.core.outputs.ownership_artifact }}');
    expect(ownershipWith['retention-days']).toBe(90);
    expect(ownershipWith['if-no-files-found']).toBe('error');
    expect(str(ownershipWith['path'], 'ownership.path').endsWith('steward/ownership/ownership.json')).toBe(true);

    const handoffIndex = steps.indexOf(handoff);
    const ownershipIndex = steps.indexOf(ownership);
    const commitmentIndex = steps.findIndex((step) => step['id'] === 'commitment');
    expect(handoffIndex).toBeLessThan(ownershipIndex);
    expect(ownershipIndex).toBeLessThan(commitmentIndex);

    const commitmentStep = steps[commitmentIndex];
    if (commitmentStep === undefined) {
      throw new Error('commitment step missing');
    }
    expect(commitmentStep['if']).toBe("${{ steps.core.outputs.commit == 'true' }}");
    const commitmentRun = str(commitmentStep['run'], 'commitment.run');
    expect(commitmentRun.includes('committed=true')).toBe(true);
    expect(commitmentRun.includes('GITHUB_OUTPUT')).toBe(true);

    const publish = jobOf(W, 'publish');
    const publishCore = stepById(stepsOf(publish), 'core');
    const publishEnv = record(publishCore['env'], 'publish.core.env');
    expect(publishEnv['STEWARD_GATE_DISPOSITION']).toBe('${{ needs.gate.outputs.disposition }}');
    expect(publishEnv['STEWARD_GATE_RECORD_ONLY']).toBe('${{ needs.gate.outputs.record_only }}');
    expect(publishEnv['STEWARD_GATE_SNAPSHOT_HASH']).toBe('${{ needs.gate.outputs.snapshot_hash }}');
    expect(publishEnv['STEWARD_GATE_POLICY_REVISION']).toBe('${{ needs.gate.outputs.policy_revision }}');
  });

  it('workflows use only the steward secret names', () => {
    for (const text of [wText, pText, iText]) {
      expect(PROBE_SECRET_PATTERN.test(text)).toBe(false);
    }
    expect(wText.includes('secrets.PATCH_STEWARD_APP_PRIVATE_KEY')).toBe(true);

    const pattern = /secrets\.([A-Za-z0-9_]+)/g;
    for (const text of [wText, pText, iText]) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        const name = match[1];
        expect(name === 'PATCH_STEWARD_APP_ID' || name === 'PATCH_STEWARD_APP_PRIVATE_KEY').toBe(true);
      }
    }
  });
});
