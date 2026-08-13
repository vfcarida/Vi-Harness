/**
 * Environment-based configuration.
 *
 * Loads configuration from environment variables with optional overrides.
 * Uses Zod for validation when schemas are registered.
 * Supports runtime mutation for testing and dynamic reconfiguration.
 */
import { z } from 'zod';
import type { Configuration } from '../../core/interfaces/configuration.js';
import { HarnessError } from '../../core/errors/base-error.js';
import { ErrorCode, ErrorCategory } from '../../core/errors/error-codes.js';

export interface EnvConfigurationOptions {
  /** Static overrides applied on top of environment variables. */
  overrides?: Record<string, unknown>;

  /** Optional Zod schema for validating the merged configuration. */
  schema?: z.ZodType;

  /** Prefix to strip from env var names (e.g. 'VI_HARNESS_'). */
  envPrefix?: string;
}

export class EnvConfiguration implements Configuration {
  private readonly values: Map<string, unknown>;

  constructor(options: EnvConfigurationOptions = {}) {
    this.values = new Map<string, unknown>();

    // Load from environment variables
    const prefix = options.envPrefix ?? '';
    for (const [key, value] of Object.entries(process.env)) {
      if (prefix && !key.startsWith(prefix)) {
        continue;
      }
      const configKey = prefix ? key.slice(prefix.length) : key;
      this.values.set(configKey, value);
    }

    // Apply overrides
    if (options.overrides) {
      for (const [key, value] of Object.entries(options.overrides)) {
        this.values.set(key, value);
      }
    }

    // Validate with Zod schema if provided
    if (options.schema) {
      const data = Object.fromEntries(this.values);
      const result = options.schema.safeParse(data);
      if (!result.success) {
        throw new HarnessError({
          code: ErrorCode.CONFIG_INVALID,
          category: ErrorCategory.CONFIGURATION,
          message: `Configuration validation failed: ${result.error.message}`,
          context: { errors: result.error.flatten() },
        });
      }
    }
  }

  get<T>(key: string): T | undefined {
    return this.values.get(key) as T | undefined;
  }

  getRequired<T>(key: string): T {
    if (!this.values.has(key)) {
      throw new HarnessError({
        code: ErrorCode.CONFIG_MISSING,
        category: ErrorCategory.CONFIGURATION,
        message: `Required configuration key not found: ${key}`,
        context: { key },
      });
    }
    return this.values.get(key) as T;
  }

  has(key: string): boolean {
    return this.values.has(key);
  }

  set(key: string, value: unknown): void {
    this.values.set(key, value);
  }
}
