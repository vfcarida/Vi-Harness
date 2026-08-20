// Pattern: Everything is a Plugin via capability seams (ref: DeepSeek Harness, Cordis)
/**
 * Plugin Abstractions & Lifecycle Contracts.
 *
 * DeepSeek Harness reference:
 * "Everything is a Plugin. The model adapter, tool registry, session log, compaction,
 * sandbox, and agent loop itself are all swappable capability seams with 3-role patterns:
 * Service Definition (Role 1), Service Provider (Role 2), and Consumer (Role 3)."
 */
import type { PluginContext } from './context.js';

export type Disposer = () => void | Promise<void>;

export enum PluginState {
  UNLOADED = 'UNLOADED',
  LOADING = 'LOADING',
  ACTIVE = 'ACTIVE',
  DISPOSING = 'DISPOSING',
  FAILED = 'FAILED',
}

export interface Plugin<TConfig = Record<string, unknown>> {
  /** Unique plugin identifier (e.g. 'llm-openai', 'shell-docker', 'tool-bash'). */
  readonly name: string;

  /** Semantic version string. */
  readonly version?: string;

  /**
   * Required service keys that must be available before this plugin is activated.
   * If any service is missing at activation, the plugin system either waits or raises an error.
   */
  readonly inject?: ReadonlyArray<string>;

  /**
   * Optional service keys this plugin can consume if available.
   */
  readonly optionalInject?: ReadonlyArray<string>;

  /** Plugin-specific configuration object. */
  readonly config?: TConfig;

  /**
   * Apply method: contributes services, event listeners, waterfall interceptors,
   * and reversible effects to the shared context.
   */
  apply(ctx: PluginContext): void | Promise<void>;
}

export interface PluginRecord {
  readonly plugin: Plugin;
  state: PluginState;
  readonly disposers: Disposer[];
  loadedAt?: Date;
  error?: Error;
}
