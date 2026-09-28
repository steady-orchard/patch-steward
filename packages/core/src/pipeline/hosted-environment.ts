import type { AppCredentials } from '../github/app-auth.js';
import type { EventEnvironment } from '../ownership/events.js';
import { err, ok } from '../result.js';
import type { Result } from '../result.js';
import { GATE_DISPOSITIONS } from '../vocabulary.js';
import type { GateDisposition } from '../vocabulary.js';

export const HOSTED_ENVIRONMENT_FAILURE_CODES = ['action.environment-invalid'] as const;
export type HostedEnvironmentFailureCode = (typeof HOSTED_ENVIRONMENT_FAILURE_CODES)[number];

export const HOSTED_APP_ID_VARIABLE = 'PATCH_STEWARD_APP_ID';
export const HOSTED_APP_KEY_VARIABLE = 'PATCH_STEWARD_APP_PRIVATE_KEY';

export interface HostedCommonEnvironment {
  readonly eventName: string;
  readonly eventPath: string;
  readonly repository: string;
  readonly repositoryId: string;
  readonly ref: string;
  readonly serverUrl: string;
  readonly apiUrl: string;
  readonly runId: string;
  readonly runAttempt: string;
  readonly runnerTemp: string;
  readonly outputPath: string;
  readonly summaryPath: string;
  readonly credentials: AppCredentials;
}

export interface HostedGateEnvironment extends HostedCommonEnvironment {
  readonly job: 'gate';
}

export interface HostedGateOutputValues {
  readonly disposition: GateDisposition;
  readonly recordOnly: boolean;
  readonly snapshotHash: string | null;
  readonly policyRevision: string | null;
}

export interface HostedPublishEnvironment extends HostedCommonEnvironment {
  readonly job: 'publish';
  readonly gate: HostedGateOutputValues;
}

export type HostedEnvironmentVariables = Readonly<Record<string, string | undefined>>;

type HostedFailureCode = HostedEnvironmentFailureCode | 'app-auth.credentials-invalid';
type HostedResult<T> = Result<T, HostedFailureCode>;

const RUNNER_VARIABLES = [
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

const RUN_ID_PATTERN = /^[1-9][0-9]{0,19}$/;
const RUN_ATTEMPT_PATTERN = /^[1-9][0-9]{0,4}$/;
const SNAPSHOT_HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;
const POLICY_REVISION_PATTERN = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const APP_ID_PATTERN = /^[1-9][0-9]{0,19}$/;

function environmentInvalid(name: string): Result<never, HostedFailureCode> {
  const message = 'The runner environment is incomplete or invalid.';
  return err('action.environment-invalid', 'infrastructure', message, [
    { code: 'action.environment-invalid', path: name, message, line: null, column: null },
  ]);
}

function credentialsInvalid(name: string): Result<never, HostedFailureCode> {
  const message = 'The GitHub App credentials are not usable.';
  return err('app-auth.credentials-invalid', 'credential-unusable', message, [
    { code: 'app-auth.credentials-invalid', path: name, message, line: null, column: null },
  ]);
}

// No control, DEL, or absent value; length within the runner's own transport bound.
function hasNoControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 32 || code === 127) {
      return false;
    }
  }
  return true;
}

function readRunnerVariable(env: HostedEnvironmentVariables, name: string): HostedResult<string> {
  const value = env[name];
  if (value === undefined || value.length < 1 || value.length > 4096 || !hasNoControlChars(value)) {
    return environmentInvalid(name);
  }
  if (name === 'GITHUB_REPOSITORY_ID' || name === 'GITHUB_RUN_ID') {
    if (!RUN_ID_PATTERN.test(value) || !Number.isSafeInteger(Number(value))) {
      return environmentInvalid(name);
    }
  } else if (name === 'GITHUB_RUN_ATTEMPT') {
    if (!RUN_ATTEMPT_PATTERN.test(value)) {
      return environmentInvalid(name);
    }
  }
  return ok(value);
}

function readRunnerVariables(env: HostedEnvironmentVariables): HostedResult<Record<(typeof RUNNER_VARIABLES)[number], string>> {
  const values: Partial<Record<(typeof RUNNER_VARIABLES)[number], string>> = {};
  for (const name of RUNNER_VARIABLES) {
    const read = readRunnerVariable(env, name);
    if (!read.ok) {
      return read;
    }
    values[name] = read.value;
  }
  return ok(values as Record<(typeof RUNNER_VARIABLES)[number], string>);
}

