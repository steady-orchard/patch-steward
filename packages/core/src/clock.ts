import { randomBytes } from 'node:crypto';

export interface Clock {
  now(): Date;
}

export interface RandomSource {
  hex(bytes: number): string;
}

export const systemClock: Clock = Object.freeze({
  now(): Date {
    return new Date();
  },
});

export const systemRandom: RandomSource = Object.freeze({
  hex(bytes: number): string {
    return randomBytes(bytes).toString('hex');
  },
});

export function fixedClock(iso: string): Clock {
  return {
    now(): Date {
      return new Date(iso);
    },
  };
}

export function steppingClock(startIso: string, stepMilliseconds: number): Clock {
  let nextTime = new Date(startIso).getTime();
  let called = false;
  return {
    now(): Date {
      if (!called) {
        called = true;
        return new Date(nextTime);
      }
      nextTime += stepMilliseconds;
      return new Date(nextTime);
    },
  };
}

export function fixedRandom(hex: string): RandomSource {
  return {
    hex(bytes: number): string {
      if (hex.length !== 2 * bytes || !/^[0-9a-f]*$/.test(hex)) {
        throw new Error('fixedRandom: requested byte length does not match fixed hex value');
      }
      return hex;
    },
  };
}
