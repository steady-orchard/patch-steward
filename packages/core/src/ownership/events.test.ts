import { describe, expect, it } from 'vitest';

import { EVENT_PAYLOAD_MAX_BYTES } from '../policy/bounds.js';
import { authenticateEvent, closureResolution, eventIdentity, stewardConcurrencyGroup } from './events.js';
import type { AuthenticatedEvent, EventEnvironment } from './events.js';

const baseEnvironment: EventEnvironment = {
  eventName: 'pull_request_target',
  repository: 'steady-orchard/patch-steward-testbed-public',
  repositoryId: '1068416373',
  ref: 'refs/heads/master',
  serverUrl: 'https://github.com',
  apiUrl: 'https://api.github.com',
  runId: '36081628326',
  runAttempt: '1',
};

function environment(overrides: Partial<EventEnvironment> = {}): EventEnvironment {
  return { ...baseEnvironment, ...overrides };
}

function pullRequestPayload(overrides: Record<string, unknown> = {}) {
  return {
    action: 'opened',
    number: 12,
    pull_request: {
      id: 555,
      number: 12,
      updated_at: '2026-09-27T10:00:00Z',
      user: { id: 42 },
      merged: false,
      title: 'Fix the bug',
      body: 'Detailed description',
      labels: [{ name: 'bug' }],
    },
    repository: {
      id: 1068416373,
      full_name: 'steady-orchard/patch-steward-testbed-public',
      default_branch: 'master',
    },
    sender: { id: 42, type: 'User' },
    ...overrides,
  };
}

function issuePayload(overrides: Record<string, unknown> = {}) {
  return {
    action: 'opened',
    issue: {
      id: 777,
      number: 29,
      updated_at: '2026-09-27T10:00:00Z',
      user: { id: 42 },
      title: 'A defect',
      body: 'Steps to reproduce',
      labels: [{ name: 'defect' }],
    },
    repository: {
      id: 1068416373,
      full_name: 'steady-orchard/patch-steward-testbed-public',
      default_branch: 'master',
    },
    sender: { id: 42, type: 'User' },
    ...overrides,
  };
}

function encode(payload: unknown): Uint8Array {
  return new Uint8Array(Buffer.from(JSON.stringify(payload)));
}

function expectRejected(result: ReturnType<typeof authenticateEvent>, path: string): void {
  expect(result.ok).toBe(false);
  if (result.ok) {
    return;
  }
  expect(result.failure.code).toBe('gate.event-invalid');
  expect(result.failure.outcome).toBe('inconclusive');
  expect(result.failure.details[0]?.path).toBe(path);
}

