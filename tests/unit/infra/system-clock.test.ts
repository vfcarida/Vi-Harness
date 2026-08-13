/**
 * Tests for SystemClock.
 *
 * Proves:
 *   - SystemClock implements the Clock interface
 *   - now() returns a Date close to the real time
 *   - timestamp() returns a number close to Date.now()
 */
import { describe, it, expect } from 'vitest';
import { SystemClock } from '../../../src/infra/time/system-clock.js';
import type { Clock } from '../../../src/core/interfaces/clock.js';

describe('SystemClock', () => {
  const clock: Clock = new SystemClock();

  it('should be instantiable', () => {
    expect(clock).toBeDefined();
  });

  it('now() should return a Date close to current time', () => {
    const before = Date.now();
    const result = clock.now();
    const after = Date.now();

    expect(result).toBeInstanceOf(Date);
    expect(result.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.getTime()).toBeLessThanOrEqual(after);
  });

  it('timestamp() should return a number close to Date.now()', () => {
    const before = Date.now();
    const result = clock.timestamp();
    const after = Date.now();

    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThanOrEqual(before);
    expect(result).toBeLessThanOrEqual(after);
  });
});
