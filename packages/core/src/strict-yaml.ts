import { Document, LineCounter, isAlias, isMap, isScalar, isSeq, parseAllDocuments } from 'yaml';
import { err, ok } from './result.js';
import type { Result } from './result.js';

export interface StrictYamlBounds {
  readonly maxBytes: number;
  readonly maxDepth: number;
  readonly maxNodes: number;
}

export type StrictYamlFailureCode =
  | 'yaml.too-large'
  | 'yaml.invalid-utf8'
  | 'yaml.syntax'
  | 'yaml.empty'
  | 'yaml.multi-document'
  | 'yaml.duplicate-key'
  | 'yaml.directive'
  | 'yaml.alias'
  | 'yaml.anchor'
  | 'yaml.explicit-tag'
  | 'yaml.non-string-key'
  | 'yaml.forbidden-key'
  | 'yaml.too-deep'
  | 'yaml.too-many-nodes';

export const STRICT_YAML_FAILURE_CODES: readonly StrictYamlFailureCode[] = [
  'yaml.too-large',
  'yaml.invalid-utf8',
  'yaml.syntax',
  'yaml.empty',
  'yaml.multi-document',
  'yaml.duplicate-key',
  'yaml.directive',
  'yaml.alias',
  'yaml.anchor',
  'yaml.explicit-tag',
  'yaml.non-string-key',
  'yaml.forbidden-key',
  'yaml.too-deep',
  'yaml.too-many-nodes',
];

const MESSAGES: Record<StrictYamlFailureCode, string> = {
  'yaml.too-large': 'YAML input exceeds the maximum allowed size.',
  'yaml.invalid-utf8': 'YAML input is not valid UTF-8.',
  'yaml.syntax': 'YAML input could not be parsed.',
  'yaml.empty': 'YAML input contains no document.',
  'yaml.multi-document': 'YAML input contains more than one document.',
  'yaml.duplicate-key': 'YAML input contains a duplicate mapping key.',
  'yaml.directive': 'YAML input contains a directive, which is not permitted.',
  'yaml.alias': 'YAML input contains an alias, which is not permitted.',
  'yaml.anchor': 'YAML input contains an anchor, which is not permitted.',
  'yaml.explicit-tag': 'YAML input contains an explicit tag, which is not permitted.',
  'yaml.non-string-key': 'YAML input contains a mapping key that is not a string.',
  'yaml.forbidden-key': 'YAML input contains a forbidden mapping key.',
  'yaml.too-deep': 'YAML input exceeds the maximum allowed nesting depth.',
  'yaml.too-many-nodes': 'YAML input exceeds the maximum allowed number of nodes.',
};

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const NODE_VIOLATION_PRECEDENCE: readonly StrictYamlFailureCode[] = [
  'yaml.alias',
  'yaml.anchor',
  'yaml.explicit-tag',
  'yaml.non-string-key',
  'yaml.forbidden-key',
  'yaml.too-deep',
  'yaml.too-many-nodes',
];

interface NodePosition {
  readonly line: number | null;
  readonly column: number | null;
}

type Err<C extends string> = ReturnType<typeof err<C>>;

function makeFailure(code: StrictYamlFailureCode, path: string, position: NodePosition): Err<StrictYamlFailureCode> {
  return err(code, 'policy-invalid', MESSAGES[code], [
    { code, path, message: MESSAGES[code], line: position.line, column: position.column },
  ]);
}

interface NodeLike {
  readonly anchor?: string;
  readonly tag?: string;
  readonly range?: readonly [number, number, number] | null;
}

export interface YamlPosition {
  readonly line: number;
  readonly column: number;
}

export interface StrictYamlDocument {
  readonly value: unknown;
  readonly positions: ReadonlyMap<string, YamlPosition>;
}

interface WalkState {
  nodeCount: number;
  stopped: boolean;
  found: Partial<Record<StrictYamlFailureCode, { path: string; position: NodePosition }>>;
  positions: Map<string, YamlPosition>;
}

