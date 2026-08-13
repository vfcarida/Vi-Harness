/**
 * Result type for operations that can fail.
 *
 * Provides a type-safe alternative to throwing exceptions for expected
 * failure modes. Unexpected failures should still throw.
 */

export type Result<T, E = Error> = Success<T> | ResultFailure<E>;

export interface Success<T> {
  readonly ok: true;
  readonly value: T;
}

export interface ResultFailure<E> {
  readonly ok: false;
  readonly error: E;
}

export type Failure<E> = ResultFailure<E>;

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

export function ok<T>(value: T): Success<T> {
  return { ok: true, value };
}

export function fail<E>(error: E): ResultFailure<E> {
  return { ok: false, error };
}
