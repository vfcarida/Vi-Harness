/**
 * Tests for TestClock.
 *
 * Proves:
 *   - TestClock implements the Clock interface
 *   - Time is deterministic and controllable
 *   - advance() moves time forward
 *   - set() moves to an exact time
 *   - now() returns independent Date copies (no aliasing)
 */
import { describe, it, expect } from 'vitest';
import { TestClock } from '../../../src/infra/time/test-clock.js';
import type { Clock } from '../../../src/core/interfaces/clock.js';

describe('TestClock', () => {
  it('should implement the Clock interface', () => {
    const clock: Clock = new TestClock();
    expect(typeof clock.now).toBe('function');
    expect(typeof clock.timestamp).toBe('function');
  });

  it('should start at the specified initial time', () => {
    const initial = new Date('2024-06-15T12:00:00Z');
    const clock = new TestClock(initial);

    expect(clock.now()).toEqual(initial);
    expect(clock.timestamp()).toBe(initial.getTime());
  });

  it('should default to 2024-01-01T00:00:00Z', () => {
    const clock = new TestClock();
    expect(clock.now()).toEqual(new Date('2024-01-01T00:00:00Z'));
  });

  it('advance() should move time forward', () => {
    const clock = new TestClock(new Date('2024-01-01T00:00:00Z'));

    clock.advance(5000); // 5 seconds
    expect(clock.now()).toEqual(new Date('2024-01-01T00:00:05Z'));

    clock.advance(60000); // 1 minute
    expect(clock.now()).toEqual(new Date('2024-01-01T00:01:05Z'));
  });

  it('set() should move to an exact time', () => {
    const clock = new TestClock();
    const target = new Date('2025-12-31T23:59:59Z');

    clock.set(target);
    expect(clock.now()).toEqual(target);
  });

  it('now() should return independent Date copies', () => {
    const clock = new TestClock();
    const a = clock.now();
    const b = clock.now();

    expect(a).toEqual(b);
    expect(a).not.toBe(b); // Different object references
  });

  it('timestamp() should reflect advances', () => {
    const initial = new Date('2024-01-01T00:00:00Z');
    const clock = new TestClock(initial);

    const before = clock.timestamp();
    clock.advance(10000);
    const after = clock.timestamp();

    expect(after - before).toBe(10000);
  });
});
