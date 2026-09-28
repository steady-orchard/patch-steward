import { describe, expect, it } from 'vitest';
import {
  HOSTED_APP_ID_VARIABLE,
  HOSTED_APP_KEY_VARIABLE,
  hostedEventEnvironment,
  readGateEnvironment,
  readPublishEnvironment,
} from './hosted-environment.js';
import type { HostedEnvironmentVariables } from './hosted-environment.js';

const KEY = '-----' + 'BEGIN TEST KEY-----\n' + 'Q'.repeat(64) + '\n-----' + 'END TEST KEY-----\n';

function gateEnv(overrides: Record<string, string | undefined> = {}): HostedEnvironmentVariables {
  return {
    GITHUB_EVENT_NAME: 'issues',
    GITHUB_EVENT_PATH: '/tmp/event.json',
    GITHUB_REPOSITORY: 'steady-orchard/patch-steward-testbed-public',
    GITHUB_REPOSITORY_ID: '1376317064',
    GITHUB_REF: 'refs/heads/master',
    GITHUB_SERVER_URL: 'https://github.com',
    GITHUB_API_URL: 'https://api.github.com',
    GITHUB_RUN_ID: '36081628326',
    GITHUB_RUN_ATTEMPT: '1',
    RUNNER_TEMP: '/tmp/work',
    GITHUB_OUTPUT: '/tmp/work/output',
    GITHUB_STEP_SUMMARY: '/tmp/work/summary',
    PATCH_STEWARD_APP_ID: '4993303',
    PATCH_STEWARD_APP_PRIVATE_KEY: KEY,
    ...overrides,
  };
}

function publishEnv(overrides: Record<string, string | undefined> = {}): HostedEnvironmentVariables {
  return gateEnv({
    STEWARD_GATE_DISPOSITION: 'runnable',
    STEWARD_GATE_RECORD_ONLY: 'false',
    STEWARD_GATE_SNAPSHOT_HASH: 'sha256:' + 'a'.repeat(64),
    STEWARD_GATE_POLICY_REVISION: 'b'.repeat(40),
    ...overrides,
  });
}

