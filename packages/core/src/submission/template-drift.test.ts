import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseStrictYaml } from '../strict-yaml.js';
import { POLICY_FILE_MAX_BYTES, POLICY_YAML_MAX_DEPTH, POLICY_YAML_MAX_NODES } from '../policy/bounds.js';
import {
  DEFECT_FORM_MAPPING_V1,
  PROPOSAL_FORM_MAPPING_V1,
  PULL_REQUEST_TEMPLATE_MAPPING_V1,
  SECURITY_CLAIM_OPTION_LABEL,
  pullRequestTemplateMarker,
} from './field-mapping.js';
import type { IssueFormMapping } from './field-mapping.js';
import { scanMarkdownLines, findMarkdownHeadings } from './markdown-scan.js';
import { parseIssueBody, parsePullRequestBody } from './parse.js';

function readTemplateText(relativePath: string): string {
  const bytes = readFileSync(fileURLToPath(new URL(`../../../../templates/${relativePath}`, import.meta.url)));
  return new TextDecoder('utf-8').decode(bytes).replace(/\r/g, '');
}

function readTemplateBytes(relativePath: string): Uint8Array {
  const text = readTemplateText(relativePath);
  return new TextEncoder().encode(text);
}

interface IssueFormElementAttributes {
  readonly label?: string;
  readonly render?: unknown;
  readonly value?: string;
  readonly options?: ReadonlyArray<{ label: string }>;
}

interface IssueFormElement {
  readonly type: string;
  readonly id?: string;
  readonly attributes?: IssueFormElementAttributes;
  readonly validations?: { readonly required?: boolean };
}

interface IssueFormDocument {
  readonly name: string;
  readonly description: string;
  readonly body: readonly IssueFormElement[];
}

function loadIssueForm(relativePath: string): IssueFormDocument {
  const result = parseStrictYaml(readTemplateBytes(relativePath), {
    maxBytes: POLICY_FILE_MAX_BYTES,
    maxDepth: POLICY_YAML_MAX_DEPTH,
    maxNodes: POLICY_YAML_MAX_NODES,
  });
  if (!result.ok) {
    throw new Error(`failed to parse ${relativePath}`);
  }
  return result.value as IssueFormDocument;
}

function checkFormAgainstMapping(form: IssueFormDocument, mapping: IssueFormMapping): void {
  const first = form.body[0];
  expect(first?.type).toBe('markdown');

  const rest = form.body.slice(1);
  const actual = rest.map((element) => [
    element.id,
    element.attributes?.label,
    element.type,
    element.validations?.required === true,
  ]);
  const expected = mapping.fields.map((field) => [field.id, field.label, field.element, field.required]);
  expect(actual).toEqual(expected);

  const checkboxes = rest.find((element) => element.type === 'checkboxes');
  if (checkboxes !== undefined) {
    expect(checkboxes.attributes?.options).toHaveLength(1);
    expect(checkboxes.attributes?.options?.[0]?.label).toBe(SECURITY_CLAIM_OPTION_LABEL);
  }
}

function renderIssueBody(form: IssueFormDocument): string {
  const parts: string[] = [];
  for (const element of form.body) {
    if (element.type === 'markdown') {
      continue;
    }
    const label = element.attributes?.label ?? '';
    if (element.type === 'checkboxes') {
      const option = element.attributes?.options?.[0];
      parts.push(`### ${label}\n\n- [ ] ${option?.label ?? ''}\n\n`);
    } else {
      parts.push(`### ${label}\n\n_No response_\n\n`);
    }
  }
  return parts.join('');
}

