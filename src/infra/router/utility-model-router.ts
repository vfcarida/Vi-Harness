/**
 * Utility-Based Model Router.
 *
 * Implements ModelRouter interface to dynamically select the optimal model provider per task iteration.
 *
 * Conceptually:
 * Utility(model, task) = P(success | model, task) * value - cost - latency_penalty - risk_penalty
 *
 * Features:
 * - Hot-swapping: Selects different models per iteration as task demands change.
 * - Health-aware: Excludes unhealthy providers via ModelHealthRegistry.
 * - Capability-aware: Matches token limits and capability flags via CapabilityMatcher.
 * - Cost-aware & Budget-critical overrides.
 * - Risk-aware penalties for HIGH/CRITICAL risk tasks.
 * - Policy-driven deterministic mode for reproducible test scenarios.
 * - Fallback routing when primary candidates are unavailable.
 */
import type { ModelProvider } from '../../core/interfaces/model-provider.js';
import type { ModelRouter } from '../../core/interfaces/model-router.js';
import type {
  RoutingRequest,
  RoutingDecision,
  ModelScore,
} from '../../core/model/router-types.js';
import {
  TaskCategory,
  ModelPolicyRule,
} from '../../core/model/router-types.js';
import { ModelCapability } from '../../core/model/model-io.js';
import { CapabilityMatcher } from './capability-matcher.js';
import { ModelHealthRegistry } from './health-registry.js';
import { CostPolicy } from './cost-policy.js';
import { HarnessError } from '../../core/errors/base-error.js';
import { ErrorCode, ErrorCategory } from '../../core/errors/error-codes.js';

export interface UtilityModelRouterOptions {
  readonly healthRegistry?: ModelHealthRegistry;
  readonly deterministic?: boolean;
}

const TASK_VALUES: Record<TaskCategory, number> = {
  [TaskCategory.ARCHITECTURE]: 10.0,
  [TaskCategory.SECURITY_REVIEW]: 9.0,
  [TaskCategory.CODE_GEN]: 8.0,
  [TaskCategory.BUG_FIX]: 7.0,
  [TaskCategory.REFACTOR]: 6.0,
  [TaskCategory.TEST_REPAIR]: 5.5,
  [TaskCategory.TEST_GEN]: 5.0,
  [TaskCategory.FINAL_REVIEW]: 6.0,
  [TaskCategory.EXPLORE]: 3.0,
  [TaskCategory.SUMMARIZATION]: 2.0,
  [TaskCategory.CLASSIFICATION]: 1.5,
};

export class UtilityModelRouter implements ModelRouter {
  private readonly providers = new Map<string, ModelProvider>();
  private readonly healthRegistry: ModelHealthRegistry;
  private isDeterministic: boolean;

  constructor(options: UtilityModelRouterOptions = {}) {
    this.healthRegistry = options.healthRegistry ?? new ModelHealthRegistry();
    this.isDeterministic = options.deterministic ?? false;
  }

  registerProvider(provider: ModelProvider): void {
    this.providers.set(provider.providerId, provider);
  }

  unregisterProvider(providerId: string): boolean {
    return this.providers.delete(providerId);
  }

  listProviders(): ReadonlyArray<ModelProvider> {
    return Array.from(this.providers.values());
  }

  setDeterministicMode(enabled: boolean): void {
    this.isDeterministic = enabled;
  }

  async route(request: RoutingRequest): Promise<RoutingDecision> {
    if (this.providers.size === 0) {
      throw new HarnessError({
        code: ErrorCode.MODEL_UNAVAILABLE,
        category: ErrorCategory.MODEL,
        message: 'No model providers registered in ModelRouter',
      });
    }

    // 1. Explicit preferred provider check
    if (request.preferredProviderId) {
      const preferred = this.providers.get(request.preferredProviderId);
      if (preferred) {
        const isHealthy = await this.healthRegistry.isHealthy(preferred);
        if (isHealthy) {
          const match = CapabilityMatcher.match(preferred.descriptor, request);
          if (match.matches) {
            return {
              selectedProvider: preferred,
              selectedModelId: preferred.descriptor.id,
              scores: [],
              rationale: `Explicit preferred provider selected: ${preferred.providerId}`,
              decidedAt: new Date(),
              deterministic: this.isDeterministic,
            };
          }
        }
      }
    }

    const candidateScores: ModelScore[] = [];
    const appliedPolicies: string[] = [];

    // Check budget critical state
    const isBudgetCritical =
      (request.remainingBudgetDollars !== undefined && request.remainingBudgetDollars <= 0.5) ||
      request.metadata?.budgetCritical === true;

    if (isBudgetCritical) appliedPolicies.push(ModelPolicyRule.BUDGET_CRITICAL_LOW_COST);
    if (request.complexity === 'LOW') appliedPolicies.push(ModelPolicyRule.LOW_COMPLEXITY_CHEAP);
    if (request.complexity === 'HIGH' || request.complexity === 'VERY_HIGH') {
      appliedPolicies.push(ModelPolicyRule.HIGH_COMPLEXITY_REASONING);
    }
    if (request.risk === 'HIGH' || request.risk === 'CRITICAL') {
      appliedPolicies.push(ModelPolicyRule.HIGH_RISK_APPROVED);
    }
    if (request.isRepetitive) appliedPolicies.push(ModelPolicyRule.REPETITIVE_SMALL);

    // 2. Score all registered providers
    for (const provider of this.providers.values()) {
      const descriptor = provider.descriptor;

      // Check health
      const isHealthy = await this.healthRegistry.isHealthy(provider);
      if (!isHealthy) {
        continue; // Exclude unhealthy provider
      }

      // Check capability match
      const match = CapabilityMatcher.match(descriptor, request);
      if (!match.matches) {
        continue; // Exclude incompatible model
      }

      // Compute Expected Utility
      const score = this.calculateUtility(provider, request, isBudgetCritical);
      candidateScores.push(score);
    }

    if (candidateScores.length === 0) {
      throw new HarnessError({
        code: ErrorCode.MODEL_UNAVAILABLE,
        category: ErrorCategory.MODEL,
        message: `No healthy model provider satisfies request (context: ${request.contextTokenCount} tokens, risk: ${request.risk})`,
        context: { request },
      });
    }

    // 3. Sort candidates by totalUtility descending
    candidateScores.sort((a, b) => {
      const diff = b.totalUtility - a.totalUtility;
      if (Math.abs(diff) > 0.0001 || !this.isDeterministic) {
        return diff;
      }
      // Deterministic tie-breaking by providerId + modelId lexicographically
      return `${a.providerId}:${a.modelId}`.localeCompare(`${b.providerId}:${b.modelId}`);
    });

    const topScore = candidateScores[0]!;
    const selectedProvider = this.providers.get(topScore.providerId)!;

    const rationale =
      `Selected ${selectedProvider.providerId} (${topScore.modelId}) with utility score ${topScore.totalUtility.toFixed(3)}. ` +
      `[P(success)=${topScore.successProbability.toFixed(2)}, Cost=$${topScore.estimatedCostDollars.toFixed(4)}, ` +
      `RiskPenalty=${topScore.riskPenalty.toFixed(2)}]. Policies applied: [${appliedPolicies.join(', ')}]`;

    return {
      selectedProvider,
      selectedModelId: topScore.modelId,
      scores: candidateScores,
      rationale,
      decidedAt: new Date(),
      deterministic: this.isDeterministic,
    };
  }

