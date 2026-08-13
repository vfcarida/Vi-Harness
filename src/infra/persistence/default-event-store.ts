/**
 * Default Event Store.
 *
 * Implements EventStore interface:
 * Appends and retrieves sequential state transition records per task for event sourcing.
 */
import type { EventStore } from '../../core/interfaces/event-store.js';
import type { TaskId, IdFactory } from '../../core/types/identifiers.js';
import type { StateEventRecord } from '../../core/model/recovery-types.js';

export interface DefaultEventStoreOptions {
  readonly idFactory: IdFactory;
}

export class DefaultEventStore implements EventStore {
  private readonly eventsPerTask = new Map<TaskId, StateEventRecord[]>();
  private readonly idFactory: IdFactory;

  constructor(options: DefaultEventStoreOptions) {
    this.idFactory = options.idFactory;
  }

  async append(input: Omit<StateEventRecord, 'id' | 'sequenceNumber'>): Promise<StateEventRecord> {
    const list = this.eventsPerTask.get(input.taskId) ?? [];
    const sequenceNumber = list.length + 1;
    const record: StateEventRecord = {
      ...input,
      id: this.idFactory.create<'Trace'>(), // unique event ID
      sequenceNumber,
    };

    list.push(record);
    this.eventsPerTask.set(input.taskId, list);
    return record;
  }

  async getEvents(taskId: TaskId): Promise<ReadonlyArray<StateEventRecord>> {
    return this.eventsPerTask.get(taskId) ?? [];
  }

  async getLastEvent(taskId: TaskId): Promise<StateEventRecord | undefined> {
    const list = this.eventsPerTask.get(taskId);
    if (!list || list.length === 0) return undefined;
    return list[list.length - 1];
  }

  async clear(): Promise<void> {
    this.eventsPerTask.clear();
  }
}
