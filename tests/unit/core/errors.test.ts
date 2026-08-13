/**
 * Tests for the error model.
 *
 * Proves:
 *   - HarnessError is constructable with all fields
 *   - It extends Error and supports instanceof
 *   - JSON serialization includes all structured fields
 *   - cause chaining works
 *   - ErrorCode/ErrorCategory enums are exhaustive
 *   - ERROR_CODE_CATEGORY mapping is consistent
 */
import { describe, it, expect } from 'vitest';
import {
  HarnessError,
  ErrorCode,
  ErrorCategory,
  ERROR_CODE_CATEGORY,
} from '../../../src/core/errors/index.js';

describe('HarnessError', () => {
  it('should construct with required fields', () => {
    const error = new HarnessError({
      code: ErrorCode.CONFIG_MISSING,
      category: ErrorCategory.CONFIGURATION,
      message: 'Key not found: DB_HOST',
    });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(HarnessError);
    expect(error.name).toBe('HarnessError');
    expect(error.code).toBe(ErrorCode.CONFIG_MISSING);
    expect(error.category).toBe(ErrorCategory.CONFIGURATION);
    expect(error.message).toBe('Key not found: DB_HOST');
    expect(error.context).toEqual({});
    expect(error.timestamp).toBeInstanceOf(Date);
    expect(error.cause).toBeUndefined();
  });

  it('should carry structured context', () => {
    const error = new HarnessError({
      code: ErrorCode.TOOL_EXECUTION_FAILED,
      category: ErrorCategory.TOOL,
      message: 'Tool crashed',
      context: { toolName: 'shell', exitCode: 137 },
    });

    expect(error.context).toEqual({ toolName: 'shell', exitCode: 137 });
  });

  it('should chain a cause error', () => {
    const cause = new TypeError('underlying failure');
    const error = new HarnessError({
      code: ErrorCode.INFRA_CONNECTION_FAILED,
      category: ErrorCategory.INFRASTRUCTURE,
      message: 'Connection refused',
      cause,
    });

    expect(error.cause).toBe(cause);
    expect(error.cause?.message).toBe('underlying failure');
  });

  it('should serialize to JSON with all fields', () => {
    const cause = new Error('root cause');
    const error = new HarnessError({
      code: ErrorCode.MODEL_TIMEOUT,
      category: ErrorCategory.MODEL,
      message: 'Request timed out after 30s',
      context: { provider: 'openai', timeoutMs: 30000 },
      cause,
    });

    const json = error.toJSON();

    expect(json.name).toBe('HarnessError');
    expect(json.code).toBe('MODEL_TIMEOUT');
    expect(json.category).toBe('MODEL');
    expect(json.message).toBe('Request timed out after 30s');
    expect(json.context).toEqual({ provider: 'openai', timeoutMs: 30000 });
    expect(json.timestamp).toBeDefined();
    expect(json.cause).toBe('root cause');
    expect(json.stack).toBeDefined();
  });

  it('should have a proper stack trace', () => {
    const error = new HarnessError({
      code: ErrorCode.STATE_INVALID_TRANSITION,
      category: ErrorCategory.STATE,
      message: 'Invalid transition',
    });

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('Invalid transition');
  });
});

describe('ErrorCode / ErrorCategory', () => {
  it('every ErrorCode should have a category mapping', () => {
    for (const code of Object.values(ErrorCode)) {
      expect(
        ERROR_CODE_CATEGORY[code],
        `Missing category mapping for ErrorCode.${code}`,
      ).toBeDefined();
    }
  });

  it('every mapped category should be a valid ErrorCategory', () => {
    const validCategories = new Set(Object.values(ErrorCategory));
    for (const [code, category] of Object.entries(ERROR_CODE_CATEGORY)) {
      expect(
        validCategories.has(category),
        `Invalid category "${category}" for code "${code}"`,
      ).toBe(true);
    }
  });

  it('should have at least one code per category', () => {
    const usedCategories = new Set(Object.values(ERROR_CODE_CATEGORY));
    for (const category of Object.values(ErrorCategory)) {
      expect(
        usedCategories.has(category),
        `ErrorCategory.${category} has no codes mapped to it`,
      ).toBe(true);
    }
  });
});
