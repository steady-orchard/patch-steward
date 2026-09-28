import { describe, expect, it } from 'vitest';

import { buildEvidenceManifest, evidenceManifestSchema } from './manifest.js';
import type { EvidenceManifest, EvidenceManifestInput } from './manifest.js';
import { canonicalJsonHash, contentHash } from '../hash.js';

const RUN_ID = 'local-20260927T101500Z-3f9a1c2e';
const STORE_PATH = `runs/pr-12/${RUN_ID}`;
const METRICS_PATH = `metrics/2026-09/${RUN_ID}.json`;
const CREATED_AT = '2026-09-27T10:15:03.120Z';

function textBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

const SMALL_JSON = '{\n  "b": 1,\n  "a": [2]\n}\n';

const BASE_FILES: readonly { readonly path: string; readonly bytes: Uint8Array }[] = [
  { path: 'findings/finding-0001.json', bytes: textBytes(SMALL_JSON) },
  { path: 'logs/steward.txt', bytes: textBytes('plain log text\n') },
  { path: 'report.md', bytes: textBytes('# Report\n') },
  { path: 'decision.json', bytes: textBytes(SMALL_JSON) },
  { path: 'run.json', bytes: textBytes(SMALL_JSON) },
  { path: 'submission.json', bytes: textBytes(SMALL_JSON) },
  { path: 'policy-revision.json', bytes: textBytes(SMALL_JSON) },
  { path: 'report.json', bytes: textBytes(SMALL_JSON) },
];

function baseInput(overrides: Partial<EvidenceManifestInput> = {}): EvidenceManifestInput {
  return {
    runId: RUN_ID,
    runAttempt: 1,
    storePath: STORE_PATH,
    createdAt: CREATED_AT,
    files: BASE_FILES,
    metrics: { path: METRICS_PATH, bytes: textBytes('[]\n') },
    redaction: {
      detectors: ['private-key', 'github-token'],
      policyPatterns: [],
      exactValues: 3,
      replacements: [{ id: 'github-token', count: 1 }],
    },
    ...overrides,
  };
}

function buildBaseManifest(): EvidenceManifest {
  const result = buildEvidenceManifest(baseInput());
  if (!result.ok) {
    throw new Error('expected the base manifest to build successfully');
  }
  return result.value;
}

const WAITING_FILES: readonly { readonly path: string; readonly bytes: Uint8Array }[] = [
  { path: 'run.json', bytes: textBytes(SMALL_JSON) },
  { path: 'submission.json', bytes: textBytes(SMALL_JSON) },
  { path: 'policy-revision.json', bytes: textBytes(SMALL_JSON) },
  { path: 'waiting.json', bytes: textBytes(SMALL_JSON) },
  { path: 'logs/steward.txt', bytes: textBytes('plain log text\n') },
];

function waitingInput(overrides: Partial<EvidenceManifestInput> = {}): EvidenceManifestInput {
  return baseInput({ runKind: 'waiting', files: WAITING_FILES, ...overrides });
}

