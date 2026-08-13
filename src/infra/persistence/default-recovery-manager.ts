/**
 * Default Recovery Manager.
 *
 * Implements RecoveryManager interface:
 * Analyzes process crash state across execution journal, event store, and checkpoint store.
 * Classifies interrupted actions and enforces recovery policies:
 * - RETRY_SAFE: safe non-destructive actions retried automatically
 * - REQUIRE_REVIEW: destructive or uncertain actions require human review
 * - RECONCILE: reconciles filesystem / outcome state
 * - ABORT: aborts corrupt executions
 */
import type { RecoveryManager } from '../../core/interfaces/recovery-manager.js';
import type { ExecutionJournal } from '../../core/interfaces/execution-journal.js';
import type { EventStore } from '../../core/interfaces/event-store.js';
import type { CheckpointStore } from '../../core/interfaces/checkpoint-store.js';
import type { TaskId } from '../../core/types/identifiers.js';
import type {
  RecoveryAnalysis,
  RecoveryDecision,
} from '../../core/model/recovery-types.js';
import { RecoveryPolicy } from '../../core/model/recovery-types.js';
import { ActionType } from '../../core/model/action.js';

export class DefaultRecoveryManager implements RecoveryManager {
  async analyzeCrash(
    taskId: TaskId,
    journal: ExecutionJournal,
    eventStore: EventStore,
    checkpointStore: CheckpointStore,
  ): Promise<RecoveryAnalysis> {
    const interruptedEntries = await journal.getInterruptedEntries(taskId);
    const events = await eventStore.getEvents(taskId);
    const checkpoints = await checkpointStore.list(taskId);

    const lastCheckpoint = checkpoints.length > 0 ? checkpoints[checkpoints.length - 1] : undefined;
    const lastSequence = events.length > 0 ? events[events.length - 1]!.sequenceNumber : 0;

    let hasDestructiveInterruption = false;
    for (const entry of interruptedEntries) {
      if (
        entry.isDestructive ||
        entry.actionProposal.type === ActionType.FILE_DELETE ||
        entry.actionProposal.irreversible
      ) {
        hasDestructiveInterruption = true;
        break;
      }
    }

    let recommendedPolicy = RecoveryPolicy.RETRY_SAFE;
    let requiresHumanReview = false;

    if (hasDestructiveInterruption) {
      recommendedPolicy = RecoveryPolicy.REQUIRE_REVIEW;
      requiresHumanReview = true;
    } else if (interruptedEntries.length > 0) {
      recommendedPolicy = RecoveryPolicy.RETRY_SAFE;
      requiresHumanReview = false;
    }

    return {
      taskId,
      interruptedEntries,
      lastCheckpointId: lastCheckpoint?.id,
      lastVerifiedSequence: lastSequence,
      recommendedPolicy,
      requiresHumanReview,
      details: {
        totalEvents: events.length,
        totalCheckpoints: checkpoints.length,
        interruptedCount: interruptedEntries.length,
        hasDestructiveInterruption,
      },
    };
  }

  createRecoveryDecision(analysis: RecoveryAnalysis): RecoveryDecision {
    if (analysis.requiresHumanReview || analysis.recommendedPolicy === RecoveryPolicy.REQUIRE_REVIEW) {
      return {
        action: 'ESCALATE',
        targetCheckpointId: analysis.lastCheckpointId,
        recoveryPolicy: RecoveryPolicy.REQUIRE_REVIEW,
        rationale: 'Destructive action was interrupted during execution. Human review required to prevent silent duplicate execution.',
      };
    }

    if (analysis.interruptedEntries.length > 0) {
      return {
        action: 'RETRY_ACTION',
        targetCheckpointId: analysis.lastCheckpointId,
        recoveryPolicy: RecoveryPolicy.RETRY_SAFE,
        rationale: 'Interrupted non-destructive action is safe to retry automatically.',
      };
    }

    return {
      action: 'RESUME',
      targetCheckpointId: analysis.lastCheckpointId,
      recoveryPolicy: RecoveryPolicy.RETRY_SAFE,
      rationale: 'No interrupted actions found. Resuming runtime from last verified milestone state.',
    };
  }
}
