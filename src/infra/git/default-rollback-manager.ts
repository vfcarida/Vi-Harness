/**
 * Default Rollback Manager.
 *
 * Implements RollbackManager interface with Safe Rollback Semantics:
 * - Reverts agent-owned modifications and files
 * - Preserves user-owned modifications and untracked files
 * - Never blindly overwrites user changes
 * - Handles failed rollbacks cleanly with error reporting
 */
import type { RollbackManager } from '../../core/interfaces/rollback-manager.js';
import type { CheckpointStore } from '../../core/interfaces/checkpoint-store.js';
import type { GitManager } from '../../core/interfaces/git-manager.js';
import type { CheckpointId } from '../../core/types/identifiers.js';
import type { Checkpoint } from '../../core/model/checkpoint.js';
import type { RollbackResult } from '../../core/model/git-types.js';

export class DefaultRollbackManager implements RollbackManager {
  async rollbackToCheckpoint(
    checkpointId: CheckpointId,
    checkpointStore: CheckpointStore,
    git: GitManager,
  ): Promise<RollbackResult> {
    const startTime = Date.now();
    const checkpoint = await checkpointStore.getCheckpoint(checkpointId);

    if (!checkpoint) {
      return {
        success: false,
        checkpointId,
        restoredRef: '',
        revertedFiles: [],
        preservedUserChanges: [],
        durationMs: Date.now() - startTime,
        error: `Checkpoint not found: ${checkpointId}`,
      };
    }

    const targetRef = checkpoint.gitRef ?? 'HEAD';
    return this.safeRollback(targetRef, git, checkpoint);
  }

  async safeRollback(
    targetRef: string,
    git: GitManager,
    checkpoint?: Checkpoint,
  ): Promise<RollbackResult> {
    const startTime = Date.now();
    const status = await git.getStatus();

    const revertedFiles: string[] = [];
    const preservedUserChanges: string[] = [];

    // Distinguish agent-owned vs user-owned changes
    const agentFilesToRevert = new Set<string>([
      ...status.agentOwnedChanges,
      ...(checkpoint?.agentOwnedFiles ?? []),
    ]);

    const userFilesToPreserve = new Set<string>([
      ...status.userOwnedChanges,
      ...(checkpoint?.userOwnedFiles ?? []),
    ]);

    // Revert only agent-owned modifications
    for (const file of agentFilesToRevert) {
      if (userFilesToPreserve.has(file)) {
        // Overlapping modification conflict -> Preserve user change
        preservedUserChanges.push(file);
        continue;
      }

      try {
        await git.restorePath(file, targetRef);
        revertedFiles.push(file);
      } catch (err) {
        return {
          success: false,
          checkpointId: checkpoint?.id,
          restoredRef: targetRef,
          revertedFiles,
          preservedUserChanges: Array.from(userFilesToPreserve),
          durationMs: Date.now() - startTime,
          error: `Failed to restore path [${file}]: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }

    for (const userFile of status.userOwnedChanges) {
      preservedUserChanges.push(userFile);
    }

    // Checkout target commit ref if specified
    if (targetRef && targetRef !== 'HEAD') {
      try {
        await git.checkout(targetRef);
      } catch (err) {
        return {
          success: false,
          checkpointId: checkpoint?.id,
          restoredRef: targetRef,
          revertedFiles,
          preservedUserChanges,
          durationMs: Date.now() - startTime,
          error: `Checkout to ref [${targetRef}] failed: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }

    return {
      success: true,
      checkpointId: checkpoint?.id,
      restoredRef: targetRef,
      revertedFiles,
      preservedUserChanges: Array.from(new Set(preservedUserChanges)),
      durationMs: Date.now() - startTime,
    };
  }
}
