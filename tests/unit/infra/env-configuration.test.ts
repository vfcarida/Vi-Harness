/**
 * Tests for EnvConfiguration.
 *
 * Proves:
 *   - Configuration can be instantiated
 *   - get() returns values and undefined for missing keys
 *   - getRequired() throws HarnessError for missing keys
 *   - has() checks key existence
 *   - set() allows runtime mutation
 *   - overrides take precedence over env vars
 *   - Zod validation rejects invalid configs
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { EnvConfiguration } from '../../../src/infra/config/env-configuration.js';
import { HarnessError, ErrorCode } from '../../../src/core/errors/index.js';
import type { Configuration } from '../../../src/core/interfaces/configuration.js';

describe('EnvConfiguration', () => {
  it('should be instantiable as Configuration interface', () => {
    const config: Configuration = new EnvConfiguration();
    expect(config).toBeDefined();
  });

  it('get() should return undefined for missing keys', () => {
    const config = new EnvConfiguration({ overrides: {} });
    expect(config.get('NONEXISTENT_KEY_12345')).toBeUndefined();
  });

  it('get() should return values from overrides', () => {
    const config = new EnvConfiguration({
      overrides: { DB_HOST: 'localhost', DB_PORT: 5432 },
    });

    expect(config.get('DB_HOST')).toBe('localhost');
    expect(config.get<number>('DB_PORT')).toBe(5432);
  });

  it('has() should return true for existing keys', () => {
    const config = new EnvConfiguration({
      overrides: { MY_KEY: 'value' },
    });

    expect(config.has('MY_KEY')).toBe(true);
    expect(config.has('MISSING')).toBe(false);
  });

  it('getRequired() should throw HarnessError for missing keys', () => {
    const config = new EnvConfiguration({ overrides: {} });

    expect(() => config.getRequired('MISSING_KEY')).toThrow(HarnessError);

    try {
      config.getRequired('MISSING_KEY');
    } catch (e) {
      expect(e).toBeInstanceOf(HarnessError);
      const harnessError = e as HarnessError;
      expect(harnessError.code).toBe(ErrorCode.CONFIG_MISSING);
      expect(harnessError.context).toEqual({ key: 'MISSING_KEY' });
    }
  });

  it('getRequired() should return value for existing keys', () => {
    const config = new EnvConfiguration({
      overrides: { API_KEY: 'sk-test' },
    });

    expect(config.getRequired('API_KEY')).toBe('sk-test');
  });

  it('set() should allow runtime mutation', () => {
    const config = new EnvConfiguration();

    config.set('DYNAMIC_KEY', 'dynamic_value');
    expect(config.get('DYNAMIC_KEY')).toBe('dynamic_value');
    expect(config.has('DYNAMIC_KEY')).toBe(true);
  });

  it('overrides should take precedence over env vars', () => {
    // NODE_ENV is typically set in test environments
    const config = new EnvConfiguration({
      overrides: { NODE_ENV: 'custom-override' },
    });

    expect(config.get('NODE_ENV')).toBe('custom-override');
  });

  it('should filter by envPrefix when provided', () => {
    // Set a test env var
    process.env['VI_HARNESS_TEST_KEY'] = 'test_value';

    try {
      const config = new EnvConfiguration({
        envPrefix: 'VI_HARNESS_',
      });

      expect(config.get('TEST_KEY')).toBe('test_value');
      // Keys without prefix should not be loaded
      expect(config.has('PATH')).toBe(false);
    } finally {
      delete process.env['VI_HARNESS_TEST_KEY'];
    }
  });

  it('should throw HarnessError on Zod validation failure', () => {
    const schema = z.object({
      PORT: z.coerce.number().min(1).max(65535),
    });

    expect(
      () =>
        new EnvConfiguration({
          overrides: { PORT: 'not-a-number' },
          schema,
          envPrefix: 'UNUSED_PREFIX_XYZ_',
        }),
    ).toThrow(HarnessError);
  });
});
