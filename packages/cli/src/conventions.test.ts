import { describe, expect, it } from 'vitest';
import { err } from '@patch-steward/core';
import {
  CLI_LOCAL_RUN_NOTICE,
  STEWARD_EXIT_CODES,
  cliRunNotices,
  errorLine,
  failureErrors,
  renderJsonLine,
  warningLine,
  writeTextDiagnostics,
} from './conventions.js';
import type { CommandIo } from './policy-command.js';

describe('conventions', () => {
  it('exit codes are 0, 1, 2, and 3', () => {
    expect(STEWARD_EXIT_CODES).toEqual([0, 1, 2, 3]);
  });

  it('json output is one compact line with escaped format characters', () => {
    const input = { a: 'x\u2028y', b: '\u202e', c: [1] };
    const result = renderJsonLine(input);
    expect(result).toBe('{"a":"x\\u2028y","b":"\\u202e","c":[1]}\n');
    expect(renderJsonLine({ schema_version: 1 })).toBe('{"schema_version":1}\n');
    expect(JSON.parse(result)).toEqual(input);
  });

  it('warning and error lines use the uniform format', () => {
    expect(warningLine({ code: 'github.unauthenticated', message: 'm' })).toBe('warning github.unauthenticated: m\n');
    expect(errorLine({ code: 'usage.invalid-arguments', path: '', message: 'bad' })).toBe('error usage.invalid-arguments -: bad\n');
    expect(errorLine({ code: 'policy.unknown-key', path: 'extra', message: 'Unknown key' })).toBe(
      'error policy.unknown-key extra: Unknown key\n',
    );
  });

  it('diagnostic lines escape terminal control characters', () => {
    expect(errorLine({ code: 'x', path: 'a\u001bb', message: 'm\u202e' })).toBe('error x a\\u001bb: m\\u202e\n');
  });

  it('text diagnostics write warnings before errors on stderr only', () => {
    const stdoutLines: string[] = [];
    const stderrLines: string[] = [];
    const io: CommandIo = {
      stdout: (text) => stdoutLines.push(text),
      stderr: (text) => stderrLines.push(text),
    };
    const w = { code: 'a', message: 'm1' };
    const e = { code: 'b', path: 'p', message: 'm2' };
    writeTextDiagnostics(io, [w], [e]);
    expect(stderrLines).toEqual([warningLine(w), errorLine(e)]);
    expect(stdoutLines).toEqual([]);

    stdoutLines.length = 0;
    stderrLines.length = 0;
    writeTextDiagnostics(io, [], []);
    expect(stderrLines).toEqual([]);
    expect(stdoutLines).toEqual([]);
  });

  it('failure errors list the failure then its details', () => {
    const result = err('screen.policy-invalid', 'policy-invalid', 'bad policy', [
      { code: 'policy.unknown-key', path: 'extra', message: 'Unknown key', line: 3, column: 1 },
    ]);
    expect(failureErrors(result.failure)).toEqual([
      { code: 'screen.policy-invalid', path: '', message: 'bad policy' },
      { code: 'policy.unknown-key', path: 'extra', message: 'Unknown key' },
    ]);

    const withoutDetails = err('screen.policy-invalid', 'policy-invalid', 'bad policy');
    expect(failureErrors(withoutDetails.failure)).toHaveLength(1);
  });

  it('run notices follow the authoritative flag rule', () => {
    expect(cliRunNotices(null)).toEqual([CLI_LOCAL_RUN_NOTICE]);
    expect(cliRunNotices({ authoritative: true, revision: 'a'.repeat(40) })).toEqual([CLI_LOCAL_RUN_NOTICE]);
    expect(cliRunNotices({ authoritative: false, revision: 'local:' + 'b'.repeat(64) })).toEqual([
      CLI_LOCAL_RUN_NOTICE,
      'non-authoritative: screened under a local policy file (local:' + 'b'.repeat(64) + ')',
    ]);
  });
});
