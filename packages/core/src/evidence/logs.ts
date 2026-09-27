import { escapeReportValue } from '../report/escape.js';

export function renderLogText(lines: readonly string[]): string {
  if (lines.length === 0) {
    return '';
  }
  return lines.map(escapeReportValue).join('\n') + '\n';
}

function isContinuationByte(byte: number | undefined): boolean {
  return byte !== undefined && (byte & 0xc0) === 0x80;
}

export function truncateLogText(text: string, maxBytes: number): string {
  const buf = Buffer.from(text, 'utf8');
  const total = buf.length;
  if (total <= maxBytes) {
    return text;
  }
  const markerMax = Buffer.byteLength('\n[truncated ' + total + ' bytes]\n');
  if (maxBytes < markerMax) {
    return '';
  }
  const keep = maxBytes - markerMax;
  let headEnd = Math.floor(keep / 2);
  while (headEnd > 0 && isContinuationByte(buf[headEnd])) {
    headEnd--;
  }
  let tailStart = total - (keep - headEnd);
  while (tailStart < total && isContinuationByte(buf[tailStart])) {
    tailStart++;
  }
  const removed = tailStart - headEnd;
  return (
    buf.subarray(0, headEnd).toString('utf8') + '\n[truncated ' + removed + ' bytes]\n' + buf.subarray(tailStart).toString('utf8')
  );
}
