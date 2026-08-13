/**
 * RecoveryManager Interface.
 *
 * Analyzes journal and event streams upon process restart after crash.
 * Classifies interrupted actions into COMPLETED, FAILED, UNCERTAIN, or INTERRUPTED,
 * and formulates RecoveryDecisions adhering to recovery policies (RETRY_SAFE, REQUIRE_REVIEW, RECONCILE, ABORT).
 */
import type { TaskId } from '../types/identifiers.js';
import type { ExecutionJournal } from './execution-journal.js';
import type { EventStore } from './event-store.js';
import type { CheckpointStore } from './checkpoint-store.js';
import type { RecoveryAnalysis, RecoveryDecision } from '../model/recovery-types.js';

export interface RecoveryManager {
  /** Analyze crash state for a task across journal entries and event store. */
  analyzeCrash(
    taskId: TaskId,
    journal: ExecutionJournal,
    eventStore: EventStore,
    checkpointStore: CheckpointStore,
  ): Promise<RecoveryAnalysis>;

  /** Formulate a RecoveryDecision based on crash analysis. */
  createRecoveryDecision(analysis: RecoveryAnalysis): RecoveryDecision;
}