describe('hosted environment', () => {
  it('a complete gate environment is read', () => {
    const env = gateEnv();
    const result = readGateEnvironment(env);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.job).toBe('gate');
    expect(result.value.eventName).toBe(env.GITHUB_EVENT_NAME);
    expect(result.value.eventPath).toBe(env.GITHUB_EVENT_PATH);
    expect(result.value.repository).toBe(env.GITHUB_REPOSITORY);
    expect(result.value.repositoryId).toBe(env.GITHUB_REPOSITORY_ID);
    expect(result.value.ref).toBe(env.GITHUB_REF);
    expect(result.value.serverUrl).toBe(env.GITHUB_SERVER_URL);
    expect(result.value.apiUrl).toBe(env.GITHUB_API_URL);
    expect(result.value.runId).toBe(env.GITHUB_RUN_ID);
    expect(result.value.runAttempt).toBe(env.GITHUB_RUN_ATTEMPT);
    expect(result.value.runnerTemp).toBe(env.RUNNER_TEMP);
    expect(result.value.outputPath).toBe(env.GITHUB_OUTPUT);
    expect(result.value.summaryPath).toBe(env.GITHUB_STEP_SUMMARY);
    expect(result.value.credentials).toEqual({ appId: '4993303', privateKey: KEY });
  });

  it('a publish environment carries the gate outputs', () => {
    const result = readPublishEnvironment(publishEnv());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.job).toBe('publish');
    expect(result.value.gate).toEqual({
      disposition: 'runnable',
      recordOnly: false,
      snapshotHash: 'sha256:' + 'a'.repeat(64),
      policyRevision: 'b'.repeat(40),
    });

    const closure = readPublishEnvironment(
      publishEnv({
        STEWARD_GATE_DISPOSITION: 'closure',
        STEWARD_GATE_RECORD_ONLY: 'true',
        STEWARD_GATE_SNAPSHOT_HASH: '',
      }),
    );
    expect(closure.ok).toBe(true);
    if (!closure.ok) return;
    expect(closure.value.gate.snapshotHash).toBeNull();
    expect(closure.value.gate.recordOnly).toBe(true);
    expect(closure.value.gate.disposition).toBe('closure');
  });

  it('a missing runner variable names the variable', () => {
    const runnerVariables = [
      'GITHUB_EVENT_NAME',
      'GITHUB_EVENT_PATH',
      'GITHUB_REPOSITORY',
      'GITHUB_REPOSITORY_ID',
      'GITHUB_REF',
      'GITHUB_SERVER_URL',
      'GITHUB_API_URL',
      'GITHUB_RUN_ID',
      'GITHUB_RUN_ATTEMPT',
      'RUNNER_TEMP',
      'GITHUB_OUTPUT',
      'GITHUB_STEP_SUMMARY',
    ] as const;
    for (const name of runnerVariables) {
      const result = readGateEnvironment(gateEnv({ [name]: undefined }));
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.failure.code).toBe('action.environment-invalid');
      expect(result.failure.details[0]?.path).toBe(name);
    }
  });

  it('malformed run identifiers are rejected', () => {
    const cases: Array<[Record<string, string | undefined>, string]> = [
      [{ GITHUB_RUN_ID: '0' }, 'GITHUB_RUN_ID'],
      [{ GITHUB_RUN_ID: '01' }, 'GITHUB_RUN_ID'],
      [{ GITHUB_RUN_ID: '1'.repeat(21) }, 'GITHUB_RUN_ID'],
      [{ GITHUB_RUN_ATTEMPT: '0' }, 'GITHUB_RUN_ATTEMPT'],
      [{ GITHUB_REPOSITORY_ID: 'x' }, 'GITHUB_REPOSITORY_ID'],
      [{ GITHUB_REF: 'refs/heads/' + String.fromCharCode(10) }, 'GITHUB_REF'],
    ];
    for (const [overrides, path] of cases) {
      const result = readGateEnvironment(gateEnv(overrides));
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.failure.code).toBe('action.environment-invalid');
      expect(result.failure.details[0]?.path).toBe(path);
    }
  });

  it('invalid gate outputs are rejected', () => {
    const cases: Array<[Record<string, string | undefined>, string]> = [
      [{ STEWARD_GATE_DISPOSITION: 'passed' }, 'STEWARD_GATE_DISPOSITION'],
      [{ STEWARD_GATE_RECORD_ONLY: 'yes' }, 'STEWARD_GATE_RECORD_ONLY'],
      [{ STEWARD_GATE_SNAPSHOT_HASH: 'sha256:xyz' }, 'STEWARD_GATE_SNAPSHOT_HASH'],
      [{ STEWARD_GATE_POLICY_REVISION: 'abc' }, 'STEWARD_GATE_POLICY_REVISION'],
      [{ STEWARD_GATE_POLICY_REVISION: undefined }, 'STEWARD_GATE_POLICY_REVISION'],
    ];
    for (const [overrides, path] of cases) {
      const result = readPublishEnvironment(publishEnv(overrides));
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.failure.code).toBe('action.environment-invalid');
      expect(result.failure.details[0]?.path).toBe(path);
    }
  });

  it('empty app credentials are unusable', () => {
    const cases: Array<[Record<string, string | undefined>, string]> = [
      [{ [HOSTED_APP_ID_VARIABLE]: '' }, HOSTED_APP_ID_VARIABLE],
      [{ [HOSTED_APP_ID_VARIABLE]: 'abc' }, HOSTED_APP_ID_VARIABLE],
      [{ [HOSTED_APP_ID_VARIABLE]: undefined }, HOSTED_APP_ID_VARIABLE],
      [{ [HOSTED_APP_KEY_VARIABLE]: '' }, HOSTED_APP_KEY_VARIABLE],
      [{ [HOSTED_APP_KEY_VARIABLE]: 'k'.repeat(16385) }, HOSTED_APP_KEY_VARIABLE],
    ];
    for (const [overrides, path] of cases) {
      const result = readGateEnvironment(gateEnv(overrides));
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.failure.code).toBe('app-auth.credentials-invalid');
      expect(result.failure.details[0]?.path).toBe(path);
    }

    const runnerFirst = readGateEnvironment(gateEnv({ GITHUB_RUN_ID: undefined, [HOSTED_APP_KEY_VARIABLE]: '' }));
    expect(runnerFirst.ok).toBe(false);
    if (!runnerFirst.ok) {
      expect(runnerFirst.failure.code).toBe('action.environment-invalid');
      expect(runnerFirst.failure.details[0]?.path).toBe('GITHUB_RUN_ID');
    }
  });

  it('environment failures never include a value', () => {
    const badKey = KEY;
    const badAppId = '9x' + 'secretish';
    const badRunnerTemp = 'value-sentinel' + String.fromCharCode(0);

    const keyResult = readGateEnvironment(gateEnv({ [HOSTED_APP_KEY_VARIABLE]: '' }));
    const appIdResult = readGateEnvironment(gateEnv({ [HOSTED_APP_ID_VARIABLE]: badAppId }));
    const runnerTempResult = readGateEnvironment(gateEnv({ RUNNER_TEMP: badRunnerTemp }));

    for (const result of [keyResult, appIdResult, runnerTempResult]) {
      const serialized = JSON.stringify(result);
      expect(serialized.includes(badKey)).toBe(false);
      expect(serialized.includes(badAppId)).toBe(false);
      expect(serialized.includes('value-sentinel')).toBe(false);
    }
  });

  it('the event environment maps runner variables', () => {
    const env = gateEnv();
    const result = readGateEnvironment(env);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(hostedEventEnvironment(result.value)).toEqual({
      eventName: 'issues',
      repository: env.GITHUB_REPOSITORY,
      repositoryId: '1376317064',
      ref: 'refs/heads/master',
      serverUrl: env.GITHUB_SERVER_URL,
      apiUrl: env.GITHUB_API_URL,
      runId: '36081628326',
      runAttempt: '1',
    });
  });
});
