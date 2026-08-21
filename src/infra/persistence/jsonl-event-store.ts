/**
 * JSONL File-Backed Durable Event Store.
 *
 * Implements EventStore interface:
 * Appends and replays sequential state transition records to/from durable `.jsonl` files
 * on disk, guaranteeing zero-data-loss crash recovery.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { EventStore } from '../../core/interfaces/event-store.js';
import type { TaskId, IdFactory } from '../../core/types/identifiers.js';
import type { StateEventRecord } from '../../core/model/recovery-types.js';

export interface JsonlEventStoreOptions {
  readonly storageDir?: string;
  readonly idFactory: IdFactory;
}

export class JsonlEventStore implements EventStore {
  private readonly storageDir: string;
  private readonly idFactory: IdFactory;

  constructor(options: JsonlEventStoreOptions) {
    this.storageDir = options.storageDir ?? path.join(process.cwd(), '.vi-harness', 'events');
    this.idFactory = options.idFactory;

    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  private getTaskFilePath(taskId: TaskId): string {
    const sanitized = taskId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.storageDir, `${sanitized}.jsonl`);
  }

  async append(input: Omit<StateEventRecord, 'id' | 'sequenceNumber'>): Promise<StateEventRecord> {
    const existingEvents = await this.getEvents(input.taskId);
    const sequenceNumber = existingEvents.length + 1;
    const record: StateEventRecord = {
      ...input,
      id: this.idFactory.create<'Trace'>(),
      sequenceNumber,
    };

    const filePath = this.getTaskFilePath(input.taskId);
    const line = JSON.stringify(record) + '\n';
    await fs.promises.appendFile(filePath, line, 'utf-8');

    return record;
  }

  async getEvents(taskId: TaskId): Promise<ReadonlyArray<StateEventRecord>> {
    const filePath = this.getTaskFilePath(taskId);
    if (!fs.existsSync(filePath)) {
      return [];
    }

    const content = await fs.promises.readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter((l) => l.trim().length > 0);
    const events: StateEventRecord[] = [];

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as StateEventRecord;
        events.push({
          ...parsed,
          timestamp: new Date(parsed.timestamp),
        });
      } catch {
        // Skip corrupt lines
      }
    }

    return events;
  }

  async getLastEvent(taskId: TaskId): Promise<StateEventRecord | undefined> {
    const events = await this.getEvents(taskId);
    return events.length > 0 ? events[events.length - 1] : undefined;
  }

  async clear(): Promise<void> {
    if (fs.existsSync(this.storageDir)) {
      const files = await fs.promises.readdir(this.storageDir);
      for (const file of files) {
        if (file.endsWith('.jsonl')) {
          await fs.promises.unlink(path.join(this.storageDir, file));
        }
      }
    }
  }
}
