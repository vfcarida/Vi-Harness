/**
 * Compaction Lock, Crash Recovery & Triggers Test Suite (Prompt P001).
 *
 * Validates:
 * - CompactionLock prevents concurrent compaction on the same session
 * - Lock lifecycle emits 'compaction/start' and 'compaction/end'
 * - Crash recovery detects orphaned locks and restores compaction availability
 * - Pressure trigger vs Context-Overflow trigger threshold divergence
 * - Full 5-stage progressive pipeline end-to-end execution
 */
import { describe, it, expect } from 'vitest';
import {
  InMemoryCompactionLock,
  ContextCompressor,
  ContextRanker,
  UuidV7IdFactory,
  TestClock,
  InMemoryCollapseStore,
} from '../../../src/infra/index.js';
import {
  ContextObjectType,
  ContextTier,
  ContextScope,
  type ContextObject,
  DEFAULT_SCORING_WEIGHTS,
} from '../../../src/core/index.js';

describe('Compaction Lock, Crash Recovery & Compaction Triggers (DeepSeek Harness)', () => {
  const idFactory = new UuidV7IdFactory();
  const clock = new TestClock(new Date('2026-01-01T00:00:00Z'));
  const now = clock.now();
  const nowMs = now.getTime();

  function buildSampleTrajectory(count: number): ContextObject[] {
    const objects: ContextObject[] = [];
    for (let i = 1; i <= count; i++) {
      objects.push({
        id: idFactory.create<'Context'>(),
        tier: ContextTier.L2_EPISODIC,
        type: ContextObjectType.ATTEMPT,
        content: `Trajectory iteration #${i}: Attempting heuristic solution candidate ${i}`,
        source: 'agent',
        timestamp: new Date(nowMs - (count - i) * 1000),
        importance: 0.55,
        confidence: 0.8,
        scope: ContextScope.TASK,
        dependencies: [],
        lastUsed: new Date(nowMs - (count - i) * 1000),
        lastVerified: null,
        costTokens: 80,
        tags: ['episodic', 'attempt'],
        version: 1,
        active: true,
        metadata: { iter: i },
      });
    }
    return objects;
  }

  it('1. Compaction Lock: Prevents concurrent compaction on the same session', () => {
    const lock = new InMemoryCompactionLock();
    const sessionId = 'session-123';

    expect(lock.acquire(sessionId)).toBe(true);
    // Second acquisition on active lock must fail
    expect(lock.acquire(sessionId)).toBe(false);

    const state = lock.getLockState(sessionId);
    expect(state?.locked).toBe(true);
    expect(state?.lastEvent).toBe('compaction/start');

    // After release, acquisition succeeds
    lock.release(sessionId);
    expect(lock.getLockState(sessionId)?.locked).toBe(false);
    expect(lock.getLockState(sessionId)?.lastEvent).toBe('compaction/end');
    expect(lock.acquire(sessionId)).toBe(true);
  });

  it('2. Crash Recovery: Detects and recovers orphaned locks after timeout/crash', () => {
    const lock = new InMemoryCompactionLock({ timeoutMs: 100 });
    const sessionId = 'crashed-session-456';

    // Simulate crash: lock acquired but never released
    lock.acquire(sessionId);
    lock.forceOrphaned(sessionId);

    // Orphan detection
    expect(lock.isOrphaned(sessionId)).toBe(true);

    // Recover clears orphaned state
    lock.recover(sessionId);
    expect(lock.isOrphaned(sessionId)).toBe(false);

    // Can now acquire cleanly
    expect(lock.acquire(sessionId)).toBe(true);
  });

  it('3. Compressor with Lock: Transparently handles lock lifecycle and concurrent rejection', () => {
    const lock = new InMemoryCompactionLock();
    const sessionId = 'session-compactor-test';
    const objects = buildSampleTrajectory(3);
    const scored = objects.map((o) => ContextRanker.scoreObject(o, nowMs, DEFAULT_SCORING_WEIGHTS));

    // Run compaction with lock -> should succeed and release automatically
    const result = ContextCompressor.compress(scored, 1000, nowMs, {
      lock,
      sessionId,
      modelContextTokens: 32000,
    });

    expect(result.retained.length).toBeGreaterThan(0);
    expect(lock.getLockState(sessionId)?.locked).toBe(false);
    expect(lock.getLockState(sessionId)?.lastEvent).toBe('compaction/end');

    // Simulate already-locked session
    lock.acquire(sessionId);
    expect(() => {
      ContextCompressor.compress(scored, 1000, nowMs, {
        lock,
        sessionId,
        modelContextTokens: 32000,
      });
    }).toThrow(/concurrent compaction in progress/);
  });

  it('4. Pressure vs Context-Overflow Triggers: Overflow trigger uses aggressive thresholds', () => {
    const objects = buildSampleTrajectory(10); // 800 tokens
    const scored = objects.map((o) => ContextRanker.scoreObject(o, nowMs, DEFAULT_SCORING_WEIGHTS));

    // Normal pressure trigger with 800 tokens on 1000 budget (80% load)
    const pressureResult = ContextCompressor.compress(scored, 1000, nowMs, {
      trigger: 'pressure',
      modelContextTokens: 100000, // large window -> standard gentle compaction
    });

    // Emergency context-overflow trigger -> aggressively compresses earlier
    const overflowResult = ContextCompressor.compress(scored, 1000, nowMs, {
      trigger: 'context-overflow',
      aggressiveOnOverflow: true,
      modelContextTokens: 100000,
    });

    expect(overflowResult.totalTokens).toBeLessThan(pressureResult.totalTokens);
    expect(overflowResult.explanations.some((e) => e.action === 'COLLAPSED')).toBe(true);
  });

  it('5. Full 5-Stage Compaction Pipeline End-to-End Execution', () => {
    const collapseStore = new InMemoryCollapseStore();
    const objects: ContextObject[] = [
      // Invariant user instruction (must preserve)
      {
        id: idFactory.create<'Context'>(),
        tier: ContextTier.L3_REPOSITORY,
        type: ContextObjectType.USER_INSTRUCTION,
        content: 'MANDATORY GOAL: Refactor database connection pool safely',
        source: 'user',
        timestamp: now,
        importance: 1.0,
        confidence: 1.0,
        scope: ContextScope.GLOBAL,
        dependencies: [],
        lastUsed: now,
        lastVerified: now,
        costTokens: 30,
        tags: ['must_preserve', 'goal'],
        version: 1,
        active: true,
        metadata: {},
      },
      // Oversized tool result (Stage 0 Budget Reduction & Stage 0.5 Tool-Result Pruning)
      {
        id: idFactory.create<'Context'>(),
        tier: ContextTier.L0_HOT,
        type: ContextObjectType.OBSERVATION,
        content: 'STDOUT: ' + 'DATABASE_RECORD_DUMP_ROW_'.repeat(800), // ~5000 tokens
        source: 'tool_executor',
        timestamp: now,
        importance: 0.85,
        confidence: 1.0,
        scope: ContextScope.TASK,
        dependencies: [],
        lastUsed: now,
        lastVerified: now,
        costTokens: 5000,
        tags: ['tool_output'],
        version: 1,
        active: true,
        metadata: {},
      },
      // Ephemeral debug log (Stage 1 Snip candidate)
      {
        id: idFactory.create<'Context'>(),
        tier: ContextTier.L0_HOT,
        type: ContextObjectType.OBSERVATION,
        content: '[DEBUG] Socket ping latency to DB cluster: 15ms. stdout: OK',
        source: 'tracer',
        timestamp: new Date(nowMs - 20 * 60 * 60 * 1000), // 20 hours old
        importance: 0.2,
        confidence: 1.0,
        scope: ContextScope.TASK,
        dependencies: [],
        lastUsed: new Date(nowMs - 20 * 60 * 60 * 1000),
        lastVerified: null,
        costTokens: 60,
        tags: ['ephemeral', 'log'],
        version: 1,
        active: true,
        metadata: {},
      },
      // Repetitive tool output (Stage 2 Micro-compact candidate)
      {
        id: idFactory.create<'Context'>(),
        tier: ContextTier.L0_HOT,
        type: ContextObjectType.OBSERVATION,
        content: 'npm test output: 0 failures, 45 passed tests.',
        source: 'tool_executor',
        timestamp: now,
        importance: 0.5,
        confidence: 1.0,
        scope: ContextScope.TASK,
        dependencies: [],
        lastUsed: now,
        lastVerified: now,
        costTokens: 120,
        tags: ['tool_output'],
        version: 1,
        active: true,
        metadata: {},
      },
      {
        id: idFactory.create<'Context'>(),
        tier: ContextTier.L0_HOT,
        type: ContextObjectType.OBSERVATION,
        content: 'npm test output: 0 failures, 45 passed tests.',
        source: 'tool_executor',
        timestamp: now,
        importance: 0.5,
        confidence: 1.0,
        scope: ContextScope.TASK,
        dependencies: [],
        lastUsed: now,
        lastVerified: now,
        costTokens: 120,
        tags: ['tool_output'],
        version: 1,
        active: true,
        metadata: {},
      },
      // Episodic trajectory attempts (Stage 3 Context Collapse candidates)
      ...buildSampleTrajectory(6),
    ];

    const scored = objects.map((o) => ContextRanker.scoreObject(o, nowMs, DEFAULT_SCORING_WEIGHTS));

    const result = ContextCompressor.compress(scored, 800, nowMs, {
      modelContextTokens: 32000,
      maxToolResultTokens: 1000,
      collapseStore,
    });

    // 1. Pipeline stages recorded
    expect(result.pipelineStagesRun).toEqual([
      'BUDGET_REDUCTION',
      'TOOL_PRUNE',
      'SNIP',
      'MICRO_COMPACT',
      'COLLAPSE',
      'AUTO_COMPACT',
    ]);

    // 2. Budget strictly respected
    expect(result.totalTokens).toBeLessThanOrEqual(800);

    // 3. Invariants preserved
    expect(result.retained.some((o) => o.type === ContextObjectType.USER_INSTRUCTION)).toBe(true);

    // 4. Budget reduction and trimming explanation recorded
    expect(result.explanations.some((e) => e.action === 'TRIMMED')).toBe(true);

    // 5. Snip pruned ephemeral debug log
    expect(result.omitted.some((o) => o.content.includes('[DEBUG]'))).toBe(true);

    // 6. Microcompact summarized repetitive outputs
    expect(result.explanations.some((e) => e.action === 'SUMMARIZED')).toBe(true);

    // 7. Context Collapse generated milestone projection
    expect(result.explanations.some((e) => e.action === 'COLLAPSED')).toBe(true);
  });
});
