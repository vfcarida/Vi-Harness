/**
 * StateStore interface.
 *
 * Manages agent state and enforces valid transitions.
 * "All important state transitions must be explicit."
 */
import type { TaskId, EvidenceId } from '../types/identifiers.js';
import type { AgentState, StateEvent, StateTransition } from '../model/state.js';

export interface TransitionOptions {
  readonly isLlmEmitted?: boolean;
  readonly evidenceIds?: ReadonlyArray<EvidenceId>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface StateStore {
  /** Get the current state for a task. */
  getState(taskId: TaskId): Promise<AgentState | undefined>;

  /** Apply a state event, returning the resulting transition. */
  transition(
    taskId: TaskId,
    event: StateEvent,
    options?: TransitionOptions,
  ): Promise<StateTransition>;

  /** Get the full transition history for a task. */
  getHistory(taskId: TaskId): Promise<ReadonlyArray<StateTransition>>;
}
