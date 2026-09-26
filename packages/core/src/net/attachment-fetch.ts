import { createHash } from 'node:crypto';

import { isPublicIpAddress } from './address-policy.js';
import type { ContentHash } from '../hash.js';
import { ATTACHMENT_URL_MAX_LENGTH } from '../policy/bounds.js';

export const ATTACHMENT_VIOLATION_RULES = ['destination', 'scheme', 'userinfo', 'file-bytes', 'total-bytes', 'redirects'] as const;
export type AttachmentViolationRule = (typeof ATTACHMENT_VIOLATION_RULES)[number];

export const ATTACHMENT_UNAVAILABLE_REASONS = [
  'dns',
  'private-address',
  'tls',
  'network',
  'timeout',
  'status',
  'redirect-invalid',
] as const;
export type AttachmentUnavailableReason = (typeof ATTACHMENT_UNAVAILABLE_REASONS)[number];

export type AttachmentTransportErrorReason = 'tls' | 'network' | 'timeout';

export interface AttachmentAddress {
  readonly address: string;
  readonly family: 4 | 6;
}

export type AttachmentResolver = (hostname: string) => Promise<readonly AttachmentAddress[]>;

export interface AttachmentTransportRequest {
  readonly url: URL;
  readonly address: string;
  readonly family: 4 | 6;
  readonly signal: AbortSignal;
}

export type AttachmentTransportResponse =
  | {
      readonly kind: 'response';
      readonly status: number;
      readonly location: string | null;
      readonly body: AsyncIterable<Uint8Array>;
      readonly close: () => void;
    }
  | { readonly kind: 'error'; readonly reason: AttachmentTransportErrorReason };

export type AttachmentTransport = (request: AttachmentTransportRequest) => Promise<AttachmentTransportResponse>;

export interface AttachmentFetchOptions {
  readonly destinations: readonly string[];
  readonly maxRedirects: number;
  readonly timeoutMs: number;
  readonly maxFileBytes: number;
  readonly remainingTotalBytes: number;
  readonly resolver: AttachmentResolver;
  readonly transport: AttachmentTransport;
}

export type AttachmentFetchOutcome =
  | {
      readonly kind: 'fetched';
      readonly url: string;
      readonly finalUrl: string;
      readonly redirects: number;
      readonly bytes: Buffer;
      readonly contentHash: ContentHash;
    }
  | { readonly kind: 'violation'; readonly url: string; readonly rule: AttachmentViolationRule; readonly message: string }
  | { readonly kind: 'unavailable'; readonly url: string; readonly reason: AttachmentUnavailableReason; readonly message: string };

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function violation(url: string, rule: AttachmentViolationRule, message: string): AttachmentFetchOutcome {
  return { kind: 'violation', url, rule, message };
}

function unavailable(url: string, reason: AttachmentUnavailableReason, message: string): AttachmentFetchOutcome {
  return { kind: 'unavailable', url, reason, message };
}

interface HopValidation {
  readonly ok: true;
  readonly parsed: URL;
}

interface HopValidationFailure {
  readonly ok: false;
  readonly outcome: AttachmentFetchOutcome;
}

function validateFirstUrl(inputUrl: string, destinations: readonly string[]): HopValidation | HopValidationFailure {
  if (inputUrl.length > ATTACHMENT_URL_MAX_LENGTH) {
    return { ok: false, outcome: violation(inputUrl, 'destination', 'The attachment URL exceeds the maximum length.') };
  }
  let parsed: URL;
  try {
    parsed = new URL(inputUrl);
  } catch {
    return { ok: false, outcome: violation(inputUrl, 'destination', 'The attachment URL could not be parsed.') };
  }
  return validateHop(inputUrl, parsed, destinations);
}

function validateHop(originalUrl: string, parsed: URL, destinations: readonly string[]): HopValidation | HopValidationFailure {
  if (parsed.protocol !== 'https:') {
    return { ok: false, outcome: violation(originalUrl, 'scheme', 'Only https attachment URLs are fetched.') };
  }
  if (parsed.username !== '' || parsed.password !== '') {
    return { ok: false, outcome: violation(originalUrl, 'userinfo', 'The attachment URL must not carry userinfo.') };
  }
  if (parsed.port !== '') {
    return { ok: false, outcome: violation(originalUrl, 'destination', 'The attachment URL must use the default port.') };
  }
  const host = parsed.hostname.toLowerCase();
  const allowed = destinations.some((d) => d.toLowerCase() === host);
  if (!allowed) {
    return { ok: false, outcome: violation(originalUrl, 'destination', 'The attachment host is not an approved destination.') };
  }
  return { ok: true, parsed };
}

