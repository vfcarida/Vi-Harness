/**
 * Cost & Budget Domain Types.
 *
 * Tracks financial pricing, estimated vs actual costs, and per-task / per-model budgets.
 */
export interface ModelPricing {
  readonly promptPricePerMillion: number;
  readonly completionPricePerMillion: number;
}

export const DEFAULT_MODEL_PRICING: Readonly<Record<string, ModelPricing>> = {
  'gpt-4o': { promptPricePerMillion: 2.5, completionPricePerMillion: 10.0 },
  'gpt-4o-mini': { promptPricePerMillion: 0.15, completionPricePerMillion: 0.6 },
  'claude-3-5-sonnet': { promptPricePerMillion: 3.0, completionPricePerMillion: 15.0 },
  'claude-3-haiku': { promptPricePerMillion: 0.25, completionPricePerMillion: 1.25 },
};

export interface CostEstimate {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly estimatedCostUSD: number;
  readonly actualCostUSD?: number;
  readonly hasPricing: boolean;
}

export interface BudgetConfig {
  readonly taskBudgetUSD?: number;
  readonly modelBudgetUSD?: Readonly<Record<string, number>>;
  readonly warningThreshold?: number; // e.g. 0.8 (80%)
}

export interface BudgetCheckResult {
  readonly allowed: boolean;
  readonly warning: boolean;
  readonly currentCostUSD: number;
  readonly newCostUSD: number;
  readonly budgetUSD?: number;
  readonly warningMessage?: string;
  readonly errorMessage?: string;
}
