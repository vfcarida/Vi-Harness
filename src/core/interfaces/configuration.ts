/**
 * Configuration interface.
 *
 * Abstracts configuration retrieval so the domain layer does not
 * care whether values come from env vars, files, or remote config.
 */

export interface Configuration {
  /** Get a configuration value, returning undefined if not set. */
  get<T>(key: string): T | undefined;

  /** Get a configuration value, throwing if not set. */
  getRequired<T>(key: string): T;

  /** Check whether a key is present. */
  has(key: string): boolean;

  /** Set a configuration value at runtime. */
  set(key: string, value: unknown): void;
}
