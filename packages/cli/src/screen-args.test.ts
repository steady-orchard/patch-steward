import { describe, expect, it } from 'vitest';

import { parseScreenArgs } from './screen-args.js';

describe('parseScreenArgs', () => {
  it('screen arguments accept an issue or a pull request number', () => {
    const a = parseScreenArgs(['--issue', '29']);
    expect(a).toEqual({
      ok: true,
      args: { submission: { type: 'issue', number: 29 }, repository: null, policyFile: null, evidenceDir: null, json: false },
    });

    const b = parseScreenArgs([
      '--pr',
      '26',
      '--repo',
      'steady-orchard/patch-steward-testbed-public',
      '--policy-file',
      'p.yml',
      '--evidence-dir',
      'ev',
      '--json',
    ]);
    expect(b).toEqual({
      ok: true,
      args: {
        submission: { type: 'pull_request', number: 26 },
        repository: { owner: 'steady-orchard', name: 'patch-steward-testbed-public' },
        policyFile: 'p.yml',
        evidenceDir: 'ev',
        json: true,
      },
    });

    const c = parseScreenArgs(['--issue', '2147483647']);
    expect(c.ok).toBe(true);
    if (c.ok) {
      expect(c.args.submission.number).toBe(2147483647);
    }
  });

  it('screen arguments reject --issue with --pr', () => {
    const result = parseScreenArgs(['--issue', '1', '--pr', '2']);
    expect(result).toEqual({
      ok: false,
      code: 'usage.conflicting-options',
      message: '--issue and --pr cannot be used together',
      json: false,
    });
  });

  it('screen arguments require one submission flag', () => {
    for (const argv of [[], ['--repo', 'o/r']]) {
      const result = parseScreenArgs(argv);
      expect(result).toEqual({
        ok: false,
        code: 'usage.invalid-arguments',
        message: 'one of --issue <number> or --pr <number> is required',
        json: false,
      });
    }
  });

  it('screen arguments reject a malformed number', () => {
    for (const value of ['0', '01', '+1', '1.0', '1e3', 'abc', '', '2147483648']) {
      const result = parseScreenArgs(['--issue', value]);
      expect(result).toEqual({
        ok: false,
        code: 'usage.invalid-arguments',
        message: '--issue must be a positive decimal integer',
        json: false,
      });
    }

    const prResult = parseScreenArgs(['--pr', '0']);
    expect(prResult).toEqual({
      ok: false,
      code: 'usage.invalid-arguments',
      message: '--pr must be a positive decimal integer',
      json: false,
    });

    const negative = parseScreenArgs(['--issue', '-1']);
    expect(negative.ok).toBe(false);
    if (!negative.ok) {
      expect(negative.code).toBe('usage.invalid-arguments');
    }
  });

  it('screen arguments validate --repo', () => {
    const result = parseScreenArgs(['--issue', '1', '--repo', 'nope']);
    expect(result).toEqual({
      ok: false,
      code: 'usage.invalid-arguments',
      message: '--repo must be owner/name',
      json: false,
    });
  });

  it('screen arguments reject empty path options', () => {
    const policy = parseScreenArgs(['--issue', '1', '--policy-file', '']);
    expect(policy.ok).toBe(false);
    if (!policy.ok) {
      expect(policy.message).toBe('--policy-file must not be empty');
    }

    const evidence = parseScreenArgs(['--issue', '1', '--evidence-dir', '']);
    expect(evidence.ok).toBe(false);
    if (!evidence.ok) {
      expect(evidence.message).toBe('--evidence-dir must not be empty');
    }
  });

  it('screen arguments reject unknown options and positionals', () => {
    const bogus = parseScreenArgs(['--issue', '1', '--bogus']);
    expect(bogus.ok).toBe(false);
    if (!bogus.ok) {
      expect(bogus.code).toBe('usage.unknown-option');
    }

    const shortFlag = parseScreenArgs(['-h']);
    expect(shortFlag.ok).toBe(false);
    if (!shortFlag.ok) {
      expect(shortFlag.code).toBe('usage.unknown-option');
    }

    const positional = parseScreenArgs(['--issue', '1', 'extra']);
    expect(positional.ok).toBe(false);
    if (!positional.ok) {
      expect(positional.code).toBe('usage.invalid-arguments');
    }
  });

  it('screen arguments detect --json on failure', () => {
    const a = parseScreenArgs(['--bogus', '--json']);
    expect(a.ok).toBe(false);
    if (!a.ok) {
      expect(a.json).toBe(true);
    }

    const b = parseScreenArgs(['--issue', '1', '--pr', '2', '--json']);
    expect(b.ok).toBe(false);
    if (!b.ok) {
      expect(b.json).toBe(true);
    }

    const c = parseScreenArgs(['--bogus']);
    expect(c.ok).toBe(false);
    if (!c.ok) {
      expect(c.json).toBe(false);
    }
  });
});
