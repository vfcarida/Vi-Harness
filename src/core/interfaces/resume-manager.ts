/**
 * ResumeManager Interface.
 *
 * Safely restores agent state and runtime context from durable stores and recovery decisions.
 */
import type { TaskId } from '../types/identifiers.js';
import type { RecoveryDecision } from '../model/recovery-types.js';
import type { AgentState } from '../model/state.js';
import type { CheckpointId } from '../types/identifiers.js';

export interface ResumeResult {
  readonly state: AgentState;
  readonly resumedFromCheckpoint?: CheckpointId;
  readonly actionToTake: string;
}

export interface ResumeManager {
  /** Resume a task using a formulated RecoveryDecision. */
  resumeTask(taskId: TaskId, decision: RecoveryDecision): Promise<ResumeResult>;
}
