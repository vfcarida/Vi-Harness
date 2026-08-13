/**
 * RollbackManager Interface.
 *
 * Implements safe rollback semantics:
 * - Reverts agent-owned modifications
 * - Preserves user-owned modifications
 * - Detects conflicts and halts cleanly
 */
import type { CheckpointId } from '../types/identifiers.js';
import type { CheckpointStore } from './checkpoint-store.js';
import type { GitManager } from './git-manager.js';
import type { Checkpoint } from '../model/checkpoint.js';
import type { RollbackResult } from '../model/git-types.js';

export interface RollbackManager {
  /** Roll back workspace and state machine to a specific Checkpoint ID. */
  rollbackToCheckpoint(
    checkpointId: CheckpointId,
    checkpointStore: CheckpointStore,
    git: GitManager,
  ): Promise<RollbackResult>;

  /** Perform safe rollback to target ref while preserving user-owned changes. */
  safeRollback(
    targetRef: string,
    git: GitManager,
    checkpoint?: Checkpoint,
  ): Promise<RollbackResult>;
}
