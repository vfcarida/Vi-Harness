/**
 * Default Evidence Store.
 *
 * Implements EvidenceStore interface:
 * Stores, queries, and filters Evidence objects.
 */
import type { EvidenceStore, EvidenceFilter } from '../../core/interfaces/evidence-store.js';
import type { EvidenceId, TaskId } from '../../core/types/identifiers.js';
import type { Evidence } from '../../core/model/evidence.js';

export class DefaultEvidenceStore implements EvidenceStore {
  private readonly records = new Map<EvidenceId, Evidence>();

  async record(evidence: Evidence): Promise<void> {
    this.records.set(evidence.id, evidence);
  }

  async get(id: EvidenceId): Promise<Evidence | undefined> {
    return this.records.get(id);
  }

  async query(filter: EvidenceFilter): Promise<ReadonlyArray<Evidence>> {
    let result = Array.from(this.records.values());

    if (filter.taskId) {
      result = result.filter((e) => e.taskId === filter.taskId);
    }
    if (filter.type) {
      result = result.filter((e) => e.type === filter.type);
    }
    if (filter.pass !== undefined) {
      result = result.filter((e) => e.pass === filter.pass);
    }
    if (filter.after) {
      const afterTime = filter.after.getTime();
      result = result.filter((e) => e.createdAt.getTime() > afterTime);
    }
    if (filter.before) {
      const beforeTime = filter.before.getTime();
      result = result.filter((e) => e.createdAt.getTime() < beforeTime);
    }

    return result;
  }

  async listForTask(taskId: TaskId): Promise<ReadonlyArray<Evidence>> {
    return this.query({ taskId });
  }

  async clear(): Promise<void> {
    this.records.clear();
  }
}
