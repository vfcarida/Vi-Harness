/**
 * Model Metrics Interface.
 *
 * Provides enterprise observability over model executions:
 * - Request counts
 * - Token counts (input, output, reasoning)
 * - Latency histograms / averages
 * - Failure rates
 * - Retry counts
 * - Estimated financial cost
 */
import type { TokenUsage } from '../model/model-io.js';

export interface RecordMetricParams {
  readonly providerId: string;
  readonly modelId: string;
  readonly latencyMs: number;
  readonly usage: TokenUsage;
  readonly costDollars: number;
  readonly success: boolean;
  readonly attempts: number;
  readonly errorCategory?: string;
}

export interface ProviderMetricsSummary {
  readonly providerId: string;
  readonly totalRequests: number;
  readonly successfulRequests: number;
  readonly failedRequests: number;
  readonly totalInputTokens: number;
  readonly totalOutputTokens: number;
  readonly totalTokens: number;
  readonly totalCostDollars: number;
  readonly averageLatencyMs: number;
  readonly totalRetries: number;
}

export interface ModelMetricsCollector {
  /** Record a completed or failed model invocation. */
  recordRequest(params: RecordMetricParams): void;

  /** Get aggregated metrics summary for a provider, or overall if omitted. */
  getMetrics(providerId?: string): ProviderMetricsSummary;

  /** Reset collected metrics. */
  reset(): void;
}
