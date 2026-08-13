/**
 * Cost Policy & Estimator.
 *
 * Calculates estimated financial cost for a model request given:
 * - Input context token count
 * - Estimated output token count per TaskCategory
 * - Provider descriptor rates
 */
import type { ModelDescriptor } from '../../core/model/model-io.js';
import { TaskCategory } from '../../core/model/router-types.js';

const ESTIMATED_OUTPUT_TOKENS: Record<TaskCategory, number> = {
  [TaskCategory.EXPLORE]: 600,
  [TaskCategory.CODE_GEN]: 2000,
  [TaskCategory.BUG_FIX]: 1500,
  [TaskCategory.REFACTOR]: 1800,
  [TaskCategory.SUMMARIZATION]: 400,
  [TaskCategory.CLASSIFICATION]: 100,
  [TaskCategory.TEST_GEN]: 1200,
  [TaskCategory.TEST_REPAIR]: 1000,
  [TaskCategory.ARCHITECTURE]: 2500,
  [TaskCategory.SECURITY_REVIEW]: 1500,
  [TaskCategory.FINAL_REVIEW]: 1000,
};

export class CostPolicy {
  /**
   * Estimate financial cost in dollars for a request against a model.
   */
  static estimateCost(
    descriptor: ModelDescriptor,
    inputTokens: number,
    taskCategory: TaskCategory,
  ): number {
    const estimatedOutput = ESTIMATED_OUTPUT_TOKENS[taskCategory] ?? 1000;

    const inputCost = (inputTokens / 1000) * descriptor.costPer1kInputTokensDollars;
    const outputCost = (estimatedOutput / 1000) * descriptor.costPer1kOutputTokensDollars;

    return inputCost + outputCost;
  }
}
