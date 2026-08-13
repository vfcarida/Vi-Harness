import { describe, it, expect, beforeEach } from 'vitest';
import {
  DefaultCostTracker,
  DefaultBudgetTracker,
  DefaultTelemetryCollector,
  UuidV7IdFactory,
  TestClock,
} from '../../../src/infra/index.js';
import type { TaskId } from '../../../src/core/index.js';

describe('Observability, Telemetry and Cost Layer', () => {
  let costTracker: DefaultCostTracker;
  let budgetTracker: DefaultBudgetTracker;
  let telemetryCollector: DefaultTelemetryCollector;
  let idFactory: UuidV7IdFactory;
  let clock: TestClock;
  let taskId: TaskId;

  beforeEach(() => {
    idFactory = new UuidV7IdFactory();
    clock = new TestClock(new Date('2024-01-01T00:00:00Z'));
    taskId = idFactory.create<'Task'>();

    costTracker = new DefaultCostTracker();
    budgetTracker = new DefaultBudgetTracker();
    telemetryCollector = new DefaultTelemetryCollector({ idFactory, clock });
  });

  it('should emit and aggregate operational metrics across agent, model, context, tool, and verification', () => {
    const traceId = telemetryCollector.startTrace(taskId);

    telemetryCollector.recordSpan(traceId, {
      id: 'span-1',
      name: 'model-invocation',
      startTime: clock.now(),
      attributes: { model: 'gpt-4o' },
      status: 'OK',
    });

    telemetryCollector.recordAgentTask(true, 4, 'GOAL_ACHIEVED');
    telemetryCollector.recordModelInvocation({
      provider: 'openai',
      model: 'gpt-4o',
      inputTokens: 1000,
      outputTokens: 500,
      latencyMs: 320,
      cost: 0.0075,
      retries: 0,
      failures: 0,
    });

    telemetryCollector.recordContextCompilation({
      contextSize: 5000,
      compressedSize: 2000,
      compressionRatio: 0.4,
      retrievalCount: 10,
      omittedObjects: 2,
      compilerLatencyMs: 15,
    });

    telemetryCollector.recordToolExecution(45, true);
    telemetryCollector.recordVerificationOutcome(true, false, false);

    const aggregated = telemetryCollector.getAggregatedTelemetry();

    expect(aggregated.agent.taskCount).toBe(1);
    expect(aggregated.agent.successRate).toBe(1.0);
    expect(aggregated.agent.averageIterations).toBe(4);
    expect(aggregated.models).toHaveLength(1);
    expect(aggregated.totalCostUSD).toBe(0.0075);
    expect(aggregated.context.compressionRatio).toBe(0.4);
    expect(aggregated.tool.totalCalls).toBe(1);
    expect(aggregated.verification.passRate).toBe(1.0);
  });

  it('should perform cost accounting based on prompt and completion token prices', () => {
    // Registered pricing for claude-3-5-sonnet: $3.00/M prompt, $15.00/M completion
    const estimate = costTracker.calculateCost('anthropic', 'claude-3-5-sonnet', 100_000, 10_000);

    expect(estimate.hasPricing).toBe(true);
    // (100,000 / 1,000,000)*3.00 + (10,000 / 1,000,000)*15.00 = 0.30 + 0.15 = 0.45
    expect(estimate.estimatedCostUSD).toBeCloseTo(0.45, 4);

    costTracker.recordCost(taskId, 'anthropic', 'claude-3-5-sonnet', estimate.estimatedCostUSD);
    expect(costTracker.getTotalCost(taskId)).toBeCloseTo(0.45, 4);
  });

  it('should handle missing pricing and providers without cost data gracefully without errors', () => {
    // Custom unknown open-weight model with no pricing registered
    const estimate = costTracker.calculateCost('ollama', 'llama-3-8b-custom', 50_000, 5_000);

    expect(estimate.hasPricing).toBe(false);
    expect(estimate.estimatedCostUSD).toBe(0.0);
  });

  it('should accept actual cost data overrides when provided', () => {
    const estimate = costTracker.calculateCost('custom-vendor', 'custom-model', 1000, 1000, 0.05);

    expect(estimate.hasPricing).toBe(true);
    expect(estimate.estimatedCostUSD).toBe(0.05);
    expect(estimate.actualCostUSD).toBe(0.05);
  });

  it('should enforce task budget limits and issue warnings when threshold is reached', () => {
    budgetTracker.setTaskBudget(taskId, 1.0); // $1.00 budget

    // Record initial usage of $0.70
    budgetTracker.recordUsage(taskId, 'gpt-4o', 0.7);

    // Test additional cost of $0.15 (total $0.85 -> 85% reaches 80% warning threshold)
    const warningCheck = budgetTracker.checkBudget(taskId, 'gpt-4o', 0.15);
    expect(warningCheck.allowed).toBe(true);
    expect(warningCheck.warning).toBe(true);
    expect(warningCheck.warningMessage).toContain('warning');

    // Test additional cost of $0.40 (total $1.10 -> exceeds $1.00 task budget)
    const exceedCheck = budgetTracker.checkBudget(taskId, 'gpt-4o', 0.4);
    expect(exceedCheck.allowed).toBe(false);
    expect(exceedCheck.errorMessage).toContain('Task budget limit');
  });

  it('should enforce model budget limits per model ID', () => {
    const modelId = 'claude-3-5-sonnet';
    budgetTracker.setModelBudget(modelId, 5.0); // $5.00 limit for model

    budgetTracker.recordUsage(taskId, modelId, 4.0);

    const exceedCheck = budgetTracker.checkBudget(taskId, modelId, 2.0); // Total $6.00 > $5.00
    expect(exceedCheck.allowed).toBe(false);
    expect(exceedCheck.errorMessage).toContain('Model [claude-3-5-sonnet] budget limit');
  });
});
