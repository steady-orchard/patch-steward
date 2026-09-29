import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  openContainerHarness,
  outputText,
  type ContainerHarness,
  type HarnessCheckout,
} from './container-harness.container.test.js';
import type { ResolvedImage } from './types.js';
import { SHELL_TEST_IMAGE } from './test-images.test.js';

const FLOOD_LIMITS = { outputHeadBytes: 4096, outputTailBytes: 4096, outputStreamBytes: 1048576 };

describe('container limits', () => {
  let harness: ContainerHarness;
  let image: ResolvedImage;
  let checkout: HarnessCheckout;

  beforeAll(async () => {
    harness = await openContainerHarness();
    const prepared = await harness.prepareImage(SHELL_TEST_IMAGE);
    expect(prepared.result.ok, JSON.stringify(prepared.result)).toBe(true);
    if (!prepared.result.ok) throw new Error('image preparation failed');
    image = prepared.result.value;
    checkout = await harness.materialize('hostile-limits.json');
  }, 600000);

  afterAll(async () => {
    if (harness) await harness.close();
  }, 120000);

  it('exit E2: a fork bomb stops at the pids limit', async () => {
    const result = await harness.run({ image, checkout, run: ['sh', 'fork.sh'], limits: { pids: 64 } });
    expect(result.kind, JSON.stringify(result)).toBe('completed');
    if (result.kind !== 'completed') return;
    expect(result.execution.record.exit.timed_out).toBe(false);
    expect(outputText(result)).toMatch(/can't fork|Resource temporarily unavailable/);
    expect(result.execution.record.limits?.pids).toBe(64);
    expect(result.durationMs).toBeLessThan(60000);
  }, 180000);

  it('exit E2: a memory hog ends oom killed', async () => {
    const result = await harness.run({ image, checkout, run: ['sh', 'memory.sh'], limits: { memoryMb: 128 } });
    expect(result.kind, JSON.stringify(result)).toBe('completed');
    if (result.kind !== 'completed') return;
    expect(result.execution.record.exit.oom_killed).toBe(true);
    expect(result.execution.record.exit.timed_out).toBe(false);
  }, 180000);

  it('exit E2: a sleeper ends timed out', async () => {
    const result = await harness.run({ image, checkout, run: ['sh', 'sleep.sh'], limits: { executionSeconds: 3 } });
    expect(result.kind, JSON.stringify(result)).toBe('completed');
    if (result.kind !== 'completed') return;
    expect(result.execution.record.exit.timed_out).toBe(true);
    expect(result.durationMs).toBeLessThan(60000);
  }, 180000);

  it('exit E2: an output flood ends output limited', async () => {
    const result = await harness.run({ image, checkout, run: ['sh', 'flood.sh'], limits: FLOOD_LIMITS });
    expect(result.kind, JSON.stringify(result)).toBe('completed');
    if (result.kind !== 'completed') return;
    const { record } = result.execution;
    expect(record.exit.output_limited).toBe(true);
    expect(record.exit.timed_out).toBe(false);
    expect(record.output.truncated).toBe(true);
    expect(record.output.head.startsWith('flood line')).toBe(true);
    expect(record.output.total_bytes).toBeGreaterThanOrEqual(1048576);
  }, 180000);

  it('exit E2: an invalid UTF-8 flood stays bounded', async () => {
    const result = await harness.run({ image, checkout, run: ['sh', 'flood-invalid.sh'], limits: FLOOD_LIMITS });
    expect(result.kind, JSON.stringify(result)).toBe('completed');
    if (result.kind !== 'completed') return;
    expect(result.execution.record.exit.output_limited).toBe(true);
    for (const part of result.execution.output.parts) expect(Buffer.byteLength(part, 'utf8')).toBeLessThanOrEqual(8388608);
    expect(outputText(result)).toContain(String.fromCharCode(0xfffd));
  }, 180000);

  it('exit E2: a scratch filler hits ENOSPC', async () => {
    const result = await harness.run({ image, checkout, run: ['sh', 'scratch.sh'], limits: { scratchMb: 16 } });
    expect(result.kind, JSON.stringify(result)).toBe('completed');
    if (result.kind !== 'completed') return;
    expect(outputText(result)).toContain('No space left on device');
    expect(result.execution.record.exit.oom_killed).toBe(false);
  }, 180000);
});
