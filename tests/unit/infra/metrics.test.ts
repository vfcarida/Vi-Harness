import { describe, it, expect } from 'vitest';
import { InMemoryMetricsCollector } from '../../../src/infra/metrics/in-memory-metrics-collector.js';

describe('InMemoryMetricsCollector', () => {
  it('should record requests and aggregate metrics per provider and overall', () => {
    const collector = new InMemoryMetricsCollector();

    // Provider A requests
    collector.recordRequest({
      providerId: 'provider-a',
      modelId: 'gpt-4o',
      latencyMs: 100,
      usage: { inputTokens: 50, outputTokens: 20, totalTokens: 70 },
      costDollars: 0.005,
      success: true,
      attempts: 1,
    });

    collector.recordRequest({
      providerId: 'provider-a',
      modelId: 'gpt-4o',
      latencyMs: 200,
      usage: { inputTokens: 100, outputTokens: 40, totalTokens: 140 },
      costDollars: 0.01,
      success: false,
      attempts: 3, // 2 retries
    });

    // Provider B request
    collector.recordRequest({
      providerId: 'provider-b',
      modelId: 'claude-3-5-sonnet',
      latencyMs: 150,
      usage: { inputTokens: 30, outputTokens: 30, totalTokens: 60 },
      costDollars: 0.004,
      success: true,
      attempts: 1,
    });

    // Verify Provider A summary
    const summaryA = collector.getMetrics('provider-a');
    expect(summaryA.totalRequests).toBe(2);
    expect(summaryA.successfulRequests).toBe(1);
    expect(summaryA.failedRequests).toBe(1);
    expect(summaryA.totalTokens).toBe(210);
    expect(summaryA.totalCostDollars).toBeCloseTo(0.015);
    expect(summaryA.averageLatencyMs).toBe(150);
    expect(summaryA.totalRetries).toBe(2);

    // Verify Overall summary
    const overall = collector.getMetrics();
    expect(overall.providerId).toBe('all');
    expect(overall.totalRequests).toBe(3);
    expect(overall.successfulRequests).toBe(2);
    expect(overall.failedRequests).toBe(1);
    expect(overall.totalTokens).toBe(270);
    expect(overall.totalCostDollars).toBeCloseTo(0.019);
    expect(overall.averageLatencyMs).toBe(150);
    expect(overall.totalRetries).toBe(2);
  });

  it('should reset metrics on reset()', () => {
    const collector = new InMemoryMetricsCollector();
    collector.recordRequest({
      providerId: 'prov',
      modelId: 'm',
      latencyMs: 10,
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      costDollars: 0.001,
      success: true,
      attempts: 1,
    });

    collector.reset();
    const summary = collector.getMetrics('prov');
    expect(summary.totalRequests).toBe(0);
    expect(summary.totalTokens).toBe(0);
  });
});
