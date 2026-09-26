import type { Category } from '../vocabulary.js';
import { CATEGORIES } from '../vocabulary.js';
import { POLICY_DIRECTORY } from '../git/reader.js';
import { matchesAnyGlob } from './globs.js';
import {
  BUILT_IN_TRUSTED_PATHS,
  BUILT_IN_EXECUTION_SENSITIVE_PATHS,
  PATH_CLASS_TEST_GLOBS,
  PATH_CLASS_DOCS_GLOBS,
  PATH_CLASS_INFRA_GLOBS,
} from './path-lists.js';

export const PATH_CLASSES = ['test', 'docs', 'infra', 'code'] as const;
export type PathClass = (typeof PATH_CLASSES)[number];

export function classifyPath(path: string): PathClass {
  if (matchesAnyGlob(PATH_CLASS_TEST_GLOBS, path)) {
    return 'test';
  }
  if (matchesAnyGlob(PATH_CLASS_DOCS_GLOBS, path)) {
    return 'docs';
  }
  if (
    matchesAnyGlob(BUILT_IN_TRUSTED_PATHS, path) ||
    matchesAnyGlob(BUILT_IN_EXECUTION_SENSITIVE_PATHS, path) ||
    matchesAnyGlob(PATH_CLASS_INFRA_GLOBS, path)
  ) {
    return 'infra';
  }
  return 'code';
}

export const PATH_CHANGE_KINDS = ['added', 'modified', 'deleted', 'renamed', 'copied', 'type-changed'] as const;
export type PathChangeKind = (typeof PATH_CHANGE_KINDS)[number];

export interface PathChange {
  readonly kind: PathChangeKind;
  readonly path: string;
  readonly previousPath: string | null;
}

export function changedPathSet(changes: readonly PathChange[]): readonly string[] {
  const paths = new Set<string>();
  for (const change of changes) {
    paths.add(change.path);
    if ((change.kind === 'renamed' || change.kind === 'copied') && change.previousPath !== null) {
      paths.add(change.previousPath);
    }
  }
  return Array.from(paths).sort();
}

function isDocsConsistent(classes: readonly PathClass[]): boolean {
  if (classes.length === 0) {
    return false;
  }
  return classes.every((c) => c === 'docs' || c === 'test') && classes.some((c) => c === 'docs');
}

function isChoreConsistent(classes: readonly PathClass[]): boolean {
  if (classes.length === 0) {
    return false;
  }
  return classes.every((c) => c !== 'code') && classes.some((c) => c === 'docs' || c === 'infra');
}

function needsCodePath(classes: readonly PathClass[]): boolean {
  return classes.some((c) => c === 'code');
}

export function consistentCategories(paths: readonly string[]): readonly Category[] {
  if (paths.length === 0) {
    return [];
  }
  const classes = paths.map(classifyPath);
  const result: Category[] = [];
  for (const category of CATEGORIES) {
    let consistent: boolean;
    switch (category) {
      case 'docs':
        consistent = isDocsConsistent(classes);
        break;
      case 'chore':
        consistent = isChoreConsistent(classes);
        break;
      case 'bugfix':
      case 'feature':
      case 'refactor':
      case 'security':
        consistent = needsCodePath(classes);
        break;
    }
    if (consistent) {
      result.push(category);
    }
  }
  return result;
}

export interface PathAdditions {
  readonly trusted: readonly string[];
  readonly executionSensitive: readonly string[];
}

export function isTrustedPath(path: string, additional: readonly string[]): boolean {
  return matchesAnyGlob(BUILT_IN_TRUSTED_PATHS, path) || matchesAnyGlob(additional, path);
}

export function isExecutionSensitivePath(path: string, additional: readonly string[]): boolean {
  return matchesAnyGlob(BUILT_IN_EXECUTION_SENSITIVE_PATHS, path) || matchesAnyGlob(additional, path);
}

export function isPolicyDirectoryPath(path: string): boolean {
  return path === POLICY_DIRECTORY || path.startsWith(`${POLICY_DIRECTORY}/`);
}

export interface PathFlags {
  readonly trusted: readonly string[];
  readonly executionSensitive: readonly string[];
  readonly policy: readonly string[];
}

export function detectPathFlags(paths: readonly string[], additions: PathAdditions): PathFlags {
  const trusted: string[] = [];
  const executionSensitive: string[] = [];
  const policy: string[] = [];
  for (const path of paths) {
    if (isTrustedPath(path, additions.trusted)) {
      trusted.push(path);
    }
    if (isExecutionSensitivePath(path, additions.executionSensitive)) {
      executionSensitive.push(path);
    }
    if (isPolicyDirectoryPath(path)) {
      policy.push(path);
    }
  }
  trusted.sort();
  executionSensitive.sort();
  policy.sort();
  return { trusted, executionSensitive, policy };
}
