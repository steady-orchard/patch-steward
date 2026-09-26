import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FILE_SOURCE_NOTICE, runPolicyCommand } from './policy-command.js';

const corpusDir = fileURLToPath(new URL('../../../fixtures/policies/', import.meta.url));
const expectations = JSON.parse(readFileSync(join(corpusDir, 'expectations.json'), 'utf8')) as Record<
  string,
  { valid: boolean; codes: string[] }
>;
const templatePath = fileURLToPath(new URL('../../../templates/policy/policy.yml', import.meta.url));

describe('policy command fixture corpus', () => {
  it.each(Object.keys(expectations))('policy command matches the expectation for fixture %s', async (rel) => {
    const expectation = expectations[rel]!;
    const stdout: string[] = [];
    const stderr: string[] = [];
    const exit = await runPolicyCommand(['--file', join(corpusDir, rel), '--json'], {
      cwd: corpusDir,
      io: {
        stdout: (text) => {
          stdout.push(text);
        },
        stderr: (text) => {
          stderr.push(text);
        },
      },
    });
    expect(exit).toBe(expectation.valid ? 0 : 1);
    const report = JSON.parse(stdout.join('')) as { valid: boolean; authoritative: boolean; errors: { code: string }[] };
    expect(report.valid).toBe(expectation.valid);
    const codes = [...new Set(report.errors.map((error) => error.code))].sort();
    expect(codes).toEqual([...expectation.codes].sort());
    expect(report.authoritative).toBe(false);
    expect(stderr.join('')).toBe('');
  });

  it('policy command accepts the template with a placeholder warning and exits 0', async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const exit = await runPolicyCommand(['--file', templatePath], {
      cwd: corpusDir,
      io: {
        stdout: (text) => {
          stdout.push(text);
        },
        stderr: (text) => {
          stderr.push(text);
        },
      },
    });
    expect(exit).toBe(0);
    expect(stdout.join('')).toContain(`notice: ${FILE_SOURCE_NOTICE}`);
    const stderrLines = stderr
      .join('')
      .split('\n')
      .filter((line) => line.length > 0);
    expect(stderrLines).toHaveLength(1);
    expect(stderrLines[0]).toMatch(/^warning policy\.llm-model-placeholder llm\.model /);
  });

  it('policy command reports no warnings for fixture valid/copilot.yml', async () => {
    const stdout: string[] = [];
    const exit = await runPolicyCommand(['--file', join(corpusDir, 'valid/copilot.yml'), '--json'], {
      cwd: corpusDir,
      io: {
        stdout: (text) => {
          stdout.push(text);
        },
        stderr: () => {},
      },
    });
    expect(exit).toBe(0);
    const report = JSON.parse(stdout.join('')) as { warnings: unknown[] };
    expect(report.warnings).toEqual([]);
  });
});
