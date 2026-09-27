import { describe, expect, it } from 'vitest';

import { fixedClock, fixedRandom, steppingClock, systemClock, systemRandom } from './clock.js';

describe('clock', () => {
  it('system clock returns the current time', () => {
    const delta = Math.abs(systemClock.now().getTime() - Date.now());
    expect(delta).toBeLessThan(5000);
  });

  it('system random returns lowercase hex of the requested length', () => {
    expect(systemRandom.hex(4)).toMatch(/^[0-9a-f]{8}$/);
    expect(systemRandom.hex(16)).not.toBe(systemRandom.hex(16));
  });

  it('fixed clock and random are deterministic', () => {
    const clock = fixedClock('2026-09-27T10:15:00.000Z');
    expect(clock.now().toISOString()).toBe('2026-09-27T10:15:00.000Z');
    expect(clock.now().toISOString()).toBe('2026-09-27T10:15:00.000Z');

    expect(fixedRandom('3f9a1c2e').hex(4)).toBe('3f9a1c2e');
    expect(() => fixedRandom('3f9a1c2e').hex(2)).toThrow();
  });

  it('stepping clock advances by its step', () => {
    const clock = steppingClock('2026-09-27T10:15:00.000Z', 1500);
    expect(clock.now().toISOString()).toBe('2026-09-27T10:15:00.000Z');
    expect(clock.now().toISOString()).toBe('2026-09-27T10:15:01.500Z');
  });
});
