/**
 * MemoryStore & MemoryProvider Interfaces.
 *
 * "Memory is not a second transcript."
 * "Memory is retrieved, not injected wholesale."
 *
 * Defines the contract for selective retrieval, promotion, staleness/invalidation,
 * and external provider abstraction for long-term agent memory.
 */
import type { MemoryId } from '../types/identifiers.js';
import type {
  MemoryRecord,
  ScoredMemoryRecord,
  MemoryQuery,
  CreateMemoryRecordParams,
  MemoryTier,
  MemoryConflict,
} from '../model/memory-types.js';

// ---------------------------------------------------------------------------
// External Memory Provider Interface (Abstraction for Vector/Redis/Local DBs)
// ---------------------------------------------------------------------------

export interface MemoryProvider {
  readonly providerName: string;

  /** Store a memory record in the provider. */
  storeRecord(record: MemoryRecord): Promise<void>;

  /** Fetch a memory record by ID. */
  getRecord(id: MemoryId): Promise<MemoryRecord | undefined>;

  /** Query and rank memory records. */
  retrieve(query: MemoryQuery): Promise<ReadonlyArray<ScoredMemoryRecord>>;

  /** Update an existing memory record. */
  updateRecord(id: MemoryId, updates: Partial<MemoryRecord>): Promise<MemoryRecord>;

  /** Delete a memory record. Returns true if deleted. */
  deleteRecord(id: MemoryId): Promise<boolean>;

  /** Clear all records in this provider. */
  clear(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Memory Store Subsystem Contract
// ---------------------------------------------------------------------------

export interface MemoryStore {
  /** Create and register a new MemoryRecord. */
  createRecord(params: CreateMemoryRecordParams): Promise<MemoryRecord>;

  /** Retrieve relevant memory records matching a query. */
  retrieve(query: MemoryQuery): Promise<ReadonlyArray<ScoredMemoryRecord>>;

  /** Get a record by ID. */
  getRecord(id: MemoryId): Promise<MemoryRecord | undefined>;

  /** Record a usage event for a memory record (increments access/success counts). */
  recordUsage(id: MemoryId, success: boolean): Promise<MemoryRecord>;

  /** Promote a memory record (e.g. from EPISODIC to SEMANTIC/PROCEDURAL). */
  promote(id: MemoryId, targetTier?: MemoryTier): Promise<MemoryRecord>;

  /** Mark a memory record STALE (e.g. when architecture changes). */
  markStale(id: MemoryId, reason?: string): Promise<MemoryRecord>;

  /** Invalidate a memory record (marks INVALIDATED). */
  invalidate(id: MemoryId, reason?: string): Promise<MemoryRecord>;

  /** Delete a memory record. */
  delete(id: MemoryId): Promise<boolean>;

  /** Get all active memory conflicts. */
  getConflicts(): Promise<ReadonlyArray<MemoryConflict>>;

  /** Resolve a memory conflict by keeping winning record and invalidating losing record. */
  resolveConflict(conflictId: string, winningRecordId: MemoryId): Promise<MemoryRecord>;

  /** Update an existing memory record. */
  updateRecord(id: MemoryId, updates: Partial<MemoryRecord>): Promise<MemoryRecord>;

  /** Clear all memories. */
  clear(): Promise<void>;
}
