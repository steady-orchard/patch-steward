import {
  JUNIT_MAX_DEPTH,
  JUNIT_MAX_ELEMENTS,
  JUNIT_MAX_ATTRIBUTES,
  JUNIT_ATTRIBUTE_VALUE_MAX_LENGTH,
  TEST_CASE_IDENTITY_MAX_LENGTH,
} from '../policy/bounds.js';

export const JUNIT_FAILURE_CODES = [
  'junit.encoding',
  'junit.syntax',
  'junit.doctype-forbidden',
  'junit.entity-unknown',
  'junit.root-invalid',
  'junit.too-deep',
  'junit.too-many-elements',
  'junit.too-many-attributes',
  'junit.attribute-too-long',
] as const;

export type JunitFailureCode = (typeof JUNIT_FAILURE_CODES)[number];

export interface JunitCaseSummary {
  readonly identity: string;
  readonly status: 'pass' | 'fail' | 'skip' | 'error';
  readonly duration_ms: number | null;
  readonly identity_truncated: boolean;
}

export interface JunitFileSummary {
  readonly tests: number;
  readonly passed: number;
  readonly failed: number;
  readonly errored: number;
  readonly skipped: number;
  readonly duration_ms: number | null;
  readonly cases: readonly JunitCaseSummary[];
  readonly cases_truncated: boolean;
}

export interface JunitParseOptions {
  readonly maxCases: number;
}

export type JunitParseResult =
  | { readonly status: 'parsed'; readonly junit: JunitFileSummary }
  | { readonly status: 'malformed'; readonly error_code: JunitFailureCode };

const NAME_START = /[A-Za-z_:]/;
const NAME_CHAR = /[A-Za-z0-9_:.-]/;
const WHITESPACE = new Set([' ', '\t', '\n', '\r']);

class MalformedError extends Error {
  constructor(readonly code: JunitFailureCode) {
    super(code);
  }
}

function fail(code: JunitFailureCode): never {
  throw new MalformedError(code);
}

interface OpenElement {
  readonly name: string;
  readonly attrs: Map<string, string>;
  readonly children: OpenElement[];
  status: 'pass' | 'fail' | 'skip' | 'error' | null;
}

function isNameStart(ch: string): boolean {
  return NAME_START.test(ch);
}

function isNameChar(ch: string): boolean {
  return NAME_CHAR.test(ch);
}

function decodeReferences(value: string): string {
  let out = '';
  let i = 0;
  while (i < value.length) {
    const ch = value[i];
    if (ch !== '&') {
      out += ch;
      i++;
      continue;
    }
    const semi = value.indexOf(';', i);
    if (semi === -1 || semi - i > 16) {
      fail('junit.syntax');
    }
    const body = value.slice(i + 1, semi);
    out += decodeOneReference(body);
    i = semi + 1;
  }
  return out;
}

function decodeOneReference(body: string): string {
  switch (body) {
    case 'lt':
      return '<';
    case 'gt':
      return '>';
    case 'amp':
      return '&';
    case 'quot':
      return '"';
    case 'apos':
      return "'";
    default:
      break;
  }
  if (body.startsWith('#x') || body.startsWith('#X')) {
    const hex = body.slice(2);
    if (!/^[0-9A-Fa-f]+$/.test(hex)) fail('junit.entity-unknown');
    const cp = parseInt(hex, 16);
    return codePointOrFail(cp);
  }
  if (body.startsWith('#')) {
    const dec = body.slice(1);
    if (!/^[0-9]+$/.test(dec)) fail('junit.entity-unknown');
    const cp = parseInt(dec, 10);
    return codePointOrFail(cp);
  }
  fail('junit.entity-unknown');
}

function codePointOrFail(cp: number): string {
  const valid =
    cp === 0x9 ||
    cp === 0xa ||
    cp === 0xd ||
    (cp >= 0x20 && cp <= 0xd7ff) ||
    (cp >= 0xe000 && cp <= 0xfffd) ||
    (cp >= 0x10000 && cp <= 0x10ffff);
  if (!valid) fail('junit.entity-unknown');
  return String.fromCodePoint(cp);
}

function checkTextReferences(text: string): void {
  // References inside ignored root text still must be well-formed.
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch !== '&') {
      i++;
      continue;
    }
    const semi = text.indexOf(';', i);
    if (semi === -1 || semi - i > 16) fail('junit.syntax');
    decodeOneReference(text.slice(i + 1, semi));
    i = semi + 1;
  }
}

