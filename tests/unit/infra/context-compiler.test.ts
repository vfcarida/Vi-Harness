import { describe, it, expect, beforeEach } from 'vitest';
import {
  DefaultContextCompiler,
  InMemoryContextStore,
  UuidV7IdFactory,
  TestClock,
} from '../../../src/infra/index.js';
import {
  ContextTier,
  ContextObjectType,
  ContextScope,
  AgentPhase,
  GoalStatus,
  TaskStatus,
  ModelCapability,
  HarnessError,
  ErrorCode,
} from '../../../src/core/index.js';
import type {
  Goal,
  Task,
  AgentState,
  ModelDescriptor,
  ContextObject,
  ContextCompilationRequest,
} from '../../../src/core/index.js';

describe('ContextCompiler Pipeline & Invariant Enforcement', () => {
  let compiler: DefaultContextCompiler;
  let store: InMemoryContextStore;
  let idFactory: UuidV7IdFactory;
  let clock: TestClock;

  let sampleGoal: Goal;
  let sampleTask: Task;
  let sampleState: AgentState;

  let longContextModel: ModelDescriptor;
  let smallContextModel: ModelDescriptor;

  beforeEach(() => {
    idFactory = new UuidV7IdFactory();
    clock = new TestClock(new Date('2024-01-01T00:00:00Z'));
    store = new InMemoryContextStore({ idFactory, clock });
    compiler = new DefaultContextCompiler({ idFactory, clock });

    sampleGoal = {
      id: idFactory.create<'Goal'>(),
      description: 'Build robust context compiler engine',
      constraints: {
        maxIterations: 50,
        maxCostDollars: 10.0,
        maxDurationMs: 600000,
        maxRepairAttempts: 5,
        maxNoProgressIterations: 3,
        requireVerification: true,
      },
      status: GoalStatus.ACTIVE,
      createdAt: clock.now(),
      updatedAt: clock.now(),
      metadata: {},
    };

    sampleTask = {
      id: idFactory.create<'Task'>(),
      goalId: sampleGoal.id,
      description: 'Implement progressive reduction pipeline',
      status: TaskStatus.ACTIVE,
      priority: 1,
      createdAt: clock.now(),
      updatedAt: clock.now(),
      metadata: {},
    };

    sampleState = {
      id: idFactory.create<'State'>(),
      taskId: sampleTask.id,
      phase: AgentPhase.IMPLEMENT,
      previousPhase: AgentPhase.PLAN,
      iterationId: idFactory.create<'Iteration'>(),
      iterationCount: 3,
      repairCount: 0,
      metadata: {},
      createdAt: clock.now(),
      updatedAt: clock.now(),
    };

    longContextModel = {
      id: 'gpt-4o',
      name: 'GPT-4o Long Context',
      providerId: 'openai',
      version: '1.0.0',
      capabilities: {
        capabilities: new Set([ModelCapability.LONG_CONTEXT, ModelCapability.CODING]),
        maxContextTokens: 128000,
        maxOutputTokens: 4096,
        supportsSystemPrompt: true,
      },
      costPer1kInputTokensDollars: 0.0025,
      costPer1kOutputTokensDollars: 0.01,
    };

    smallContextModel = {
      id: 'local-small-model',
      name: 'Small Local Model',
      providerId: 'local',
      version: '1.0.0',
      capabilities: {
        capabilities: new Set([ModelCapability.CODING]),
        maxContextTokens: 4096,
        maxOutputTokens: 1024,
        supportsSystemPrompt: true,
      },
      costPer1kInputTokensDollars: 0.0001,
      costPer1kOutputTokensDollars: 0.0002,
    };
  });

  it('should remove duplicate tool outputs and redundant observation logs', async () => {
    const dupContent = 'Observation: File src/main.ts contains 100 lines';
    const obj1 = await store.addObject({
      tier: ContextTier.L0_HOT,
      type: ContextObjectType.OBSERVATION,
      content: dupContent,
      source: 'tool:read',
    });

    const obj2 = await store.addObject({
      tier: ContextTier.L0_HOT,
      type: ContextObjectType.OBSERVATION,
      content: dupContent, // Exact duplicate
      source: 'tool:read',
    });

    const req: ContextCompilationRequest = {
      goal: sampleGoal,
      task: sampleTask,
      currentState: sampleState,
      relevantObjects: [obj1, obj2],
      targetModelDescriptor: longContextModel,
      budget: { maxTokens: 10000, softLimitTokens: 8000 },
      dryRun: true,
    };

    const result = await compiler.compile(req);
    expect(result.metrics.omittedCount).toBeGreaterThanOrEqual(1);

    const retainedContents = result.compiledContext.entries.map((e) => e.content);
    const count = retainedContents.filter((c) => c.includes(dupContent)).length;
    expect(count).toBe(1); // Retained exactly once
  });

  it('should NEVER discard MUST-PRESERVE invariants (user instructions, security rules, architecture facts)', async () => {
    const secRule = await store.addObject({
      tier: ContextTier.L3_REPOSITORY,
      type: ContextObjectType.SECURITY_RULE,
      content: 'SECURITY: Never expose secret API keys in logs',
      source: 'policy',
      tags: ['must_preserve'],
    });

    const archFact = await store.addObject({
      tier: ContextTier.L3_REPOSITORY,
      type: ContextObjectType.ARCHITECTURE_FACT,
      content: 'ARCHITECTURE: The agent is a stateful state machine',
      source: 'arch_doc',
    });

    // Add noise objects
    const noiseObjs: ContextObject[] = [];
    for (let i = 0; i < 20; i++) {
      const noise = await store.addObject({
        tier: ContextTier.L0_HOT,
        type: ContextObjectType.OBSERVATION,
        content: `Low importance noise log line ${i}`,
        source: 'tool:log',
        importance: 0.1,
      });
      noiseObjs.push(noise);
    }

    const req: ContextCompilationRequest = {
      goal: sampleGoal,
      task: sampleTask,
      currentState: sampleState,
      relevantObjects: [secRule, archFact, ...noiseObjs],
      targetModelDescriptor: longContextModel,
      budget: { maxTokens: 300, softLimitTokens: 250 }, // Tight budget forcing compression
      dryRun: true,
    };

    const result = await compiler.compile(req);
    const retainedIds = new Set(result.retainedObjects.map((o) => o.id));

    expect(retainedIds.has(secRule.id)).toBe(true);
    expect(retainedIds.has(archFact.id)).toBe(true);
  });

  it('should adjust projections for low-budget vs long-context models', async () => {
    const candidates: ContextObject[] = [];
    for (let i = 0; i < 15; i++) {
      const obj = await store.addObject({
        tier: ContextTier.L1_WORKING,
        type: ContextObjectType.OBSERVATION,
        content: `Observation ${i} content block`,
        source: 'agent',
        importance: 0.5,
      });
      candidates.push(obj);
    }

    // Long context request
    const longRes = await compiler.compile({
      goal: sampleGoal,
      task: sampleTask,
      currentState: sampleState,
      relevantObjects: candidates,
      targetModelDescriptor: longContextModel,
      budget: { maxTokens: 50000, softLimitTokens: 40000 },
    });

    // Small context request (tight budget)
    const smallRes = await compiler.compile({
      goal: sampleGoal,
      task: sampleTask,
      currentState: sampleState,
      relevantObjects: candidates,
      targetModelDescriptor: smallContextModel,
      budget: { maxTokens: 50, softLimitTokens: 40 },
    });

    expect(smallRes.compiledContext.totalTokenEstimate).toBeLessThan(
      longRes.compiledContext.totalTokenEstimate,
    );
  });

  it('should produce detailed dry-run explanation reports and metrics', async () => {
    const obj = await store.addObject({
      tier: ContextTier.L0_HOT,
      type: ContextObjectType.DECISION,
      content: 'Chose SQLite for deterministic persistence',
      source: 'agent',
      importance: 0.8,
    });

    const req: ContextCompilationRequest = {
      goal: sampleGoal,
      task: sampleTask,
      currentState: sampleState,
      relevantObjects: [obj],
      targetModelDescriptor: longContextModel,
      budget: { maxTokens: 10000, softLimitTokens: 8000 },
      dryRun: true,
    };

    const result = await compiler.compile(req);
    expect(result.explanation).toBeDefined();
    expect(result.explanation?.riskLevel).toBe('LOW');
    expect(result.explanation?.items.length).toBeGreaterThan(0);
    expect(result.metrics.compressionRatio).toBeGreaterThanOrEqual(0);
    expect(result.metrics.tokensBefore).toBeGreaterThan(0);
  });

  it('should verify that compilation is READ-ONLY and does NOT mutate ContextStore', async () => {
    const obj = await store.addObject({
      tier: ContextTier.L0_HOT,
      type: ContextObjectType.HYPOTHESIS,
      content: 'Original hypothesis content',
      source: 'agent',
    });

    await compiler.compile({
      goal: sampleGoal,
      task: sampleTask,
      currentState: sampleState,
      relevantObjects: [obj],
      targetModelDescriptor: longContextModel,
      budget: { maxTokens: 50, softLimitTokens: 40 }, // Forces omission
      dryRun: true,
    });

    // Verify object still exists in store unchanged
    const storeObj = await store.getObject(obj.id);
    expect(storeObj).toBeDefined();
    expect(storeObj?.content).toBe('Original hypothesis content');
    expect(storeObj?.active).toBe(true);
  });

  it('should throw CONTEXT_BUDGET_EXCEEDED if must-preserve items exceed model context window', async () => {
    const hugeMustPreserve = await store.addObject({
      tier: ContextTier.L3_REPOSITORY,
      type: ContextObjectType.USER_INSTRUCTION,
      content: 'A'.repeat(50000), // Huge instruction
      source: 'user',
      tags: ['must_preserve'],
    });

    const req: ContextCompilationRequest = {
      goal: sampleGoal,
      task: sampleTask,
      currentState: sampleState,
      relevantObjects: [hugeMustPreserve],
      targetModelDescriptor: smallContextModel, // Max context is only 4096 tokens
      budget: { maxTokens: 2000, softLimitTokens: 1500 },
    };

    await expect(compiler.compile(req)).rejects.toThrow(HarnessError);
    try {
      await compiler.compile(req);
    } catch (err) {
      const harnessErr = err as HarnessError;
      expect(harnessErr.code).toBe(ErrorCode.CONTEXT_BUDGET_EXCEEDED);
    }
  });
});
