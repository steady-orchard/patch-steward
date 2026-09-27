import { readFileSync } from 'node:fs';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as core from '../index.js';
import type { ProcessRunner, ProcessOutput } from '../index.js';
import { ok, FAILURE_CAUSES, loadPolicy, resolvedPolicySchema, policyRevisionRecord } from '../index.js';

const templateBytes = readFileSync(fileURLToPath(new URL('../../../../templates/policy/policy.yml', import.meta.url)));

const commit = 'a'.repeat(40);
const treeId = 'b'.repeat(40);
const blobId = 'c'.repeat(40);

function defaultLsRoot(): ProcessOutput {
  return { exitCode: 0, stdout: Buffer.from(`040000 tree ${treeId}\t.github/patch-steward\u0000`), stderr: Buffer.alloc(0) };
}

function defaultLsRec(policyBytes: Buffer): ProcessOutput {
  return {
    exitCode: 0,
    stdout: Buffer.from(`100644 blob ${blobId} ${policyBytes.length}\tpolicy.yml\u0000`),
    stderr: Buffer.alloc(0),
  };
}

function makeRunner(overrides: Partial<Record<'gitDir' | 'verify' | 'lsRoot' | 'lsRec' | 'cat', ProcessOutput>>): ProcessRunner {
  const runner: ProcessRunner = async (_binary, args) => {
    if (args[0] === 'rev-parse' && args[1] === '--git-dir') {
      return ok(overrides.gitDir ?? { exitCode: 0, stdout: Buffer.from('.git\n'), stderr: Buffer.alloc(0) });
    }
    if (args[0] === 'rev-parse' && args[1] === '--verify') {
      return ok(overrides.verify ?? { exitCode: 0, stdout: Buffer.from(`${commit}\n`), stderr: Buffer.alloc(0) });
    }
    if (args[0] === 'ls-tree' && args.includes('.github/patch-steward')) {
      return ok(overrides.lsRoot ?? defaultLsRoot());
    }
    if (args[0] === 'ls-tree' && args.includes('-r')) {
      return ok(overrides.lsRec ?? defaultLsRec(templateBytes));
    }
    if (args[0] === 'cat-file') {
      return ok(overrides.cat ?? { exitCode: 0, stdout: templateBytes, stderr: Buffer.alloc(0) });
    }
    throw new Error(`unexpected git invocation: ${args.join(' ')}`);
  };
  return runner;
}

const malformedCases: readonly [string, Partial<Record<'gitDir' | 'verify' | 'lsRoot' | 'lsRec' | 'cat', ProcessOutput>>][] = [
  ['rev-parse commit id', { verify: { exitCode: 0, stdout: Buffer.from('not-a-commit\n'), stderr: Buffer.alloc(0) } }],
  [
    'ls-tree root without NUL terminator',
    { lsRoot: { exitCode: 0, stdout: Buffer.from(`040000 tree ${treeId}\t.github/patch-steward`), stderr: Buffer.alloc(0) } },
  ],
  [
    'ls-tree root with two records',
    {
      lsRoot: {
        exitCode: 0,
        stdout: Buffer.concat([
          Buffer.from(`040000 tree ${treeId}\t.github/patch-steward\u0000`),
          Buffer.from(`040000 tree ${treeId}\t.github/patch-steward\u0000`),
        ]),
        stderr: Buffer.alloc(0),
      },
    },
  ],
  [
    'ls-tree root for another path',
    { lsRoot: { exitCode: 0, stdout: Buffer.from(`040000 tree ${treeId}\tother\u0000`), stderr: Buffer.alloc(0) } },
  ],
  ['ls-tree listing record', { lsRec: { exitCode: 0, stdout: Buffer.from('garbage\u0000'), stderr: Buffer.alloc(0) } }],
  [
    'ls-tree listing unknown mode',
    { lsRec: { exitCode: 0, stdout: Buffer.from(`100600 blob ${blobId} 7\tpolicy.yml\u0000`), stderr: Buffer.alloc(0) } },
  ],
  [
    'ls-tree listing without NUL terminator',
    {
      lsRec: {
        exitCode: 0,
        stdout: Buffer.from(`100644 blob ${blobId} ${templateBytes.length}\tpolicy.yml`),
        stderr: Buffer.alloc(0),
      },
    },
  ],
  [
    'cat-file size mismatch',
    {
      lsRec: {
        exitCode: 0,
        stdout: Buffer.from(`100644 blob ${blobId} ${templateBytes.length + 1}\tpolicy.yml\u0000`),
        stderr: Buffer.alloc(0),
      },
    },
  ],
  ['invalid UTF-8 output', { lsRoot: { exitCode: 0, stdout: Buffer.from([0xff, 0xfe, 0x00]), stderr: Buffer.alloc(0) } }],
];

