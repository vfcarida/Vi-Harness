/**
 * GitManager Interface.
 *
 * Provides repository state management, diff generation, branch/worktree management,
 * path restoration, and file ownership classification (agent vs user).
 */
import type { WorkspaceState } from '../model/git-types.js';

export interface GitManager {
  /** Inspect current repository and workspace state. */
  getStatus(): Promise<WorkspaceState>;

  /** Create a commit with message and return the commit SHA/ref. */
  createCommit(message: string): Promise<string>;

  /** Create a new branch or worktree for task isolation. */
  createBranch(branchName: string): Promise<void>;

  /** Compute diff string relative to target commit ref or HEAD. */
  getDiff(targetRef?: string): Promise<string>;

  /** Checkout a commit ref or branch. */
  checkout(ref: string): Promise<void>;

  /** Restore a single file path to specified commit ref or HEAD. */
  restorePath(path: string, ref?: string): Promise<void>;

  /** Check if workspace has uncommitted changes. */
  isDirty(): Promise<boolean>;

  /** Mark explicit owner for a modified path ('agent' or 'user'). */
  markFileOwner(path: string, owner: 'agent' | 'user'): void;
}