describe('buildEvidenceManifest', () => {
  it('manifest lists every file sorted by path with its bytes and hashes', () => {
    const manifest = buildBaseManifest();

    const paths = manifest.files.map((file) => file.path);
    expect(paths).toEqual([...paths].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));

    for (const inputFile of BASE_FILES) {
      const entry = manifest.files.find((file) => file.path === inputFile.path);
      expect(entry).toBeDefined();
      expect(entry?.bytes).toBe(inputFile.bytes.length);
      expect(entry?.sha256).toBe(contentHash(inputFile.bytes));
      if (entry?.record_type !== null) {
        const decoded = new TextDecoder('utf-8', { fatal: true }).decode(inputFile.bytes);
        const expectedHash = canonicalJsonHash(JSON.parse(decoded));
        expect(expectedHash.ok).toBe(true);
        expect(entry?.content_hash).toBe(expectedHash.ok ? expectedHash.value : null);
      }
    }

    expect(manifest.metrics).toEqual({
      path: METRICS_PATH,
      bytes: textBytes('[]\n').length,
      sha256: contentHash(textBytes('[]\n')),
    });

    expect(manifest.redaction).toEqual({
      detectors: ['private-key', 'github-token'],
      policy_patterns: [],
      exact_values: 3,
      replacements: [{ id: 'github-token', count: 1 }],
    });
  });

  it('non-record files carry null record type and content hash', () => {
    const manifest = buildBaseManifest();

    const reportMarkdown = manifest.files.find((file) => file.path === 'report.md');
    expect(reportMarkdown?.record_type).toBeNull();
    expect(reportMarkdown?.content_hash).toBeNull();

    const log = manifest.files.find((file) => file.path === 'logs/steward.txt');
    expect(log?.record_type).toBeNull();
    expect(log?.content_hash).toBeNull();
  });

  it('manifest rejects a path outside the run layout', () => {
    const withExtraFile = buildEvidenceManifest(
      baseInput({ files: [...BASE_FILES, { path: 'notes.txt', bytes: textBytes('hi\n') }] }),
    );
    expect(withExtraFile.ok).toBe(false);
    if (!withExtraFile.ok) {
      expect(withExtraFile.failure.code).toBe('evidence.manifest-invalid');
    }

    const withTraversal = buildEvidenceManifest(
      baseInput({ files: [...BASE_FILES, { path: '../run.json', bytes: textBytes(SMALL_JSON) }] }),
    );
    expect(withTraversal.ok).toBe(false);
    if (!withTraversal.ok) {
      expect(withTraversal.failure.code).toBe('evidence.manifest-invalid');
    }
  });

  it('manifest rejects unsorted or duplicate paths', () => {
    const manifest = buildBaseManifest();

    const swapped: EvidenceManifest = {
      ...manifest,
      files: [
        manifest.files[1] as EvidenceManifest['files'][number],
        manifest.files[0] as EvidenceManifest['files'][number],
        ...manifest.files.slice(2),
      ],
    };
    expect(evidenceManifestSchema.safeParse(swapped).success).toBe(false);

    const duplicated: EvidenceManifest = {
      ...manifest,
      files: [...manifest.files, manifest.files[0] as EvidenceManifest['files'][number]],
    };
    expect(evidenceManifestSchema.safeParse(duplicated).success).toBe(false);
  });

  it('manifest requires every run file', () => {
    const withoutReportMarkdown = buildEvidenceManifest(
      baseInput({ files: BASE_FILES.filter((file) => file.path !== 'report.md') }),
    );
    expect(withoutReportMarkdown.ok).toBe(false);
    if (!withoutReportMarkdown.ok) {
      expect(withoutReportMarkdown.failure.code).toBe('evidence.manifest-invalid');
    }
  });

  it('manifest bounds log files', () => {
    const manyLogFiles = Array.from({ length: 17 }, (_, index) => ({
      path: `logs/l-${index + 1}.txt`,
      bytes: textBytes('log\n'),
    }));
    const tooManyLogs = buildEvidenceManifest(baseInput({ files: [...BASE_FILES, ...manyLogFiles] }));
    expect(tooManyLogs.ok).toBe(false);
    if (!tooManyLogs.ok) {
      expect(tooManyLogs.failure.code).toBe('evidence.manifest-invalid');
    }

    const oversizedLogFiles = BASE_FILES.map((file) =>
      file.path === 'logs/steward.txt' ? { path: file.path, bytes: new Uint8Array(1048577) } : file,
    );
    const oversizedLog = buildEvidenceManifest(baseInput({ files: oversizedLogFiles }));
    expect(oversizedLog.ok).toBe(false);
    if (!oversizedLog.ok) {
      expect(oversizedLog.failure.code).toBe('evidence.manifest-invalid');
    }
  });

  it('manifest binds the run directory name', () => {
    const wrongStorePath = buildEvidenceManifest(baseInput({ storePath: 'runs/pr-12/other-id' }));
    expect(wrongStorePath.ok).toBe(false);
    if (!wrongStorePath.ok) {
      expect(wrongStorePath.failure.code).toBe('evidence.manifest-invalid');
    }

    const wrongMetricsPath = buildEvidenceManifest(
      baseInput({ metrics: { path: 'metrics/2026-09/other.json', bytes: textBytes('[]\n') } }),
    );
    expect(wrongMetricsPath.ok).toBe(false);
    if (!wrongMetricsPath.ok) {
      expect(wrongMetricsPath.failure.code).toBe('evidence.manifest-invalid');
    }
  });

  it('waiting manifests require the waiting run files', () => {
    const valid = buildEvidenceManifest(waitingInput());
    expect(valid.ok).toBe(true);

    const withoutWaiting = buildEvidenceManifest(
      waitingInput({ files: WAITING_FILES.filter((file) => file.path !== 'waiting.json') }),
    );
    expect(withoutWaiting.ok).toBe(false);
    if (!withoutWaiting.ok) {
      expect(withoutWaiting.failure.code).toBe('evidence.manifest-invalid');
    }
  });

  it('waiting manifests reject decision, report, and findings files', () => {
    for (const extra of [
      { path: 'decision.json', bytes: textBytes(SMALL_JSON) },
      { path: 'report.json', bytes: textBytes(SMALL_JSON) },
      { path: 'report.md', bytes: textBytes('# Report\n') },
      { path: 'findings/finding-0001.json', bytes: textBytes(SMALL_JSON) },
    ]) {
      const result = buildEvidenceManifest(waitingInput({ files: [...WAITING_FILES, extra] }));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failure.code).toBe('evidence.manifest-invalid');
      }
    }
  });

  it('outcome manifests reject a waiting record file', () => {
    const result = buildEvidenceManifest(
      baseInput({ files: [...BASE_FILES, { path: 'waiting.json', bytes: textBytes(SMALL_JSON) }] }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('evidence.manifest-invalid');
    }
  });

  it('manifests without run_kind stay valid', () => {
    const manifest = buildBaseManifest();
    expect(evidenceManifestSchema.safeParse(manifest).success).toBe(true);
    expect(manifest).not.toHaveProperty('run_kind');

    const withRunKind = evidenceManifestSchema.safeParse({ ...manifest, run_kind: 'outcome' });
    expect(withRunKind.success).toBe(true);
  });

  it('run_kind is written only when given', async () => {
    const manifest = buildBaseManifest();
    const { prettyJson } = await import('./pretty-json.js');
    const withoutRunKind = prettyJson(manifest);
    expect(withoutRunKind.ok).toBe(true);
    if (withoutRunKind.ok) {
      expect(withoutRunKind.value).not.toContain('"run_kind"');
    }

    const waitingResult = buildEvidenceManifest(waitingInput());
    expect(waitingResult.ok).toBe(true);
    if (waitingResult.ok) {
      const withRunKind = prettyJson(waitingResult.value);
      expect(withRunKind.ok).toBe(true);
      if (withRunKind.ok) {
        expect(withRunKind.value).toContain('"run_kind": "waiting"');
      }
    }
  });

  it('manifest round-trips through pretty json', async () => {
    const manifest = buildBaseManifest();
    const { prettyJson } = await import('./pretty-json.js');
    const prettyResult = prettyJson(manifest);
    expect(prettyResult.ok).toBe(true);
    if (!prettyResult.ok) {
      return;
    }
    const roundTripped = evidenceManifestSchema.safeParse(JSON.parse(prettyResult.value));
    expect(roundTripped.success).toBe(true);
    if (roundTripped.success) {
      expect(roundTripped.data).toEqual(manifest);
    }
  });
});
