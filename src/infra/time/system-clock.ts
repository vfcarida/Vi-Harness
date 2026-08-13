/**
 * System clock — uses the real system time.
 */
import type { Clock } from '../../core/interfaces/clock.js';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }

  timestamp(): number {
    return Date.now();
  }
}
