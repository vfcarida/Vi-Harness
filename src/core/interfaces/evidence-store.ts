/**
 * EvidenceStore interface.
 *
 * Persists and queries evidence produced by verification.
 * Evidence drives state transitions and informs the context compiler.
 */
import type { Evidence, EvidenceType } from '../model/evidence.js';
import type { EvidenceId, TaskId } from '../types/identifiers.js';

export interface EvidenceFilter {
  readonly taskId?: TaskId;
  readonly type?: EvidenceType;
  readonly pass?: boolean;
  readonly since?: Date;
  readonly after?: Date;
  readonly before?: Date;
}

export interface EvidenceStore {
  /** Record a new piece of evidence. */
  record(evidence: Evidence): Promise<void>;

  /** Retrieve evidence by ID. */
  get(id: EvidenceId): Promise<Evidence | undefined>;

  /** Query evidence with filters. */
  query(filter: EvidenceFilter): Promise<ReadonlyArray<Evidence>>;

  /** List evidence for a specific task. */
  listForTask(taskId: TaskId): Promise<ReadonlyArray<Evidence>>;

  /** Clear all records. */
  clear(): Promise<void>;
}
