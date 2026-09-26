import process from 'node:process';

import type {
  ContractDisposition,
  GitHubFetch,
  GitHubRepositoryRef,
  LinkedIssueCheck,
  ProposedPolicyCheck,
} from '@patch-steward/core';
import {
  DEFAULT_CHECKLIST_POLICY,
  GIT_OUTPUT_MAX_BYTES,
  GIT_TIMEOUT_MS,
  assessAttachmentsStatically,
  checkContract,
  contentHash,
  contractRequiredFields,
  createGitHubClient,
  detectPathFlags,
  changedPathSet,
  effectiveIssueBody,
  findMergeBase,
  findUpstreamRemote,
  githubBudgetForPreflight,
  linkedIssueReference,
  listChangedPaths,
  loadPolicy,
  readIssue,
  readProposedPolicyFromGit,
  readRepository,
  resolveCommit,
} from '@patch-steward/core';

import type { PolicyCommandContext } from './policy-command.js';
import type { GitHubAuthFailureCode } from './github-auth.js';
import { GITHUB_AUTH_FAILURE_CODES, resolveGitHubAuth } from './github-auth.js';
import type { PreflightUsageCode } from './preflight-args.js';
import { PREFLIGHT_USAGE, PREFLIGHT_USAGE_CODES, parsePreflightArgs } from './preflight-args.js';
import type { PreflightDraftFailureCode } from './preflight-draft.js';
import { PREFLIGHT_DRAFT_FAILURE_CODES, readPreflightDraft } from './preflight-draft.js';
import type { PreflightError, PreflightPathsReport, PreflightReport, PreflightWarning } from './preflight-output.js';
import { PREFLIGHT_NOTICE, renderPreflightJson, renderPreflightText } from './preflight-output.js';

export interface PreflightCommandContext extends PolicyCommandContext {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly fetch?: GitHubFetch;
  readonly ghBinary?: string;
}

export type PreflightExitCode = 0 | 1 | 2;

export const PREFLIGHT_COMMAND_FAILURE_CODES = [
  'preflight.no-upstream',
  'preflight.head-unresolvable',
  'preflight.base-unresolvable',
  'preflight.repository-unavailable',
  'preflight.token-rejected',
  'preflight.policy-invalid',
  'steward.internal-error',
] as const;

export type PreflightCommandFailureCode = (typeof PREFLIGHT_COMMAND_FAILURE_CODES)[number];

export type PreflightFailureCode =
  PreflightUsageCode | PreflightDraftFailureCode | GitHubAuthFailureCode | PreflightCommandFailureCode;

export const PREFLIGHT_FAILURE_CODES: readonly PreflightFailureCode[] = Object.freeze([
  ...PREFLIGHT_USAGE_CODES,
  ...PREFLIGHT_DRAFT_FAILURE_CODES,
  ...GITHUB_AUTH_FAILURE_CODES,
  ...PREFLIGHT_COMMAND_FAILURE_CODES,
]);

export const PREFLIGHT_EXIT_BY_DISPOSITION: { readonly [K in ContractDisposition]: PreflightExitCode } = Object.freeze({
  met: 0,
  'needs-changes': 1,
  uncertain: 1,
  inconclusive: 2,
});

export const PREFLIGHT_UNAUTHENTICATED_WARNING =
  'No GitHub token was found in GH_TOKEN, GITHUB_TOKEN, or gh auth token; reading unauthenticated with a lower rate limit.';

export const PREFLIGHT_FORMAT_UNVERIFIED_WARNING =
  'The attachment format cannot be determined before fetching; screening checks it.';

interface RunState {
  submission: PreflightReport['submission'];
  repository: string | null;
  policy: PreflightReport['policy'];
  warnings: PreflightWarning[];
}

function emit(context: PreflightCommandContext, report: PreflightReport, json: boolean): void {
  if (json) {
    context.io.stdout(renderPreflightJson(report));
    return;
  }
  const t = renderPreflightText(report);
  if (t.stdout !== '') {
    context.io.stdout(t.stdout);
  }
  if (t.stderr !== '') {
    context.io.stderr(t.stderr);
  }
  if (report.errors.some((e) => e.code.startsWith('usage.'))) {
    context.io.stderr(`${PREFLIGHT_USAGE}\n`);
  }
}

