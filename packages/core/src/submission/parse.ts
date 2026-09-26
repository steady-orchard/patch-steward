import { SUBMISSION_TEXT_MAX_LENGTH } from '../policy/bounds.js';
import {
  FIELD_MAPPING_REGISTRY,
  PULL_REQUEST_TEMPLATE_MARKER_PATTERN,
  SECURITY_CLAIM_OPTION_LABEL,
  normalizeTemplateLabel,
} from './field-mapping.js';
import type {
  FieldMappingRegistry,
  IssueFormMapping,
  PullRequestTemplateMapping,
  SubmissionTemplateForm,
} from './field-mapping.js';
import { normalizeFieldText, isTrivialFieldValue } from './normalize.js';
import { scanMarkdownLines, findMarkdownHeadings } from './markdown-scan.js';
import type { MarkdownLine } from './markdown-scan.js';
import type { SubmissionFieldId } from '../submission-fields.js';
import { ok, err } from '../result.js';
import type { Result } from '../result.js';

export interface ParsedSubmissionField {
  readonly raw: string;
  readonly normalized: string;
  readonly trivial: boolean;
}

export const UNSTRUCTURED_BODY_REASONS = [
  'no-template-match',
  'marker-missing',
  'marker-conflict',
  'marker-version-unknown',
] as const;

export type UnstructuredBodyReason = (typeof UNSTRUCTURED_BODY_REASONS)[number];

export interface StructuredSubmissionBody {
  readonly structured: true;
  readonly template: { readonly form: SubmissionTemplateForm; readonly version: number };
  readonly fields: Readonly<Partial<Record<SubmissionFieldId, ParsedSubmissionField>>>;
  readonly duplicates: readonly SubmissionFieldId[];
  readonly securityClaim: boolean | null;
}

export interface UnstructuredSubmissionBody {
  readonly structured: false;
  readonly reason: UnstructuredBodyReason;
}

export type ParsedSubmissionBody = StructuredSubmissionBody | UnstructuredSubmissionBody;

export type BodyParseFailureCode = 'submission.body-too-large' | 'submission.body-malformed';

function isBlankLineText(text: string): boolean {
  return /^[ \t]*$/u.test(text);
}

function buildFieldContent(lines: readonly MarkdownLine[], start: number, end: number): ParsedSubmissionField {
  let s = start;
  let e = end;
  while (s <= e) {
    const line = lines[s];
    if (line && isBlankLineText(line.text)) {
      s += 1;
    } else {
      break;
    }
  }
  while (e >= s) {
    const line = lines[e];
    if (line && isBlankLineText(line.text)) {
      e -= 1;
    } else {
      break;
    }
  }
  let raw = '';
  if (s <= e) {
    const parts: string[] = [];
    for (let i = s; i <= e; i += 1) {
      const line = lines[i];
      if (!line) {
        continue;
      }
      parts.push(i < e ? line.text + line.terminator : line.text);
    }
    raw = parts.join('');
  }
  return { raw, normalized: normalizeFieldText(raw), trivial: isTrivialFieldValue(raw) };
}

function validateBody(body: string): Result<null, BodyParseFailureCode> {
  if (body.length > SUBMISSION_TEXT_MAX_LENGTH) {
    return err('submission.body-too-large', 'github-unavailable', 'Body exceeds the 65536-character GitHub body limit.');
  }
  if (!body.isWellFormed()) {
    return err('submission.body-malformed', 'github-unavailable', 'Body is not well-formed Unicode.');
  }
  return ok(null);
}

function isSecurityClaimTrue(lines: readonly MarkdownLine[], start: number, end: number): boolean {
  const optionOn = '- [X] ' + SECURITY_CLAIM_OPTION_LABEL;
  const optionOnLower = '- [x] ' + SECURITY_CLAIM_OPTION_LABEL;
  for (let i = start; i <= end; i += 1) {
    const line = lines[i];
    if (!line || line.context !== 'text') {
      continue;
    }
    const trimmed = line.text.replace(/[ \t]+$/u, '');
    if (trimmed === optionOn || trimmed === optionOnLower) {
      return true;
    }
  }
  return false;
}

function matchIssueMapping(mappings: readonly IssueFormMapping[], headingTextSet: ReadonlySet<string>): IssueFormMapping | null {
  for (const mapping of mappings) {
    const allPresent = mapping.fields.every((field) => headingTextSet.has(normalizeTemplateLabel(field.label)));
    if (allPresent) {
      return mapping;
    }
  }
  return null;
}

