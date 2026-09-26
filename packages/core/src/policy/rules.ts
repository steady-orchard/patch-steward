import type { FailureDetail } from '../result.js';
import { checkRedactionPattern } from '../redaction/safe-pattern.js';
import { CATEGORIES, ISSUE_CLASSIFICATIONS, LIFECYCLE_LABEL_STATES, BUILT_IN_DISMISSAL_CODES } from '../vocabulary.js';
import { DISMISSAL_CODE_PATTERN } from './catalog.js';
import type { PolicyValidationCode } from './catalog.js';
import type { Policy } from './schema.js';
import {
  LABEL_NAME_MAX_LENGTH,
  POLICY_ID_MAX_LENGTH,
  POLICY_PATH_MAX_LENGTH,
  PROJECT_DISMISSAL_CODES_MAX,
  DISMISSAL_DEFINITION_MAX_LENGTH,
  REDACTION_POLICY_PATTERNS_MAX,
} from './bounds.js';

export const RUNNER_DIRECTORY_PREFIX = '.github/patch-steward/runner/';
export const WORKFLOW_DIRECTORY_PREFIX = '.github/workflows/';

const RETIRED_MODEL_HOSTS_EXACT = new Set(['models.github.ai', 'models.inference.ai.azure.com']);
const RETIRED_MODEL_HOST_SUFFIXES = ['.models.github.ai', '.models.inference.ai.azure.com'];
const LOOPBACK_IPV4_PATTERN = /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

export function isValidRepositoryPath(path: string): boolean {
  if (path.length < 1 || path.length > POLICY_PATH_MAX_LENGTH) {
    return false;
  }
  for (let i = 0; i < path.length; i += 1) {
    const code = path.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) {
      return false;
    }
  }
  if (path.includes('\\')) {
    return false;
  }
  if (path.startsWith('/')) {
    return false;
  }
  if (path === '.') {
    return true;
  }
  const segments = path.split('/');
  for (const segment of segments) {
    if (segment.length === 0 || segment === '.' || segment === '..') {
      return false;
    }
  }
  return true;
}

function detail(code: PolicyValidationCode, path: string, message: string): FailureDetail {
  return { code, path, message, line: null, column: null };
}

function checkDuplicateIds(details: FailureDetail[], items: readonly { readonly id: string }[], listPath: string): void {
  const seen = new Set<string>();
  items.forEach((item, index) => {
    if (seen.has(item.id)) {
      details.push(detail('policy.duplicate-id', `${listPath}.${index}.id`, `Duplicate id in ${listPath}.`));
    } else {
      seen.add(item.id);
    }
  });
}

function checkRepositoryPath(details: FailureDetail[], path: string | null, detailPath: string): boolean {
  if (path === null) {
    return true;
  }
  if (!isValidRepositoryPath(path)) {
    details.push(detail('policy.invalid-path', detailPath, `Invalid repository path at ${detailPath}.`));
    return false;
  }
  return true;
}

interface BaseUrlCheckOk {
  readonly ok: true;
}
interface BaseUrlCheckFail {
  readonly ok: false;
}

function checkBaseUrl(url: string): BaseUrlCheckOk | BaseUrlCheckFail {
  if (url.length < 1 || url.length > POLICY_PATH_MAX_LENGTH) {
    return { ok: false };
  }
  if (!URL.canParse(url)) {
    return { ok: false };
  }
  const parsed = new URL(url);
  if (parsed.username !== '' || parsed.password !== '') {
    return { ok: false };
  }
  const host = parsed.hostname.toLowerCase();
  if (RETIRED_MODEL_HOSTS_EXACT.has(host)) {
    return { ok: false };
  }
  if (RETIRED_MODEL_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    return { ok: false };
  }
  if (parsed.protocol === 'https:') {
    return { ok: true };
  }
  if (parsed.protocol === 'http:' && (host === 'localhost' || host === '[::1]' || LOOPBACK_IPV4_PATTERN.test(host))) {
    return { ok: true };
  }
  return { ok: false };
}

