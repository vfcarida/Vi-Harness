/**
 * Memory Subsystem Domain Types.
 *
 * "Memory is not a second transcript."
 * "Memory is retrieved, not injected wholesale."
 *
 * Defines memory tiers (Short-Term, Episodic, Semantic, Procedural),
 * record types, lifecycle statuses (Active, Promoted, Stale, Invalidated, Expired),
 * promotion rules, and scoring structures.
 */
import type { MemoryId } from '../types/identifiers.js';

// ---------------------------------------------------------------------------
// Memory Tiers
// ---------------------------------------------------------------------------

export enum MemoryTier {
  SHORT_TERM = 'SHORT_TERM',
  EPISODIC = 'EPISODIC',
  SEMANTIC = 'SEMANTIC',
  PROCEDURAL = 'PROCEDURAL',
}

// ---------------------------------------------------------------------------
// Memory Record Types
// ---------------------------------------------------------------------------

export enum MemoryType {
  FACT = 'FACT',
  EXPERIENCE = 'EXPERIENCE',
  PATTERN = 'PATTERN',
  SKILL = 'SKILL',
  FAILURE_AVOIDANCE = 'FAILURE_AVOIDANCE',
  DECISION = 'DECISION',
  WORKFLOW = 'WORKFLOW',
}

// ---------------------------------------------------------------------------
// Memory Scopes
// ---------------------------------------------------------------------------

export enum MemoryScope {
  GLOBAL = 'GLOBAL',
  REPOSITORY = 'REPOSITORY',
  TASK = 'TASK',
  FILE = 'FILE',
  COMPONENT = 'COMPONENT',
}

// ---------------------------------------------------------------------------
// Memory Statuses
// ---------------------------------------------------------------------------

export enum MemoryStatus {
  ACTIVE = 'ACTIVE',
  PROMOTED = 'PROMOTED',
  STALE = 'STALE',
  INVALIDATED = 'INVALIDATED',
  EXPIRED = 'EXPIRED',
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
  readonly confidence: number; // 0.0 to 1.0
  readonly importance: number; // 0.0 to 1.0
  readonly scope: MemoryScope;
  readonly scopeTarget?: string;
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
  readonly tiers?: ReadonlyArray<MemoryTier>;
  readonly types?: ReadonlyArray<MemoryType>;
  readonly scopes?: ReadonlyArray<MemoryScope>;
  readonly scopeTarget?: string;
  readonly minImportance?: number;
  readonly minConfidence?: number;
  readonly tags?: ReadonlyArray<string>;
  readonly activeOnly?: boolean;
  readonly limit?: number;
}

// ---------------------------------------------------------------------------
// Creation Parameters
// ---------------------------------------------------------------------------

export interface CreateMemoryRecordParams {
  readonly id?: MemoryId;
  readonly tier: MemoryTier;
  readonly type: MemoryType;
  readonly content: string;
  readonly source: string;
  readonly confidence?: number;
  readonly importance?: number;
  readonly scope?: MemoryScope;
  readonly scopeTarget?: string;
  readonly lastVerified?: Date | null;
  readonly expiresAt?: Date | null;
  readonly tags?: ReadonlyArray<string>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
