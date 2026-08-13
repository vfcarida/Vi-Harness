/**
 * EventStore Interface.
 *
 * Persists ordered state transition events for event sourcing and state reconstruction.
 */
import type { TaskId } from '../types/identifiers.js';
import type { StateEventRecord } from '../model/recovery-types.js';

export interface EventStore {
  /** Append a new state event record to task event stream. */
  append(record: Omit<StateEventRecord, 'id' | 'sequenceNumber'>): Promise<StateEventRecord>;

  /** Get full event stream for a task ordered by sequence number. */
  getEvents(taskId: TaskId): Promise<ReadonlyArray<StateEventRecord>>;

  /** Get latest event for a task. */
  getLastEvent(taskId: TaskId): Promise<StateEventRecord | undefined>;

  /** Clear events. */
  clear(): Promise<void>;
}