function checkR1(policy: Policy, details: FailureDetail[]): void {
  checkDuplicateIds(details, policy.supported_behavior.components, 'supported_behavior.components');
  checkDuplicateIds(details, policy.supported_behavior.documents, 'supported_behavior.documents');
  checkDuplicateIds(details, policy.supported_behavior.decisions, 'supported_behavior.decisions');
  checkDuplicateIds(details, policy.supported_behavior.design_rules, 'supported_behavior.design_rules');
  checkDuplicateIds(details, policy.execution.commands, 'execution.commands');
  checkDuplicateIds(details, policy.execution.platforms, 'execution.platforms');
  checkDuplicateIds(details, policy.evidence.redaction_patterns, 'evidence.redaction_patterns');

  policy.execution.platforms.forEach((platform, platformIndex) => {
    const seen = new Set<string>();
    platform.commands.forEach((commandId, commandIndex) => {
      if (seen.has(commandId)) {
        details.push(
          detail(
            'policy.duplicate-id',
            `execution.platforms.${platformIndex}.commands.${commandIndex}`,
            'Duplicate command reference on platform.',
          ),
        );
      } else {
        seen.add(commandId);
      }
    });
  });
}

function checkR2(policy: Policy, details: FailureDetail[]): void {
  const declared = new Set(policy.execution.commands.map((command) => command.id));
  policy.execution.platforms.forEach((platform, platformIndex) => {
    platform.commands.forEach((commandId, commandIndex) => {
      if (!declared.has(commandId)) {
        details.push(
          detail(
            'policy.undeclared-reference',
            `execution.platforms.${platformIndex}.commands.${commandIndex}`,
            'Platform references a command that is not declared.',
          ),
        );
      }
    });
  });
}

function checkR3(policy: Policy, details: FailureDetail[]): void {
  policy.supported_behavior.components.forEach((component, componentIndex) => {
    component.paths.forEach((path, pathIndex) => {
      checkRepositoryPath(details, path, `supported_behavior.components.${componentIndex}.paths.${pathIndex}`);
    });
  });
  policy.supported_behavior.documents.forEach((document, index) => {
    checkRepositoryPath(details, document.path, `supported_behavior.documents.${index}.path`);
  });
  policy.supported_behavior.decisions.forEach((decisionEntry, index) => {
    checkRepositoryPath(details, decisionEntry.path, `supported_behavior.decisions.${index}.path`);
  });
  policy.trusted_paths.additional.forEach((path, index) => {
    checkRepositoryPath(details, path, `trusted_paths.additional.${index}`);
  });
  policy.execution_sensitive_paths.additional.forEach((path, index) => {
    checkRepositoryPath(details, path, `execution_sensitive_paths.additional.${index}`);
  });
  policy.execution.commands.forEach((command, commandIndex) => {
    checkRepositoryPath(details, command.working_directory, `execution.commands.${commandIndex}.working_directory`);
    command.result_files.forEach((resultFile, fileIndex) => {
      checkRepositoryPath(details, resultFile.path, `execution.commands.${commandIndex}.result_files.${fileIndex}.path`);
    });
  });
  policy.execution.platforms.forEach((platform, platformIndex) => {
    const path = `execution.platforms.${platformIndex}.ci_workflow`;
    if (platform.ci_workflow !== null && checkRepositoryPath(details, platform.ci_workflow, path)) {
      if (!platform.ci_workflow.startsWith(WORKFLOW_DIRECTORY_PREFIX) || !/\.ya?ml$/.test(platform.ci_workflow)) {
        details.push(detail('policy.invalid-path', path, 'CI workflow path must live under the workflows directory.'));
      }
    }
  });
  if (policy.runner.image.source === 'dockerfile') {
    const path = policy.runner.image.path;
    if (checkRepositoryPath(details, path, 'runner.image.path')) {
      if (!path.startsWith(RUNNER_DIRECTORY_PREFIX) || path.length <= RUNNER_DIRECTORY_PREFIX.length) {
        details.push(detail('policy.invalid-path', 'runner.image.path', 'Runner image path must live under the runner directory.'));
      }
    }
  }
  if (policy.runner.dependency_step !== null) {
    checkRepositoryPath(details, policy.runner.dependency_step.working_directory, 'runner.dependency_step.working_directory');
  }
  policy.stages.high_impact_paths.forEach((path, index) => {
    checkRepositoryPath(details, path, `stages.high_impact_paths.${index}`);
  });
  policy.escalation.sensitive_paths.forEach((path, index) => {
    checkRepositoryPath(details, path, `escalation.sensitive_paths.${index}`);
  });
}

