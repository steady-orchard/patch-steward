import * as dns from 'node:dns';
import * as https from 'node:https';
import type { LookupFunction } from 'node:net';
import type {
  AttachmentAddress,
  AttachmentResolver,
  AttachmentTransport,
  AttachmentTransportErrorReason,
  AttachmentTransportResponse,
} from './attachment-fetch.js';

export const ATTACHMENT_REQUEST_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  'user-agent': 'patch-steward',
  accept: '*/*',
  'accept-encoding': 'identity',
});

const TLS_ERROR_CODES: ReadonlySet<string> = new Set([
  'EPROTO',
  'CERT_HAS_EXPIRED',
  'CERT_NOT_YET_VALID',
  'CERT_UNTRUSTED',
  'CERT_REVOKED',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'HOSTNAME_MISMATCH',
]);

export function classifyTransportError(error: unknown, signal: AbortSignal): AttachmentTransportErrorReason {
  if (signal.aborted) {
    return 'timeout';
  }
  const code = typeof error === 'object' && error !== null && 'code' in error ? (error as { code?: unknown }).code : undefined;
  if (
    typeof code === 'string' &&
    (TLS_ERROR_CODES.has(code) || code.startsWith('ERR_TLS_') || code.startsWith('ERR_SSL_') || code.startsWith('CERT_'))
  ) {
    return 'tls';
  }
  return 'network';
}

export function pinnedLookup(address: string, family: 4 | 6): LookupFunction {
  return (_hostname, options, callback) => {
    if (options.all === true) {
      callback(null, [{ address, family }]);
      return;
    }
    callback(null, address, family);
  };
}

export const httpsAttachmentTransport: AttachmentTransport = (request) =>
  new Promise<AttachmentTransportResponse>((resolve) => {
    let settled = false;
    const settle = (value: AttachmentTransportResponse): void => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };
    const req = https.request(
      {
        protocol: 'https:',
        hostname: request.url.hostname,
        servername: request.url.hostname,
        port: request.url.port === '' ? 443 : Number(request.url.port),
        path: `${request.url.pathname}${request.url.search}`,
        method: 'GET',
        headers: { ...ATTACHMENT_REQUEST_HEADERS },
        agent: false,
        lookup: pinnedLookup(request.address, request.family),
        signal: request.signal,
      },
      (response) => {
        response.on('error', () => undefined);
        const location = response.headers.location;
        settle({
          kind: 'response',
          status: response.statusCode ?? 0,
          location: typeof location === 'string' ? location : null,
          body: response,
          close: () => {
            response.destroy();
          },
        });
      },
    );
    req.on('error', (error) => {
      settle({ kind: 'error', reason: classifyTransportError(error, request.signal) });
    });
    req.end();
  });

export const systemAttachmentResolver: AttachmentResolver = async (hostname) => {
  const results = await dns.promises.lookup(hostname, { all: true, verbatim: true });
  return results.map((result): AttachmentAddress => ({ address: result.address, family: result.family === 6 ? 6 : 4 }));
};
