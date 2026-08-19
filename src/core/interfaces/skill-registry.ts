/**
 * Skill Registry and Self-Modification Interfaces (DeepSeek Harness & Hermes).
 */
import type {
  Skill,
  SkillEntry,
  SkillContent,
  SkillDiscoveryOptions,
} from '../model/skill-types.js';

export interface SkillRegistry {
  /**
   * Register a skill in the registry.
   * Returns a disposer function to unregister.
   */
  register(skill: Skill): () => void;

  /**
   * Unregister a skill by name.
   */
  unregister(name: string): boolean;

  /**
   * Browse available skills in the catalog.
   */
  catalog(): ReadonlyArray<SkillEntry>;

  /**
   * Load skill content by name.
   */
  load(name: string): SkillContent | undefined;

  /**
   * Retrieve full Skill definition by name.
   */
  getSkill(name: string): Skill | undefined;

  /**
   * Discover skills from local directories, workspace, and npm packages.
   */
  discoverSkills(options?: SkillDiscoveryOptions): Promise<ReadonlyArray<Skill>>;
}

/**
 * Self-modification interface allowing the agent to inspect, mount,
 * and unmount skills into its active session context.
 */
export interface SelfModification {
  /**
   * Mount a skill into active session context.
   */
  mountSkill(name: string): boolean;

  /**
   * List all currently mounted skill names.
   */
  listMounted(): ReadonlyArray<string>;

  /**
   * Unmount a skill from active session context.
   */
  unmountSkill(name: string): boolean;

  /**
   * Get concatenated instructions of all currently mounted skills.
   */
  getMountedSkillContent(): string;
}
