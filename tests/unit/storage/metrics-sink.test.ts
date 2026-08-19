/**
 * SQLite Metrics Sink Unit Tests (P013).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SqliteStore } from '../../../src/infra/storage/sqlite-store.js';
import { SqliteMetricsSink } from '../../../src/infra/storage/metrics-sink.js';

describe('SQLite Metrics Sink — P013', () => {
  let store: SqliteStore;
  let metricsSink: SqliteMetricsSink;

  beforeEach(async () => {
    store = new SqliteStore(':memory:');
    await store.open();
    metricsSink = new SqliteMetricsSink({ store });
  });

  afterEach(async () => {
    await store.close();
  });

  it('1. should record and retrieve metrics for a session', async () => {
    await metricsSink.recordMetric('sess-100', 'model_call', {
      model: 'gpt-4o',
      tokens: 1200,
      costDollars: 0.005,
    });
    await metricsSink.recordMetric('sess-100', 'tool_execution', {
      tool: 'read_file',
      durationMs: 15,
    });

    const metrics = await metricsSink.getSessionMetrics('sess-100');
    expect(metrics).toHaveLength(2);
    expect(metrics[0]?.eventType).toBe('model_call');
    expect(metrics[0]?.payload['tokens']).toBe(1200);
    expect(metrics[1]?.eventType).toBe('tool_execution');
    expect(metrics[1]?.payload['tool']).toBe('read_file');
  });

  it('2. should aggregate session totals (tokens, cost, event counts)', async () => {
    await metricsSink.recordMetric('sess-agg', 'iteration_start', { iteration: 1 });
    await metricsSink.recordMetric('sess-agg', 'model_turn', { tokens: 1500, costDollars: 0.008 });
    await metricsSink.recordMetric('sess-agg', 'model_turn', { tokens: 2000, costDollars: 0.012 });
    await metricsSink.recordMetric('sess-agg', 'iteration_end', { iteration: 1 });

    const agg = await metricsSink.aggregateSessionTotals('sess-agg');
    expect(agg.sessionId).toBe('sess-agg');
    expect(agg.totalTokens).toBe(3500);
    expect(agg.totalCostDollars).toBe(0.02);
    expect(agg.eventCounts['model_turn']).toBe(2);
    expect(agg.eventCounts['iteration_start']).toBe(1);
    expect(agg.eventCounts['iteration_end']).toBe(1);
  });

  it('3. should export metrics matching query filter as valid JSON', async () => {
    await metricsSink.recordMetric('sess-export-1', 'event_a', { val: 'a' });
    await metricsSink.recordMetric('sess-export-2', 'event_b', { val: 'b' });

    const jsonStr = await metricsSink.exportMetricsJson({ sessionId: 'sess-export-1' });
    const parsed = JSON.parse(jsonStr);

    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].sessionId).toBe('sess-export-1');
    expect(parsed[0].eventType).toBe('event_a');
  });

  it('4. should handle sessions with no recorded metrics gracefully', async () => {
    const agg = await metricsSink.aggregateSessionTotals('empty-session');
    expect(agg.totalTokens).toBe(0);
    expect(agg.totalCostDollars).toBe(0);
    expect(agg.eventCounts).toEqual({});
  });

  it('5. should record global / non-session metrics with null sessionId', async () => {
    await metricsSink.recordMetric(null, 'harness_startup', { version: '0.1.0' });

    const allJson = await metricsSink.exportMetricsJson();
    const parsed = JSON.parse(allJson);

    expect(parsed.length).toBeGreaterThanOrEqual(1);
    expect(parsed[0].eventType).toBe('harness_startup');
  });

  it('6. should filter export by since timestamp', async () => {
    const base = 1000000;
    await metricsSink.recordMetric('sess-filter', 'early_event', { step: 1 }, base);
    await metricsSink.recordMetric('sess-filter', 'late_event', { step: 2 }, base + 5000);

    const filtered = await metricsSink.exportMetricsJson({ since: base + 2000 });
    const parsed = JSON.parse(filtered);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].eventType).toBe('late_event');
  });

  it('7. should track firstEventTime and lastEventTime in aggregation', async () => {
    await metricsSink.recordMetric('sess-time', 'start', {}, 1000);
    await metricsSink.recordMetric('sess-time', 'end', {}, 5000);

    const agg = await metricsSink.aggregateSessionTotals('sess-time');
    expect(agg.firstEventTime).toBe(1000);
    expect(agg.lastEventTime).toBe(5000);
  });

  it('8. should return empty array when querying metrics for unknown session', async () => {
    const metrics = await metricsSink.getSessionMetrics('unknown-session-123');
    expect(metrics).toHaveLength(0);
  });
});
