import { createHash } from 'node:crypto';

export function gitBlobId(bytes: Uint8Array): string {
  const header = Buffer.from(`blob ${bytes.length}`, 'ascii');
  const zero = Buffer.from([0]);
  const content = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return createHash('sha1').update(header).update(zero).update(content).digest('hex');
}