function parseXml(input: string): OpenElement {
  const len = input.length;
  let pos = 0;
  let elementCount = 0;
  let root: OpenElement | null = null;
  const stack: OpenElement[] = [];

  function skipWhitespace(): void {
    while (pos < len && WHITESPACE.has(input[pos]!)) pos++;
  }

  function readName(): string {
    const start = pos;
    if (pos >= len || !isNameStart(input[pos]!)) fail('junit.syntax');
    pos++;
    while (pos < len && isNameChar(input[pos]!)) pos++;
    return input.slice(start, pos);
  }

  while (pos < len) {
    if (input[pos] === '<') {
      if (input.startsWith('<?', pos)) {
        const end = input.indexOf('?>', pos + 2);
        if (end === -1) fail('junit.syntax');
        const content = input.slice(pos + 2, end);
        const m = /^([A-Za-z_:][A-Za-z0-9_:.-]*)([\s\S]*)$/.exec(content);
        if (m && m[1]!.toLowerCase() === 'xml' && /^\s/.test(m[2] ?? '')) {
          if (pos !== 0) fail('junit.syntax');
          const encMatch = /encoding\s*=\s*(?:"([^"]*)"|'([^']*)')/.exec(content);
          const encValue = encMatch ? (encMatch[1] ?? encMatch[2] ?? '') : null;
          if (encValue !== null && encValue.toLowerCase() !== 'utf-8') fail('junit.encoding');
        }
        pos = end + 2;
        continue;
      }
      if (input.startsWith('<!--', pos)) {
        const end = input.indexOf('-->', pos + 4);
        if (end === -1) fail('junit.syntax');
        pos = end + 3;
        continue;
      }
      if (input.startsWith('<![CDATA[', pos)) {
        if (stack.length === 0) fail('junit.syntax');
        const end = input.indexOf(']]>', pos + 9);
        if (end === -1) fail('junit.syntax');
        pos = end + 3;
        continue;
      }
      if (input.startsWith('<!', pos)) {
        const rest = input.slice(pos + 2, pos + 9).toUpperCase();
        if (rest.startsWith('DOCTYPE') || rest.startsWith('ENTITY')) fail('junit.doctype-forbidden');
        fail('junit.syntax');
      }
      if (input.startsWith('</', pos)) {
        pos += 2;
        const name = readName();
        skipWhitespace();
        if (pos >= len || input[pos] !== '>') fail('junit.syntax');
        pos++;
        const top = stack.pop();
        if (!top || top.name !== name) fail('junit.syntax');
        continue;
      }
      // opening tag
      pos++;
      const name = readName();
      const attrs = new Map<string, string>();
      let selfClose = false;
      for (;;) {
        const before = pos;
        skipWhitespace();
        if (pos < len && (input[pos] === '>' || input.startsWith('/>', pos))) {
          if (input.startsWith('/>', pos)) {
            selfClose = true;
            pos += 2;
          } else {
            pos += 1;
          }
          break;
        }
        if (pos === before) fail('junit.syntax');
        if (pos >= len) fail('junit.syntax');
        const attrName = readName();
        skipWhitespace();
        if (pos >= len || input[pos] !== '=') fail('junit.syntax');
        pos++;
        skipWhitespace();
        const quote = input[pos];
        if (quote !== '"' && quote !== "'") fail('junit.syntax');
        pos++;
        const valStart = pos;
        const closeIdx = input.indexOf(quote, pos);
        if (closeIdx === -1) fail('junit.syntax');
        const rawValue = input.slice(valStart, closeIdx);
        if (rawValue.includes('<')) fail('junit.syntax');
        pos = closeIdx + 1;
        if (attrs.has(attrName)) fail('junit.syntax');
        const decoded = decodeReferences(rawValue);
        if (decoded.length > JUNIT_ATTRIBUTE_VALUE_MAX_LENGTH) fail('junit.attribute-too-long');
        attrs.set(attrName, decoded);
      }
      if (attrs.size > JUNIT_MAX_ATTRIBUTES) fail('junit.too-many-attributes');
      elementCount++;
      if (elementCount > JUNIT_MAX_ELEMENTS) fail('junit.too-many-elements');
      const depth = stack.length + 1;
      if (depth > JUNIT_MAX_DEPTH) fail('junit.too-deep');
      if (stack.length === 0) {
        if (root !== null) fail('junit.syntax');
        if (name !== 'testsuites' && name !== 'testsuite') fail('junit.root-invalid');
      }
      const element: OpenElement = { name, attrs, children: [], status: null };
      if (stack.length > 0) stack[stack.length - 1]!.children.push(element);
      else root = element;
      if (!selfClose) stack.push(element);
      continue;
    }
    // text node
    const nextLt = input.indexOf('<', pos);
    const textEnd = nextLt === -1 ? len : nextLt;
    const text = input.slice(pos, textEnd);
    if (stack.length === 0) {
      if (text.trim().length > 0) fail('junit.syntax');
    } else {
      checkTextReferences(text);
    }
    pos = textEnd;
  }

  if (root === null || stack.length > 0) fail('junit.syntax');
  return root;
}