describe('invariant 5 conformance', () => {
  it.each(malformedCases.map(([name]) => name))('invariant 5: malformed git output is rejected: %s', async (name) => {
    const overrides = malformedCases.find(([caseName]) => caseName === name)?.[1];
    const runner = makeRunner(overrides ?? {});
    const result = await loadPolicy({ kind: 'git', repoDir: os.tmpdir(), ref: 'main' }, { runner });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('git.malformed-output');
      expect(result.failure.outcome).toBe('inconclusive');
    }
    expect('value' in result).toBe(false);
  });

  it('invariant 5: loaded policies re-validate against the resolved schema', async () => {
    const dir = os.tmpdir();
    const filePath = fileURLToPath(new URL('../../../../templates/policy/policy.yml', import.meta.url));
    const fileResult = await loadPolicy({ kind: 'file', path: filePath });
    expect(fileResult.ok).toBe(true);
    if (fileResult.ok) {
      expect(resolvedPolicySchema.safeParse(fileResult.value.policy).success).toBe(true);
      const record = policyRevisionRecord(fileResult.value, { stewardVersion: '0.0.2', loadedAt: '2026-09-26T12:00:00Z' });
      expect(record.ok).toBe(true);
    }

    const runner = makeRunner({});
    const gitResult = await loadPolicy({ kind: 'git', repoDir: dir, ref: 'main' }, { runner });
    expect(gitResult.ok).toBe(true);
    if (gitResult.ok) {
      expect(resolvedPolicySchema.safeParse(gitResult.value.policy).success).toBe(true);
      const record = policyRevisionRecord(gitResult.value, { stewardVersion: '0.0.2', loadedAt: '2026-09-26T12:00:00Z' });
      expect(record.ok).toBe(true);
    }
  });

  it('invariant 5: every exported load, validate, and resolve function rejects invalid input', async () => {
    const names = Object.keys(core)
      .filter((name) => /^(load|validate|resolve)/.test(name) && typeof (core as Record<string, unknown>)[name] === 'function')
      .sort();
    expect(names).toEqual([
      'loadPolicy',
      'resolveCommit',
      'resolvePolicy',
      'validateHandoff',
      'validatePolicy',
      'validatePolicyBytes',
    ]);

    const results: unknown[] = [];

    const invalidFileResult = await core.loadPolicy({ kind: 'file', path: '/does-not-exist/policy.yml' });
    results.push(invalidFileResult);

    const bytesResult = await (async () => {
      const dir = os.tmpdir();
      const { writeFileSync, mkdtempSync } = await import('node:fs');
      const { join } = await import('node:path');
      const tmp = mkdtempSync(join(dir, 'invariant5-'));
      const path = join(tmp, 'policy.yml');
      writeFileSync(path, 'version: 1\nextra: 1\n');
      return core.loadPolicy({ kind: 'file', path });
    })();
    results.push(bytesResult);

    results.push(core.validatePolicy({ version: 1 }));
    results.push(core.validatePolicyBytes(Buffer.from('version: 1\n')));
    results.push(core.resolvePolicy({ dismissal_codes: [] } as unknown as core.Policy));

    const gitOptions = { repoDir: os.tmpdir(), timeoutMs: 1000, maxOutputBytes: 1000 };
    results.push(await core.resolveCommit(gitOptions, '-x'));
    results.push(core.validateHandoff(null, { previous: null, gate: null, maxRounds: 1 }));

    const versionRunner: ProcessRunner = async (_binary, args) => {
      if (args[0] === 'rev-parse' && args[1] === '--git-dir') {
        return ok({ exitCode: 0, stdout: Buffer.from('.git\n'), stderr: Buffer.alloc(0) });
      }
      if (args[0] === 'rev-parse' && args[1] === '--verify') {
        return ok({ exitCode: 0, stdout: Buffer.from(`${commit}\n`), stderr: Buffer.alloc(0) });
      }
      if (args[0] === 'ls-tree' && args.includes('.github/patch-steward')) {
        return ok(defaultLsRoot());
      }
      if (args[0] === 'ls-tree' && args.includes('-r')) {
        return ok({ exitCode: 0, stdout: Buffer.from(`100644 blob ${blobId} 11\tpolicy.yml\u0000`), stderr: Buffer.alloc(0) });
      }
      if (args[0] === 'cat-file') {
        return ok({ exitCode: 0, stdout: Buffer.from('version: 2\n'), stderr: Buffer.alloc(0) });
      }
      throw new Error(`unexpected git invocation: ${args.join(' ')}`);
    };
    results.push(await core.loadPolicy({ kind: 'git', repoDir: os.tmpdir(), ref: 'main' }, { runner: versionRunner }));

    for (const result of results) {
      const r = result as { ok: boolean; failure?: { outcome: string; cause: string } };
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.failure?.outcome).toBe('inconclusive');
        expect(FAILURE_CAUSES).toContain(r.failure?.cause);
      }
      expect('value' in (result as object)).toBe(false);
    }
  });

  it('invariant 5: every exported load, validate, resolve, parse, capture, and check function rejects invalid input', async () => {
    const names = Object.keys(core)
      .filter(
        (name) =>
          /^(load|validate|resolve|parse|capture|check)/.test(name) &&
          typeof (core as Record<string, unknown>)[name] === 'function',
      )
      .sort();
    expect(names).toEqual([
      'captureIssue',
      'capturePullRequest',
      'checkContract',
      'checkPolicyRules',
      'checkRedactionPattern',
      'loadPolicy',
      'parseCategoryValue',
      'parseIssueBody',
      'parseLinkedIssueValue',
      'parsePullRequestBody',
      'parseStewardVersion',
      'parseStrictYaml',
      'parseStrictYamlDocument',
      'resolveCommit',
      'resolvePolicy',
      'validateHandoff',
      'validatePolicy',
      'validatePolicyBytes',
    ]);

    function expectResultRejection(result: unknown, expectedCode?: string): void {
      const r = result as { ok: boolean; failure?: { outcome: string; code: string } };
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.failure?.outcome).toBe('inconclusive');
        if (expectedCode !== undefined) {
          expect(r.failure?.code).toBe(expectedCode);
        }
      }
    }

    // loadPolicy, resolveCommit, resolvePolicy, validatePolicy, validatePolicyBytes: reuse the existing test's invalid inputs.
    expectResultRejection(await core.loadPolicy({ kind: 'file', path: '/does-not-exist/policy.yml' }));
    expectResultRejection(core.validatePolicy({ version: 1 }));
    expectResultRejection(core.validatePolicyBytes(Buffer.from('version: 1\n')));
    expectResultRejection(core.resolvePolicy({ dismissal_codes: [] } as unknown as core.Policy));
    const gitOptions = { repoDir: os.tmpdir(), timeoutMs: 1000, maxOutputBytes: 1000 };
    expectResultRejection(await core.resolveCommit(gitOptions, '-x'));
    expectResultRejection(core.validateHandoff(null, { previous: null, gate: null, maxRounds: 1 }), 'pipeline.handoff-invalid');
    expectResultRejection(core.parseStewardVersion('not json'), 'steward.version-unavailable');

    // parseCategoryValue / parseLinkedIssueValue: invalid status, not a Result.
    expect(core.parseCategoryValue('bugfix feature')).toEqual({ status: 'invalid' });
    expect(core.parseLinkedIssueValue('#1, #2', 'o/r').status).toBe('invalid');

    // parseIssueBody / parsePullRequestBody: Result rejections.
    expectResultRejection(core.parseIssueBody('x'.repeat(65537)), 'submission.body-too-large');
    expectResultRejection(core.parsePullRequestBody('\uD800'), 'submission.body-malformed');

    // parseStrictYaml / parseStrictYamlDocument: anchor rejection.
    const yamlBounds = { maxBytes: 1000, maxDepth: 10, maxNodes: 100 };
    expectResultRejection(core.parseStrictYaml(Buffer.from('a: &x 1\n'), yamlBounds), 'yaml.anchor');
    expectResultRejection(core.parseStrictYamlDocument(Buffer.from('a: &x 1\n'), yamlBounds), 'yaml.anchor');

    // checkContract: an unstructured issue body against the template policy.
    const templatePolicyResult = await core.loadPolicy({ kind: 'file', path: filePathForTemplate() });
    expect(templatePolicyResult.ok).toBe(true);
    if (templatePolicyResult.ok) {
      const contractResult = core.checkContract({
        type: 'issue',
        repository: { fullName: 'steady-orchard/patch-steward-testbed-public', defaultBranch: 'main' },
        policy: templatePolicyResult.value.policy,
        body: { structured: false, reason: 'no-template-match' },
        requestedKind: null,
        attachments: { limit: 5, countExceeded: false, items: [] },
      });
      expect(contractResult.disposition).toBe('needs-changes');
    }

    // checkPolicyRules: an undeclared execution command reference.
    const rawResult = core.parseStrictYaml(templateBytes, {
      maxBytes: core.POLICY_FILE_MAX_BYTES,
      maxDepth: core.POLICY_YAML_MAX_DEPTH,
      maxNodes: core.POLICY_YAML_MAX_NODES,
    });
    expect(rawResult.ok).toBe(true);
    if (rawResult.ok) {
      const raw = rawResult.value as { execution: { platforms: { commands: string[] }[] } };
      const platform = raw.execution.platforms[0];
      expect(platform).toBeDefined();
      if (platform) {
        platform.commands = ['test', 'missing'];
      }
      const policy = core.policySchema.parse(raw);
      const violations = core.checkPolicyRules(policy);
      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0]?.code).toBe('policy.undeclared-reference');
    }

    // checkRedactionPattern: catastrophic backtracking pattern is rejected.
    expect(core.checkRedactionPattern('(a+)+$')).not.toBeNull();

    // captureIssue / capturePullRequest: a repository read that does not match the expected schema.
    async function schemaMismatchFetch(): Promise<Response> {
      return new Response('{}', { status: 200 });
    }
    const captureClient = core.createGitHubClient({
      token: null,
      budget: core.createGitHubBudget({ requests: 10, retriesPerRequest: 0 }),
      fetch: schemaMismatchFetch,
    });
    const captureContext: core.CaptureContext = {
      client: captureClient,
      repository: { owner: 'steady-orchard', name: 'patch-steward-testbed-public' },
      policy: core.DEFAULT_CHECKLIST_POLICY,
      policyRevision: 'a'.repeat(40),
      attachmentResolver: () => {
        throw new Error('unexpected attachment resolver call');
      },
      attachmentTransport: () => {
        throw new Error('unexpected attachment transport call');
      },
      authorResponses: [],
    };
    expectResultRejection(await core.captureIssue(captureContext, 1), 'github.schema-mismatch');
    expectResultRejection(await core.capturePullRequest(captureContext, 1), 'github.schema-mismatch');
  });

  it('invariant 5: new adapters reject malformed input with a typed result', async () => {
    async function schemaMismatchFetch(): Promise<Response> {
      return new Response('{}', { status: 200 });
    }
    const client = core.createGitHubClient({
      token: null,
      budget: core.createGitHubBudget({ requests: 10, retriesPerRequest: 0 }),
      fetch: schemaMismatchFetch,
    });
    const repository = { owner: 'steady-orchard', name: 'patch-steward-testbed-public' };

    const repoResult = await core.readRepository(client, repository);
    expect(repoResult.ok).toBe(false);
    if (!repoResult.ok) {
      expect(repoResult.failure.code).toBe('github.schema-mismatch');
      expect(repoResult.failure.outcome).toBe('inconclusive');
    }

    const malformedRunner: ProcessRunner = async () =>
      ok({ exitCode: 0, stdout: Buffer.from('Q\u0000x\u0000'), stderr: Buffer.alloc(0) });
    const changedPathsResult = await core.listChangedPaths(
      { repoDir: os.tmpdir(), timeoutMs: 1000, maxOutputBytes: 1000, runner: malformedRunner },
      'a'.repeat(40),
      'b'.repeat(40),
    );
    expect(changedPathsResult.ok).toBe(false);
    if (!changedPathsResult.ok) {
      expect(changedPathsResult.failure.code).toBe('git.malformed-output');
      expect(changedPathsResult.failure.outcome).toBe('inconclusive');
    }

    const dirSha = 'd'.repeat(40);
    const otherTreeSha = 'e'.repeat(40);
    async function policyTreeFetch(url: string): Promise<Response> {
      if (url.includes('/contents/')) {
        return new Response(
          JSON.stringify([{ name: 'patch-steward', path: '.github/patch-steward', sha: dirSha, type: 'dir', size: 0 }]),
          { status: 200 },
        );
      }
      if (url.includes('/git/trees/')) {
        return new Response(JSON.stringify({ sha: otherTreeSha, truncated: false, tree: [] }), { status: 200 });
      }
      throw new Error(`unexpected url: ${url}`);
    }
    const policyTreeClient = core.createGitHubClient({
      token: null,
      budget: core.createGitHubBudget({ requests: 10, retriesPerRequest: 0 }),
      fetch: policyTreeFetch,
    });
    const proposedPolicyResult = await core.readProposedPolicyFromGitHub(policyTreeClient, repository, 'c'.repeat(40));
    expect(proposedPolicyResult.ok).toBe(false);
    if (!proposedPolicyResult.ok) {
      expect(proposedPolicyResult.failure.code).toBe('github.malformed-response');
      expect(proposedPolicyResult.failure.outcome).toBe('inconclusive');
    }

    const redirectOutcome = await core.fetchAttachment('https://github.com/user-attachments/files/1/a.txt', {
      destinations: ['github.com'],
      maxRedirects: 5,
      timeoutMs: 1000,
      maxFileBytes: 1000,
      remainingTotalBytes: 1000,
      resolver: async () => [{ address: '93.184.216.34', family: 4 }],
      transport: async () => ({
        kind: 'response',
        status: 302,
        location: null,
        body: (async function* () {})(),
        close: () => undefined,
      }),
    });
    expect(redirectOutcome).toEqual({
      kind: 'unavailable',
      url: 'https://github.com/user-attachments/files/1/a.txt',
      reason: 'redirect-invalid',
      message: 'The attachment redirect target is invalid.',
    });

    const zipInspection = core.inspectZipArchive(Buffer.from('not a zip'), 1000);
    expect(zipInspection.kind).toBe('violation');
    if (zipInspection.kind === 'violation') {
      expect(zipInspection.reason).toBe('malformed');
    }

    const bodyResult = core.parsePullRequestBody('\uD800');
    expect(bodyResult.ok).toBe(false);
    if (!bodyResult.ok) {
      expect(bodyResult.failure.code).toBe('submission.body-malformed');
      expect(bodyResult.failure.outcome).toBe('inconclusive');
    }
  });
});

function filePathForTemplate(): string {
  return fileURLToPath(new URL('../../../../templates/policy/policy.yml', import.meta.url));
}