function recordPosition(state: WalkState, path: string, position: NodePosition): void {
  if (position.line === null || position.column === null) {
    return;
  }
  state.positions.set(path, { line: position.line, column: position.column });
}

function positionAt(lineCounter: LineCounter, node: NodeLike | null | undefined): NodePosition {
  const offset = node?.range?.[0];
  if (offset === undefined || offset === null) {
    return { line: null, column: null };
  }
  const pos = lineCounter.linePos(offset);
  if (pos.line === 0) {
    return { line: null, column: null };
  }
  return { line: pos.line, column: pos.col };
}

function record(
  state: WalkState,
  code: StrictYamlFailureCode,
  path: string,
  lineCounter: LineCounter,
  node: NodeLike | null | undefined,
): void {
  if (state.found[code] !== undefined) {
    return;
  }
  state.found[code] = { path, position: positionAt(lineCounter, node) };
}

function joinPath(parent: string, segment: string): string {
  return parent === '' ? segment : `${parent}.${segment}`;
}

function walkNode(
  state: WalkState,
  lineCounter: LineCounter,
  bounds: StrictYamlBounds,
  node: unknown,
  path: string,
  ancestorDepth: number,
): void {
  if (state.stopped) {
    return;
  }
  state.nodeCount += 1;
  if (state.nodeCount > bounds.maxNodes) {
    record(state, 'yaml.too-many-nodes', path, lineCounter, node as NodeLike);
    state.stopped = true;
    return;
  }

  if (isAlias(node)) {
    record(state, 'yaml.alias', path, lineCounter, node);
    return;
  }

  const nodeLike = node as NodeLike;
  if (typeof nodeLike.anchor === 'string' && nodeLike.anchor.length > 0) {
    record(state, 'yaml.anchor', path, lineCounter, nodeLike);
  }
  if (typeof nodeLike.tag === 'string' && nodeLike.tag.length > 0) {
    record(state, 'yaml.explicit-tag', path, lineCounter, nodeLike);
  }

  if (isScalar(node)) {
    return;
  }

  if (isMap(node)) {
    const depth = ancestorDepth + 1;
    if (depth > bounds.maxDepth) {
      record(state, 'yaml.too-deep', path, lineCounter, nodeLike);
    }
    if (depth > bounds.maxDepth + 1) {
      return;
    }
    for (const pair of node.items) {
      if (state.stopped) {
        return;
      }
      walkPair(state, lineCounter, bounds, pair, path, depth);
    }
    return;
  }

  if (isSeq(node)) {
    const depth = ancestorDepth + 1;
    if (depth > bounds.maxDepth) {
      record(state, 'yaml.too-deep', path, lineCounter, nodeLike);
    }
    if (depth > bounds.maxDepth + 1) {
      return;
    }
    for (let index = 0; index < node.items.length; index += 1) {
      if (state.stopped) {
        return;
      }
      const item: unknown = node.items[index];
      if (item === null || item === undefined) {
        continue;
      }
      const itemPath = joinPath(path, String(index));
      recordPosition(state, itemPath, positionAt(lineCounter, item as NodeLike));
      walkNode(state, lineCounter, bounds, item, itemPath, depth);
    }
  }
}

function walkPair(
  state: WalkState,
  lineCounter: LineCounter,
  bounds: StrictYamlBounds,
  pair: { key: unknown; value: unknown },
  mapPath: string,
  mapDepth: number,
): void {
  const key = pair.key;
  const validKey = isScalar(key) && typeof key.value === 'string';
  const segment = validKey ? (key.value as string) : null;
  const pairPath = segment !== null ? joinPath(mapPath, segment) : mapPath;

  if (!validKey) {
    record(state, 'yaml.non-string-key', pairPath, lineCounter, key as NodeLike);
  } else if (FORBIDDEN_KEYS.has(segment as string)) {
    record(state, 'yaml.forbidden-key', pairPath, lineCounter, key as NodeLike);
  }

  if (validKey) {
    recordPosition(state, pairPath, positionAt(lineCounter, key as NodeLike));
  }

  walkNode(state, lineCounter, bounds, key, pairPath, mapDepth);
  if (state.stopped) {
    return;
  }
  const value = pair.value;
  if (value !== null && value !== undefined) {
    walkNode(state, lineCounter, bounds, value, pairPath, mapDepth);
  }
}

