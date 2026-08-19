/**
 * Profile and Bundle System Types (DeepSeek Harness Reference).
 *
 * Defines distribution profiles, bundle composition, and configuration patches
 * for running Vi-Harness in web, headless, CI, or custom user environments.
 */

export interface ProfilePatch {
  /** The subsystem or component to patch (e.g. 'llm-adapter', 'shell-provider', 'storage', 'model-router') */
  readonly target: string;
  /** Custom configuration properties to merge into the target */
  readonly config?: Record<string, unknown>;
  /** Optional plugin package or module specifier */
  readonly plugin?: string;
}

export interface ProfileConfig {
  /** Unique profile identifier (e.g. 'web', 'headless', 'ci', 'custom') */
  readonly name: string;
  /** Human-readable description of what this profile activates */
  readonly description?: string;
  /** Bundles included in this composition (e.g. ['base', 'headless', 'sqlite', 'mcp']) */
  readonly bundles: string[];
  /** Subsystem configuration overrides and plugin mounts */
  readonly patches?: ProfilePatch[];
  /** Environment variable defaults to set when active */
  readonly env?: Record<string, string>;
  /** Arbitrary metadata */
  readonly metadata?: Record<string, unknown>;
}

export interface ProfileBundle {
  readonly name: string;
  readonly description: string;
  readonly defaultSettings?: Record<string, unknown>;
}

export interface ResolvedProfile {
  readonly name: string;
  readonly description: string;
  readonly activeBundles: string[];
  readonly patches: ProfilePatch[];
  readonly env: Record<string, string>;
  readonly resolvedConfig: Record<string, unknown>;
}
