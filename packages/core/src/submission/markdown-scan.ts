export const MARKDOWN_LINE_CONTEXTS = ['text', 'fence', 'comment'] as const;

export type MarkdownLineContext = (typeof MARKDOWN_LINE_CONTEXTS)[number];

export interface MarkdownLine {
  readonly text: string;
  readonly terminator: '' | '\n' | '\r\n' | '\r';
  readonly context: MarkdownLineContext;
}

export interface MarkdownHeading {
  readonly lineIndex: number;
  readonly text: string;
}

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;

function splitLines(source: string): Array<{ text: string; terminator: '' | '\n' | '\r\n' | '\r' }> {
  const result: Array<{ text: string; terminator: '' | '\n' | '\r\n' | '\r' }> = [];
  if (source.length === 0) {
    return result;
  }
  let start = 0;
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (ch === '\n') {
      result.push({ text: source.slice(start, i), terminator: '\n' });
      i += 1;
      start = i;
    } else if (ch === '\r') {
      if (source[i + 1] === '\n') {
        result.push({ text: source.slice(start, i), terminator: '\r\n' });
        i += 2;
        start = i;
      } else {
        result.push({ text: source.slice(start, i), terminator: '\r' });
        i += 1;
        start = i;
      }
    } else {
      i += 1;
    }
  }
  if (start < source.length) {
    result.push({ text: source.slice(start), terminator: '' });
  }
  return result;
}

function fenceCloses(line: string, fenceChar: string, fenceLen: number): boolean {
  let i = 0;
  const n = line.length;
  while (i < n && line[i] === ' ' && i < 3) {
    i += 1;
  }
  const runStart = i;
  let count = 0;
  while (i < n && line[i] === fenceChar) {
    i += 1;
    count += 1;
  }
  if (runStart > 3 || count < fenceLen) {
    return false;
  }
  while (i < n) {
    const ch = line[i];
    if (ch !== ' ' && ch !== '\t') {
      return false;
    }
    i += 1;
  }
  return true;
}

export function scanMarkdownLines(source: string): readonly MarkdownLine[] {
  const rawLines = splitLines(source);
  const result: MarkdownLine[] = [];

  let state: 'text' | 'fence' | 'comment' = 'text';
  let fenceChar = '';
  let fenceLen = 0;

  for (const raw of rawLines) {
    const line = raw.text;
    if (state === 'fence') {
      result.push({ text: line, terminator: raw.terminator, context: 'fence' });
      if (fenceCloses(line, fenceChar, fenceLen)) {
        state = 'text';
        fenceChar = '';
        fenceLen = 0;
      }
      continue;
    }

    if (state === 'comment') {
      const closeIdx = line.indexOf('-->');
      if (closeIdx === -1) {
        result.push({ text: line, terminator: raw.terminator, context: 'comment' });
        continue;
      }
      result.push({ text: line, terminator: raw.terminator, context: 'comment' });
      state = scanTextTail(line, closeIdx + 3);
      continue;
    }

    // state === 'text'
    const fenceMatch = FENCE_OPEN.exec(line);
    if (fenceMatch) {
      const run = fenceMatch[1] as string;
      const ch = run[0] as string;
      const isBacktick = ch === '`';
      const rest = line.slice((fenceMatch.index ?? 0) + fenceMatch[0].length);
      const valid = !isBacktick || !rest.includes('`');
      if (valid) {
        fenceChar = ch;
        fenceLen = run.length;
        state = 'fence';
        result.push({ text: line, terminator: raw.terminator, context: 'fence' });
        continue;
      }
    }

    result.push({ text: line, terminator: raw.terminator, context: 'text' });
    state = scanTextTail(line, 0);
  }

  return result;
}

function scanTextTail(line: string, from: number): 'text' | 'comment' {
  let i = from;
  const n = line.length;
  while (i < n) {
    const openIdx = line.indexOf('<!--', i);
    if (openIdx === -1) {
      return 'text';
    }
    const closeIdx = line.indexOf('-->', openIdx + 4);
    if (closeIdx === -1) {
      return 'comment';
    }
    i = closeIdx + 3;
  }
  return 'text';
}

export function findMarkdownHeadings(lines: readonly MarkdownLine[], level: 2 | 3): readonly MarkdownHeading[] {
  const result: MarkdownHeading[] = [];
  const prefix = '#'.repeat(level);
  for (let idx = 0; idx < lines.length; idx += 1) {
    const line = lines[idx];
    if (!line || line.context !== 'text') {
      continue;
    }
    const text = line.text;
    if (!text.startsWith(prefix)) {
      continue;
    }
    if (text[level] === '#') {
      continue;
    }
    if (text[level] !== ' ') {
      continue;
    }
    let i = level;
    while (text[i] === ' ') {
      i += 1;
    }
    const rest = text.slice(i).replace(/\s+$/, '');
    result.push({ lineIndex: idx, text: rest });
  }
  return result;
}