export function parseStrictYaml(bytes: Uint8Array, bounds: StrictYamlBounds): Result<unknown, StrictYamlFailureCode> {
  const result = parseStrictYamlDocument(bytes, bounds);
  if (!result.ok) {
    return result;
  }
  return ok(result.value.value);
}

export function parseStrictYamlDocument(
  bytes: Uint8Array,
  bounds: StrictYamlBounds,
): Result<StrictYamlDocument, StrictYamlFailureCode> {
  if (bytes.byteLength > bounds.maxBytes) {
    return makeFailure('yaml.too-large', '', { line: null, column: null });
  }

  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return makeFailure('yaml.invalid-utf8', '', { line: null, column: null });
  }

  const lineCounter = new LineCounter();
  let docs: Document.Parsed[];
  try {
    docs = parseAllDocuments(text, {
      version: '1.2',
      schema: 'core',
      uniqueKeys: true,
      strict: true,
      merge: false,
      prettyErrors: false,
      lineCounter,
    }) as Document.Parsed[];
  } catch (error) {
    if (error instanceof RangeError) {
      return makeFailure('yaml.too-deep', '', { line: null, column: null });
    }
    return makeFailure('yaml.syntax', '', { line: null, column: null });
  }

  if (docs.length === 0) {
    return makeFailure('yaml.empty', '', { line: null, column: null });
  }
  if (docs.length > 1) {
    return makeFailure('yaml.multi-document', '', { line: null, column: null });
  }

  const doc = docs[0] as Document.Parsed;

  if (doc.errors.length > 0) {
    const firstError = doc.errors[0];
    if (firstError !== undefined) {
      const position = pointFor(lineCounter, firstError.pos[0]);
      if (firstError.code === 'DUPLICATE_KEY') {
        return makeFailure('yaml.duplicate-key', '', position);
      }
      if (firstError.code === 'RESOURCE_EXHAUSTION') {
        return makeFailure('yaml.too-deep', '', position);
      }
      return makeFailure('yaml.syntax', '', position);
    }
  }

  if (doc.directives !== undefined) {
    if (doc.directives.yaml.explicit === true) {
      return makeFailure('yaml.directive', '', { line: null, column: null });
    }
    const tagEntries = Object.entries(doc.directives.tags);
    for (const [handle, prefix] of tagEntries) {
      if (handle !== '!!' || prefix !== 'tag:yaml.org,2002:') {
        return makeFailure('yaml.directive', '', { line: null, column: null });
      }
    }
  }

  if (doc.contents === null || doc.contents === undefined) {
    return makeFailure('yaml.empty', '', { line: null, column: null });
  }

  const state: WalkState = { nodeCount: 0, stopped: false, found: {}, positions: new Map() };
  recordPosition(state, '', positionAt(lineCounter, doc.contents as NodeLike));
  walkNode(state, lineCounter, bounds, doc.contents, '', 0);

  for (const code of NODE_VIOLATION_PRECEDENCE) {
    const found = state.found[code];
    if (found !== undefined) {
      return makeFailure(code, found.path, found.position);
    }
  }

  if (doc.warnings.length > 0) {
    return makeFailure('yaml.syntax', '', { line: null, column: null });
  }

  try {
    const value: unknown = doc.toJS();
    return ok({ value, positions: state.positions });
  } catch {
    return makeFailure('yaml.syntax', '', { line: null, column: null });
  }
}

function pointFor(lineCounter: LineCounter, offset: number): NodePosition {
  const pos = lineCounter.linePos(offset);
  if (pos.line === 0) {
    return { line: null, column: null };
  }
  return { line: pos.line, column: pos.col };
}