describe('template drift', () => {
  it('defect issue form matches field mapping v1', () => {
    const form = loadIssueForm('issue-forms/steward-defect.yml');
    checkFormAgainstMapping(form, DEFECT_FORM_MAPPING_V1);
  });

  it('proposal issue form matches field mapping v1', () => {
    const form = loadIssueForm('issue-forms/steward-proposal.yml');
    checkFormAgainstMapping(form, PROPOSAL_FORM_MAPPING_V1);
  });

  it('issue form required flags equal the template policy issue fields', () => {
    const policy = parseStrictYaml(readTemplateBytes('policy/policy.yml'), {
      maxBytes: POLICY_FILE_MAX_BYTES,
      maxDepth: POLICY_YAML_MAX_DEPTH,
      maxNodes: POLICY_YAML_MAX_NODES,
    });
    if (!policy.ok) {
      throw new Error('failed to parse policy template');
    }
    const raw = policy.value as { submission: { issue_fields: { defect: string[]; proposal: string[] } } };

    const defectForm = loadIssueForm('issue-forms/steward-defect.yml');
    const defectRequiredIds = defectForm.body
      .filter((element) => element.type !== 'markdown' && element.validations?.required === true)
      .map((element) => element.id);
    expect(defectRequiredIds).toEqual(raw.submission.issue_fields.defect);

    const proposalForm = loadIssueForm('issue-forms/steward-proposal.yml');
    const proposalRequiredIds = proposalForm.body
      .filter((element) => element.type !== 'markdown' && element.validations?.required === true)
      .map((element) => element.id);
    expect(proposalRequiredIds).toEqual(raw.submission.issue_fields.proposal);
  });

  it('issue forms carry no labels key, no severity field, and no render key', () => {
    for (const relativePath of ['issue-forms/steward-defect.yml', 'issue-forms/steward-proposal.yml']) {
      const form = loadIssueForm(relativePath);
      expect(Object.keys(form)).toEqual(['name', 'description', 'body']);
      for (const element of form.body) {
        if (element.id !== undefined) {
          expect(element.id.toLowerCase()).not.toContain('severity');
        }
        if (element.attributes?.label !== undefined) {
          expect(element.attributes.label.toLowerCase()).not.toContain('severity');
        }
        expect(element.attributes && Object.hasOwn(element.attributes, 'render')).toBe(false);
      }
      const markdownValue = form.body[0]?.attributes?.value ?? '';
      expect(markdownValue.toLowerCase()).toContain('severity');
      expect(markdownValue.toLowerCase()).toContain('security');
    }
    const defectForm = loadIssueForm('issue-forms/steward-defect.yml');
    const defectMarkdownValue = defectForm.body[0]?.attributes?.value ?? '';
    expect(defectMarkdownValue).toContain('Reproduction command');
  });

  it('pull request template marker and headings match field mapping v1', () => {
    const text = readTemplateText('pull-request/pull_request_template.md');
    const firstLine = text.split('\n')[0];
    expect(firstLine).toBe(pullRequestTemplateMarker(1));
    const headings = findMarkdownHeadings(scanMarkdownLines(text), 2).map((heading) => heading.text);
    expect(headings).toEqual(PULL_REQUEST_TEMPLATE_MAPPING_V1.sections.map((section) => section.heading));
  });

  it('committed templates parse as structured v1 bodies', () => {
    const prText = readTemplateText('pull-request/pull_request_template.md');
    const prResult = parsePullRequestBody(prText);
    if (!prResult.ok) {
      throw new Error('pull request template failed to parse');
    }
    const prBody = prResult.value;
    if (!prBody.structured) {
      throw new Error('pull request template parsed as unstructured');
    }
    expect(prBody.template).toEqual({ form: 'pull_request', version: 1 });
    const prFields = Object.values(prBody.fields);
    expect(prFields).toHaveLength(11);
    for (const field of prFields) {
      expect(field?.trivial).toBe(true);
    }
    expect(prBody.duplicates).toEqual([]);

    const defectForm = loadIssueForm('issue-forms/steward-defect.yml');
    const defectBody = renderIssueBody(defectForm);
    const defectResult = parseIssueBody(defectBody);
    if (!defectResult.ok) {
      throw new Error('defect form failed to parse');
    }
    const defectParsed = defectResult.value;
    if (!defectParsed.structured) {
      throw new Error('defect form parsed as unstructured');
    }
    expect(defectParsed.template).toEqual({ form: 'defect', version: 1 });
    for (const [id, field] of Object.entries(defectParsed.fields)) {
      if (id === 'security-claim') {
        continue;
      }
      expect(field?.trivial).toBe(true);
    }
    expect(defectParsed.duplicates).toEqual([]);
    expect(defectParsed.securityClaim).toBe(false);

    const proposalForm = loadIssueForm('issue-forms/steward-proposal.yml');
    const proposalBody = renderIssueBody(proposalForm);
    const proposalResult = parseIssueBody(proposalBody);
    if (!proposalResult.ok) {
      throw new Error('proposal form failed to parse');
    }
    const proposalParsed = proposalResult.value;
    if (!proposalParsed.structured) {
      throw new Error('proposal form parsed as unstructured');
    }
    expect(proposalParsed.template).toEqual({ form: 'proposal', version: 1 });
    for (const field of Object.values(proposalParsed.fields)) {
      expect(field?.trivial).toBe(true);
    }
    expect(proposalParsed.duplicates).toEqual([]);
  });

  it('policy template attachment defaults', () => {
    const policy = parseStrictYaml(readTemplateBytes('policy/policy.yml'), {
      maxBytes: POLICY_FILE_MAX_BYTES,
      maxDepth: POLICY_YAML_MAX_DEPTH,
      maxNodes: POLICY_YAML_MAX_NODES,
    });
    if (!policy.ok) {
      throw new Error('failed to parse policy template');
    }
    const raw = policy.value as { submission: { attachments: { destinations: string[]; formats: string[] } } };
    expect(raw.submission.attachments.destinations).toEqual([
      'github.com',
      'objects.githubusercontent.com',
      'github-production-user-asset-6210df.s3.amazonaws.com',
      'user-images.githubusercontent.com',
      'private-user-images.githubusercontent.com',
    ]);
    expect(raw.submission.attachments.formats).toEqual([
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
  });
});