function readGateOutputValues(env: HostedEnvironmentVariables): HostedResult<HostedGateOutputValues> {
  const disposition = env.STEWARD_GATE_DISPOSITION;
  if (disposition === undefined || !(GATE_DISPOSITIONS as readonly string[]).includes(disposition)) {
    return environmentInvalid('STEWARD_GATE_DISPOSITION');
  }
  const recordOnlyRaw = env.STEWARD_GATE_RECORD_ONLY;
  if (recordOnlyRaw !== 'true' && recordOnlyRaw !== 'false') {
    return environmentInvalid('STEWARD_GATE_RECORD_ONLY');
  }
  const snapshotHashRaw = env.STEWARD_GATE_SNAPSHOT_HASH;
  if (snapshotHashRaw === undefined || (snapshotHashRaw !== '' && !SNAPSHOT_HASH_PATTERN.test(snapshotHashRaw))) {
    return environmentInvalid('STEWARD_GATE_SNAPSHOT_HASH');
  }
  const policyRevisionRaw = env.STEWARD_GATE_POLICY_REVISION;
  if (policyRevisionRaw === undefined || (policyRevisionRaw !== '' && !POLICY_REVISION_PATTERN.test(policyRevisionRaw))) {
    return environmentInvalid('STEWARD_GATE_POLICY_REVISION');
  }
  return ok({
    disposition: disposition as GateDisposition,
    recordOnly: recordOnlyRaw === 'true',
    snapshotHash: snapshotHashRaw === '' ? null : snapshotHashRaw,
    policyRevision: policyRevisionRaw === '' ? null : policyRevisionRaw,
  });
}

function readCredentials(env: HostedEnvironmentVariables): HostedResult<AppCredentials> {
  const appId = env[HOSTED_APP_ID_VARIABLE];
  if (appId === undefined || appId.length < 1 || !APP_ID_PATTERN.test(appId)) {
    return credentialsInvalid(HOSTED_APP_ID_VARIABLE);
  }
  const privateKey = env[HOSTED_APP_KEY_VARIABLE];
  if (privateKey === undefined || privateKey.length < 1 || privateKey.length > 16384) {
    return credentialsInvalid(HOSTED_APP_KEY_VARIABLE);
  }
  return ok({ appId, privateKey });
}

function buildCommon(
  values: Record<(typeof RUNNER_VARIABLES)[number], string>,
  credentials: AppCredentials,
): HostedCommonEnvironment {
  return {
    eventName: values.GITHUB_EVENT_NAME,
    eventPath: values.GITHUB_EVENT_PATH,
    repository: values.GITHUB_REPOSITORY,
    repositoryId: values.GITHUB_REPOSITORY_ID,
    ref: values.GITHUB_REF,
    serverUrl: values.GITHUB_SERVER_URL,
    apiUrl: values.GITHUB_API_URL,
    runId: values.GITHUB_RUN_ID,
    runAttempt: values.GITHUB_RUN_ATTEMPT,
    runnerTemp: values.RUNNER_TEMP,
    outputPath: values.GITHUB_OUTPUT,
    summaryPath: values.GITHUB_STEP_SUMMARY,
    credentials,
  };
}

export function readGateEnvironment(env: HostedEnvironmentVariables): HostedResult<HostedGateEnvironment> {
  const runnerValues = readRunnerVariables(env);
  if (!runnerValues.ok) {
    return runnerValues;
  }
  const credentials = readCredentials(env);
  if (!credentials.ok) {
    return credentials;
  }
  return ok({ ...buildCommon(runnerValues.value, credentials.value), job: 'gate' });
}

export function readPublishEnvironment(env: HostedEnvironmentVariables): HostedResult<HostedPublishEnvironment> {
  const runnerValues = readRunnerVariables(env);
  if (!runnerValues.ok) {
    return runnerValues;
  }
  const gate = readGateOutputValues(env);
  if (!gate.ok) {
    return gate;
  }
  const credentials = readCredentials(env);
  if (!credentials.ok) {
    return credentials;
  }
  return ok({ ...buildCommon(runnerValues.value, credentials.value), job: 'publish', gate: gate.value });
}

export function hostedEventEnvironment(environment: HostedCommonEnvironment): EventEnvironment {
  return {
    eventName: environment.eventName,
    repository: environment.repository,
    repositoryId: environment.repositoryId,
    ref: environment.ref,
    serverUrl: environment.serverUrl,
    apiUrl: environment.apiUrl,
    runId: environment.runId,
    runAttempt: environment.runAttempt,
  };
}
