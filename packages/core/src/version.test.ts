import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { recordIdentifierSchema } from './records/common.js';
import { parseStewardVersion, stewardVersion } from './version.js';

describe('version', () => {
  it('steward version matches the core package version', () => {
    const result = stewardVersion();
    expect(result.ok).toBe(true);
    const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      version: string;
    };
    if (result.ok) {
      expect(result.value).toBe(packageJson.version);
    }
  });

  it('root, core, and cli versions are equal', () => {
    const root = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')) as {
      version: string;
    };
    const core = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
    const cli = JSON.parse(readFileSync(new URL('../../cli/package.json', import.meta.url), 'utf8')) as {
      version: string;
    };
    expect(root.version).toBe(core.version);
    expect(core.version).toBe(cli.version);
  });

  it('steward version is a record identifier', () => {
    const result = stewardVersion();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(recordIdentifierSchema.safeParse(result.value).success).toBe(true);
    }
  });

  it('malformed versions are steward defects', () => {
    const malformed = ['not json', '{}', '{"version":1}', '{"version":"1.2"}', '{"version":"01.2.3"}', '{"version":"1.2.3 "}'];
    for (const text of malformed) {
      const result = parseStewardVersion(text);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failure.code).toBe('steward.version-unavailable');
        expect(result.failure.cause).toBe('steward-defect');
        expect(result.failure.outcome).toBe('inconclusive');
      }
    }

    const valid = parseStewardVersion('{"version":"1.2.3-rc.1+build.5"}');
    expect(valid.ok).toBe(true);
  });
});