  private calculateUtility(
    provider: ModelProvider,
    request: RoutingRequest,
    isBudgetCritical: boolean,
  ): ModelScore {
    const desc = provider.descriptor;
    const caps = desc.capabilities.capabilities;

    // 1. Success Probability P(success | model, task)
    let successProbability = 0.75; // Base probability

    const isHighComplexity = request.complexity === 'HIGH' || request.complexity === 'VERY_HIGH';
    const isMediumOrHigher = request.complexity === 'MEDIUM' || isHighComplexity;
    const hasReasoning = caps.has(ModelCapability.REASONING);
    const hasCoding = caps.has(ModelCapability.CODING);
    const isFullTierModel = desc.capabilities.maxOutputTokens >= 4000;

    let reasoningBonus = 0.0;

    if (isHighComplexity) {
      if (hasReasoning && hasCoding) {
        successProbability = 0.95;
        const isFrontierTier = desc.capabilities.maxOutputTokens >= 16000 || desc.costPer1kOutputTokensDollars >= 0.03;
        reasoningBonus = request.complexity === 'VERY_HIGH' ? (isFrontierTier ? 25.0 : 10.0) : 8.0;
      } else if (!hasReasoning) {
        successProbability = 0.4;
      }
    } else if (isMediumOrHigher && (request.taskCategory === TaskCategory.CODE_GEN || request.taskCategory === TaskCategory.BUG_FIX)) {
      if (hasCoding && isFullTierModel) {
        successProbability = 0.90;
      } else {
        successProbability = 0.65;
      }
    } else if (request.complexity === 'LOW') {
      successProbability = 0.98;
    }

    // 2. Task Value
    const taskValue = TASK_VALUES[request.taskCategory] ?? 5.0;

    // 3. Estimated Cost
    const estimatedCost = CostPolicy.estimateCost(
      desc,
      request.contextTokenCount,
      request.taskCategory,
    );

    // 4. Cost Penalty Factor
    let costWeight = 10.0; // Base cost weight
    if (isBudgetCritical) {
      costWeight = 500.0; // Heavily penalize cost when budget is critical
    } else if (request.complexity === 'LOW') {
      costWeight = 150.0; // Prioritize cost savings for low complexity
    }

    const costPenalty = estimatedCost * costWeight;

    // 5. Estimated Latency
    const estimatedLatencyMs = (desc.costPer1kOutputTokensDollars > 0.005 ? 1200 : 400);
    const latencyWeight = request.latencyBudgetMs && estimatedLatencyMs > request.latencyBudgetMs ? 0.01 : 0.001;
    const latencyPenalty = estimatedLatencyMs * latencyWeight;

    // 6. Risk Penalty
    let riskPenalty = 0.0;
    const isHighRisk = request.risk === 'HIGH' || request.risk === 'CRITICAL';
    if (isHighRisk) {
      if (!hasReasoning || desc.costPer1kOutputTokensDollars < 0.001) {
        riskPenalty = 8.0; // Heavy penalty for using small/weak models on high-risk tasks
      }
    }

    // 7. Repetitive task preference (boost low-cost models)
    let repetitiveBonus = 0.0;
    if (request.isRepetitive && desc.costPer1kOutputTokensDollars < 0.003) {
      repetitiveBonus = 2.0;
    }

    // Utility Formula
    const totalUtility =
      successProbability * taskValue +
      reasoningBonus -
      costPenalty -
      latencyPenalty -
      riskPenalty +
      repetitiveBonus;

    return {
      providerId: provider.providerId,
      modelId: desc.id,
      totalUtility,
      successProbability,
      estimatedCostDollars: estimatedCost,
      estimatedLatencyMs,
      riskPenalty,
      scoreBreakdown: {
        expectedValue: successProbability * taskValue,
        reasoningBonus,
        costPenalty,
        latencyPenalty,
        riskPenalty,
        repetitiveBonus,
      },
    };
  }
}
