import type { AttachmentAssessment, AttachmentAssessmentSet } from './attachments.js';
import { attachmentFormatFromUrl } from './attachments.js';
import type { ResolvedPolicy } from '../policy/schema.js';
import { ARCHIVE_ENTRY_NAME_MAX_BYTES } from '../policy/bounds.js';
import { fetchAttachment } from '../net/attachment-fetch.js';
import type { AttachmentResolver, AttachmentTransport } from '../net/attachment-fetch.js';
import { inspectGzipArchive, inspectZipArchive } from '../net/archive.js';

export interface SubmissionAttachmentFetchOptions {
  readonly policy: ResolvedPolicy;
  readonly resolver: AttachmentResolver;
  readonly transport: AttachmentTransport;
}

function lastPathSegment(url: string): string {
  const parsed = new URL(url);
  const pathname = parsed.pathname;
  const lastSlash = pathname.lastIndexOf('/');
  return lastSlash === -1 ? pathname : pathname.slice(lastSlash + 1);
}

function gzipEntryName(item: AttachmentAssessment, finalUrl: string): string {
  const segment = item.format !== null ? lastPathSegment(item.url) : lastPathSegment(finalUrl);
  const stripped = /\.gz$/i.test(segment) ? segment.slice(0, -3) : segment;
  const bytes = new TextEncoder().encode(stripped).length;
  return stripped.length === 0 || bytes > ARCHIVE_ENTRY_NAME_MAX_BYTES ? 'attachment' : stripped;
}

export async function fetchSubmissionAttachments(
  set: AttachmentAssessmentSet,
  options: SubmissionAttachmentFetchOptions,
): Promise<AttachmentAssessmentSet> {
  if (set.countExceeded) {
    return set;
  }

  const { policy, resolver, transport } = options;
  const limits = policy.limits.attachments;
  const destinations = policy.submission.attachments.destinations;
  let remaining = limits.total_bytes;

  const items: AttachmentAssessment[] = [];
  for (const item of set.items) {
    if (item.status !== 'pending') {
      items.push(item);
      continue;
    }

    const outcome = await fetchAttachment(item.url, {
      destinations,
      maxRedirects: limits.redirects,
      timeoutMs: limits.fetch_seconds * 1000,
      maxFileBytes: limits.file_bytes,
      remainingTotalBytes: remaining,
      resolver,
      transport,
    });

    if (outcome.kind === 'violation') {
      items.push({ ...item, status: 'violation', rule: outcome.rule });
      continue;
    }
    if (outcome.kind === 'unavailable') {
      items.push({ ...item, status: 'unavailable', reason: outcome.reason });
      continue;
    }

    remaining -= outcome.bytes.length;
    const bytes = outcome.bytes.length;
    const contentHash = outcome.contentHash;
    const format = item.format ?? attachmentFormatFromUrl(outcome.finalUrl);

    if (format === null || !policy.submission.attachments.formats.includes(format)) {
      items.push({ ...item, status: 'violation', rule: 'format', bytes, contentHash, format });
      continue;
    }

    if (format === 'zip') {
      const inspection = inspectZipArchive(outcome.bytes, limits.decompressed_bytes);
      if (inspection.kind === 'violation') {
        items.push({ ...item, status: 'violation', rule: inspection.rule, bytes, contentHash, format, entries: null });
      } else {
        items.push({ ...item, status: 'fetched', bytes, contentHash, format, entries: inspection.entries });
      }
      continue;
    }

    if (format === 'gz') {
      const entryName = gzipEntryName(item, outcome.finalUrl);
      const inspection = inspectGzipArchive(outcome.bytes, limits.decompressed_bytes, entryName);
      if (inspection.kind === 'violation') {
        items.push({ ...item, status: 'violation', rule: inspection.rule, bytes, contentHash, format, entries: null });
      } else {
        items.push({ ...item, status: 'fetched', bytes, contentHash, format, entries: inspection.entries });
      }
      continue;
    }

    items.push({ ...item, status: 'fetched', bytes, contentHash, format, entries: null });
  }

  return { limit: set.limit, countExceeded: set.countExceeded, items };
}