export function parseIssueBody(
  body: string,
  registry: FieldMappingRegistry = FIELD_MAPPING_REGISTRY,
): Result<ParsedSubmissionBody, BodyParseFailureCode> {
  const boundsResult = validateBody(body);
  if (!boundsResult.ok) {
    return boundsResult;
  }

  const lines = scanMarkdownLines(body);
  const headings = findMarkdownHeadings(lines, 3);
  const headingTextSet = new Set(headings.map((heading) => normalizeTemplateLabel(heading.text)));

  let form: 'defect' | 'proposal' | null = null;
  let mapping: IssueFormMapping | null = null;

  const defectMatch = matchIssueMapping(registry.defect, headingTextSet);
  if (defectMatch) {
    form = 'defect';
    mapping = defectMatch;
  } else {
    const proposalMatch = matchIssueMapping(registry.proposal, headingTextSet);
    if (proposalMatch) {
      form = 'proposal';
      mapping = proposalMatch;
    }
  }

  if (!form || !mapping) {
    return ok({ structured: false, reason: 'no-template-match' });
  }

  const labelToId = new Map<string, SubmissionFieldId>();
  for (const field of mapping.fields) {
    labelToId.set(normalizeTemplateLabel(field.label), field.id);
  }

  const structuralHeadings: Array<{ lineIndex: number; id: SubmissionFieldId }> = [];
  for (const heading of headings) {
    const id = labelToId.get(normalizeTemplateLabel(heading.text));
    if (id !== undefined) {
      structuralHeadings.push({ lineIndex: heading.lineIndex, id });
    }
  }

  const idCounts = new Map<SubmissionFieldId, number>();
  for (const heading of structuralHeadings) {
    idCounts.set(heading.id, (idCounts.get(heading.id) ?? 0) + 1);
  }

  const duplicates: SubmissionFieldId[] = [];
  for (const field of mapping.fields) {
    if ((idCounts.get(field.id) ?? 0) > 1) {
      duplicates.push(field.id);
    }
  }

  const fields: Partial<Record<SubmissionFieldId, ParsedSubmissionField>> = {};
  let securityClaim: boolean | null = null;
  const isDefect = form === 'defect';

  for (let i = 0; i < structuralHeadings.length; i += 1) {
    const current = structuralHeadings[i];
    if (!current) {
      continue;
    }
    if ((idCounts.get(current.id) ?? 0) > 1) {
      continue;
    }
    const next = structuralHeadings[i + 1];
    const start = current.lineIndex + 1;
    const end = (next ? next.lineIndex : lines.length) - 1;
    fields[current.id] = buildFieldContent(lines, start, end);
    if (isDefect && current.id === 'security-claim') {
      securityClaim = isSecurityClaimTrue(lines, start, end);
    }
  }

  if (!isDefect) {
    securityClaim = null;
  } else if ((idCounts.get('security-claim' as SubmissionFieldId) ?? 0) !== 1) {
    securityClaim = null;
  }

  return ok({
    structured: true,
    template: { form, version: mapping.version },
    fields,
    duplicates,
    securityClaim,
  });
}

function matchPullRequestMapping(
  markerLines: readonly MarkdownLine[],
  registry: FieldMappingRegistry,
): { mapping: PullRequestTemplateMapping } | { reason: UnstructuredBodyReason } {
  const versions = new Set<number>();
  for (const line of markerLines) {
    const match = PULL_REQUEST_TEMPLATE_MARKER_PATTERN.exec(line.text);
    if (match) {
      versions.add(Number(match[1]));
    }
  }
  if (versions.size === 0) {
    return { reason: 'marker-missing' };
  }
  if (versions.size > 1) {
    return { reason: 'marker-conflict' };
  }
  const [version] = versions;
  const mapping = registry.pullRequest.find((candidate) => candidate.version === version);
  if (!mapping) {
    return { reason: 'marker-version-unknown' };
  }
  return { mapping };
}

export function parsePullRequestBody(
  body: string,
  registry: FieldMappingRegistry = FIELD_MAPPING_REGISTRY,
): Result<ParsedSubmissionBody, BodyParseFailureCode> {
  const boundsResult = validateBody(body);
  if (!boundsResult.ok) {
    return boundsResult;
  }

  const lines = scanMarkdownLines(body);
  const markerLines = lines.filter((line) => line.context === 'text');

  const matchResult = matchPullRequestMapping(markerLines, registry);
  if ('reason' in matchResult) {
    return ok({ structured: false, reason: matchResult.reason });
  }
  const mapping = matchResult.mapping;

  const headingIdByNormalizedLower = new Map<string, SubmissionFieldId>();
  for (const section of mapping.sections) {
    headingIdByNormalizedLower.set(normalizeTemplateLabel(section.heading).toLowerCase(), section.id);
  }

  const headings = findMarkdownHeadings(lines, 2);
  const structuralHeadings: Array<{ lineIndex: number; id: SubmissionFieldId | null }> = headings.map((heading) => ({
    lineIndex: heading.lineIndex,
    id: headingIdByNormalizedLower.get(normalizeTemplateLabel(heading.text).toLowerCase()) ?? null,
  }));

  const idCounts = new Map<SubmissionFieldId, number>();
  for (const heading of structuralHeadings) {
    if (heading.id !== null) {
      idCounts.set(heading.id, (idCounts.get(heading.id) ?? 0) + 1);
    }
  }

  const duplicates: SubmissionFieldId[] = [];
  for (const section of mapping.sections) {
    if ((idCounts.get(section.id) ?? 0) > 1) {
      duplicates.push(section.id);
    }
  }

  const fields: Partial<Record<SubmissionFieldId, ParsedSubmissionField>> = {};

  for (let i = 0; i < structuralHeadings.length; i += 1) {
    const current = structuralHeadings[i];
    if (!current || current.id === null) {
      continue;
    }
    if ((idCounts.get(current.id) ?? 0) > 1) {
      continue;
    }
    const next = structuralHeadings[i + 1];
    const start = current.lineIndex + 1;
    const end = (next ? next.lineIndex : lines.length) - 1;
    fields[current.id] = buildFieldContent(lines, start, end);
  }

  return ok({
    structured: true,
    template: { form: 'pull_request', version: mapping.version },
    fields,
    duplicates,
    securityClaim: null,
  });
}
