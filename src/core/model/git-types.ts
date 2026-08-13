/**
 * Git & Workspace Domain Types.
 *
 * Distinguishes agent-owned changes, user-owned changes, and pre-existing workspace modifications.
 * Defines WorkspaceState and RollbackResult.
 */
import type { CheckpointId } from '../types/identifiers.js';

export interface WorkspaceState {
  readonly isDirty: boolean;
  readonly agentOwnedChanges: ReadonlyArray<string>;
  readonly userOwnedChanges: ReadonlyArray<string>;
  readonly untrackedFiles: ReadonlyArray<string>;
  readonly modifiedFiles: ReadonlyArray<string>;
  readonly stagedFiles: ReadonlyArray<string>;
  readonly currentBranch: string;
  readonly headCommit: string;
}

export interface RollbackResult {
  readonly success: boolean;
  readonly checkpointId?: CheckpointId;
  readonly restoredRef: string;
  readonly revertedFiles: ReadonlyArray<string>;
  readonly preservedUserChanges: ReadonlyArray<string>;
  readonly durationMs: number;
  readonly error?: string;
}
