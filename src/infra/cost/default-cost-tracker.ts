/**
 * Default Cost Tracker.
 *
 * Implements CostTracker interface:
 * Calculates token pricing estimates, accumulates task costs, and gracefully handles
 * missing pricing or providers without cost data (defaults to $0.00 with hasPricing: false).
 */
import type { CostTracker } from '../../core/interfaces/cost-tracker.js';
import type { TaskId } from '../../core/types/identifiers.js';
import type { ModelPricing, CostEstimate } from '../../core/model/cost-types.js';
import { DEFAULT_MODEL_PRICING } from '../../core/model/cost-types.js';

export class DefaultCostTracker implements CostTracker {
  private readonly pricingMap = new Map<string, ModelPricing>();
  private readonly taskCosts = new Map<TaskId, number>();
  private totalCostAcrossTasks = 0;

  constructor(customPricing?: Readonly<Record<string, ModelPricing>>) {
    // Populate default pricing
    for (const [model, pricing] of Object.entries(DEFAULT_MODEL_PRICING)) {
      this.pricingMap.set(model.toLowerCase(), pricing);
    }
    if (customPricing) {
      for (const [model, pricing] of Object.entries(customPricing)) {
        this.pricingMap.set(model.toLowerCase(), pricing);
      }
    }
  }

  registerPricing(model: string, pricing: ModelPricing): void {
    this.pricingMap.set(model.toLowerCase(), pricing);
  }

  calculateCost(
    _provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    actualCost?: number,
  ): CostEstimate {
    if (actualCost !== undefined) {
      return {
        inputTokens,
        outputTokens,
        estimatedCostUSD: actualCost,
        actualCostUSD: actualCost,
        hasPricing: true,
      };
    }

    const pricing = this.pricingMap.get(model.toLowerCase());

    if (!pricing) {
      // Missing pricing or provider without cost data -> Return 0.0 with hasPricing: false
      return {
        inputTokens,
        outputTokens,
        estimatedCostUSD: 0.0,
        hasPricing: false,
      };
    }

    const promptCost = (inputTokens / 1_000_000) * pricing.promptPricePerMillion;
    const completionCost = (outputTokens / 1_000_000) * pricing.completionPricePerMillion;
    const estimatedCostUSD = promptCost + completionCost;

    return {
      inputTokens,
      outputTokens,
      estimatedCostUSD,
      hasPricing: true,
    };
  }

  recordCost(taskId: TaskId, _provider: string, _model: string, costUSD: number): void {
    const current = this.taskCosts.get(taskId) ?? 0;
    this.taskCosts.set(taskId, current + costUSD);
    this.totalCostAcrossTasks += costUSD;
  }

  getTotalCost(taskId?: TaskId): number {
    if (taskId) {
      return this.taskCosts.get(taskId) ?? 0;
    }
    return this.totalCostAcrossTasks;
  }
}