function computeStatus(el: ElementAttrsLike): 'pass' | 'fail' | 'skip' | 'error' {
  let hasFailure = false;
  let hasSkipped = false;
  for (const child of el.children) {
    if (child.name === 'error') return 'error';
    if (child.name === 'failure') hasFailure = true;
    if (child.name === 'skipped') hasSkipped = true;
  }
  if (hasFailure) return 'fail';
  if (hasSkipped) return 'skip';
  return 'pass';
}

interface ElementAttrsLike {
  readonly name: string;
  readonly attrs: Map<string, string>;
  readonly children: OpenElement[];
}

function durationFromTime(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  if (!/^[0-9]+(\.[0-9]+)?$/.test(raw)) return null;
  const ms = Math.round(Number(raw) * 1000);
  return Number.isSafeInteger(ms) ? ms : null;
}

function truncateIdentity(identity: string): { identity: string; truncated: boolean } {
  if (identity.length <= TEST_CASE_IDENTITY_MAX_LENGTH) return { identity, truncated: false };
  let cut = TEST_CASE_IDENTITY_MAX_LENGTH;
  const before = identity.charCodeAt(cut - 1);
  if (before >= 0xd800 && before <= 0xdbff) cut -= 1;
  return { identity: identity.slice(0, cut), truncated: true };
}

function collectCases(root: OpenElement): OpenElement[] {
  const cases: OpenElement[] = [];
  function walk(el: OpenElement): void {
    if (el.name === 'testcase') cases.push(el);
    for (const child of el.children) walk(child);
  }
  walk(root);
  return cases;
}

export function parseJunitXml(bytes: Uint8Array, options: JunitParseOptions): JunitParseResult {
  if (!Number.isInteger(options.maxCases) || options.maxCases < 1 || options.maxCases > 1000) {
    throw new RangeError('maxCases must be an integer between 1 and 1000');
  }
  try {
    if (bytes.length >= 2 && ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff))) {
      return { status: 'malformed', error_code: 'junit.encoding' };
    }
    let offset = 0;
    if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) offset = 3;
    const sliced = bytes.subarray(offset);
    let text: string;
    try {
      text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(sliced);
    } catch {
      return { status: 'malformed', error_code: 'junit.encoding' };
    }
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      if ((c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) || c === 0xfffe || c === 0xffff) {
        return { status: 'malformed', error_code: 'junit.syntax' };
      }
    }
    const root = parseXml(text);
    const caseElements = collectCases(root);
    const cases: JunitCaseSummary[] = [];
    let passed = 0;
    let failed = 0;
    let errored = 0;
    let skipped = 0;
    let durationSum = 0;
    let hasDuration = false;
    const limit = caseElements.length;
    for (let i = 0; i < limit; i++) {
      const el = caseElements[i]!;
      const status = computeStatus(el);
      if (status === 'pass') passed++;
      else if (status === 'fail') failed++;
      else if (status === 'error') errored++;
      else skipped++;
      const rawIdentity = `${el.attrs.get('classname') ?? ''}::${el.attrs.get('name') ?? ''}`;
      const { identity, truncated } = truncateIdentity(rawIdentity);
      const duration = durationFromTime(el.attrs.get('time'));
      if (duration !== null) {
        durationSum += duration;
        hasDuration = true;
      }
      if (cases.length < options.maxCases) {
        cases.push({ identity, status, duration_ms: duration, identity_truncated: truncated });
      }
    }
    const summary: JunitFileSummary = {
      tests: caseElements.length,
      passed,
      failed,
      errored,
      skipped,
      duration_ms: hasDuration ? durationSum : null,
      cases,
      cases_truncated: caseElements.length > cases.length,
    };
    return { status: 'parsed', junit: summary };
  } catch (err) {
    if (err instanceof MalformedError) {
      return { status: 'malformed', error_code: err.code };
    }
    return { status: 'malformed', error_code: 'junit.syntax' };
  }
}
