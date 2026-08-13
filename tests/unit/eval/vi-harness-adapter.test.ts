/**
 * ViHarness Adapter Contract & Compatibility Unit Tests.
 *
 * Verifies that the ViHarness adapter satisfies the Pi replacement benchmark contract:
 * - Translates Benchmark Task -> Vi Goal -> Vi Execution -> Pi Benchmark Result
 * - Exposes success, finalState, changedFiles, finalDiff, tests, iterations, modelCalls, tokens, estimatedCost, duration, terminationReason
 * - Strictly hides internal Vi-Harness domain objects behind the adapter boundary
 * - Acts as a drop-in replacement for PiHarness in coding-agent benchmarks
 */
import { describe, it, expect } from 'vitest';
import {
  ViHarness,
  ScriptedModelProvider,
  UuidV7IdFactory,
  TestClock,
  type PiBenchmarkTask,
} from '../../../src/index.js';

describe('ViHarness Pi-Replacement Compatibility Adapter Contract', () => {
  it('1. Interface Contract & Drop-in Substitution: Executes task and returns valid PiBenchmarkResult', async () => {
    const idFactory = new UuidV7IdFactory();
    const clock = new TestClock(new Date('2026-08-13T12:00:00Z'));

    const scriptedProvider = new ScriptedModelProvider({
      providerId: 'scripted-provider',
      steps: [
        {
          content: 'Reasoning: Plan to fix bug',
          toolCalls: [
            {
              id: 'call_1',
              name: 'write_file',
              input: { path: 'src/fix.js', content: 'console.log("fixed");' },
            },
          ],
        },
      ],
    });

    const harness = new ViHarness({
      primaryProvider: scriptedProvider,
      idFactory,
      clock,
    });

    const benchmarkTask: PiBenchmarkTask = {
      id: 'task-bench-101',
      name: 'Fix Login Bug',
      description: 'Fix null pointer crash during user login flow',
      maxCostUSD: 2.5,
      maxTokens: 25000,
      maxIterations: 5,
      maxDurationMs: 60000,
      requiredTools: ['write_file', 'read_file'],
    };

    const result = await harness.runTask(benchmarkTask);

    // Verify mandatory benchmark result fields
    expect(result).toBeDefined();
    expect(result.taskId).toBe('task-bench-101');
    expect(typeof result.success).toBe('boolean');
    expect(typeof result.finalState).toBe('string');
    expect(Array.isArray(result.changedFiles)).toBe(true);
    expect(typeof result.finalDiff).toBe('string');
    expect(result.tests).toBeDefined();
    expect(typeof result.tests.total).toBe('number');
    expect(typeof result.tests.passed).toBe('number');
    expect(typeof result.tests.failed).toBe('number');
    expect(typeof result.tests.passRate).toBe('number');

    expect(typeof result.iterations).toBe('number');
    expect(result.iterations).toBeGreaterThan(0);
    expect(typeof result.modelCalls).toBe('number');
    expect(result.modelCalls).toBeGreaterThan(0);

    expect(result.tokens).toBeDefined();
    expect(typeof result.tokens.promptTokens).toBe('number');
    expect(typeof result.tokens.completionTokens).toBe('number');
    expect(typeof result.tokens.totalTokens).toBe('number');

    expect(typeof result.estimatedCost).toBe('number');
    expect(typeof result.duration).toBe('number');
    expect(typeof result.terminationReason).toBe('string');
  });

  it('2. Changed Files & Diff Extraction: Captures agent file modifications and diff summaries', async () => {
    const idFactory = new UuidV7IdFactory();
    const clock = new TestClock(new Date('2026-08-13T12:00:00Z'));

    const scriptedProvider = new ScriptedModelProvider({
      providerId: 'scripted-provider',
      steps: [
        {
          content: 'Modifying login handler',
          toolCalls: [
            {
              id: 'call_write',
              name: 'write_file',
              input: { path: 'src/auth/login.ts', content: 'export function login() { return true; }' },
            },
          ],
        },
      ],
    });

    const harness = new ViHarness({
      primaryProvider: scriptedProvider,
      idFactory,
      clock,
    });

    const task: PiBenchmarkTask = {
      id: 'task-diff-test',
      description: 'Refactor login auth method',
    };

    const result = await harness.executeTask(task);

    expect(result.changedFiles).toContain('src/auth/login.ts');
    expect(result.finalDiff).toContain('src/auth/login.ts');
  });

  it('3. Alias Methods Support: Supports executeTask and execute aliases for benchmark runners', async () => {
    const idFactory = new UuidV7IdFactory();
    const clock = new TestClock(new Date('2026-08-13T12:00:00Z'));

    const harness = new ViHarness({
      idFactory,
      clock,
    });

    const task: PiBenchmarkTask = {
      id: 'task-alias-test',
      description: 'Alias invocation verification',
    };

    const res1 = await harness.runTask(task);
    const res2 = await harness.executeTask(task);
    const res3 = await harness.execute(task);

    expect(res1.taskId).toBe('task-alias-test');
    expect(res2.taskId).toBe('task-alias-test');
    expect(res3.taskId).toBe('task-alias-test');
  });

  it('4. Information Hiding Boundary: Does NOT leak internal Vi state handles in PiBenchmarkResult', async () => {
    const idFactory = new UuidV7IdFactory();
    const clock = new TestClock(new Date('2026-08-13T12:00:00Z'));

    const harness = new ViHarness({
      idFactory,
      clock,
    });

    const task: PiBenchmarkTask = {
      id: 'task-hiding-test',
      description: 'Ensure internal Vi state handles are hidden',
    };

    const result = await harness.runTask(task) as any;

    // Verify internal state machine / runtime / context graph handles are NOT exposed
    expect(result.stateMachine).toBeUndefined();
    expect(result.contextCompiler).toBeUndefined();
    expect(result.eventStore).toBeUndefined();
    expect(result.evidenceStore).toBeUndefined();
    expect(result.policyEngine).toBeUndefined();
  });
});
