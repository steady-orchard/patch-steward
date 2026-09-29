import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { commandForPlatform } from './windows-shim.js';

const BS = String.fromCharCode(92);
const CRLF = String.fromCharCode(13, 10);
const LF = String.fromCharCode(10);

const CASES: string[][] = [
  ['plain'],
  ['a b'],
  [''],
  ['say "hi"'],
  ['a&b|c<d>e^f'],
  ['%PATH%'],
  ['100%'],
  ['!x!'],
  ['C:' + BS + 'dir' + BS],
  ['tail' + BS + BS],
  ['back' + BS + '"q'],
  ['(paren)'],
  ['semi;colon,comma'],
  ['star*?'],
  ["it's"],
  ['a`b'],
  ['%%'],
  ['=eq'],
  ['caret^^'],
  ['two', 'args here'],
  ['%CD%x'],
  ['a%b%c'],
  ['a" & echo INJECTED & "b'],
  ['x")" & echo INJ'],
  ['"'],
  ['""'],
  [BS + '"' + BS],
  ['a)b'],
  ['^'],
];

describe.runIf(process.platform === 'win32')('batch shims', { timeout: 120000 }, () => {
  let root = '';
  let shims: string[] = [];

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-steward-shim-'));
    const dir = path.join(root, 'Program Files (x86) a&b');
    fs.mkdirSync(dir);
    const node = process.execPath;
    const files: Record<string, string> = {
      'echo-args.cjs': 'process.stdout.write(JSON.stringify(process.argv.slice(2)));' + LF,
      'simple.cmd': '@"' + node + '" "%~dp0echo-args.cjs" %*' + CRLF,
      'block.cmd':
        '@SETLOCAL' +
        CRLF +
        '@IF EXIST "%~dp0echo-args.cjs" (' +
        CRLF +
        '  "' +
        node +
        '" "%~dp0echo-args.cjs" %*' +
        CRLF +
        ') ELSE (' +
        CRLF +
        '  echo missing' +
        CRLF +
        ')' +
        CRLF,
      'plain.bat': '@echo off' + CRLF + '"' + node + '" "%~dp0echo-args.cjs" %*' + CRLF,
    };
    for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text, 'utf8');
    shims = ['simple.cmd', 'block.cmd', 'plain.bat'].map((n) => path.join(dir, n));
  });

  afterAll(() => {
    if (root !== '') fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it('round-trips hostile arguments through shims', () => {
    for (const shimPath of shims) {
      for (const caseArgs of CASES) {
        const cmd = commandForPlatform([shimPath, ...caseArgs], { platform: 'win32', env: process.env });
        expect(cmd.viaCmd).toBe(true);
        const r = spawnSync(cmd.binary, [...cmd.args], { windowsVerbatimArguments: true, encoding: 'utf8', windowsHide: true });
        expect(r.stdout, shimPath + ' ' + JSON.stringify(caseArgs)).toBe(JSON.stringify(caseArgs));
      }
    }
  });
});
