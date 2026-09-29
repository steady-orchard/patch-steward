import { describe, expect, it } from 'vitest';
import { executionResultEntrySchema } from '../execution/transport.js';
import { executionRecordSchema } from '../records/execution-record.js';
import { forbiddenRuntimeArguments } from './argv.js';
import { openContainerHarness, RUNTIME_NAME } from './container-harness.container.test.js';
import { NODE_TEST_IMAGE } from './test-images.test.js';

describe('typescript sample', () => {
  it('runs the TypeScript sample in the sandbox', async () => {
    const harness = await openContainerHarness();
    try {
      const prepared = await harness.prepareImage(NODE_TEST_IMAGE);
      expect(prepared.result.ok, JSON.stringify(prepared.result)).toBe(true);
      if (!prepared.result.ok) return;
      const image = prepared.result.value;
      expect(image.digest).toBe('sha256:' + NODE_TEST_IMAGE.split('sha256:')[1]);

      const checkout = await harness.materialize('typescript-sample.json');
      const result = await harness.run({
        image,
        checkout,
        run: ['node', '--test', '--test-reporter=junit', '--test-reporter-destination=junit.xml', 'test/math.test.ts'],
        resultFiles: [{ path: 'junit.xml', format: 'junit-xml' }],
      });
      expect(result.kind, JSON.stringify(result)).toBe('completed');
      if (result.kind !== 'completed') return;
      const { execution } = result;
      const record = execution.record;
      expect(record.exit.code).toBe(1);
      expect(record.exit.timed_out).toBe(false);
      expect(record.result_files[0]?.status, JSON.stringify(record.result_files[0])).toBe('parsed');
      expect(record.result_files[0]?.junit?.tests).toBe(2);
      expect(record.result_files[0]?.junit?.passed).toBe(1);
      expect(record.result_files[0]?.junit?.failed).toBe(1);
      expect(record.admissibility).toBe('evidence');
      expect(record.environment.runtime?.name).toBe(RUNTIME_NAME);
      expect(executionRecordSchema.safeParse(record).success).toBe(true);
      expect(executionResultEntrySchema.safeParse(execution).success).toBe(true);
      for (const c of harness.calls) expect(forbiddenRuntimeArguments(c.args)).toEqual([]);
    } finally {
      await harness.close();
    }
  });
});