function checkR4(policy: Policy, details: FailureDetail[]): void {
  policy.execution.platforms.forEach((platform, index) => {
    if (platform.source === 'container') {
      if (platform.os !== 'linux') {
        details.push(
          detail('policy.invalid-value', `execution.platforms.${index}.source`, 'Container platforms must use the linux OS.'),
        );
      }
      if (platform.ci_workflow !== null) {
        details.push(
          detail(
            'policy.invalid-value',
            `execution.platforms.${index}.ci_workflow`,
            'Container platforms must not declare a CI workflow.',
          ),
        );
      }
    } else if (platform.source === 'ci-signal') {
      if (platform.ci_workflow === null) {
        details.push(
          detail('policy.invalid-value', `execution.platforms.${index}.ci_workflow`, 'CI-signal platforms require a CI workflow.'),
        );
      }
    }
  });
}

function checkR5(policy: Policy, details: FailureDetail[]): void {
  const llm = policy.llm;
  if (llm === undefined) {
    return;
  }
  if (llm.provider === 'copilot-sdk') {
    if (llm.auth.type !== 'github-token') {
      details.push(detail('policy.llm-pairing', 'llm.auth.type', 'copilot-sdk requires the github-token auth type.'));
    }
    if (llm.options !== undefined) {
      details.push(detail('policy.llm-pairing', 'llm.options', 'copilot-sdk does not accept llm.options.'));
    }
    if (llm.limits.ai_credits_per_run === undefined) {
      details.push(detail('policy.missing-key', 'llm.limits.ai_credits_per_run', 'copilot-sdk requires ai_credits_per_run.'));
    }
    if (llm.limits.tokens_per_run !== undefined) {
      details.push(detail('policy.llm-pairing', 'llm.limits.tokens_per_run', 'copilot-sdk does not use tokens_per_run.'));
    }
    if (llm.limits.output_tokens_per_call !== undefined) {
      details.push(
        detail('policy.llm-pairing', 'llm.limits.output_tokens_per_call', 'copilot-sdk does not use output_tokens_per_call.'),
      );
    }
  } else if (llm.provider === 'openai-compatible') {
    if (llm.auth.type !== 'env') {
      details.push(detail('policy.llm-pairing', 'llm.auth.type', 'openai-compatible requires the env auth type.'));
    }
    if (llm.options === undefined) {
      details.push(detail('policy.missing-key', 'llm.options', 'openai-compatible requires llm.options.'));
    } else if (!checkBaseUrl(llm.options.base_url).ok) {
      details.push(detail('policy.llm-base-url', 'llm.options.base_url', 'llm.options.base_url is not an acceptable base URL.'));
    }
    if (llm.limits.ai_credits_per_run !== undefined) {
      details.push(
        detail('policy.llm-pairing', 'llm.limits.ai_credits_per_run', 'openai-compatible does not use ai_credits_per_run.'),
      );
    }
    if (llm.limits.tokens_per_run === undefined) {
      details.push(detail('policy.missing-key', 'llm.limits.tokens_per_run', 'openai-compatible requires tokens_per_run.'));
    }
    if (llm.limits.output_tokens_per_call === undefined) {
      details.push(
        detail('policy.missing-key', 'llm.limits.output_tokens_per_call', 'openai-compatible requires output_tokens_per_call.'),
      );
    }
  }
}

function checkR6(policy: Policy, details: FailureDetail[]): void {
  const perCategory = policy.stages.per_category;
  const anyChallenge = CATEGORIES.some((category) => perCategory[category].includes('challenge'));
  if (anyChallenge && policy.stages.challenge_rounds < 1) {
    details.push(
      detail('policy.stage-conflict', 'stages.challenge_rounds', 'challenge_rounds must be at least 1 when challenge is used.'),
    );
  }
  for (const category of CATEGORIES) {
    const hasFixVerification = perCategory[category].includes('fix-verification');
    const requiresRegressionTest = policy.categories[category].regression_test === 'required';
    if (hasFixVerification !== requiresRegressionTest) {
      details.push(
        detail(
          'policy.stage-conflict',
          `stages.per_category.${category}`,
          'fix-verification stage and regression_test requirement must match.',
        ),
      );
    }
  }
}

