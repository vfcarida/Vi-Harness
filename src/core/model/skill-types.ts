/**
 * Skill Subsystem Domain Types (DeepSeek Harness & Hermes).
 *
 * Defines skills, skill catalogs, discovery options, and loaded skill content.
 */

export type SkillSource = 'local' | 'extracted' | 'package' | 'workspace' | 'user';

export interface Skill {
  readonly name: string;
  readonly description: string;
  readonly content: string; // The actual skill instructions/template
  readonly source: SkillSource;
  readonly tags: ReadonlyArray<string>;
  readonly version?: string;
  readonly author?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface SkillEntry {
  readonly name: string;
  readonly description: string;
  readonly source: SkillSource;
  readonly tags: ReadonlyArray<string>;
  readonly version?: string;
}

export interface SkillContent {
  readonly name: string;
  readonly content: string;
  readonly description: string;
  readonly source: SkillSource;
  readonly tags: ReadonlyArray<string>;
}

export interface SkillDiscoveryOptions {
  readonly userSkillsDirectory?: string;
  readonly workspaceSkillsDirectory?: string;
  readonly packageJsonPath?: string;
  readonly includeExtracted?: boolean;
}
