import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { executionResultEntrySchema } from '../execution/transport.js';
import { executionRecordSchema } from '../records/execution-record.js';
import type { ContainerExecutionResult } from './container.js';
import { HARNESS_LIMITS, openContainerHarness, outputText, type ContainerHarness } from './container-harness.container.test.js';
import { SHELL_TEST_IMAGE } from './test-images.test.js';

const INJECTION = [
  '$(touch /tmp/pwned) `id` ; rm -rf / && echo owned',
  '**bold** [link](https://example.invalid) <img src=x>',
  '@octocat #1 owner/repo#2',
  '${{ secrets.GITHUB_TOKEN }}',
];

describe('result files and injection text', () => {
  let harness: ContainerHarness;
  let result: ContainerExecutionResult;

  beforeAll(async () => {
    harness = await openContainerHarness();
    const prepared = await harness.prepareImage(SHELL_TEST_IMAGE);
    expect(prepared.result.ok, JSON.stringify(prepared.result)).toBe(true);
    if (!prepared.result.ok) return;
    const checkout = await harness.materialize('hostile-results.json');
    result = await harness.run({
      image: prepared.result.value,
      checkout,
      run: ['sh', 'results.sh'],
      resultFiles: [
        'reports/injection.xml',
        'reports/link.xml',
        'reports/dir.xml',
        'reports/binary.xml',
        'reports/ff.xml',
        'reports/never.xml',
      ].map((path) => ({ path, format: 'junit-xml' as const })),
      limits: { ...HARNESS_LIMITS, resultFiles: 6 },
    });
  }, 300000);

  afterAll(async () => {
    await harness.close();
  });

  it('reports hostile result files by status', () => {
    expect(result.kind, JSON.stringify(result)).toBe('completed');
    if (result.kind !== 'completed') return;
    const { record, result_texts: texts } = result.execution;
    expect(record.exit.code).toBe(0);
    expect(record.result_files.map((f) => f.status)).toEqual([
      'parsed',
      'not-regular',
      'not-regular',
      'malformed',
      'malformed',
      'missing',
    ]);
    const nullHashes = record.result_files.flatMap((f, i) => (f.content_hash === null ? [i + 1] : []));
    expect(nullHashes).toEqual([2, 3, 6]);
    const ff = texts.find((t) => t.position === 5);
    expect(ff?.decoded_bytes).toBe(8388609);
    expect(ff?.text).toBeNull();
    expect(texts.find((t) => t.position === 4)?.text).not.toBeNull();
    expect(executionRecordSchema.safeParse(record).success).toBe(true);
    expect(executionResultEntrySchema.safeParse(result.execution).success).toBe(true);
  });

  it('keeps injection text as data in the record', () => {
    expect(result.kind).toBe('completed');
    if (result.kind !== 'completed') return;
    const output = outputText(result);
    const cases = result.execution.record.result_files[0]?.junit?.cases ?? [];
    const identities = cases.map((c) => c.identity).join('\n');
    for (const text of INJECTION) {
      expect(output).toContain(text);
      expect(identities).toContain(text);
    }
    expect(executionRecordSchema.safeParse(result.execution.record).success).toBe(true);
  });
});
