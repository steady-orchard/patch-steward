import { downloadOwnershipRecord, listOwnershipArtifacts } from '../github/artifacts.js';
import type { GitHubClient } from '../github/client.js';
import type { GitHubRepositoryRef } from '../github/reader.js';
import { loadPolicy } from '../policy/loader.js';
import { OWNERSHIP_SETTLE_DELAY_MS } from '../policy/bounds.js';
import { ownershipArtifactName } from '../ownership/record.js';
import type { OwnershipRecord } from '../ownership/record.js';
import type {
  FreshnessDecisionInput,
  FreshnessUnknownReason,
  OwnArtifactReference,
  PublishFreshness,
  SuccessorRead,
} from '../ownership/freshness.js';
import { decidePublishFreshness, freshnessTop } from '../ownership/freshness.js';
import { captureIssue, capturePullRequest } from '../submission/intake.js';
import type { AttachmentResolver, AttachmentTransport } from '../net/attachment-fetch.js';
import type { SubmissionType } from '../vocabulary.js';
import type { Err } from '../result.js';
import { err } from '../result.js';

export const PUBLISH_FRESHNESS_FAILURE_CODES = ['publish.freshness-unknown'] as const;
export type PublishFreshnessFailureCode = (typeof PUBLISH_FRESHNESS_FAILURE_CODES)[number];

const FRESHNESS_UNKNOWN_MESSAGE = 'Publication freshness could not be confirmed.';

export function publishFreshnessFailure(reason: FreshnessUnknownReason): Err<PublishFreshnessFailureCode> {
  return err('publish.freshness-unknown', 'github-unavailable', FRESHNESS_UNKNOWN_MESSAGE, [
    { code: 'publish.freshness-unknown', path: reason, message: FRESHNESS_UNKNOWN_MESSAGE, line: null, column: null },
  ]);
}

export interface PublishFreshnessInput {
  readonly client: GitHubClient;
  readonly repository: GitHubRepositoryRef;
  readonly defaultBranch: string;
  readonly subject: { readonly type: SubmissionType; readonly number: number };
  readonly own: OwnArtifactReference;
  readonly record: OwnershipRecord;
}

export interface PublishFreshnessDeps {
  readonly resolver: AttachmentResolver;
  readonly transport: AttachmentTransport;
  readonly sleep: (ms: number) => Promise<void>;
  readonly settleMs?: number;
}

export interface PublishFreshnessResult {
  readonly freshness: PublishFreshness;
  readonly logLines: readonly string[];
}

export async function verifyPublishFreshness(
  input: PublishFreshnessInput,
  deps: PublishFreshnessDeps,
): Promise<PublishFreshnessResult> {
  try {
    const settleMs = deps.settleMs ?? OWNERSHIP_SETTLE_DELAY_MS;
    await deps.sleep(settleMs);
    const logLines: string[] = [`freshness settle ${String(settleMs)} ms`];

    const name = ownershipArtifactName(input.subject.type, input.subject.number);
    const listing = await listOwnershipArtifacts(input.client, input.repository, name);
    logLines.push(`freshness listing ${listing.ok ? 'ok' : 'unavailable'}`);
    const top = freshnessTop(listing.ok ? listing.value : null, name, input.own);

    let successor: SuccessorRead | null = null;
    if (top.kind === 'newer') {
      const downloaded = await downloadOwnershipRecord(
        input.client,
        input.repository,
        top.artifact,
        {
          repository: `${input.repository.owner}/${input.repository.name}`,
          type: input.subject.type,
          number: input.subject.number,
          artifactName: name,
          workflowRunId: top.artifact.workflowRunId,
        },
        { resolver: deps.resolver, transport: deps.transport },
      );
      successor = downloaded.ok
        ? { kind: 'valid', runId: downloaded.value.run_id, runAttempt: downloaded.value.run_attempt }
        : { kind: 'unavailable' };
    }

    let live: FreshnessDecisionInput['live'] = null;
    if (top.kind === 'own-newest') {
      const loaded = await loadPolicy({
        kind: 'github',
        client: input.client,
        repository: input.repository,
        branch: input.defaultBranch,
      });
      if (!loaded.ok) {
        live = { kind: 'unavailable' };
      } else {
        const capture =
          input.subject.type === 'issue'
            ? await captureIssue(
                {
                  client: input.client,
                  repository: input.repository,
                  policy: loaded.value.policy,
                  policyRevision: loaded.value.revision.id,
                  attachmentResolver: deps.resolver,
                  attachmentTransport: deps.transport,
                  authorResponses: [],
                },
                input.subject.number,
              )
            : await capturePullRequest(
                {
                  client: input.client,
                  repository: input.repository,
                  policy: loaded.value.policy,
                  policyRevision: loaded.value.revision.id,
                  attachmentResolver: deps.resolver,
                  attachmentTransport: deps.transport,
                  authorResponses: [],
                },
                input.subject.number,
              );
        live = capture.ok
          ? { kind: 'captured', snapshotHash: capture.value.snapshotHash, policyRevision: loaded.value.revision.id }
          : { kind: 'unavailable' };
      }
    }

    const freshness = decidePublishFreshness({
      top,
      successor,
      live,
      recorded: { snapshotHash: input.record.snapshot_hash, policyRevision: input.record.policy_revision },
    });

    if (freshness.kind === 'current') {
      logLines.push('freshness current');
    } else if (freshness.kind === 'superseded' && freshness.reason === 'newer-owner') {
      logLines.push(
        `freshness superseded newer-owner ${String(freshness.successor.run_id)}-${String(freshness.successor.run_attempt)}`,
      );
    } else if (freshness.kind === 'superseded' && freshness.reason === 'snapshot-changed') {
      logLines.push('freshness superseded snapshot-changed');
    } else if (freshness.kind === 'unknown') {
      logLines.push(`freshness unknown ${freshness.reason}`);
    }

    return { freshness, logLines };
  } catch {
    return { freshness: { kind: 'unknown', reason: 'listing-unavailable' }, logLines: [] };
  }
}
