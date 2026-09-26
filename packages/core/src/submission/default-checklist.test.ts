import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CHECKLIST_POLICY } from './default-checklist.js';
import { validatePolicyBytes } from '../policy/validate.js';
import { resolvePolicy } from '../policy/resolve.js';
import { resolvedPolicySchema } from '../policy/schema.js';

function loadResolvedTemplate() {
  const bytes = readFileSync(fileURLToPath(new URL('../../../../templates/policy/policy.yml', import.meta.url)));
  const validated = validatePolicyBytes(bytes);
  if (!validated.ok) {
    throw new Error('template invalid');
  }
  const resolved = resolvePolicy(validated.value);
  if (!resolved.ok) {
    throw new Error('template unresolved');
  }
  return resolved.value;
}

describe('DEFAULT_CHECKLIST_POLICY', () => {
  it('default checklist equals the resolved policy template', () => {
    expect(DEFAULT_CHECKLIST_POLICY).toEqual(loadResolvedTemplate());
  });

  it('default checklist re-validates against the resolved policy schema', () => {
    expect(resolvedPolicySchema.safeParse(DEFAULT_CHECKLIST_POLICY).success).toBe(true);
  });

  it('default checklist is deeply frozen', () => {
    expect(Object.isFrozen(DEFAULT_CHECKLIST_POLICY)).toBe(true);
    expect(Object.isFrozen(DEFAULT_CHECKLIST_POLICY.submission)).toBe(true);
    expect(Object.isFrozen(DEFAULT_CHECKLIST_POLICY.submission.attachments)).toBe(true);
    expect(Object.isFrozen(DEFAULT_CHECKLIST_POLICY.submission.attachments.destinations)).toBe(true);
    expect(Object.isFrozen(DEFAULT_CHECKLIST_POLICY.categories.bugfix.required_fields)).toBe(true);
  });

  it('default checklist carries the template submission defaults', () => {
    expect(DEFAULT_CHECKLIST_POLICY.submission.attachments.destinations).toEqual([
      'github.com',
      'objects.githubusercontent.com',
      'github-production-user-asset-6210df.s3.amazonaws.com',
      'user-images.githubusercontent.com',
      'private-user-images.githubusercontent.com',
    ]);
    expect(DEFAULT_CHECKLIST_POLICY.submission.attachments.formats).toEqual([
      'txt',
      'log',
      'md',
      'json',
      'patch',
      'diff',
      'zip',
      'gz',
      'png',
      'jpg',
      'jpeg',
      'gif',
    ]);
    expect(DEFAULT_CHECKLIST_POLICY.modes.default).toBe('observe');
    expect(DEFAULT_CHECKLIST_POLICY.categories.bugfix.linked_issue).toBe('required');
    expect(DEFAULT_CHECKLIST_POLICY.submission.free_form).toBe(false);
  });
});
