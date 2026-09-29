import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseJunitXml } from './parse.js';

const root = fileURLToPath(new URL('../../../../fixtures/junit/', import.meta.url));

type Expectation =
  | {
      status: 'parsed';
      tests: number;
      passed: number;
      failed: number;
      errored: number;
      skipped: number;
      duration_ms: number | null;
      identities: string[];
    }
  | { status: 'malformed'; error_code: string };

const expectations = JSON.parse(readFileSync(root + 'expectations.json', 'utf8')) as Record<string, Expectation>;

function files(): string[] {
  return ['samples', 'hostile'].flatMap((d) =>
    readdirSync(root + d)
      .filter((n) => n.endsWith('.xml'))
      .map((n) => `${d}/${n}`),
  );
}

describe('junit fixtures', () => {
  it('every junit fixture has an expectation', () => {
    for (const f of files()) expect(Object.keys(expectations), f).toContain(f);
  });

  it('every junit expectation has a fixture', () => {
    const present = files();
    for (const k of Object.keys(expectations)) expect(present, k).toContain(k);
  });

  it('junit fixtures parse to their expectations', () => {
    for (const [file, want] of Object.entries(expectations)) {
      const got = parseJunitXml(readFileSync(root + file), { maxCases: 1000 });
      expect(got.status, file).toBe(want.status);
      if (want.status === 'parsed' && got.status === 'parsed') {
        const j = got.junit;
        expect([j.tests, j.passed, j.failed, j.errored, j.skipped, j.duration_ms], file).toEqual([
          want.tests,
          want.passed,
          want.failed,
          want.errored,
          want.skipped,
          want.duration_ms,
        ]);
        expect(
          j.cases.map((c) => c.identity),
          file,
        ).toEqual(want.identities);
      } else if (want.status === 'malformed' && got.status === 'malformed') {
        expect(got.error_code, file).toBe(want.error_code);
      }
    }
  });

  it('hostile junit fixtures are rejected quickly', () => {
    for (const f of files().filter((n) => n.startsWith('hostile/'))) {
      const bytes = readFileSync(root + f);
      const start = performance.now();
      const got = parseJunitXml(bytes, { maxCases: 1000 });
      expect(got.status, f).toBe('malformed');
      expect(performance.now() - start, f).toBeLessThan(1000);
    }
  });

  it('invalid UTF-8 junit input is malformed', () => {
    const bytes = Buffer.concat([Buffer.from('<testsuites name="'), Buffer.from([0xff, 0xfe]), Buffer.from('"/>')]);
    const got = parseJunitXml(bytes, { maxCases: 1000 });
    expect(got).toMatchObject({ status: 'malformed', error_code: 'junit.encoding' });
  });
});
