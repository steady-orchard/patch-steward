import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { parseStrictYaml } from '../strict-yaml.js';
import { buildRunName, parseRunName } from '../ownership/caps.js';
import type { RunNameFields } from '../ownership/caps.js';
import type { SenderType } from '../vocabulary.js';

const RN_PR =
  'steward pr ${{ github.event.pull_request.number }} author ${{ github.event.pull_request.user.id }} event ${{ github.event_name }} ${{ github.event.action }} sender ${{ github.event.sender.id }} ${{ github.event.sender.type }}';
const RN_ISSUE =
  'steward issue ${{ github.event.issue.number }} author ${{ github.event.issue.user.id }} event ${{ github.event_name }} ${{ github.event.action }} sender ${{ github.event.sender.id }} ${{ github.event.sender.type }}';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function loadWorkflow(relativePath: string): Promise<unknown> {
  const url = new URL(relativePath, import.meta.url);
  const bytes = new Uint8Array(await readFile(url));
  const result = parseStrictYaml(bytes, { maxBytes: 1048576, maxDepth: 64, maxNodes: 100000 });
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error('unreachable');
  }
  return result.value;
}

function collectEventPaths(value: unknown, path: readonly string[], out: string[][]): void {
  if (typeof value === 'string') {
    if (value.includes('github.event')) {
      out.push([...path]);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectEventPaths(item, [...path, String(index)], out);
    });
    return;
  }
  if (isRecord(value)) {
    for (const [key, item] of Object.entries(value)) {
      collectEventPaths(item, [...path, key], out);
    }
  }
}

function collectAllStrings(value: unknown, out: string[]): void {
  if (typeof value === 'string') {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectAllStrings(item, out);
    }
    return;
  }
  if (isRecord(value)) {
    for (const item of Object.values(value)) {
      collectAllStrings(item, out);
    }
  }
}

interface WorkflowStep {
  readonly run: unknown;
}

function isStep(value: unknown): value is WorkflowStep {
  return isRecord(value);
}

function jobEntries(doc: unknown): ReadonlyArray<readonly [string, unknown]> {
  if (!isRecord(doc)) {
    throw new Error('workflow document is not a mapping');
  }
  const jobs = doc['jobs'];
  if (!isRecord(jobs)) {
    throw new Error('workflow document has no jobs mapping');
  }
  return Object.entries(jobs);
}

function jobSteps(job: unknown): readonly unknown[] {
  if (!isRecord(job)) {
    return [];
  }
  const steps = job['steps'];
  return Array.isArray(steps) ? steps : [];
}

function extractExpressions(text: string): string[] {
  const out: string[] = [];
  const pattern = /\$\{\{\s*([^}]*?)\s*\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const expr = match[1];
    if (expr !== undefined) {
      out.push(expr);
    }
  }
  return out;
}

function substitute(template: string, values: readonly string[]): string {
  let index = 0;
  return template.replace(/\$\{\{\s*[^}]*?\s*\}\}/g, () => {
    const value = values[index];
    index += 1;
    if (value === undefined) {
      throw new Error('not enough substitution values');
    }
    return value;
  });
}

describe('invariant 1: workflows', () => {
  it('no event text reaches a run step', async () => {
    const w = await loadWorkflow('../../../../.github/workflows/steward-screening.yml');
    const p = await loadWorkflow('../../../../templates/workflows/steward-pr.yml');
    const i = await loadWorkflow('../../../../templates/workflows/steward-issues.yml');

    let runStepsVisitedInW = 0;
    for (const doc of [w, p, i]) {
      for (const [, job] of jobEntries(doc)) {
        for (const step of jobSteps(job)) {
          if (isStep(step) && typeof step.run === 'string') {
            expect(step.run).not.toContain('${{');
            if (doc === w) {
              runStepsVisitedInW += 1;
            }
          }
        }
      }
    }
    expect(runStepsVisitedInW).toBeGreaterThan(0);

    const wPaths: string[][] = [];
    collectEventPaths(w, [], wPaths);
    expect(wPaths).toEqual([]);

    const pPaths: string[][] = [];
    collectEventPaths(p, [], pPaths);
    expect(pPaths).toEqual([['run-name']]);

    const iPaths: string[][] = [];
    collectEventPaths(i, [], iPaths);
    expect(iPaths).toEqual([['run-name']]);

    const allStrings: string[] = [];
    collectAllStrings(w, allStrings);
    collectAllStrings(p, allStrings);
    collectAllStrings(i, allStrings);
    for (const text of allStrings) {
      expect(text).not.toContain('github.head_ref');
      expect(text).not.toContain('toJSON(github');
    }
  });

  it('run-name uses only numeric and enumerated values', async () => {
    const p = await loadWorkflow('../../../../templates/workflows/steward-pr.yml');
    const i = await loadWorkflow('../../../../templates/workflows/steward-issues.yml');
    if (!isRecord(p) || !isRecord(i)) {
      throw new Error('workflow document is not a mapping');
    }

    expect(p['run-name']).toBe(RN_PR);
    expect(i['run-name']).toBe(RN_ISSUE);

    const prExpressions = extractExpressions(RN_PR);
    expect(new Set(prExpressions)).toEqual(
      new Set([
        'github.event.pull_request.number',
        'github.event.pull_request.user.id',
        'github.event_name',
        'github.event.action',
        'github.event.sender.id',
        'github.event.sender.type',
      ]),
    );

    const issueExpressions = extractExpressions(RN_ISSUE);
    expect(new Set(issueExpressions)).toEqual(
      new Set([
        'github.event.issue.number',
        'github.event.issue.user.id',
        'github.event_name',
        'github.event.action',
        'github.event.sender.id',
        'github.event.sender.type',
      ]),
    );

    const prSample = substitute(RN_PR, ['12', '2095171', 'pull_request_target', 'edited', '331019482', 'Bot']);
    const prFields = parseRunName(prSample);
    expect(prFields).not.toBeNull();
    const expectedPrFields: RunNameFields = {
      kind: 'pr',
      number: 12,
      authorId: 2095171,
      eventName: 'pull_request_target',
      action: 'edited',
      senderId: 331019482,
      senderType: 'Bot' as SenderType,
    };
    expect(prFields).toEqual(expectedPrFields);
    if (prFields !== null) {
      expect(buildRunName(prFields)).toBe(prSample);
    }

    const issueSample = substitute(RN_ISSUE, ['29', '2095171', 'issues', 'opened', '2095171', 'User']);
    const issueFields = parseRunName(issueSample);
    expect(issueFields).not.toBeNull();
    const expectedIssueFields: RunNameFields = {
      kind: 'issue',
      number: 29,
      authorId: 2095171,
      eventName: 'issues',
      action: 'opened',
      senderId: 2095171,
      senderType: 'User' as SenderType,
    };
    expect(issueFields).toEqual(expectedIssueFields);
    if (issueFields !== null) {
      expect(buildRunName(issueFields)).toBe(issueSample);
    }

    const hostileSample = substitute(RN_PR, ['12', '2095171', 'pull_request_target', 'x $(id)', '331019482', 'Bot']);
    expect(parseRunName(hostileSample)).toBeNull();
  });
});
