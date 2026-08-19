/**
 * Frozen Memory Snapshot (from Hermes).
 *
 * Captures active durable memories ONCE at execution start and compiles them into
 * immutable L3_REPOSITORY context objects marked with `immutableDuringExecution: true`.
 *
 * Guarantees:
 * 1. Memory is rendered into context ONCE at execution start.
 * 2. New memories created during execution are persisted to store, but NOT injected
 *    into active context of the current session.
 * 3. Preserves LLM prefix caching performance across all iterations of the execution.
 * 4. On the next execution start, newly persisted memories become part of the new snapshot.
 */
import type { MemoryStore } from '../../core/interfaces/memory-store.js';
import type { IdFactory } from '../../core/types/identifiers.js';
import type { Clock } from '../../core/interfaces/clock.js';
import type { ContextObject } from '../../core/model/context-object.js';
import { ContextTier } from '../../core/model/context.js';
import { ContextObjectType, ContextScope } from '../../core/model/context-object.js';
import { MemoryStatus } from '../../core/model/memory-types.js';

export interface FrozenMemorySnapshotOptions {
  readonly memoryStore: MemoryStore;
  readonly idFactory: IdFactory;
  readonly clock: Clock;
}

export interface CreateSnapshotParams {
  readonly taskDescription: string;
  readonly goalDescription: string;
  readonly limit?: number;
}

export class FrozenMemorySnapshot {
  private readonly memoryStore: MemoryStore;
  private readonly idFactory: IdFactory;
  private readonly clock: Clock;

  constructor(options: FrozenMemorySnapshotOptions) {
    this.memoryStore = options.memoryStore;
    this.idFactory = options.idFactory;
    this.clock = options.clock;
  }

  /**
   * Create an immutable snapshot of active memories for this execution session.
   */
  async capture(params: CreateSnapshotParams): Promise<ReadonlyArray<ContextObject>> {
    const now = this.clock.now();
    const queryText = `${params.taskDescription} ${params.goalDescription}`.trim();

    const scoredMemories = await this.memoryStore.retrieve({
      queryText,
      activeOnly: true,
      limit: params.limit ?? 10,
    });

    const snapshotObjects: ContextObject[] = [];

    for (const scored of scoredMemories) {
      const mem = scored.record;
      if (mem.status === MemoryStatus.ACTIVE || mem.status === MemoryStatus.PROMOTED) {
        snapshotObjects.push({
          id: this.idFactory.create<'Context'>(),
          tier: ContextTier.L3_REPOSITORY,
          type: ContextObjectType.REQUIREMENT,
          content: `[Long-Term Memory: ${mem.type}] ${mem.content}`,
          source: `memory_store:${mem.source}`,
          timestamp: mem.createdAt,
          importance: Math.max(0.7, mem.importance),
          confidence: mem.confidence,
          scope: ContextScope.GLOBAL,
          dependencies: [],
          lastUsed: now,
          lastVerified: mem.lastVerified,
          costTokens: Math.ceil(mem.content.length / 4),
          tags: ['frozen_memory', 'memory_rag', 'durable_fact', ...mem.tags],
          version: 1,
          active: true,
          immutableDuringExecution: true,
          metadata: {
            memoryId: mem.id,
            memoryType: mem.type,
            topic: mem.topic,
            frozenAt: now.toISOString(),
          },
        });
      }
    }

    return Object.freeze(snapshotObjects);
  }
}
