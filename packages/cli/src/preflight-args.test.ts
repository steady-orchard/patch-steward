import { describe, expect, it } from 'vitest';

import { PREFLIGHT_USAGE, parsePreflightArgs } from './preflight-args.js';

describe('parsePreflightArgs', () => {
  it('preflight args accept an issue draft', () => {
    const result = parsePreflightArgs(['--issue', 'defect', '--draft', 'd.md']);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.args.submission).toEqual({ type: 'issue', issueKind: 'defect' });
    expect(result.args.draft).toBe('d.md');
    expect(result.args.repository).toBeNull();
    expect(result.args.base).toBeNull();
    expect(result.args.json).toBe(false);
  });

  it('preflight args accept a pull request draft with repo and base', () => {
    const result = parsePreflightArgs(['--pr', '--draft', 'd.md', '--repo', 'octo/demo', '--base', 'origin/main', '--json']);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.args.submission).toEqual({ type: 'pull_request' });
    expect(result.args.repository).toEqual({ owner: 'octo', name: 'demo' });
    expect(result.args.base).toBe('origin/main');
    expect(result.args.json).toBe(true);
  });

  it('preflight args reject an unknown option', () => {
    const result = parsePreflightArgs(['--bogus']);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('usage.unknown-option');
  });

  it('preflight args reject --issue together with --pr', () => {
    const result = parsePreflightArgs(['--issue', 'defect', '--pr', '--draft', 'd.md']);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('usage.conflicting-options');
    expect(result.message).toBe('--issue and --pr cannot be used together');
  });

  it('preflight args require --issue or --pr', () => {
    const result = parsePreflightArgs(['--draft', 'd.md']);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('usage.invalid-arguments');
    expect(result.message).toBe('one of --issue <kind> or --pr is required');
  });

  it('preflight args reject an unknown issue kind', () => {
    const result = parsePreflightArgs(['--issue', 'bug', '--draft', 'd.md']);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('usage.invalid-arguments');
    expect(result.message).toBe('--issue must be defect or proposal');
  });

  it('preflight args reject --base with --issue', () => {
    const result = parsePreflightArgs(['--issue', 'proposal', '--draft', 'd.md', '--base', 'main']);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('usage.conflicting-options');
    expect(result.message).toBe('--base can be used only with --pr');
  });

  it('preflight args require --draft', () => {
    for (const argv of [['--pr'], ['--pr', '--draft', '']]) {
      const result = parsePreflightArgs(argv);
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.code).toBe('usage.invalid-arguments');
      expect(result.message).toBe('--draft <file> is required');
    }
  });

  it('preflight args reject a malformed --repo', () => {
    for (const argv of [
      ['--pr', '--draft', 'd.md', '--repo', 'octo'],
      ['--pr', '--draft', 'd.md', '--repo', 'octo/demo/x'],
      ['--pr', '--draft', 'd.md', '--repo=-x/demo'],
    ]) {
      const result = parsePreflightArgs(argv);
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.code).toBe('usage.invalid-arguments');
      expect(result.message).toBe('--repo must be owner/name');
    }
  });

  it('preflight args reject an empty --base', () => {
    const result = parsePreflightArgs(['--pr', '--draft', 'd.md', '--base', '']);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('usage.invalid-arguments');
    expect(result.message).toBe('--base must not be empty');
  });

  it('preflight args reject positional arguments', () => {
    const result = parsePreflightArgs(['--pr', '--draft', 'd.md', 'extra']);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('usage.invalid-arguments');
  });

  it('preflight args report whether JSON was requested on failure', () => {
    const withJson = parsePreflightArgs(['--pr', '--json']);
    expect(withJson.ok).toBe(false);
    if (!withJson.ok) expect(withJson.json).toBe(true);

    const withoutJson = parsePreflightArgs(['--pr']);
    expect(withoutJson.ok).toBe(false);
    if (!withoutJson.ok) expect(withoutJson.json).toBe(false);

    expect(PREFLIGHT_USAGE).toBe(
      'usage: steward preflight (--issue defect|proposal | --pr) --draft <file.md> [--repo owner/name] [--base <ref>] [--json]',
    );
  });
});
