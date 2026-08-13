/**
 * Checkpoint Domain Types.
 *
 * "Every meaningful milestone is reversible."
 *
 * Checkpoint metadata contains state snapshot, git reference, iteration count,
 * model identifier, evidence summary, and file ownership attribution (agent vs user).
 */
import type { CheckpointId, TaskId } from '../types/identifiers.js';
import type { AgentState } from './state.js';

export interface Checkpoint {
  readonly id: CheckpointId;
  readonly taskId: TaskId;
  readonly iteration: number;
  readonly gitRef?: string;
  readonly state: AgentState;
  readonly evidenceSummary: string;
  readonly modelId: string;
  readonly createdAt: Date;
  readonly reason: string;
  readonly agentOwnedFiles: ReadonlyArray<string>;
  readonly userOwnedFiles: ReadonlyArray<string>;
  readonly label?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface CreateCheckpointParams {
  readonly id?: CheckpointId;
  readonly taskId: TaskId;
  readonly iteration?: number;
  readonly state: AgentState;
  readonly gitRef?: string;
  readonly evidenceSummary?: string;
  readonly modelId?: string;
  readonly reason?: string;
  readonly agentOwnedFiles?: ReadonlyArray<string>;
  readonly userOwnedFiles?: ReadonlyArray<string>;
  readonly label?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
