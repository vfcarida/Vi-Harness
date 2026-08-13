/**
 * CheckpointStore interface.
 *
 * "Every meaningful milestone is reversible."
 *
 * Creates, restores, and manages Checkpoint snapshots.
 */
import type { CheckpointId, TaskId } from '../types/identifiers.js';
import type { Checkpoint, CreateCheckpointParams } from '../model/checkpoint.js';
import type { AgentState } from '../model/state.js';

export interface CheckpointStore {
  /** Create a checkpoint from parameters or current state. */
  create(params: CreateCheckpointParams | AgentState, label?: string): Promise<Checkpoint>;

  /** Restore checkpoint by ID. */
  restore(id: CheckpointId): Promise<AgentState>;

  /** Fetch a Checkpoint record by ID. */
  getCheckpoint(id: CheckpointId): Promise<Checkpoint | undefined>;

  /** List checkpoints for a task, ordered by creation time. */
  list(taskId: TaskId): Promise<ReadonlyArray<Checkpoint>>;

  /** Delete a checkpoint. Returns true if it existed. */
  delete(id: CheckpointId): Promise<boolean>;

  /** Clear all checkpoints. */
  clear(): Promise<void>;
}
