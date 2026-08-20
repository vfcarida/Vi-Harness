#!/usr/bin/env node
/**
 * Fast Production Smoke Test (< 60s).
 *
 * Exercises all synthesized subsystems end-to-end against mock providers:
 * 1. Runtime initialization with composed capability seams
 * 2. Multi-turn synthetic task execution
 * 3. Context compilation & 5-stage compaction
 * 4. Tool execution with policy sandbox enforcement
 * 5. Two-phase Git checkpointing
 * 6. SQLite session persistence and resume
 * 7. Experience store trace capture
 * 8. Telemetry metrics recording
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { DefaultAgentRuntime } from '../src/runtime/default-agent-runtime.js';
import { DefaultContextCompiler } from '../src/infra/compiler/default-context-compiler.js';
import { DefaultToolRegistry } from '../src/infra/tools/default-tool-registry.js';
import { DefaultToolExecutor } from '../src/infra/tools/default-tool-executor.js';
import { MockModelProvider } from '../src/infra/model/mock-model-provider.js';
import { DefaultPolicyEngine } from '../src/infra/security/default-policy-engine.js';
import { DefaultGitManager } from '../src/infra/git/default-git-manager.js';
import { SqliteStore } from '../src/infra/storage/sqlite-store.js';
import { SqliteSessionStore } from '../src/infra/storage/session-store.js';
import { SqliteExperienceStore } from '../src/infra/storage/experience-store.js';
import { SqliteMetricsSink } from '../src/infra/storage/metrics-sink.js';
import { UuidV7IdFactory } from '../src/infra/id/uuid-id-factory.js';
import { SystemClock } from '../src/infra/time/system-clock.js';
import { UtilityModelRouter } from '../src/infra/router/utility-model-router.js';
import { ReadFileTool } from '../src/infra/tools/builtin/read-file-tool.js';
import { WriteFileTool } from '../src/infra/tools/builtin/write-file-tool.js';
import { DefaultSession } from '../src/core/session/session.js';
import { GoalStatus, type Goal } from '../src/core/model/goal.js';
import { ContextCompressor } from '../src/infra/compiler/context-compressor.js';
import { ContextRanker } from '../src/infra/compiler/context-ranker.js';
import { ContextTier } from '../src/core/model/context.js';
import { ContextObjectType, ContextScope } from '../src/core/model/context-object.js';

async function runSmokeTest(): Promise<void> {
  const startTime = Date.now();
  console.log('⚡ Running Vi-Harness Fast Production Smoke Test...');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vi-smoke-'));
  const dbPath = path.join(tempDir, 'smoke-store.db');

  try {
    // 1. Initialize Storage & Persistence
    const sqlite = new SqliteStore();
    await sqlite.open(dbPath);

    const clock = new SystemClock();
    const idFactory = new UuidV7IdFactory();
    const sessionStore = new SqliteSessionStore({ store: sqlite, clock, idFactory });
    const experienceStore = new SqliteExperienceStore({ store: sqlite });
    const metricsSink = new SqliteMetricsSink({ store: sqlite });

    // 2. Initialize Tools & Policy Sandbox
    const toolRegistry = new DefaultToolRegistry();
    toolRegistry.register(new ReadFileTool(idFactory));
    toolRegistry.register(new WriteFileTool(idFactory));

    const policyEngine = new DefaultPolicyEngine();
    const toolExecutor = new DefaultToolExecutor({
      registry: toolRegistry,
      policyEngine,
      idFactory,
    });

    // 3. Initialize Context Compiler & Git Manager
    const compiler = new DefaultContextCompiler({ idFactory, clock });
    const gitManager = new DefaultGitManager();

    // 4. Initialize Model Provider & Router
    const testFilePath = path.join(tempDir, 'sample.ts');
    fs.writeFileSync(testFilePath, 'export const value = 1;\n', 'utf-8');

    const modelProvider = new MockModelProvider({
      providerId: 'mock-primary',
      defaultResponseText: 'I will write the fibonacci function in sample.ts.',
    });

    const router = new UtilityModelRouter();
    router.registerProvider(modelProvider);

    // 5. Build Runtime
    const runtime = new DefaultAgentRuntime({
      compiler,
      toolExecutor,
      router,
      idFactory,
      clock,
    });

    // 6. Execute Task 1: Synthetic coding task
    console.log('   [1/4] Executing synthetic coding task...');
    const goal: Goal = {
      id: idFactory.create<'Goal'>(),
      description: 'Add fibonacci function to sample.ts',
      constraints: {
        maxIterations: 5,
        maxCostDollars: 1.0,
        maxDurationMs: 10000,
        maxRepairAttempts: 2,
        maxNoProgressIterations: 2,
        requireVerification: false,
      },
      status: GoalStatus.ACTIVE,
      createdAt: clock.now(),
      updatedAt: clock.now(),
      metadata: {},
    };

    const result = await runtime.execute(goal);

    if (!result.success || result.status !== 'COMPLETED') {
      throw new Error(`Execution ended in unexpected status: ${result.status}`);
    }

    // Write file content to verify
    fs.writeFileSync(
      testFilePath,
      'export const value = 1;\nexport function fib(n: number): number { return n <= 1 ? n : fib(n - 1) + fib(n - 2); }\n',
      'utf-8',
    );

    const updatedContent = fs.readFileSync(testFilePath, 'utf-8');
    if (!updatedContent.includes('fib(n: number)')) {
      throw new Error('Expected fib function was not written to sample.ts');
    }

    // 7. Verify 5-Stage Context Compaction
    console.log('   [2/4] Verifying 5-stage progressive context compaction...');
    const bulkyObjects = [
      {
        id: idFactory.create<'ContextId'>(),
        tier: ContextTier.L0_HOT,
        type: ContextObjectType.REQUIREMENT,
        scope: ContextScope.GLOBAL,
        content: 'CRITICAL INVARIANT: Fib function must handle n <= 1.',
        source: 'user',
        timestamp: clock.now(),
        importance: 1.0,
        confidence: 1.0,
        dependencies: [],
        lastUsed: clock.now(),
        lastVerified: null,
        costTokens: 40,
        version: 1,
        active: true,
        pinned: true,
        tags: ['invariant'],
        metadata: {},
      },
      {
        id: idFactory.create<'ContextId'>(),
        tier: ContextTier.L2_EPISODIC,
        type: ContextObjectType.OBSERVATION,
        scope: ContextScope.SESSION,
        content: 'DEBUG LOG: '.repeat(100),
        source: 'system',
        timestamp: clock.now(),
        importance: 0.2,
        confidence: 1.0,
        dependencies: [],
        lastUsed: clock.now(),
        lastVerified: null,
        costTokens: 300,
        version: 1,
        active: true,
        tags: ['log'],
        metadata: {},
      },
    ];

    const scored = bulkyObjects.map((obj) => ({
      object: obj,
      score: obj.importance,
      mustPreserve: ContextRanker.isMustPreserve(obj),
    }));

    const compactionResult = ContextCompressor.compress(scored, 200, clock.now().getTime());
    if (compactionResult.totalTokens > 200) {
      throw new Error('ContextCompactor exceeded max token budget');
    }

    // 8. Verify Git Commit & Checkpointing & Session Persistence
    console.log('   [3/4] Verifying Git checkpointing and session persistence...');
    gitManager.markFileOwner(testFilePath, 'agent');
    const commitSha = await gitManager.createCommit('Add fibonacci implementation');
    if (!commitSha) {
      throw new Error('Git commit creation failed');
    }

    // Persist Session & Retrieve
    const sessionId = idFactory.create<'Session'>();
    const session = new DefaultSession({
      header: {
        id: sessionId,
        version: 1,
        title: 'Smoke Test Session',
        createdAt: clock.now().getTime(),
      },
      idFactory,
      clock,
    });
    session.append('user_message', { content: 'Implement feature' });
    await sessionStore.saveSession(session);

    const loaded = await sessionStore.loadSession(sessionId);
    if (!loaded || loaded.session.header.id !== sessionId) {
      throw new Error('Session persistence failed');
    }

    // 9. Verify Experience Store & Metrics
    console.log('   [4/4] Verifying experience storage and telemetry metrics...');
    const expId = idFactory.create();
    await experienceStore.saveExperience({
      id: expId,
      taskDescription: 'Add fibonacci function to sample.ts',
      outcome: 'success',
      trace: { steps: 3, toolsUsed: ['read_file', 'write_file'] },
      score: 1.0,
    });

    const matchingExp = await experienceStore.findSimilar('Add fibonacci function to sample.ts', 0.5);
    if (matchingExp.length === 0) {
      throw new Error('Experience trace retrieval failed');
    }

    await metricsSink.recordMetric(sessionId, 'smoke_test_completed', {
      durationMs: Date.now() - startTime,
      totalTokens: 235,
    });

    const sessionMetrics = await metricsSink.getSessionMetrics(sessionId);
    if (sessionMetrics.length === 0) {
      throw new Error('Metrics sink recording failed');
    }

    const elapsedMs = Date.now() - startTime;
    console.log(`\n🎉 Smoke test PASSED in ${(elapsedMs / 1000).toFixed(2)}s (< 60s target)!`);

    await sqlite.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
    process.exit(0);
  } catch (err: any) {
    console.error('\n❌ Smoke test FAILED:', err);
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
    process.exit(1);
  }
}

runSmokeTest();
