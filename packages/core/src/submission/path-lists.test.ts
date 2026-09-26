import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  BUILT_IN_TRUSTED_PATHS,
  BUILT_IN_EXECUTION_SENSITIVE_PATHS,
  PATH_CLASS_TEST_GLOBS,
  PATH_CLASS_DOCS_GLOBS,
  PATH_CLASS_INFRA_GLOBS,
} from './path-lists.js';

function digest(list: readonly string[]): string {
  return createHash('sha256').update(JSON.stringify(list), 'utf8').digest('hex');
}

const lists = {
  BUILT_IN_TRUSTED_PATHS,
  BUILT_IN_EXECUTION_SENSITIVE_PATHS,
  PATH_CLASS_TEST_GLOBS,
  PATH_CLASS_DOCS_GLOBS,
  PATH_CLASS_INFRA_GLOBS,
};

describe('path-lists', () => {
  it('built-in path lists match the approved digests', () => {
    expect(digest(BUILT_IN_TRUSTED_PATHS)).toBe('8c0f49f0d4517f0cea9f7b6eb23e65066e122dea7b3703321244d3632ab34efa');
    expect(digest(BUILT_IN_EXECUTION_SENSITIVE_PATHS)).toBe('497221efe7c4930bab47d4f4ce2d16dacf6d48a411d545d4cbc1cec56f2e304f');
    expect(digest(PATH_CLASS_TEST_GLOBS)).toBe('f5749e3896c4d4660e60fd7f91ac630b2d0a300f184efb0ef57cf24dccf57419');
    expect(digest(PATH_CLASS_DOCS_GLOBS)).toBe('40f5aeb29babb3e65a28d3190683d89b8a98e82e806db4279993863fb53c1597');
    expect(digest(PATH_CLASS_INFRA_GLOBS)).toBe('05d231efb56a9553d7fb67233be142bc28db1b6bad86cfdf1891343024858685');

    expect(BUILT_IN_TRUSTED_PATHS.length).toBe(26);
    expect(BUILT_IN_EXECUTION_SENSITIVE_PATHS.length).toBe(182);
    expect(PATH_CLASS_TEST_GLOBS.length).toBe(26);
    expect(PATH_CLASS_DOCS_GLOBS.length).toBe(39);
    expect(PATH_CLASS_INFRA_GLOBS.length).toBe(15);
  });

  it('built-in path lists have no duplicates and no special glob characters', () => {
    for (const list of Object.values(lists)) {
      expect(new Set(list).size).toBe(list.length);
      for (const entry of list) {
        expect(entry.length).toBeGreaterThan(0);
        expect(entry.startsWith('/')).toBe(false);
        expect(entry.endsWith('/')).toBe(false);
        expect(entry.includes('//')).toBe(false);
        expect(entry.includes('\\')).toBe(false);
        expect(entry.includes('{')).toBe(false);
        expect(entry.includes('}')).toBe(false);
        expect(entry.includes('[')).toBe(false);
        expect(entry.includes(']')).toBe(false);
        expect(entry.startsWith('!')).toBe(false);
      }
    }
  });

  it('built-in path lists are frozen', () => {
    for (const list of Object.values(lists)) {
      expect(Object.isFrozen(list)).toBe(true);
    }
  });
});
