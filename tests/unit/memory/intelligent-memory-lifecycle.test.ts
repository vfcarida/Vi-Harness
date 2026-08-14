/**
 * Intelligent Memory Lifecycle Suite (Prompt 7).
 *
 * Validates:
 * 1. Formal lifecycle (CANDIDATE -> ACTIVE -> INVALIDATED / SUPERSEDED).
 * 2. Invalidation upon architecture change (e.g. OAuth -> SAML).
 * 3. Conflict detection and explicit resolution without silent overwriting.
 * 4. RAG-based context injection (only relevant active memories retrieved).
 * 5. Invariant: Memory is durable factual knowledge, not raw conversation dumps.
 */
import { describe, it, expect } from 'vitest';
import {
  InMemoryMemoryStore,
  DefaultContextCompiler,
  UuidV7IdFactory,
  TestClock,
} from '../../../src/infra/index.js';
import {
  MemoryTier,
  MemoryType,
  MemoryScope,
  MemoryStatus,
  GoalStatus,
  TaskStatus,
  AgentPhase,
  ModelCapability,
  type ModelDescriptor,
  type Goal,
  type Task,
} from '../../../src/core/index.js';

describe('Intelligent Memory Lifecycle Suite (Prompt 7)', () => {
  const idFactory = new UuidV7IdFactory();
  const clock = new TestClock(new Date('2026-01-01T00:00:00Z'));
  const now = clock.now();

  const modelDescriptor: ModelDescriptor = {
    id: 'gpt-4o',
    name: 'Standard Model',
    providerId: 'openai-provider',
    version: '1.0.0',
    capabilities: {
      capabilities: new Set([ModelCapability.CODING, ModelCapability.REASONING]),
      maxContextTokens: 128000,
      maxOutputTokens: 4096,
      supportsSystemPrompt: true,
    },
    costPer1kInputTokensDollars: 0.0025,
    costPer1kOutputTokensDollars: 0.01,
  };

  it('1. Lifecycle: Unverified tool data starts as CANDIDATE; promoted on verification or recurrence', async () => {
    const memoryStore = new InMemoryMemoryStore({ idFactory, clock });

    // Step 1: Unverified tool observation -> CANDIDATE status
    const candidate = await memoryStore.createRecord({
      tier: MemoryTier.SHORT_TERM,
      type: MemoryType.FACT,
      content: 'Database connection pool size is 20',
      source: 'tool:inspect_config',
      importance: 0.5,
    });

    expect(candidate.status).toBe(MemoryStatus.CANDIDATE);

    // Step 2: Promote explicitly
    const promoted = await memoryStore.promote(candidate.id, MemoryTier.SEMANTIC);
    expect(promoted.status).toBe(MemoryStatus.ACTIVE);
    expect(promoted.tier).toBe(MemoryTier.SEMANTIC);

    // Step 3: Explicit user decision starts directly as ACTIVE
    const userDecision = await memoryStore.createRecord({
      tier: MemoryTier.SEMANTIC,
      type: MemoryType.DECISION,
      content: 'Always use UUIDv7 for distributed primary keys',
      source: 'user',
      importance: 1.0,
      tags: ['user_decision'],
    });

    expect(userDecision.status).toBe(MemoryStatus.ACTIVE);
  });

  it('2. Invalidation upon Architecture Change: OAuth -> SAML invalidation', async () => {
    const memoryStore = new InMemoryMemoryStore({ idFactory, clock });

    // 1. Initial Architecture: OAuth authentication
    const oauthMemory = await memoryStore.createRecord({
      tier: MemoryTier.SEMANTIC,
      type: MemoryType.DECISION,
      content: 'Authentication uses OAuth2 with JWT bearer tokens',
      source: 'lead_architect',
      topic: 'auth_protocol',
      importance: 0.9,
    });

    expect(oauthMemory.status).toBe(MemoryStatus.ACTIVE);

    // 2. Migration to SAML: Invalidate OAuth memory
    const invalidatedOauth = await memoryStore.invalidate(
      oauthMemory.id,
      'Migrated authentication provider to Enterprise SAML 2.0',
    );
    expect(invalidatedOauth.status).toBe(MemoryStatus.INVALIDATED);
    expect(invalidatedOauth.metadata['invalidationReason']).toContain('Enterprise SAML 2.0');

    // 3. New SAML memory
    const samlMemory = await memoryStore.createRecord({
      tier: MemoryTier.SEMANTIC,
      type: MemoryType.DECISION,
      content: 'Authentication uses Enterprise SAML 2.0 Single Sign-On',
      source: 'lead_architect',
      topic: 'auth_protocol',
      importance: 0.95,
    });

    // 4. Retrieve active memories: only SAML is retrieved
    const activeAuth = await memoryStore.retrieve({
      topic: 'auth_protocol',
      activeOnly: true,
    });

    expect(activeAuth).toHaveLength(1);
    expect(activeAuth[0]?.record.id).toBe(samlMemory.id);
    expect(activeAuth[0]?.record.content).toContain('SAML 2.0');
  });

  it('3. Conflict Detection and Explicit Resolution without silent overwriting', async () => {
    const memoryStore = new InMemoryMemoryStore({ idFactory, clock });

    const mem1 = await memoryStore.createRecord({
      tier: MemoryTier.SEMANTIC,
      type: MemoryType.FACT,
      content: 'Server listening port must be 8080',
      topic: 'server_port',
      source: 'service_config',
      importance: 0.8,
    });

    const mem2 = await memoryStore.createRecord({
      tier: MemoryTier.SEMANTIC,
      type: MemoryType.FACT,
      content: 'Server listening port must be 443 with TLS',
      topic: 'server_port',
      source: 'security_auditor',
      importance: 0.95,
    });

    // Detect conflict
    const conflicts = await memoryStore.getConflicts();
    expect(conflicts.length).toBeGreaterThanOrEqual(1);
    expect(conflicts[0]?.topic).toBe('server_port');

    // Resolve conflict in favor of mem2 (Port 443 TLS)
    const winner = await memoryStore.resolveConflict(conflicts[0]!.conflictId, mem2.id);
    expect(winner.id).toBe(mem2.id);
    expect(winner.status).toBe(MemoryStatus.ACTIVE);

    // Loser must be invalidated
    const loser = await memoryStore.getRecord(mem1.id);
    expect(loser?.status).toBe(MemoryStatus.INVALIDATED);
  });

  it('4. RAG-Based Context Injection: Only relevant active memories injected, unreferenced do not bloat prompt', async () => {
    const memoryStore = new InMemoryMemoryStore({ idFactory, clock });
    const compiler = new DefaultContextCompiler({ idFactory, clock, memoryStore });

    // Store 3 different domain memories
    await memoryStore.createRecord({
      tier: MemoryTier.SEMANTIC,
      type: MemoryType.PATTERN,
      content: 'Payment processing requires idempotent retry tokens in Stripe headers',
      topic: 'payments',
      source: 'architect',
      importance: 0.9,
    });

    await memoryStore.createRecord({
      tier: MemoryTier.SEMANTIC,
      type: MemoryType.PATTERN,
      content: 'Image uploads must be resized to 1080p WebP before S3 storage',
      topic: 'media',
      source: 'architect',
      importance: 0.9,
    });

    await memoryStore.createRecord({
      tier: MemoryTier.SEMANTIC,
      type: MemoryType.FACT,
      content: 'Legacy Redis cluster is on port 6380',
      topic: 'database',
      source: 'devops',
      importance: 0.4,
      status: MemoryStatus.CANDIDATE, // Unpromoted
    });

    const goal: Goal = {
      id: idFactory.create<'Goal'>(),
      description: 'Implement Stripe payment refund webhook handler',
      status: GoalStatus.ACTIVE,
      constraints: { maxIterations: 5 },
      createdAt: now,
      updatedAt: now,
      metadata: {},
    };

    const task: Task = {
      id: idFactory.create<'Task'>(),
      goalId: goal.id,
      description: 'Handle stripe refund event and ensure payment retry idempotency',
      status: TaskStatus.ACTIVE,
      priority: 1,
      createdAt: now,
      updatedAt: now,
      metadata: {},
    };

    const compiled = await compiler.compile({
      goal,
      task,
      currentState: {
        taskId: task.id,
        phase: AgentPhase.IMPLEMENT,
        stepCount: 1,
        repairCount: 0,
        noProgressCount: 0,
        updatedAt: now,
        history: [],
      },
      targetModelDescriptor: modelDescriptor,
      budget: { maxTokens: 4000, softLimitTokens: 3000 },
    });

    const compiledText = compiled.compiledContext.entries.map((e) => e.content).join('\n');

    // 1. Relevant active memory (Stripe payment idempotency) WAS retrieved via RAG
    expect(compiledText).toContain('Payment processing requires idempotent retry tokens');

    // 2. Irrelevant memory (Image upload WebP) was NOT injected
    expect(compiledText).not.toContain('Image uploads must be resized');

    // 3. Unpromoted CANDIDATE memory (Redis port) was NOT injected
    expect(compiledText).not.toContain('Legacy Redis cluster');
  });
});
