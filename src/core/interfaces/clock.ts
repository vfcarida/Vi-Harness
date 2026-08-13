/**
 * Clock interface.
 *
 * Abstracts time so the runtime is deterministically testable.
 * Production uses SystemClock; tests use TestClock.
 */

export interface Clock {
  /** Current time as a Date object. */
  now(): Date;

  /** Current time as Unix epoch milliseconds. */
  timestamp(): number;
}
