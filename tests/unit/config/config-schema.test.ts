import { describe, it, expect } from 'vitest';
import { ConfigSchemaValidator } from '../../../src/infra/config/config-schema.js';

describe('ConfigSchemaValidator', () => {
  it('applies default configuration values correctly', () => {
    const config = ConfigSchemaValidator.validate({});
    expect(config.maxIterations).toBe(50);
    expect(config.maxCostDollars).toBe(5.0);
    expect(config.defaultModelId).toBe('claude-3-7-sonnet-20250219');
    expect(config.enableCompaction).toBe(true);
    expect(config.logLevel).toBe('info');
  });

  it('validates custom configuration and overrides defaults', () => {
    const config = ConfigSchemaValidator.validate({
      maxIterations: 100,
      maxCostDollars: 15.0,
      logLevel: 'debug',
      enableArchitectMode: true,
    });

    expect(config.maxIterations).toBe(100);
    expect(config.maxCostDollars).toBe(15.0);
    expect(config.logLevel).toBe('debug');
    expect(config.enableArchitectMode).toBe(true);
  });

  it('rejects invalid configuration properties', () => {
    const invalidResult = ConfigSchemaValidator.safeValidate({
      maxIterations: -10, // Must be positive
      logLevel: 'invalid_level',
    });

    expect(invalidResult.success).toBe(false);
  });
});
