/**
 * Runtime Configuration Schema & Environment Validator.
 *
 * Enforces strict runtime configuration validation using Zod:
 * - Iteration and loop limits
 * - Token and cost budgets
 * - Timeout settings
 * - Model router and provider configuration
 */
import { z } from 'zod';

export const RuntimeConfigSchema = z.object({
  maxIterations: z.number().int().positive().default(50),
  maxCostDollars: z.number().positive().default(5.0),
  maxDurationSeconds: z.number().int().positive().default(1800),
  defaultTimeoutMs: z.number().int().positive().default(60000),
  defaultModelId: z.string().min(1).default('claude-3-7-sonnet-20250219'),
  defaultProviderId: z.string().min(1).default('anthropic-primary'),
  enableArchitectMode: z.boolean().default(false),
  enableCompaction: z.boolean().default(true),
  enablePrefixCaching: z.boolean().default(true),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type RuntimeConfig = z.infer<typeof RuntimeConfigSchema>;

export class ConfigSchemaValidator {
  /**
   * Validate and apply defaults to runtime configuration.
   */
  static validate(config: unknown): RuntimeConfig {
    return RuntimeConfigSchema.parse(config ?? {});
  }

  /**
   * Safe validation returning parse result.
   */
  static safeValidate(config: unknown): z.SafeParseReturnType<unknown, RuntimeConfig> {
    return RuntimeConfigSchema.safeParse(config ?? {});
  }
}
