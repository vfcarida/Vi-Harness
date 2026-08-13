/**
 * Test clock — deterministic clock for testing.
 *
 * Allows tests to control time explicitly, ensuring reproducible
 * behavior for time-dependent logic (expiry, ordering, durations).
 */
import type { Clock } from '../../core/interfaces/clock.js';

export class TestClock implements Clock {
  private currentTime: Date;

  constructor(initial: Date = new Date('2024-01-01T00:00:00Z')) {
    this.currentTime = new Date(initial.getTime());
  }

  now(): Date {
    return new Date(this.currentTime.getTime());
  }

  timestamp(): number {
    return this.currentTime.getTime();
  }

  /** Advance time by the given number of milliseconds. */
  advance(ms: number): void {
    this.currentTime = new Date(this.currentTime.getTime() + ms);
  }

  /** Set time to a specific date. */
  set(date: Date): void {
    this.currentTime = new Date(date.getTime());
  }
}