function fail(
  context: PreflightCommandContext,
  state: RunState,
  json: boolean,
  errors: readonly PreflightError[],
): PreflightExitCode {
  const report: PreflightReport = {
    schema_version: 1,
    unverified: true,
    notice: PREFLIGHT_NOTICE,
    submission: state.submission,
    repository: state.repository,
    policy: state.policy,
    contract: null,
    paths: null,
    warnings: state.warnings,
    errors,
  };
  emit(context, report, json);
  return 2;
}

function singleError(code: string, message: string): PreflightError[] {
  return [{ code, path: '', message }];
}

export async function runPreflightCommand(argv: readonly string[], context: PreflightCommandContext): Promise<PreflightExitCode> {
  const parsed = parsePreflightArgs(argv);
  if (!parsed.ok) {
    const state: RunState = { submission: null, repository: null, policy: null, warnings: [] };
    return fail(context, state, parsed.json, singleError(parsed.code, parsed.message));
  }

  const args = parsed.args;
  const json = args.json;
  const isPullRequest = args.submission.type === 'pull_request';
  const state: RunState = {
    submission: isPullRequest
      ? { type: 'pull_request', issue_kind: null }
      : { type: 'issue', issue_kind: args.submission.issueKind },
    repository: null,
    policy: null,
    warnings: [],
  };

  try {
    const draftResult = await readPreflightDraft(context.cwd, args.draft, args.submission.type);
    if (!draftResult.ok) {
      return fail(context, state, json, singleError(draftResult.code, draftResult.message));
    }
    const draft = draftResult.draft;

    const gitOptions = {
      repoDir: context.cwd,
      timeoutMs: GIT_TIMEOUT_MS,
      maxOutputBytes: GIT_OUTPUT_MAX_BYTES,
      ...(context.gitBinary !== undefined ? { gitBinary: context.gitBinary } : {}),
      ...(context.runner !== undefined ? { runner: context.runner } : {}),
    };

    let remote: { readonly remote: string; readonly owner: string; readonly name: string } | null = null;
    if (args.repository === null || (isPullRequest && args.base === null)) {
      const remoteResult = await findUpstreamRemote(gitOptions);
      if (!remoteResult.ok) {
        return fail(context, state, json, singleError(remoteResult.failure.code, remoteResult.failure.message));
      }
      remote = remoteResult.value;
    }

    const ref: GitHubRepositoryRef | null =
      args.repository ?? (remote !== null ? { owner: remote.owner, name: remote.name } : null);
    if (ref === null) {
      return fail(
        context,
        state,
        json,
        singleError('preflight.no-upstream', 'No GitHub remote named upstream or origin was found; pass --repo owner/name.'),
      );
    }
    state.repository = `${ref.owner}/${ref.name}`;
    const refValue: GitHubRepositoryRef = ref;

    const trackingRemote =
      remote !== null &&
      remote.owner.toLowerCase() === ref.owner.toLowerCase() &&
      remote.name.toLowerCase() === ref.name.toLowerCase()
        ? remote
        : null;

    let head: string | null = null;
    if (isPullRequest) {
      const headResult = await resolveCommit(gitOptions, 'HEAD');
      if (!headResult.ok) {
        if (headResult.failure.code === 'git.ref-unresolvable') {
          return fail(
            context,
            state,
            json,
            singleError('preflight.head-unresolvable', 'HEAD does not name a commit; commit the change before running preflight.'),
          );
        }
        return fail(context, state, json, singleError(headResult.failure.code, headResult.failure.message));
      }
      head = headResult.value;
    }

    const authResult = await resolveGitHubAuth({
      env: context.env ?? process.env,
      cwd: context.cwd,
      ...(context.runner !== undefined ? { runner: context.runner } : {}),
      ...(context.ghBinary !== undefined ? { ghBinary: context.ghBinary } : {}),
    });
    if (!authResult.ok) {
      return fail(context, state, json, singleError(authResult.code, authResult.message));
    }
    const auth = authResult.auth;
    if (auth.source === 'none') {
      state.warnings.push({ code: 'github.unauthenticated', message: PREFLIGHT_UNAUTHENTICATED_WARNING, subjects: [] });
    }

    const client = createGitHubClient({
      token: auth.token,
      budget: githubBudgetForPreflight(),
      ...(context.fetch !== undefined ? { fetch: context.fetch } : {}),
    });
    const tokenPresent = auth.token !== null;

    function mapGitHubFailure(code: string, message: string, forRepositoryRead: boolean): PreflightExitCode {
      if (code === 'github.unauthorized' && tokenPresent) {
        return fail(
          context,
          state,
          json,
          singleError('preflight.token-rejected', 'GitHub rejected the token; no unauthenticated fallback was attempted.'),
        );
      }
      if (forRepositoryRead && code === 'github.not-found') {
        const name = `${refValue.owner}/${refValue.name}`;
        const msg = tokenPresent
          ? `The repository ${name} does not exist or the token cannot read it.`
          : `The repository ${name} does not exist or is private; set GH_TOKEN or GITHUB_TOKEN, or log in with gh.`;
        return fail(context, state, json, singleError('preflight.repository-unavailable', msg));
      }
      return fail(context, state, json, singleError(code, message));
    }

    const repoResult = await readRepository(client, ref);
    if (!repoResult.ok) {
      return mapGitHubFailure(repoResult.failure.code, repoResult.failure.message, true);
    }
    const fullName = repoResult.value.fullName;
    const defaultBranch = repoResult.value.defaultBranch;
    state.repository = fullName;

    let policy = DEFAULT_CHECKLIST_POLICY;
    const loaded = await loadPolicy({ kind: 'github', client, repository: ref, branch: defaultBranch });
    if (loaded.ok) {
      const revision = loaded.value.revision;
      if (revision.kind === 'git-tree') {
        state.policy = {
          source: 'published',
          repository: fullName,
          ref: defaultBranch,
          commit: revision.commit,
          revision: revision.id,
        };
      }
      policy = loaded.value.policy;
    } else if (loaded.failure.code === 'policy-source.not-published') {
      state.policy = { source: 'default-checklist', repository: fullName, ref: defaultBranch, commit: null, revision: null };
    } else if (loaded.failure.code.startsWith('github.')) {
      return mapGitHubFailure(loaded.failure.code, loaded.failure.message, false);
    } else {
      const errors: PreflightError[] = [
        {
          code: 'preflight.policy-invalid',
          path: '',
          message: `The published policy of ${fullName} on ${defaultBranch} is invalid; no default checklist was substituted.`,
        },
      ];
      if (loaded.failure.details.length > 0) {
        for (const detail of loaded.failure.details) {
          errors.push({ code: detail.code, path: detail.path, message: detail.message });
        }
      } else {
        errors.push({ code: loaded.failure.code, path: '', message: loaded.failure.message });
      }
      return fail(context, state, json, errors);
    }

    const contractRepository = { fullName, defaultBranch };
    let contract;
    let paths: PreflightPathsReport | null = null;

    if (!isPullRequest) {
      const kind = args.submission.issueKind;
      const body = draft.body;
      const requiredFields = contractRequiredFields(policy, { type: 'issue', body, requestedKind: kind });
      const attachments = assessAttachmentsStatically({
        body: effectiveIssueBody(body, kind),
        bodyText: draft.text,
        requiredFields,
        policy,
      });
      contract = checkContract({ type: 'issue', repository: contractRepository, policy, body, requestedKind: kind, attachments });
    } else {
      const headId = head as string;
      const baseRef = args.base ?? (trackingRemote !== null ? `refs/remotes/${trackingRemote.remote}/${defaultBranch}` : null);
      if (baseRef === null) {
        return fail(
          context,
          state,
          json,
          singleError(
            'preflight.base-unresolvable',
            `No remote-tracking branch for ${fullName} ${defaultBranch} was found; run git fetch or pass --base <ref>.`,
          ),
        );
      }
      const baseResult = await resolveCommit(gitOptions, baseRef);
      if (!baseResult.ok) {
        if (baseResult.failure.code === 'git.ref-unresolvable' || baseResult.failure.code === 'git.invalid-ref') {
          return fail(
            context,
            state,
            json,
            singleError('preflight.base-unresolvable', `${baseRef} does not name a commit; run git fetch or pass --base <ref>.`),
          );
        }
        return fail(context, state, json, singleError(baseResult.failure.code, baseResult.failure.message));
      }
      const base = baseResult.value;

      const mergeBaseResult = await findMergeBase(gitOptions, base, headId);
      if (!mergeBaseResult.ok) {
        return fail(context, state, json, singleError(mergeBaseResult.failure.code, mergeBaseResult.failure.message));
      }
      const mergeBase = mergeBaseResult.value;

      const changedResult = await listChangedPaths(gitOptions, mergeBase, headId);
      if (!changedResult.ok) {
        return fail(context, state, json, singleError(changedResult.failure.code, changedResult.failure.message));
      }
      const changed = changedResult.value;

      const body = draft.body;
      let linkedIssue: LinkedIssueCheck;
      const lv = linkedIssueReference(body, fullName);
      if (lv.status === 'one') {
        const issueResult = await readIssue(client, ref, lv.number);
        if (issueResult.ok) {
          linkedIssue = {
            status: 'exists',
            number: lv.number,
            contentHash: contentHash(new TextEncoder().encode(issueResult.value.body ?? '')),
          };
        } else if (issueResult.failure.code === 'github.not-found' || issueResult.failure.code === 'github.not-an-issue') {
          linkedIssue = { status: 'not-found', number: lv.number };
        } else {
          linkedIssue = { status: 'unavailable', number: lv.number, failure: issueResult.failure };
        }
      } else {
        linkedIssue = { status: 'not-checked' };
      }

      let proposedPolicy: ProposedPolicyCheck;
      if (
        changed.kind === 'complete' &&
        detectPathFlags(changedPathSet(changed.changes), {
          trusted: policy.trusted_paths.additional,
          executionSensitive: policy.execution_sensitive_paths.additional,
        }).policy.length > 0
      ) {
        const proposedResult = await readProposedPolicyFromGit(gitOptions, headId);
        proposedPolicy = proposedResult.ok
          ? { status: 'read', proposed: proposedResult.value }
          : { status: 'unavailable', failure: proposedResult.failure };
      } else {
        proposedPolicy = { status: 'not-read' };
      }

      const requiredFields = contractRequiredFields(policy, { type: 'pull_request', body });
      const attachments = assessAttachmentsStatically({ body, bodyText: draft.text, requiredFields, policy });
      contract = checkContract({
        type: 'pull_request',
        repository: contractRepository,
        policy,
        body,
        changedPaths: changed,
        linkedIssue,
        sharedHeads: { status: 'not-applicable' },
        proposedPolicy,
        attachments,
      });

      const flags = contract.flags;
      paths = {
        base,
        head: headId,
        merge_base: mergeBase,
        changed: changed.kind === 'complete' ? changed.changes.length : null,
        trusted_changed: flags !== null ? flags.trusted_paths_changed : false,
        execution_sensitive_changed: flags !== null ? flags.execution_sensitive_paths_changed : false,
        policy_changed: flags !== null ? flags.policy_changed : false,
        trusted_paths: flags !== null ? flags.trusted_paths : [],
        execution_sensitive_paths: flags !== null ? flags.execution_sensitive_paths : [],
        policy_paths: flags !== null ? flags.policy_paths : [],
        policy_change: flags !== null ? flags.policy_change : null,
      };
    }

    for (const warning of contract.warnings) {
      state.warnings.push({ code: warning.code, message: PREFLIGHT_FORMAT_UNVERIFIED_WARNING, subjects: warning.subjects });
    }

    const report: PreflightReport = {
      schema_version: 1,
      unverified: true,
      notice: PREFLIGHT_NOTICE,
      submission: state.submission,
      repository: fullName,
      policy: state.policy,
      contract: {
        disposition: contract.disposition,
        findings: contract.findings,
        requests: contract.requests,
        inconclusive: contract.inconclusive,
        category: contract.category,
        plausible_categories: contract.plausible_categories,
        effective_mode: contract.effective_mode,
        enforced: contract.enforced,
        template: contract.template,
      },
      paths,
      warnings: state.warnings,
      errors: [],
    };
    emit(context, report, json);
    return PREFLIGHT_EXIT_BY_DISPOSITION[contract.disposition];
  } catch {
    return fail(
      context,
      state,
      json,
      singleError('steward.internal-error', 'The steward failed unexpectedly; no contract result was produced.'),
    );
  }
}