export async function fetchAttachment(url: string, options: AttachmentFetchOptions): Promise<AttachmentFetchOutcome> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<'deadline'>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve('deadline');
    }, options.timeoutMs);
  });

  async function raceDeadline<T>(work: Promise<T>): Promise<T | 'deadline'> {
    return Promise.race([work, deadline]);
  }

  try {
    const first = validateFirstUrl(url, options.destinations);
    if (!first.ok) return first.outcome;

    let currentParsed = first.parsed;
    let redirects = 0;

    for (;;) {
      const hostname = currentParsed.hostname.toLowerCase();

      let resolved: readonly AttachmentAddress[];
      try {
        const raced = await raceDeadline(Promise.resolve(options.resolver(hostname)));
        if (raced === 'deadline') return unavailable(url, 'timeout', 'The attachment fetch exceeded the time bound.');
        resolved = raced;
      } catch {
        return unavailable(url, 'dns', 'The attachment host could not be resolved.');
      }
      if (resolved.length === 0) {
        return unavailable(url, 'dns', 'The attachment host could not be resolved.');
      }
      for (const candidate of resolved) {
        if (!isPublicIpAddress(candidate.address)) {
          return unavailable(url, 'private-address', 'The attachment host resolved to a non-public address.');
        }
      }

      const chosen = resolved[0];
      if (chosen === undefined) {
        return unavailable(url, 'dns', 'The attachment host could not be resolved.');
      }

      let response: AttachmentTransportResponse;
      try {
        const raced = await raceDeadline(
          Promise.resolve(
            options.transport({
              url: currentParsed,
              address: chosen.address,
              family: chosen.family,
              signal: controller.signal,
            }),
          ),
        );
        if (raced === 'deadline') return unavailable(url, 'timeout', 'The attachment fetch exceeded the time bound.');
        response = raced;
      } catch {
        return unavailable(url, 'network', 'The attachment fetch failed due to a network error.');
      }

      if (response.kind === 'error') {
        return unavailable(url, response.reason, 'The attachment fetch failed.');
      }

      if (REDIRECT_STATUSES.has(response.status)) {
        redirects += 1;
        response.close();
        if (redirects > options.maxRedirects) {
          return violation(url, 'redirects', 'The attachment fetch exceeded the redirect limit.');
        }
        const location = response.location;
        if (location === null || location.length > ATTACHMENT_URL_MAX_LENGTH) {
          return unavailable(url, 'redirect-invalid', 'The attachment redirect target is invalid.');
        }
        let nextParsed: URL;
        try {
          nextParsed = new URL(location, currentParsed);
        } catch {
          return unavailable(url, 'redirect-invalid', 'The attachment redirect target is invalid.');
        }
        const hop = validateHop(url, nextParsed, options.destinations);
        if (!hop.ok) return hop.outcome;
        currentParsed = hop.parsed;
        continue;
      }

      if (response.status < 200 || response.status > 299) {
        return unavailable(url, 'status', 'The attachment fetch returned an unsuccessful status.');
      }

      const limit = Math.min(options.maxFileBytes, options.remainingTotalBytes);
      const hasher = createHash('sha256');
      const chunks: Buffer[] = [];
      let total = 0;
      const iterator = response.body[Symbol.asyncIterator]();

      for (;;) {
        let step: IteratorResult<Uint8Array>;
        try {
          const raced = await raceDeadline(Promise.resolve(iterator.next()));
          if (raced === 'deadline') {
            response.close();
            void iterator.return?.();
            return unavailable(url, 'timeout', 'The attachment fetch exceeded the time bound.');
          }
          step = raced;
        } catch {
          response.close();
          return unavailable(url, 'network', 'The attachment fetch failed due to a network error.');
        }
        if (step.done) break;
        const chunk = Buffer.from(step.value);
        hasher.update(chunk);
        total += chunk.length;
        if (total > limit) {
          response.close();
          void iterator.return?.();
          if (total > options.maxFileBytes) {
            return violation(url, 'file-bytes', 'The attachment exceeded the maximum file size.');
          }
          return violation(url, 'total-bytes', 'The attachment exceeded the remaining total byte budget.');
        }
        chunks.push(chunk);
      }

      response.close();
      const bytes = Buffer.concat(chunks);
      return {
        kind: 'fetched',
        url,
        finalUrl: currentParsed.href,
        redirects,
        bytes,
        contentHash: `sha256:${hasher.digest('hex')}` as ContentHash,
      };
    }
  } catch {
    return unavailable(url, 'network', 'The attachment fetch failed unexpectedly.');
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
