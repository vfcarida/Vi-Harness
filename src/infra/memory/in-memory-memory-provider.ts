/**
 * In-Memory Memory Provider.
 *
 * Implements MemoryProvider interface for storing and retrieving MemoryRecords in memory.
 * Acts as the default provider implementation. External vector/Redis providers
 * implement the same MemoryProvider interface.
 */
import type { MemoryProvider } from '../../core/interfaces/memory-store.js';
import type { MemoryId } from '../../core/types/identifiers.js';
import type {
  MemoryRecord,
  ScoredMemoryRecord,
  MemoryQuery,
} from '../../core/model/memory-types.js';
import { MemoryRetriever } from './memory-retriever.js';

export class InMemoryMemoryProvider implements MemoryProvider {
  public readonly providerName = 'in-memory-provider';
  private readonly records = new Map<MemoryId, MemoryRecord>();

  async storeRecord(record: MemoryRecord): Promise<void> {
    this.records.set(record.id, record);
  }

  async getRecord(id: MemoryId): Promise<MemoryRecord | undefined> {
    return this.records.get(id);
  }

  async retrieve(query: MemoryQuery): Promise<ReadonlyArray<ScoredMemoryRecord>> {
    const candidates = Array.from(this.records.values());
    return MemoryRetriever.retrieve(candidates, query, new Date());
  }

  async updateRecord(id: MemoryId, updates: Partial<MemoryRecord>): Promise<MemoryRecord> {
    const existing = this.records.get(id);
    if (!existing) {
      throw new Error(`MemoryRecord not found: ${id}`);
    }

    const updated: MemoryRecord = {
      ...existing,
      ...updates,
      id: existing.id,
      updatedAt: new Date(),
    };

    this.records.set(id, updated);
    return updated;
  }

  async deleteRecord(id: MemoryId): Promise<boolean> {
    return this.records.delete(id);
  }

  async clear(): Promise<void> {
    this.records.clear();
  }
}
