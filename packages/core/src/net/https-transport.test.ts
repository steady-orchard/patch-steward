import * as net from 'node:net';
import { describe, expect, it } from 'vitest';

import {
  ATTACHMENT_REQUEST_HEADERS,
  classifyTransportError,
  httpsAttachmentTransport,
  pinnedLookup,
  systemAttachmentResolver,
} from './https-transport.js';
import type { AttachmentTransportRequest } from './attachment-fetch.js';

interface TestServer {
  readonly port: number;
  readonly connectionCount: () => number;
  readonly close: () => Promise<void>;
}

function startServer(handler: (socket: net.Socket) => void): Promise<TestServer> {
  return new Promise((resolve, reject) => {
    let connections = 0;
    const sockets = new Set<net.Socket>();
    const server = net.createServer((socket) => {
      connections += 1;
      sockets.add(socket);
      socket.on('error', () => undefined);
      socket.on('close', () => sockets.delete(socket));
      handler(socket);
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        reject(new Error('unexpected server address'));
        return;
      }
      resolve({
        port: address.port,
        connectionCount: () => connections,
        close: () =>
          new Promise<void>((closeResolve) => {
            for (const socket of sockets) {
              socket.destroy();
            }
            server.close(() => closeResolve());
          }),
      });
    });
  });
}

function makeRequest(port: number, signal: AbortSignal): AttachmentTransportRequest {
  return {
    url: new URL(`https://pinned.invalid:${port}/file.txt`),
    address: '127.0.0.1',
    family: 4,
    signal,
  };
}

describe('https-transport', () => {
  it('attachment rule: requests carry no credentials', () => {
    expect(Object.keys(ATTACHMENT_REQUEST_HEADERS)).toEqual(['user-agent', 'accept', 'accept-encoding']);
    expect(Object.isFrozen(ATTACHMENT_REQUEST_HEADERS)).toBe(true);
    for (const key of Object.keys(ATTACHMENT_REQUEST_HEADERS)) {
      expect(key).not.toMatch(/authorization|cookie|token|proxy/i);
    }
  });

  it('pinned lookup returns the validated address without resolving', () => {
    const lookup = pinnedLookup('140.82.114.3', 4);
    const allResults: unknown[] = [];
    lookup('anything.invalid', { all: true } as never, (...args: unknown[]) => {
      allResults.push(args);
    });
    expect(allResults).toEqual([[null, [{ address: '140.82.114.3', family: 4 }]]]);

    const singleResults: unknown[] = [];
    lookup('anything.invalid', {} as never, (...args: unknown[]) => {
      singleResults.push(args);
    });
    expect(singleResults).toEqual([[null, '140.82.114.3', 4]]);
  });

  it('transport errors are classified', () => {
    const notAborted = new AbortController().signal;
    const tlsCodes = [
      'ERR_TLS_CERT_ALTNAME_INVALID',
      'CERT_HAS_EXPIRED',
      'DEPTH_ZERO_SELF_SIGNED_CERT',
      'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
      'ERR_SSL_WRONG_VERSION_NUMBER',
      'EPROTO',
    ];
    for (const code of tlsCodes) {
      expect(classifyTransportError({ code }, notAborted)).toBe('tls');
    }

    const networkCodes = ['ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND'];
    for (const code of networkCodes) {
      expect(classifyTransportError({ code }, notAborted)).toBe('network');
    }
    expect(classifyTransportError({}, notAborted)).toBe('network');
    expect(classifyTransportError('not-an-object', notAborted)).toBe('network');

    const abortController = new AbortController();
    abortController.abort();
    expect(classifyTransportError({ code: 'EPROTO' }, abortController.signal)).toBe('timeout');
    expect(classifyTransportError(new Error('boom'), abortController.signal)).toBe('timeout');
  });

  it('https transport connects to the pinned address', async () => {
    const server = await startServer((socket) => {
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    });
    try {
      const controller = new AbortController();
      const result = await httpsAttachmentTransport(makeRequest(server.port, controller.signal));
      expect(server.connectionCount()).toBe(1);
      expect(result).toEqual({ kind: 'error', reason: 'tls' });
    } finally {
      await server.close();
    }
  });

  it('injected failure: https transport TLS failure', async () => {
    const server = await startServer((socket) => {
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    });
    try {
      const controller = new AbortController();
      const result = await httpsAttachmentTransport(makeRequest(server.port, controller.signal));
      expect(result).toEqual({ kind: 'error', reason: 'tls' });
    } finally {
      await server.close();
    }
  });

  it('injected failure: https transport connection reset', async () => {
    const server = await startServer((socket) => {
      socket.resetAndDestroy();
    });
    try {
      const controller = new AbortController();
      const result = await httpsAttachmentTransport(makeRequest(server.port, controller.signal));
      expect(result).toEqual({ kind: 'error', reason: 'network' });
    } finally {
      await server.close();
    }
  });

  it('injected failure: https transport timeout', async () => {
    const server = await startServer(() => {
      // Keep the socket open silently; do not respond.
    });
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 100);
      const result = await httpsAttachmentTransport(makeRequest(server.port, controller.signal));
      expect(result).toEqual({ kind: 'error', reason: 'timeout' });
    } finally {
      await server.close();
    }
  }, 5000);

  it('system resolver maps address families', async () => {
    const results = await systemAttachmentResolver('localhost');
    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      expect([4, 6]).toContain(result.family);
      expect(result.address.length).toBeGreaterThan(0);
    }
  });
});
