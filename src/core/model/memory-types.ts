/**
 * Memory Subsystem Domain Types.
 *
 * "Memory is not conversation history. Memory is durable information."
 *
 * Defines memory tiers, record types, explicit lifecycle statuses
 * (CANDIDATE, ACTIVE, STALE, INVALIDATED, ARCHIVED), provenance metadata,
 * conflict representation, and query interfaces.
 */
import type { MemoryId } from '../types/identifiers.js';

// ---------------------------------------------------------------------------
// Memory Tiers & Types
// ---------------------------------------------------------------------------

export enum MemoryTier {
  SHORT_TERM = 'SHORT_TERM',
  EPISODIC = 'EPISODIC',
  SEMANTIC = 'SEMANTIC',
  PROCEDURAL = 'PROCEDURAL',
}

export enum MemoryType {
  FACT = 'FACT',
  EXPERIENCE = 'EXPERIENCE',
  PATTERN = 'PATTERN',
  SKILL = 'SKILL',
  FAILURE_AVOIDANCE = 'FAILURE_AVOIDANCE',
  DECISION = 'DECISION',
  WORKFLOW = 'WORKFLOW',
}

export enum MemoryScope {
  GLOBAL = 'GLOBAL',
  REPOSITORY = 'REPOSITORY',
  TASK = 'TASK',
  FILE = 'FILE',
  COMPONENT = 'COMPONENT',
}

// ---------------------------------------------------------------------------
// Explicit Memory Lifecycle Statuses
// ---------------------------------------------------------------------------

export enum MemoryStatus {
  CANDIDATE = 'CANDIDATE',
  ACTIVE = 'ACTIVE',
  STALE = 'STALE',
  INVALIDATED = 'INVALIDATED',
  ARCHIVED = 'ARCHIVED',
  PROMOTED = 'PROMOTED',
  EXPIRED = 'EXPIRED',
}

// ---------------------------------------------------------------------------
// Source Provenance
// ---------------------------------------------------------------------------

export interface MemoryProvenance {
  readonly source: string;
  readonly toolName?: string;
  readonly filePath?: string;
  readonly commitHash?: string;
  readonly agentPhase?: string;
  readonly timestamp: Date;
}

// ---------------------------------------------------------------------------
// Memory Conflict / Contradiction
// ---------------------------------------------------------------------------

export interface MemoryConflict {
  readonly conflictId: string;
  readonly existingRecord: MemoryRecord;
  readonly conflictingRecord: MemoryRecord;
  readonly topic: string;
  readonly reason: string;
  readonly detectedAt: Date;
}

// ---------------------------------------------------------------------------
// Memory Record
// ---------------------------------------------------------------------------

export interface MemoryRecord {
  readonly id: MemoryId;
  readonly tier: MemoryTier;
  readonly type: MemoryType;
  readonly content: string;
  readonly source: string;
  readonly provenance?: MemoryProvenance;
  readonly confidence: number; // 0.0 to 1.0
  readonly importance: number; // 0.0 to 1.0
  readonly scope: MemoryScope;
  readonly scopeTarget?: string;
  readonly topic?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly lastUsed: Date;
  readonly lastVerified: Date | null;
  readonly expiresAt: Date | null;
  readonly status: MemoryStatus;
  readonly accessCount: number;
  readonly successCount: number;
  readonly recurrenceCount: number;
  readonly tags: ReadonlyArray<string>;
  readonly metadata: Readonly<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Scored Memory Record
// ---------------------------------------------------------------------------

export interface ScoredMemoryRecord {
  readonly record: MemoryRecord;
  readonly relevanceScore: number;
  readonly scoreBreakdown: Readonly<Record<string, number>>;
}

// ---------------------------------------------------------------------------
// Memory Query
// ---------------------------------------------------------------------------

export interface MemoryQuery {
  readonly queryText?: string;
  readonly topic?: string;
  readonly tiers?: ReadonlyArray<MemoryTier>;
  readonly types?: ReadonlyArray<MemoryType>;
  readonly scopes?: ReadonlyArray<MemoryScope>;
  readonly scopeTarget?: string;
  readonly minImportance?: number;
  readonly minConfidence?: number;
  readonly tags?: ReadonlyArray<string>;
  readonly activeOnly?: boolean;
  readonly statuses?: ReadonlyArray<MemoryStatus>;
  readonly limit?: number;
}

// ---------------------------------------------------------------------------
// Creation Parameters
// ---------------------------------------------------------------------------

export interface CreateMemoryRecordParams {
  readonly id?: MemoryId;
  readonly tier?: MemoryTier;
  readonly type: MemoryType;
  readonly content: string;
  readonly source: string;
  readonly provenance?: MemoryProvenance;
  readonly confidence?: number;
  readonly importance?: number;
  readonly scope?: MemoryScope;
  readonly scopeTarget?: string;
  readonly topic?: string;
  readonly status?: MemoryStatus;
  readonly lastVerified?: Date | null;
  readonly expiresAt?: Date | null;
  readonly tags?: ReadonlyArray<string>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
