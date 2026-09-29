export interface OutputCaptureLimits {
  readonly headBytes: number;
  readonly tailBytes: number;
  readonly streamBytes: number;
}

export interface CapturedOutput {
  readonly head: Uint8Array;
  readonly tail: Uint8Array;
  readonly totalBytes: number;
  readonly omittedBytes: number;
  readonly limited: boolean;
}

function isContinuation(byte: number): boolean {
  return byte >= 0x80 && byte <= 0xbf;
}

function leadSequenceLength(byte: number): number {
  if (byte >= 0xc2 && byte <= 0xdf) return 2;
  if (byte >= 0xe0 && byte <= 0xef) return 3;
  if (byte >= 0xf0 && byte <= 0xf4) return 4;
  return 0;
}

function trimIncompleteTrailingSequence(bytes: Uint8Array): Uint8Array {
  const scanStart = Math.max(0, bytes.length - 3);
  for (let i = bytes.length - 1; i >= scanStart; i--) {
    const byte = bytes[i];
    if (byte === undefined || isContinuation(byte)) continue;
    const length = leadSequenceLength(byte);
    if (length > 0 && bytes.length - i < length) {
      return bytes.subarray(0, i);
    }
    return bytes;
  }
  return bytes;
}

function trimLeadingContinuationBytes(bytes: Uint8Array): Uint8Array {
  const scanEnd = Math.min(bytes.length, 3);
  let cut = 0;
  for (let i = 0; i < scanEnd; i++) {
    const byte = bytes[i];
    if (byte !== undefined && isContinuation(byte)) {
      cut = i + 1;
    } else {
      break;
    }
  }
  return bytes.subarray(cut);
}

function assertLimit(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a safe integer >= 0`);
  }
}

export class OutputCaptureBuffer {
  private readonly headBytes: number;
  private readonly tailBytes: number;
  private readonly streamBytes: number;
  private readonly headChunks: Uint8Array[] = [];
  private headStored = 0;
  private tailChunks: Uint8Array[] = [];
  private tailStored = 0;
  private accepted = 0;

  constructor(limits: OutputCaptureLimits) {
    assertLimit('headBytes', limits.headBytes);
    assertLimit('tailBytes', limits.tailBytes);
    assertLimit('streamBytes', limits.streamBytes);
    if (limits.streamBytes < 1) {
      throw new RangeError('streamBytes must be >= 1');
    }
    this.headBytes = limits.headBytes;
    this.tailBytes = limits.tailBytes;
    this.streamBytes = limits.streamBytes;
  }

  get totalBytes(): number {
    return this.accepted;
  }

  get limited(): boolean {
    return this.accepted === this.streamBytes;
  }

  push(chunk: Uint8Array): boolean {
    const remaining = this.streamBytes - this.accepted;
    if (remaining > 0 && chunk.length > 0) {
      const usable = chunk.length > remaining ? chunk.subarray(0, remaining) : chunk;
      this.accepted += usable.length;

      let rest = usable;
      if (this.headStored < this.headBytes && rest.length > 0) {
        const take = Math.min(this.headBytes - this.headStored, rest.length);
        this.headChunks.push(rest.subarray(0, take));
        this.headStored += take;
        rest = rest.subarray(take);
      }

      if (rest.length > 0) {
        this.tailChunks.push(rest);
        this.tailStored += rest.length;
        // Memory stays bounded: drop whole chunks from the front once they are no longer needed.
        while (this.tailChunks.length > 1) {
          const first = this.tailChunks[0];
          if (first === undefined) break;
          if (this.tailStored - first.length >= this.tailBytes) {
            this.tailChunks.shift();
            this.tailStored -= first.length;
          } else {
            break;
          }
        }
      }
    }

    return this.accepted === this.streamBytes;
  }

  result(): CapturedOutput {
    const headAll = concat(this.headChunks, this.headStored);
    const tailAll = concat(this.tailChunks, this.tailStored);
    const tailKept = tailAll.length > this.tailBytes ? tailAll.subarray(tailAll.length - this.tailBytes) : tailAll;

    if (this.accepted <= this.headBytes + this.tailBytes) {
      const whole = concatTwo(headAll, tailKept, this.accepted);
      return {
        head: whole,
        tail: new Uint8Array(0),
        totalBytes: this.accepted,
        omittedBytes: 0,
        limited: this.limited,
      };
    }

    const head = trimIncompleteTrailingSequence(headAll);
    const tail = trimLeadingContinuationBytes(tailKept);
    const omittedBytes = this.accepted - head.length - tail.length;

    return {
      head,
      tail,
      totalBytes: this.accepted,
      omittedBytes,
      limited: this.limited,
    };
  }
}

function concat(chunks: readonly Uint8Array[], length: number): Uint8Array {
  const out = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function concatTwo(a: Uint8Array, b: Uint8Array, length: number): Uint8Array {
  const out = new Uint8Array(length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

export function decodeCapturedBytes(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: false, ignoreBOM: true }).decode(bytes);
}

export function outputOmittedMarker(omittedBytes: number): string {
  return `[... ${omittedBytes} bytes omitted ...]`;
}