function isInvalidLabelName(name: string): boolean {
  const length = Array.from(name).length;
  if (length < 1 || length > LABEL_NAME_MAX_LENGTH) {
    return true;
  }
  if (name !== name.trim()) {
    return true;
  }
  for (let i = 0; i < name.length; i += 1) {
    const code = name.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) {
      return true;
    }
  }
  return false;
}

function checkR7(policy: Policy, details: FailureDetail[]): void {
  const seen = new Set<string>();
  for (const state of LIFECYCLE_LABEL_STATES) {
    const name = policy.labels.status[state];
    const path = `labels.status.${state}`;
    if (isInvalidLabelName(name)) {
      details.push(detail('policy.label-name', path, 'Label name is invalid.'));
      continue;
    }
    const lower = name.toLowerCase();
    if (seen.has(lower)) {
      details.push(detail('policy.label-name', path, 'Label name collides with another label case-insensitively.'));
      continue;
    }
    seen.add(lower);
  }
  for (const classification of ISSUE_CLASSIFICATIONS) {
    const name = policy.labels.classification[classification];
    const path = `labels.classification.${classification}`;
    if (isInvalidLabelName(name)) {
      details.push(detail('policy.label-name', path, 'Label name is invalid.'));
      continue;
    }
    const lower = name.toLowerCase();
    if (seen.has(lower)) {
      details.push(detail('policy.label-name', path, 'Label name collides with another label case-insensitively.'));
      continue;
    }
    seen.add(lower);
  }
}

const BUILT_IN_DISMISSAL_CODE_SET = new Set<string>(BUILT_IN_DISMISSAL_CODES);

function checkR8(policy: Policy, details: FailureDetail[]): void {
  const entries = policy.dismissal_codes;
  if (entries.length > PROJECT_DISMISSAL_CODES_MAX) {
    details.push(detail('policy.dismissal-code', 'dismissal_codes', 'Too many project dismissal codes.'));
  }
  const seenCodes = new Set<string>();
  entries.forEach((entry, index) => {
    const codePath = `dismissal_codes.${index}.code`;
    if (entry.code.length > POLICY_ID_MAX_LENGTH || !DISMISSAL_CODE_PATTERN.test(entry.code)) {
      details.push(detail('policy.dismissal-code', codePath, 'Dismissal code has an invalid form.'));
    } else if (BUILT_IN_DISMISSAL_CODE_SET.has(entry.code)) {
      details.push(detail('policy.dismissal-code', codePath, 'Dismissal code redefines a built-in code.'));
    } else if (seenCodes.has(entry.code)) {
      details.push(detail('policy.dismissal-code', codePath, 'Dismissal code is already declared.'));
    } else {
      seenCodes.add(entry.code);
    }

    const definitionPath = `dismissal_codes.${index}.definition`;
    const definitionLength = Array.from(entry.definition).length;
    if (definitionLength < 1 || definitionLength > DISMISSAL_DEFINITION_MAX_LENGTH || entry.definition.trim() === '') {
      details.push(detail('policy.dismissal-code', definitionPath, 'Dismissal code definition is invalid.'));
    }
  });
}

function checkR9(policy: Policy, details: FailureDetail[]): void {
  const patterns = policy.evidence.redaction_patterns;
  if (patterns.length > REDACTION_POLICY_PATTERNS_MAX) {
    details.push(detail('policy.redaction-pattern', 'evidence.redaction_patterns', 'Too many redaction patterns.'));
  }
  patterns.forEach((pattern, index) => {
    const violation = checkRedactionPattern(pattern.pattern);
    if (violation !== null) {
      details.push(
        detail(
          'policy.redaction-pattern',
          `evidence.redaction_patterns.${index}.pattern`,
          `Redaction pattern is unsafe: ${violation}.`,
        ),
      );
    }
  });
}

export function checkPolicyRules(policy: Policy): FailureDetail[] {
  const details: FailureDetail[] = [];
  checkR1(policy, details);
  checkR2(policy, details);
  checkR3(policy, details);
  checkR4(policy, details);
  checkR5(policy, details);
  checkR6(policy, details);
  checkR7(policy, details);
  checkR8(policy, details);
  checkR9(policy, details);
  return details;
}
