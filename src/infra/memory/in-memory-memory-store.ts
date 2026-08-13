/**
 * In-Memory Memory Store Implementation.
 *
 * Implements MemoryStore contract:
 * - Selective memory creation with metadata & scope
 * - Usage tracking (access/success count) & auto-promotion
 * - Invalidation & Staleness transitions (when architecture or facts change)
 * - Delegation to pluggable MemoryProvider implementation
 */
import type { MemoryStore, MemoryProvider } from '../../core/interfaces/memory-store.js';
import type { MemoryId, IdFactory } from '../../core/types/identifiers.js';
import type { Clock } from '../../core/interfaces/clock.js';
import type {
  MemoryRecord,
  ScoredMemoryRecord,
  MemoryQuery,
  CreateMemoryRecordParams,
  MemoryTier,
} from '../../core/model/memory-types.js';
import {
  MemoryStatus,
  MemoryScope,
} from '../../core/model/memory-types.js';
import { InMemoryMemoryProvider } from './in-memory-memory-provider.js';
import { MemoryLifecycle } from './memory-lifecycle.js';
import { HarnessError } from '../../core/errors/base-error.js';
import { ErrorCode, ErrorCategory } from '../../core/errors/error-codes.js';

export interface InMemoryMemoryStoreOptions {
  readonly idFactory: IdFactory;
  readonly clock: Clock;
  readonly provider?: MemoryProvider;
}

export class InMemoryMemoryStore implements MemoryStore {
  private readonly idFactory: IdFactory;
  private readonly clock: Clock;
  private readonly provider: MemoryProvider;

  constructor(options: InMemoryMemoryStoreOptions) {
    this.idFactory = options.idFactory;
    this.clock = options.clock;
    this.provider = options.provider ?? new InMemoryMemoryProvider();
  }

  async createRecord(params: CreateMemoryRecordParams): Promise<MemoryRecord> {
    const id = params.id ?? this.idFactory.create<'Memory'>();
    const now = this.clock.now();

    let record: MemoryRecord = {
      id,
      tier: params.tier,
      type: params.type,
      content: params.content,
      source: params.source,
      confidence: params.confidence ?? 1.0,
      importance: params.importance ?? 0.5,
      scope: params.scope ?? MemoryScope.REPOSITORY,
      scopeTarget: params.scopeTarget,
      createdAt: now,
      updatedAt: now,
      lastUsed: now,
      lastVerified: params.lastVerified ?? null,
      expiresAt: params.expiresAt ?? null,
      status: MemoryStatus.ACTIVE,
      accessCount: 0,
      successCount: 0,
      recurrenceCount: 1,
      tags: params.tags ?? [],
      metadata: params.metadata ?? {},
    };

    // Auto-promote if initial parameters satisfy promotion rules
    if (MemoryLifecycle.shouldPromote(record)) {
      const targetTier = MemoryLifecycle.determinePromotedTier(record);
      record = {
        ...record,
        status: MemoryStatus.PROMOTED,
        tier: targetTier,
      };
    }

    await this.provider.storeRecord(record);
    return record;
  }

  async retrieve(query: MemoryQuery): Promise<ReadonlyArray<ScoredMemoryRecord>> {
    return this.provider.retrieve(query);
  }

  async getRecord(id: MemoryId): Promise<MemoryRecord | undefined> {
    return this.provider.getRecord(id);
  }

  async recordUsage(id: MemoryId, success: boolean): Promise<MemoryRecord> {
    const record = await this.provider.getRecord(id);
    if (!record) {
      throw new HarnessError({
        code: ErrorCode.CONTEXT_COMPILATION_FAILED,
        category: ErrorCategory.CONTEXT,
        message: `MemoryRecord not found: ${id}`,
      });
    }

    const now = this.clock.now();
    const updatedAccess = record.accessCount + 1;
    const updatedSuccess = record.successCount + (success ? 1 : 0);
    const updatedRecurrence = record.recurrenceCount + 1;

    let updated: MemoryRecord = {
      ...record,
      accessCount: updatedAccess,
      successCount: updatedSuccess,
      recurrenceCount: updatedRecurrence,
      lastUsed: now,
      updatedAt: now,
    };

    if (MemoryLifecycle.shouldPromote(updated)) {
      const targetTier = MemoryLifecycle.determinePromotedTier(updated);
      updated = {
        ...updated,
        status: MemoryStatus.PROMOTED,
        tier: targetTier,
      };
    }

    return this.provider.updateRecord(id, updated);
  }

  async promote(id: MemoryId, targetTier?: MemoryTier): Promise<MemoryRecord> {
    const record = await this.provider.getRecord(id);
    if (!record) {
      throw new HarnessError({
        code: ErrorCode.CONTEXT_COMPILATION_FAILED,
        category: ErrorCategory.CONTEXT,
        message: `MemoryRecord not found: ${id}`,
      });
    }

    const newTier = targetTier ?? MemoryLifecycle.determinePromotedTier(record);
    const updated: MemoryRecord = {
      ...record,
      status: MemoryStatus.PROMOTED,
      tier: newTier,
      updatedAt: this.clock.now(),
    };

    return this.provider.updateRecord(id, updated);
  }

  async markStale(id: MemoryId, reason?: string): Promise<MemoryRecord> {
    const record = await this.provider.getRecord(id);
    if (!record) {
      throw new HarnessError({
        code: ErrorCode.CONTEXT_COMPILATION_FAILED,
        category: ErrorCategory.CONTEXT,
        message: `MemoryRecord not found: ${id}`,
      });
    }

    const updated: MemoryRecord = {
      ...record,
      status: MemoryStatus.STALE,
      updatedAt: this.clock.now(),
      metadata: {
        ...record.metadata,
        staleReason: reason ?? 'Architecture or system state changed',
      },
    };

    return this.provider.updateRecord(id, updated);
  }

  async invalidate(id: MemoryId, reason?: string): Promise<MemoryRecord> {
    const record = await this.provider.getRecord(id);
    if (!record) {
      throw new HarnessError({
        code: ErrorCode.CONTEXT_COMPILATION_FAILED,
        category: ErrorCategory.CONTEXT,
        message: `MemoryRecord not found: ${id}`,
      });
    }

    const updated: MemoryRecord = {
      ...record,
      status: MemoryStatus.INVALIDATED,
      updatedAt: this.clock.now(),
      metadata: {
        ...record.metadata,
        invalidationReason: reason ?? 'Contradicted by evidence',
      },
    };

    return this.provider.updateRecord(id, updated);
  }

  async delete(id: MemoryId): Promise<boolean> {
    return this.provider.deleteRecord(id);
  }

  async clear(): Promise<void> {
    return this.provider.clear();
  }
}
