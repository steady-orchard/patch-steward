import { describe, expect, it } from 'vitest';
import {
  buildRunName,
  evaluateCaps,
  parseRunName,
  type CapEvaluationInput,
  type RunListItem,
  type RunListQueryResult,
  type RunNameFields,
} from './caps.js';

const TODAY = new Date('2026-09-27T12:00:00.000Z');
const TODAY_ISO = '2026-09-27T08:00:00.000Z';
const OTHER_DAY_ISO = '2026-09-26T08:00:00.000Z';

function makeItem(overrides: Partial<RunListItem> & { fields?: RunNameFields } = {}): RunListItem {
  const fields: RunNameFields = overrides.fields ?? {
    kind: 'pr',
    number: 12,
    authorId: 2095171,
    eventName: 'pull_request_target',
    action: 'edited',
    senderId: 2095171,
    senderType: 'User',
  };
  return {
    id: overrides.id ?? 1,
    path: overrides.path ?? '.github/workflows/steward-pr.yml',
    event: overrides.event ?? 'pull_request_target',
    status: overrides.status ?? 'in_progress',
    createdAt: overrides.createdAt ?? TODAY_ISO,
    displayTitle: overrides.displayTitle ?? buildRunName(fields),
  };
}

function queryResult(items: readonly RunListItem[], overrides: Partial<RunListQueryResult> = {}): RunListQueryResult {
  return { items, totalCount: overrides.totalCount ?? items.length, complete: overrides.complete ?? true };
}

function baseInput(overrides: Partial<CapEvaluationInput> = {}): CapEvaluationInput {
  return {
    createdToday: queryResult([]),
    inProgress: queryResult([]),
    queued: queryResult([]),
    now: TODAY,
    botUserId: 999,
    authorId: 2095171,
    currentRunId: 1,
    dailyLimit: 10,
    authorLimit: 5,
    ...overrides,
  };
}

