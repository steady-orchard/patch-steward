import { describe, expect, it } from 'vitest';
import { runCli, STEWARD_USAGE } from './index.js';

describe('steward cli', () => {
  it('steward without a command prints usage and exits 2', async () => {
    const stderr: string[] = [];
    const exit = await runCli([], {
      cwd: process.cwd(),
      io: {
        stdout: () => {},
        stderr: (text) => {
          stderr.push(text);
        },
      },
    });
    expect(exit).toBe(2);
    const joined = stderr.join('');
    expect(joined).toContain('usage.missing-command');
    expect(joined).toContain(STEWARD_USAGE);
  });

  it('steward help prints usage and exits 0', async () => {
    const stdout: string[] = [];
    const exit = await runCli(['help'], {
      cwd: process.cwd(),
      io: {
        stdout: (text) => {
          stdout.push(text);
        },
        stderr: () => {},
      },
    });
    expect(exit).toBe(0);
    expect(stdout.join('')).toBe(`${STEWARD_USAGE}\n`);
  });

  it('steward with an unknown command exits 2', async () => {
    const stderr: string[] = [];
    const exit = await runCli(['frobnicate'], {
      cwd: process.cwd(),
      io: {
        stdout: () => {},
        stderr: (text) => {
          stderr.push(text);
        },
      },
    });
    expect(exit).toBe(2);
    expect(stderr.join('')).toContain('usage.unknown-command');
  });

  it('steward policy dispatches to the policy command', async () => {
    const stderr: string[] = [];
    const exit = await runCli(['policy', '--ref', 'a', '--file', 'b'], {
      cwd: process.cwd(),
      io: {
        stdout: () => {},
        stderr: (text) => {
          stderr.push(text);
        },
      },
    });
    expect(exit).toBe(2);
    expect(stderr.join('')).toContain('usage.conflicting-options');
  });
});
