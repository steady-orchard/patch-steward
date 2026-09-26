import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { BUILT_IN_DISMISSAL_CODES } from '../vocabulary.js';
import {
  BUILT_IN_DISMISSAL_DEFINITIONS,
  builtInDismissalCatalog,
  DISMISSAL_CODE_PATTERN,
  LLM_MODEL_PLACEHOLDER,
  PUBLIC_SUBSET_SECTION_IDS,
  POLICY_VALIDATION_CODES,
} from './catalog.js';

describe('catalog', () => {
  it('built-in dismissal definitions match the approved digest', () => {
    const digest = createHash('sha256')
      .update(JSON.stringify(BUILT_IN_DISMISSAL_CODES.map((c) => [c, BUILT_IN_DISMISSAL_DEFINITIONS[c]])))
      .digest('hex');
    expect(digest).toBe('3237f832d4c813b52d66f17c6e77d78082dddf8d9a9eaf4c30dff83655996331');
  });

  it('built-in dismissal catalog lists nine built-in entries in vocabulary order', () => {
    const entries = builtInDismissalCatalog();
    expect(entries).toHaveLength(9);
    expect(entries.map((e) => e.code)).toEqual([...BUILT_IN_DISMISSAL_CODES]);
    expect(entries.every((e) => e.built_in === true)).toBe(true);
  });

  it('built-in dismissal codes match the code pattern', () => {
    for (const code of BUILT_IN_DISMISSAL_CODES) {
      expect(code).toMatch(DISMISSAL_CODE_PATTERN);
    }
    for (const bad of ['Bad', 'a--b', '-a', 'a-']) {
      expect(bad).not.toMatch(DISMISSAL_CODE_PATTERN);
    }
  });

  it('placeholder model id is replace-with-model-id', () => {
    expect(LLM_MODEL_PLACEHOLDER).toBe('replace-with-model-id');
  });

  it('public subset section ids are the eight closed sections', () => {
    expect(PUBLIC_SUBSET_SECTION_IDS).toEqual([
      'categories',
      'evidence_requirements',
      'unrequested_change',
      'modes',
      'attachment_caps',
      'dismissal_codes',
      'supported_versions',
      'inference_admission',
    ]);
  });

  it('policy validation codes are unique and namespaced', () => {
    expect(POLICY_VALIDATION_CODES).toHaveLength(16);
    expect(new Set(POLICY_VALIDATION_CODES).size).toBe(16);
    for (const code of POLICY_VALIDATION_CODES) {
      expect(code.startsWith('policy.')).toBe(true);
    }
  });
});