describe('event authentication', () => {
  it('a pull_request_target payload authenticates', () => {
    const result = authenticateEvent(environment({ eventName: 'pull_request_target' }), encode(pullRequestPayload()));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const event: AuthenticatedEvent = result.value;
    expect(event.eventName).toBe('pull_request_target');
    expect(event.action).toBe('opened');
    expect(event.repository).toEqual({
      fullName: 'steady-orchard/patch-steward-testbed-public',
      id: 1068416373,
      defaultBranch: 'master',
    });
    expect(event.subject).toEqual({ type: 'pull_request', number: 12 });
    expect(event.objectId).toBe(555);
    expect(event.objectUpdatedAt).toBe('2026-09-27T10:00:00Z');
    expect(event.authorId).toBe(42);
    expect(event.senderId).toBe(42);
    expect(event.senderType).toBe('User');
    expect(event.merged).toBe(false);
    expect(event.closure).toBe(false);
    expect(event.runId).toBe(36081628326);
    expect(event.runAttempt).toBe(1);
  });

  it('an issues payload authenticates', () => {
    const result = authenticateEvent(environment({ eventName: 'issues' }), encode(issuePayload()));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const event = result.value;
    expect(event.eventName).toBe('issues');
    expect(event.subject).toEqual({ type: 'issue', number: 29 });
    expect(event.objectId).toBe(777);
    expect(event.merged).toBeNull();
    expect(event.closure).toBe(false);
  });

  it('an issues payload for a pull request is rejected', () => {
    const payload = issuePayload({ issue: { ...issuePayload().issue, pull_request: { url: 'x' } } });
    const result = authenticateEvent(environment({ eventName: 'issues' }), encode(payload));
    expectRejected(result, 'issue-is-pull-request');
  });

  it('a payload for another repository is rejected', () => {
    const payload = pullRequestPayload({
      repository: { id: 1068416373, full_name: 'someone-else/other-repo', default_branch: 'master' },
    });
    const result = authenticateEvent(environment({ eventName: 'pull_request_target' }), encode(payload));
    expectRejected(result, 'repository');
  });

  it('a payload with another repository id is rejected', () => {
    const payload = pullRequestPayload({
      repository: { id: 999, full_name: 'steady-orchard/patch-steward-testbed-public', default_branch: 'master' },
    });
    const result = authenticateEvent(environment({ eventName: 'pull_request_target' }), encode(payload));
    expectRejected(result, 'repository-id');
  });

  it('a ref other than the default branch is rejected', () => {
    const result = authenticateEvent(
      environment({ eventName: 'pull_request_target', ref: 'refs/heads/develop' }),
      encode(pullRequestPayload()),
    );
    expectRejected(result, 'ref');
  });

  it('a server or API URL other than github.com is rejected', () => {
    const serverResult = authenticateEvent(
      environment({ eventName: 'pull_request_target', serverUrl: 'https://ghe.example.com' }),
      encode(pullRequestPayload()),
    );
    expectRejected(serverResult, 'server-url');

    const apiResult = authenticateEvent(
      environment({ eventName: 'pull_request_target', apiUrl: 'https://api.example.com' }),
      encode(pullRequestPayload()),
    );
    expectRejected(apiResult, 'api-url');
  });

  it('an event outside the wrappers is rejected', () => {
    const prResult = authenticateEvent(environment({ eventName: 'pull_request' }), encode(pullRequestPayload()));
    expectRejected(prResult, 'event-name');

    const commentResult = authenticateEvent(environment({ eventName: 'issue_comment' }), encode(issuePayload()));
    expectRejected(commentResult, 'event-name');
  });

  it('an action the wrapper does not accept is rejected', () => {
    const prResult = authenticateEvent(
      environment({ eventName: 'pull_request_target' }),
      encode(pullRequestPayload({ action: 'labeled' })),
    );
    expectRejected(prResult, 'action');

    const issueResult = authenticateEvent(environment({ eventName: 'issues' }), encode(issuePayload({ action: 'synchronize' })));
    expectRejected(issueResult, 'action');
  });

  it('an oversized payload is rejected', () => {
    const oversized = new Uint8Array(Buffer.alloc(EVENT_PAYLOAD_MAX_BYTES + 1, 32));
    const result = authenticateEvent(environment({ eventName: 'pull_request_target' }), oversized);
    expectRejected(result, 'payload-size');
  });

  it('a malformed payload is rejected', () => {
    const invalidUtf8 = new Uint8Array([0xff, 0xfe]);
    const encodingResult = authenticateEvent(environment({ eventName: 'pull_request_target' }), invalidUtf8);
    expectRejected(encodingResult, 'payload-encoding');

    const jsonResult = authenticateEvent(
      environment({ eventName: 'pull_request_target' }),
      new Uint8Array(Buffer.from('not json')),
    );
    expectRejected(jsonResult, 'payload-json');
  });

  it('a payload missing a required key is rejected', () => {
    const payload = pullRequestPayload();
    delete (payload as Record<string, unknown>)['sender'];
    const result = authenticateEvent(environment({ eventName: 'pull_request_target' }), encode(payload));
    expectRejected(result, 'payload-schema');
  });

  it('a malformed run id or attempt is rejected', () => {
    for (const runId of ['0', '01', 'abc', '99999999999999999999']) {
      const result = authenticateEvent(environment({ eventName: 'pull_request_target', runId }), encode(pullRequestPayload()));
      expectRejected(result, 'run-id');
    }
    const attemptResult = authenticateEvent(
      environment({ eventName: 'pull_request_target', runAttempt: '0' }),
      encode(pullRequestPayload()),
    );
    expectRejected(attemptResult, 'run-attempt');
  });

  it('failures never echo payload text', () => {
    const marker = 'HOSTILE-MARKER' + String.fromCharCode(0x202e) + '\n';
    const payload = pullRequestPayload({
      pull_request: { ...pullRequestPayload().pull_request, title: marker },
      repository: { id: 1068416373, full_name: marker, default_branch: 'master' },
    });
    const result = authenticateEvent(environment({ eventName: 'pull_request_target' }), encode(payload));
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain('HOSTILE-MARKER');
  });

  it('event identity carries the triggering object and sender', () => {
    const result = authenticateEvent(environment({ eventName: 'pull_request_target' }), encode(pullRequestPayload()));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(eventIdentity(result.value)).toEqual({
      name: 'pull_request_target',
      action: 'opened',
      object_id: 555,
      object_updated_at: '2026-09-27T10:00:00Z',
      sender_id: 42,
      sender_type: 'User',
    });
  });

  it('concurrency groups use only digits and fixed words', () => {
    expect(stewardConcurrencyGroup(1068416373, 'pull_request', 12)).toBe('steward-1068416373-pr-12');
    expect(stewardConcurrencyGroup(1068416373, 'issue', 29)).toBe('steward-1068416373-issue-29');
    expect(() => stewardConcurrencyGroup(0, 'issue', 29)).toThrow(RangeError);
    expect(() => stewardConcurrencyGroup(1068416373, 'issue', 1.5)).toThrow(RangeError);
  });

  it('closures resolve as merged, by author, by maintainer, or deleted', () => {
    const mergedResult = authenticateEvent(
      environment({ eventName: 'pull_request_target' }),
      encode(pullRequestPayload({ action: 'closed', pull_request: { ...pullRequestPayload().pull_request, merged: true } })),
    );
    expect(mergedResult.ok).toBe(true);
    if (mergedResult.ok) {
      expect(closureResolution(mergedResult.value)).toBe('merged');
    }

    const closedByAuthorResult = authenticateEvent(
      environment({ eventName: 'issues' }),
      encode(issuePayload({ action: 'closed', sender: { id: 42, type: 'User' } })),
    );
    expect(closedByAuthorResult.ok).toBe(true);
    if (closedByAuthorResult.ok) {
      expect(closureResolution(closedByAuthorResult.value)).toBe('closed-by-author');
    }

    const closedByMaintainerResult = authenticateEvent(
      environment({ eventName: 'issues' }),
      encode(issuePayload({ action: 'closed', sender: { id: 99, type: 'User' } })),
    );
    expect(closedByMaintainerResult.ok).toBe(true);
    if (closedByMaintainerResult.ok) {
      expect(closureResolution(closedByMaintainerResult.value)).toBe('closed-by-maintainer');
    }

    const deletedResult = authenticateEvent(environment({ eventName: 'issues' }), encode(issuePayload({ action: 'deleted' })));
    expect(deletedResult.ok).toBe(true);
    if (deletedResult.ok) {
      expect(closureResolution(deletedResult.value)).toBe('deleted');
    }
  });

  it('non-closure events have no resolution', () => {
    const result = authenticateEvent(environment({ eventName: 'pull_request_target' }), encode(pullRequestPayload()));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(closureResolution(result.value)).toBeNull();
    }
  });
});
