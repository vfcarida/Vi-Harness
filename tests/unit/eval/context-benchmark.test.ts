/**
 * Context Efficiency Benchmark Unit Tests.
 *
 * Validates:
 * 1. Trajectory generation across 10, 25, 50, 100 iterations with injections
 * 2. Critical Memory survival verification
 * 3. Strategy comparisons: Naive Accumulation vs Pi Compaction vs Vi-Harness Compiler
 * 4. Multi-horizon ContextBenchmarkRunner execution
 * 5. Report generation (JSON & Markdown)
 */
import { describe, it, expect } from 'vitest';
import {
  ContextTrajectoryGenerator,
  ContextBenchmarkRunner,
  ContextBenchmarkReport,
  NaiveAccumulationStrategy,
  PiCompactionStrategy,
  ViContextCompilerStrategy,
} from '../../../src/infra/index.js';

describe('Vi-Harness Context-Efficiency Benchmark Suite', { timeout: 30000 }, () => {
  it('1. Trajectory Generation: Injects repeated outputs, noise, large files, and critical memory across horizons', () => {
    for (const horizon of [10, 25, 50, 100]) {
      const trajectory = ContextTrajectoryGenerator.generateTrajectory(horizon);
      expect(trajectory.length).toBeGreaterThan(horizon);

      const criticalItems = ContextTrajectoryGenerator.getInjectedCriticalItems(horizon);
      expect(criticalItems.length).toBeGreaterThan(0);

      // Verify categories present in long horizons
      const categories = new Set(trajectory.map((s) => s.category));
      expect(categories.has('CRITICAL_MEMORY')).toBe(true);
      expect(categories.has('REPEATED_TOOL_OUTPUT')).toBe(true);
      expect(categories.has('IRRELEVANT_LOGS')).toBe(true);
      expect(categories.has('STALE_HYPOTHESIS')).toBe(true);
      expect(categories.has('LARGE_FILE')).toBe(true);
      expect(categories.has('REGULAR_STEP')).toBe(true);
    }
  });

  it('2. Critical Memory Survival: Invariant definitions retain valid verification patterns', () => {
    const items = ContextTrajectoryGenerator.CANONICAL_CRITICAL_ITEMS;
    expect(items.length).toBe(5);

    for (const item of items) {
      expect(item.id).toBeDefined();
      expect(item.factKey).toBeDefined();
      expect(item.content).toContain(item.expectedPattern);
      expect(item.injectedIteration).toBeGreaterThan(0);
    }
  });

  it('3. Strategy Comparison on 25-Horizon: Measures context tokens and retention rates', async () => {
    const horizon = 25;
    const trajectory = ContextTrajectoryGenerator.generateTrajectory(horizon);
    const criticalItems = ContextTrajectoryGenerator.getInjectedCriticalItems(horizon);

    const naive = new NaiveAccumulationStrategy();
    const pi = new PiCompactionStrategy();
    const vi = new ViContextCompilerStrategy();

    naive.reset();
    pi.reset();
    vi.reset();

    for (const step of trajectory) {
      await naive.processStep(step);
      await pi.processStep(step);
      await vi.processStep(step);
    }

    const naiveRetention = naive.evaluateRetention(criticalItems);
    const piRetention = pi.evaluateRetention(criticalItems);
    const viRetention = vi.evaluateRetention(criticalItems);

    // Vi-Harness achieves 100% critical memory retention
    expect(viRetention.retentionRate).toBe(1.0);
    expect(viRetention.retainedCount).toBe(criticalItems.length);

    // Pi Compaction loses critical facts over time
    expect(piRetention.retentionRate).toBeLessThan(1.0);

    // Naive Accumulation context size is significantly larger than Vi-Harness
    const naiveTokens = naive.evaluateRetention(criticalItems);
    const viContext = vi.getCurrentContextText();
    const naiveContext = naive.getCurrentContextText();
    expect(viContext.length).toBeLessThan(naiveContext.length);
  });

  it('4. Context Benchmark Runner Suite Execution: Compares all 3 strategies across 10, 25, 50, 100 horizons', async () => {
    const runner = new ContextBenchmarkRunner();
    const result = await runner.runSuite({
      horizons: [10, 25, 50, 100],
    });

    expect(result.suiteId).toBe('context-efficiency-suite-v1');
    expect(result.horizons).toEqual([10, 25, 50, 100]);

    for (const horizon of [10, 25, 50, 100]) {
      const comp = result.comparisonsByHorizon[horizon];
      expect(comp).toBeDefined();

      const naive = comp.strategyResults['NAIVE_ACCUMULATION'];
      const pi = comp.strategyResults['PI_COMPACTION'];
      const vi = comp.strategyResults['VI_CONTEXT_COMPILER'];

      // Vi-Harness cumulative tokens are lower than Naive Accumulation
      expect(vi.totalCumulativeTokens).toBeLessThan(naive.totalCumulativeTokens);
      expect(comp.viVsNaiveTokenSavingsPercent).toBeGreaterThan(0);

      // Vi-Harness has 100% retention on all horizons
      expect(vi.criticalMemoryRetentionScore).toBe(1.0);
      expect(vi.taskSuccess).toBe(true);

      // Verify measurements curve points exist
      expect(vi.measurements).toHaveLength(horizon);
      expect(naive.measurements).toHaveLength(horizon);
      expect(pi.measurements).toHaveLength(horizon);
    }

    // Overall summary metrics
    expect(result.executiveSummary.overallViVsNaiveSavingsPercent).toBeGreaterThan(40);
    expect(result.executiveSummary.overallViRetentionRate).toBe(1.0);
  });

  it('5. Report Generation: Produces valid JSON and formatted Markdown with curves and tables', async () => {
    const runner = new ContextBenchmarkRunner();
    const result = await runner.runSuite({
      horizons: [10, 25],
    });

    const json = ContextBenchmarkReport.generateJson(result);
    expect(typeof json).toBe('string');
    const parsed = JSON.parse(json);
    expect(parsed.suiteId).toBe(result.suiteId);
    expect(parsed.comparisonsByHorizon['10']).toBeDefined();
    expect(parsed.comparisonsByHorizon['25']).toBeDefined();

    const md = ContextBenchmarkReport.generateMarkdown(result);
    expect(md).toContain('Vi-Harness Context-Efficiency & Bloat Elimination Benchmark');
    expect(md).toContain('Executive Comparison Summary');
    expect(md).toContain('Critical Memory Survival & Retention Analysis');
    expect(md).toContain('CM-001');
    expect(md).toContain('CM-002');
  });
});
