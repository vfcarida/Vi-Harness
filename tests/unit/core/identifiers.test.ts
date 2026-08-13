/**
 * Tests for identifier types and the Result type.
 *
 * Proves:
 *   - ok() and fail() factories produce correct discriminated unions
 *   - Result type narrowing works as expected
 */
import { describe, it, expect } from 'vitest';
import { ok, fail } from '../../../src/core/types/result.js';

describe('Result type', () => {
  it('ok() should create a Success result', () => {
    const result = ok(42);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(42);
    }
  });

  it('fail() should create a Failure result', () => {
    const error = new Error('something broke');
    const result = fail(error);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(error);
      expect(result.error.message).toBe('something broke');
    }
  });

  it('ok() should work with complex values', () => {
    const value = { items: [1, 2, 3], total: 3 };
    const result = ok(value);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ items: [1, 2, 3], total: 3 });
    }
  });

  it('fail() should work with string errors', () => {
    const result = fail('not found');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('not found');
    }
  });
});