describe('run-name tags and caps', () => {
  it('run names round-trip through the parser', () => {
    const prFields: RunNameFields = {
      kind: 'pr',
      number: 12,
      authorId: 2095171,
      eventName: 'pull_request_target',
      action: 'edited',
      senderId: 2095171,
      senderType: 'User',
    };
    const prTitle = buildRunName(prFields);
    expect(prTitle).toBe('steward pr 12 author 2095171 event pull_request_target edited sender 2095171 User');
    expect(parseRunName(prTitle)).toEqual(prFields);

    const issueFields: RunNameFields = {
      kind: 'issue',
      number: 7,
      authorId: 42,
      eventName: 'issues',
      action: 'opened',
      senderId: 42,
      senderType: 'Bot',
    };
    const issueTitle = buildRunName(issueFields);
    expect(parseRunName(issueTitle)).toEqual(issueFields);
  });

  it('hostile run name with a newline is rejected', () => {
    const valid = buildRunName({
      kind: 'pr',
      number: 1,
      authorId: 1,
      eventName: 'pull_request_target',
      action: 'opened',
      senderId: 1,
      senderType: 'User',
    });
    expect(parseRunName(valid + String.fromCharCode(10) + 'x')).toBeNull();
    expect(parseRunName(valid + String.fromCharCode(10) + valid)).toBeNull();
  });

  it('hostile run name with leading zeros is rejected', () => {
    expect(parseRunName('steward pr 012 author 1 event pull_request_target opened sender 1 User')).toBeNull();
  });

  it('hostile run name with non-ASCII digits is rejected', () => {
    const fullwidthOne = String.fromCharCode(0xff11);
    const arabicIndicOne = String.fromCharCode(0x0661);
    expect(parseRunName(`steward pr ${fullwidthOne} author 1 event pull_request_target opened sender 1 User`)).toBeNull();
    expect(parseRunName(`steward pr 1 author ${arabicIndicOne} event pull_request_target opened sender 1 User`)).toBeNull();
  });

  it('hostile run name over the length bound is rejected', () => {
    const valid = buildRunName({
      kind: 'pr',
      number: 1,
      authorId: 1,
      eventName: 'pull_request_target',
      action: 'opened',
      senderId: 1,
      senderType: 'User',
    });
    const padded = valid + ' '.repeat(1025 - valid.length) + 'x';
    expect(padded.length).toBeGreaterThan(1024);
    expect(parseRunName(padded)).toBeNull();
  });

  it('hostile run name with an unknown sender type is rejected', () => {
    expect(parseRunName('steward pr 1 author 1 event pull_request_target opened sender 1 user')).toBeNull();
    expect(parseRunName('steward pr 1 author 1 event pull_request_target opened sender 1 App')).toBeNull();
  });

  it('hostile run name with extra text is rejected', () => {
    const valid = 'steward pr 1 author 1 event pull_request_target opened sender 1 User';
    expect(parseRunName(` ${valid}`)).toBeNull();
    expect(parseRunName(`${valid} `)).toBeNull();
    expect(parseRunName('steward pr 1 author 1 event pull_request_target  opened sender 1 User')).toBeNull();
    expect(parseRunName(`${valid} x`)).toBeNull();
  });

  it('hostile run name with unsafe integer ids is rejected', () => {
    expect(parseRunName('steward pr 1 author 99999999999999999999 event pull_request_target opened sender 1 User')).toBeNull();
  });

  it('hostile run name with bidi or zero-width text is rejected', () => {
    const bidi = String.fromCharCode(0x202e);
    const zeroWidth = String.fromCharCode(0x200b);
    expect(parseRunName(`steward pr 1${bidi} author 1 event pull_request_target opened sender 1 User`)).toBeNull();
    expect(parseRunName(`steward${zeroWidth} pr 1 author 1 event pull_request_target opened sender 1 User`)).toBeNull();
  });

  it('only wrapper runs from accepted events count', () => {
    const otherPath = makeItem({ id: 2, path: '.github/workflows/other.yml' });
    const otherEvent = makeItem({ id: 3, event: 'pull_request' });
    const refSuffixed = makeItem({ id: 4, path: '.github/workflows/steward-pr.yml@refs/heads/master' });
    const input = baseInput({
      inProgress: queryResult([otherPath, otherEvent, refSuffixed]),
      queued: queryResult([]),
    });
    const result = evaluateCaps(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.authorCount).toBe(2);
    }
  });

  it('the daily count excludes runs sent by the installation bot', () => {
    const botItem = makeItem({
      id: 2,
      fields: {
        kind: 'pr',
        number: 1,
        authorId: 2095171,
        eventName: 'pull_request_target',
        action: 'opened',
        senderId: 999,
        senderType: 'Bot',
      },
    });
    const input = baseInput({ createdToday: queryResult([botItem]) });
    const result = evaluateCaps(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.dailyCount).toBe(1);
    }
  });

  it('unparseable titles count toward the daily cap', () => {
    const unparseable = makeItem({ id: 2, displayTitle: 'not a steward title' });
    const input = baseInput({ createdToday: queryResult([unparseable]) });
    const result = evaluateCaps(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.dailyCount).toBe(2);
    }
  });

  it('this run counts once toward each cap', () => {
    const currentItem = makeItem({ id: 1 });
    const inputPresent = baseInput({ createdToday: queryResult([currentItem]), currentRunId: 1 });
    const resultPresent = evaluateCaps(inputPresent);
    expect(resultPresent.ok).toBe(true);
    if (resultPresent.ok) {
      expect(resultPresent.value.dailyCount).toBe(1);
    }

    const inputAbsent = baseInput({ createdToday: queryResult([]), currentRunId: 1 });
    const resultAbsent = evaluateCaps(inputAbsent);
    expect(resultAbsent.ok).toBe(true);
    if (resultAbsent.ok) {
      expect(resultAbsent.value.dailyCount).toBe(1);
    }
  });

  it('runs created on another UTC day do not count', () => {
    const otherDayItem = makeItem({ id: 2, createdAt: OTHER_DAY_ISO });
    const input = baseInput({ createdToday: queryResult([otherDayItem]) });
    const result = evaluateCaps(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.dailyCount).toBe(1);
    }
  });

  it('a daily count over the limit is queued as daily-runs', () => {
    const items = Array.from({ length: 11 }, (_, i) => makeItem({ id: i + 2 }));
    const input = baseInput({ createdToday: queryResult(items), dailyLimit: 10 });
    const result = evaluateCaps(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.state).toBe('daily-runs');
      expect(result.value.dailyCount).toBe(12);
    }
  });

  it('the per-author count uses queued and in-progress runs', () => {
    const sameAuthor = makeItem({ id: 2, status: 'in_progress' });
    const otherAuthor = makeItem({
      id: 3,
      status: 'queued',
      fields: {
        kind: 'pr',
        number: 5,
        authorId: 555,
        eventName: 'pull_request_target',
        action: 'opened',
        senderId: 555,
        senderType: 'User',
      },
    });
    const completed = makeItem({ id: 4, status: 'completed' });
    const sharedAcrossBoth = makeItem({ id: 5, status: 'queued' });
    const input = baseInput({
      inProgress: queryResult([sameAuthor, otherAuthor, completed, sharedAcrossBoth]),
      queued: queryResult([sharedAcrossBoth]),
    });
    const result = evaluateCaps(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.authorCount).toBe(3);
    }
  });

  it('a per-author count over the limit is queued', () => {
    const items = Array.from({ length: 5 }, (_, i) => makeItem({ id: i + 2, status: 'queued' }));
    const input = baseInput({ queued: queryResult(items), authorLimit: 5 });
    const result = evaluateCaps(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.state).toBe('per-author-concurrent-runs');
      expect(result.value.authorCount).toBe(6);
    }
  });

  it('the daily cap is reported before the per-author cap', () => {
    const dailyItems = Array.from({ length: 11 }, (_, i) => makeItem({ id: i + 100 }));
    const authorItems = Array.from({ length: 5 }, (_, i) => makeItem({ id: i + 200, status: 'queued' }));
    const input = baseInput({
      createdToday: queryResult(dailyItems),
      queued: queryResult(authorItems),
      dailyLimit: 10,
      authorLimit: 5,
    });
    const result = evaluateCaps(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.state).toBe('daily-runs');
    }
  });

  it('duplicate and early-exit runs still count', () => {
    const first = makeItem({ id: 2 });
    const duplicate = makeItem({ id: 3 });
    const input = baseInput({ createdToday: queryResult([first, duplicate]) });
    const result = evaluateCaps(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.dailyCount).toBe(3);
    }
  });

  it('an incomplete run listing fails before commitment', () => {
    const incompleteToday = evaluateCaps(baseInput({ createdToday: queryResult([], { complete: false }) }));
    expect(incompleteToday.ok).toBe(false);
    if (!incompleteToday.ok) {
      expect(incompleteToday.failure.code).toBe('caps.run-list-unavailable');
      expect(incompleteToday.failure.outcome).toBe('inconclusive');
    }

    const incompleteInProgress = evaluateCaps(baseInput({ inProgress: queryResult([], { complete: false }) }));
    expect(incompleteInProgress.ok).toBe(false);
    if (!incompleteInProgress.ok) {
      expect(incompleteInProgress.failure.code).toBe('caps.run-list-unavailable');
      expect(incompleteInProgress.failure.outcome).toBe('inconclusive');
    }

    const incompleteQueued = evaluateCaps(baseInput({ queued: queryResult([], { complete: false }) }));
    expect(incompleteQueued.ok).toBe(false);
    if (!incompleteQueued.ok) {
      expect(incompleteQueued.failure.code).toBe('caps.run-list-unavailable');
      expect(incompleteQueued.failure.outcome).toBe('inconclusive');
    }
  });

  it('a total over the result ceiling is over the daily cap', () => {
    const input = baseInput({ createdToday: queryResult([], { totalCount: 1001, complete: false }) });
    const result = evaluateCaps(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.state).toBe('daily-runs');
      expect(result.value.dailyCount).toBe(1001);
    }
  });
});
