import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it, afterEach } from 'vitest';

import { readPreflightDraft } from './preflight-draft.js';

const DEFECT_LINES = [
  '### Expected behavior',
  '',
  '`widget parse` accepts an empty file and prints an empty document.',
  '',
  '### Authoritative basis',
  '',
  'docs/format.md, section "Empty input": an empty file is a valid document.',
  '',
  '### Actual behavior',
  '',
  '`widget parse empty.txt` exits with status 1 and prints `TypeError: cannot read properties of undefined`.',
  '',
  '### Affected version',
  '',
  '1.4.2',
  '',
  '### Reproduction command',
  '',
  '```shell',
  'touch empty.txt',
  'widget parse empty.txt',
  '```',
  '',
  '### Expected result',
  '',
  'Exit status 0 and the output `[]`.',
  '',
  '### Proposed scope',
  '',
  'Handle empty input in the parser entry point only.',
  '',
  '### References',
  '',
  '_No response_',
  '',
  '### Security claim',
  '',
  '- [ ] This report claims a security problem',
];

let tmpDirs: string[] = [];

function makeTmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-draft-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tmpDirs = [];
});

describe('readPreflightDraft', () => {
  it('draft is read relative to the working directory and parsed', async () => {
    const tmp = makeTmpDir();
    const content = DEFECT_LINES.join('\n');
    fs.writeFileSync(path.join(tmp, 'd.md'), content, 'utf8');

    const result = await readPreflightDraft(tmp, 'd.md', 'issue');

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.draft.body.structured).toBe(true);
    if (result.draft.body.structured) {
      expect(result.draft.body.template).toEqual({ form: 'defect', version: 1 });
    }
    expect(result.draft.text).toBe(content);
  });

  it('draft with a byte order mark and CRLF parses like a GitHub body', async () => {
    const tmp = makeTmpDir();
    const content = DEFECT_LINES.join('\r\n');
    const bom = Buffer.from([0xef, 0xbb, 0xbf]);
    const bytes = Buffer.concat([bom, Buffer.from(content, 'utf8')]);
    fs.writeFileSync(path.join(tmp, 'd.md'), bytes);

    const result = await readPreflightDraft(tmp, 'd.md', 'issue');

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.draft.body.structured).toBe(true);
    if (result.draft.body.structured) {
      expect(result.draft.body.template).toEqual({ form: 'defect', version: 1 });
    }
    expect(result.draft.text.startsWith(String.fromCharCode(0xfeff))).toBe(false);
  });

  it('missing draft is reported as not found', async () => {
    const tmp = makeTmpDir();

    const result = await readPreflightDraft(tmp, 'missing.md', 'issue');

    expect(result).toEqual({ ok: false, code: 'preflight.draft-not-found', message: 'The draft file does not exist.' });
  });

  it('draft path that is a directory is unreadable', async () => {
    const tmp = makeTmpDir();

    const result = await readPreflightDraft(tmp, '.', 'issue');

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.code).toBe('preflight.draft-unreadable');
  });

  it('draft over the byte bound is too large', async () => {
    const tmp = makeTmpDir();
    const bytes = Buffer.alloc(262144 + 1, 'a');
    fs.writeFileSync(path.join(tmp, 'd.md'), bytes);

    const result = await readPreflightDraft(tmp, 'd.md', 'issue');

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.code).toBe('preflight.draft-too-large');
    expect(result.message).toContain('262144');
    expect(result.message).toContain('65536');
  });

  it('draft over the body length is too large', async () => {
    const tmp = makeTmpDir();
    const content = 'a'.repeat(65536 + 1);
    fs.writeFileSync(path.join(tmp, 'd.md'), content, 'utf8');

    const result = await readPreflightDraft(tmp, 'd.md', 'issue');

    expect(result).toEqual({
      ok: false,
      code: 'preflight.draft-too-large',
      message: "The draft has more than 65536 characters, GitHub's limit for an issue or pull request body.",
    });
  });

  it('draft that is not UTF-8 is rejected', async () => {
    const tmp = makeTmpDir();
    const bytes = Buffer.from([0xc3, 0x28]);
    fs.writeFileSync(path.join(tmp, 'd.md'), bytes);

    const result = await readPreflightDraft(tmp, 'd.md', 'issue');

    expect(result).toEqual({ ok: false, code: 'preflight.draft-invalid-utf8', message: 'The draft is not valid UTF-8.' });
  });
});
