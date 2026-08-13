/**
 * CostTracker Interface.
 *
 * Tracks financial costs per task and model, calculating estimates and handling
 * missing pricing or provider without cost data gracefully.
 */
import type { TaskId } from '../types/identifiers.js';
import type { ModelPricing, CostEstimate } from '../model/cost-types.js';

export interface CostTracker {
  /** Calculate estimated cost for model invocation based on token counts. */
  calculateCost(
    provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    actualCost?: number,
  ): CostEstimate;

  /** Record cost incurred for a task. */
  recordCost(taskId: TaskId, provider: string, model: string, costUSD: number): void;

  /** Get total cost incurred for a task, or total across all tasks if omitted. */
  getTotalCost(taskId?: TaskId): number;

  /** Register custom pricing model. */
  registerPricing(model: string, pricing: ModelPricing): void;
}
