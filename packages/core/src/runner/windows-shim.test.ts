import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  cmdShimCommandLine,
  commandForPlatform,
  escapeForCmd,
  findWindowsExecutable,
  quoteWindowsArgument,
} from './windows-shim.js';

const BS = String.fromCharCode(92);
const Q = '"';

describe('windows shim', () => {
  it('quotes arguments for the Windows parser', () => {
    expect(quoteWindowsArgument('a b')).toBe(Q + 'a b' + Q);
    expect(quoteWindowsArgument('')).toBe(Q + Q);
    expect(quoteWindowsArgument('plain')).toBe(Q + 'plain' + Q);
    expect(quoteWindowsArgument('C:' + BS + 'dir' + BS)).toBe(Q + 'C:' + BS + 'dir' + BS + BS + Q);
    expect(quoteWindowsArgument('say ' + Q + 'hi' + Q)).toBe(Q + 'say ' + BS + Q + 'hi' + BS + Q + Q);
    expect(quoteWindowsArgument('back' + BS + Q + 'q')).toBe(Q + 'back' + BS + BS + BS + Q + 'q' + Q);
  });

  it('escapes command metacharacters with carets', () => {
    expect(escapeForCmd('a&b|c')).toBe('a^&b^|c');
    expect(escapeForCmd('(x) %y% !z!')).toBe('^(x^)^ ^%y^%^ ^!z^!');
  });

  it('builds a doubly escaped shim command line', () => {
    expect(cmdShimCommandLine('C:/tools/x.cmd', ['%PATH%', 'a b'])).toBe(
      'C:/tools/x.cmd ^^^' + Q + '^^^%PATH^^^%^^^' + Q + ' ^^^' + Q + 'a^^^ b^^^' + Q,
    );
  });

  it('finds executables on PATH with PATHEXT', () => {
    const env = { Path: 'C:/a;C:/b', PATHEXT: '.COM;.EXE;.BAT;.CMD' };
    const files = new Set([path.win32.join('C:/b', 'tool.cmd'), path.win32.join('C:/a', 'other.exe')]);
    const fileExists = (p: string): boolean => files.has(p);
    expect(findWindowsExecutable('tool', env, fileExists)).toBe(path.win32.join('C:/b', 'tool.cmd'));
    expect(findWindowsExecutable('other', env, fileExists)).toBe(path.win32.join('C:/a', 'other.exe'));
    expect(findWindowsExecutable('missing', env, fileExists)).toBeNull();

    const both = new Set([path.win32.join('C:/a', 'tool.exe'), path.win32.join('C:/b', 'tool.cmd')]);
    expect(findWindowsExecutable('tool', env, (p) => both.has(p))).toBe(path.win32.join('C:/a', 'tool.exe'));

    const order = new Set([path.win32.join('C:/b', 'tool.bat'), path.win32.join('C:/b', 'tool.cmd')]);
    expect(findWindowsExecutable('tool', env, (p) => order.has(p))).toBe(path.win32.join('C:/b', 'tool.bat'));
  });

  it('runs batch shims through cmd.exe', () => {
    const shim = path.win32.join('C:/b', 'tool.cmd');
    expect(
      commandForPlatform(['tool', 'a&b'], {
        platform: 'win32',
        env: { PATH: 'C:/b', PATHEXT: '.EXE;.CMD', SystemRoot: 'C:/Windows' },
        fileExists: (p) => p === shim,
      }),
    ).toEqual({
      binary: path.win32.join('C:/Windows', 'System32', 'cmd.exe'),
      args: ['/d', '/s', '/c', Q + cmdShimCommandLine(shim, ['a&b']) + Q],
      windowsVerbatimArguments: true,
      viaCmd: true,
    });
  });

  it('runs other commands directly', () => {
    const direct = { binary: 'tool', args: ['x', 'y'], windowsVerbatimArguments: false, viaCmd: false };
    const exe = path.win32.join('C:/b', 'tool.exe');
    expect(
      commandForPlatform(['tool', 'x', 'y'], {
        platform: 'win32',
        env: { PATH: 'C:/b', PATHEXT: '.EXE;.CMD' },
        fileExists: (p) => p === exe,
      }),
    ).toEqual(direct);
    expect(commandForPlatform(['tool', 'x', 'y'], { platform: 'win32', env: { PATH: 'C:/b' }, fileExists: () => false })).toEqual(
      direct,
    );
    expect(
      commandForPlatform(['tool.cmd', 'x', 'y'], { platform: 'linux', env: { PATH: 'C:/b' }, fileExists: () => true }),
    ).toEqual({ ...direct, binary: 'tool.cmd' });
    expect(() => commandForPlatform([], { platform: 'win32', env: {} })).toThrow(TypeError);
  });
});
