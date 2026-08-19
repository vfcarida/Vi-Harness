/**
 * Context Object & Graph Domain Types.
 *
 * "Context is compiled, not accumulated."
 *
 * Information is represented as structured ContextObjects across four tiers (L0–L3),
 * with explicit typed relations, versioning, confidence/importance scoring,
 * and scope targets.
 */
import type { ContextId } from '../types/identifiers.js';
import { ContextTier } from './context.js';

// ---------------------------------------------------------------------------
// Object Types Taxonomy
// ---------------------------------------------------------------------------

export enum ContextObjectType {
  REQUIREMENT = 'REQUIREMENT',
  DECISION = 'DECISION',
  CONSTRAINT = 'CONSTRAINT',
  HYPOTHESIS = 'HYPOTHESIS',
  FILE = 'FILE',
  CODE_SYMBOL = 'CODE_SYMBOL',
  TEST = 'TEST',
  FAILURE = 'FAILURE',
  EVIDENCE = 'EVIDENCE',
  OBSERVATION = 'OBSERVATION',
  ARTIFACT = 'ARTIFACT',
  ARCHITECTURE_FACT = 'ARCHITECTURE_FACT',
  USER_INSTRUCTION = 'USER_INSTRUCTION',
  SECURITY_RULE = 'SECURITY_RULE',
  LEARNED_PATTERN = 'LEARNED_PATTERN',
  ATTEMPT = 'ATTEMPT',
  SUMMARY = 'SUMMARY',
}

// ---------------------------------------------------------------------------
// Context Scopes
// ---------------------------------------------------------------------------

export enum ContextScope {
  GLOBAL = 'GLOBAL',
  TASK = 'TASK',
  FILE = 'FILE',
  SYMBOL = 'SYMBOL',
  ITERATION = 'ITERATION',
}

// ---------------------------------------------------------------------------
// Relation Types Taxonomy
// ---------------------------------------------------------------------------

export enum ContextRelationType {
  DEPENDS_ON = 'DEPENDS_ON',
  DERIVED_FROM = 'DERIVED_FROM',
  CONTRADICTS = 'CONTRADICTS',
  VALIDATES = 'VALIDATES',
  INVALIDATES = 'INVALIDATES',
  IMPLEMENTS = 'IMPLEMENTS',
  AFFECTS = 'AFFECTS',
  RELATED_TO = 'RELATED_TO',
}

// ---------------------------------------------------------------------------
// Context Object
// ---------------------------------------------------------------------------

export interface ContextObject {
  readonly id: ContextId;
  readonly tier: ContextTier;
  readonly type: ContextObjectType;
  readonly content: string;
  readonly source: string;
  readonly timestamp: Date;
  readonly importance: number; // 0.0 to 1.0
  readonly confidence: number; // 0.0 to 1.0
  readonly scope: ContextScope;
  readonly scopeTarget?: string; // e.g. file path, symbol name, task id
  readonly dependencies: ReadonlyArray<ContextId>;
  readonly lastUsed: Date;
  readonly lastVerified: Date | null;
  readonly costTokens: number;
  readonly tags: ReadonlyArray<string>;
  readonly version: number;
  readonly active: boolean; // false when deactivated (preserved in history)
  readonly metadata: Readonly<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Context Relation
// ---------------------------------------------------------------------------

export interface ContextRelation {
  readonly id: string;
  readonly sourceId: ContextId;
  readonly targetId: ContextId;
  readonly relation: ContextRelationType;
  readonly weight: number; // 0.0 to 1.0
  readonly createdAt: Date;
  readonly metadata: Readonly<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Context Query
// ---------------------------------------------------------------------------

export interface ContextQuery {
  readonly tier?: ContextTier;
  readonly types?: ReadonlyArray<ContextObjectType>;
  readonly scopes?: ReadonlyArray<ContextScope>;
  readonly scopeTarget?: string;
  readonly minImportance?: number;
  readonly minConfidence?: number;
  readonly tags?: ReadonlyArray<string>;
  readonly onlyActive?: boolean; // Default: true (active projection)
  readonly verifiedOnly?: boolean;
  readonly since?: Date;
  readonly relatedToId?: ContextId;
  readonly relationTypes?: ReadonlyArray<ContextRelationType>;
  readonly limit?: number;
  readonly sortBy?: 'relevance' | 'importance' | 'confidence' | 'recency';
}

// ---------------------------------------------------------------------------
// Creation Parameters
// ---------------------------------------------------------------------------

export interface CreateContextObjectParams {
  readonly id?: ContextId;
  readonly tier: ContextTier;
  readonly type: ContextObjectType;
  readonly content: string;
  readonly source: string;
  readonly importance?: number;
  readonly confidence?: number;
  readonly scope?: ContextScope;
  readonly scopeTarget?: string;
  readonly dependencies?: ReadonlyArray<ContextId>;
  readonly lastVerified?: Date | null;
  readonly costTokens?: number;
  readonly tags?: ReadonlyArray<string>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface CreateContextRelationParams {
  readonly sourceId: ContextId;
  readonly targetId: ContextId;
  readonly relation: ContextRelationType;
  readonly weight?: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
