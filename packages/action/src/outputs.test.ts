import { describe, expect, it } from 'vitest';
import { boundedSummaryText, formatOutputs, maskCommands } from './outputs.js';

describe('action outputs', () => {
  it('outputs are single-line name value pairs', () => {
    const result = formatOutputs({ disposition: 'runnable', commit: 'true', snapshot_hash: '' });
    expect(result).toBe('disposition=runnable\ncommit=true\nsnapshot_hash=\n');
  });

  it('multi-line or oversize outputs are refused', () => {
    expect(formatOutputs({ name: 'a' + String.fromCharCode(10) + 'b' })).toBeNull();
    expect(formatOutputs({ name: 'a' + String.fromCharCode(13) + 'b' })).toBeNull();
    expect(formatOutputs({ name: 'a'.repeat(1025) })).toBeNull();
    expect(formatOutputs({ 'Bad-Name': 'ok' })).toBeNull();
  });

  it('masks cover every line of a secret', () => {
    const secret = 'line-one' + String.fromCharCode(10) + 'line-two' + String.fromCharCode(10);
    expect(maskCommands(secret)).toBe('::add-mask::line-one\n::add-mask::line-two\n');
    expect(maskCommands('')).toBe('');
  });

  it('summaries stay within the bound', () => {
    const line = 'x'.repeat(69) + String.fromCharCode(10);
    const text = line.repeat(1000);
    const result = boundedSummaryText(text, 65536);
    expect(result.length).toBeLessThanOrEqual(65536);
    expect(result.endsWith('- Summary truncated.\n')).toBe(true);
    expect(boundedSummaryText('short', 65536)).toBe('short');
  });
});
