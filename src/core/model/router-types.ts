/**
 * Model Router Domain Types.
 *
 * Defines task classifications, complexity/risk levels, routing requests,
 * model utility scoring structures, policy rules, and routing decisions.
 */
import type { ModelCapability } from './model-io.js';
import type { AgentPhase } from './state.js';
import type { ModelProvider } from '../interfaces/model-provider.js';

// ---------------------------------------------------------------------------
// Task Category Taxonomy
// ---------------------------------------------------------------------------

export enum TaskCategory {
  EXPLORE = 'EXPLORE',
  CODE_GEN = 'CODE_GEN',
  BUG_FIX = 'BUG_FIX',
  REFACTOR = 'REFACTOR',
  SUMMARIZATION = 'SUMMARIZATION',
  CLASSIFICATION = 'CLASSIFICATION',
  TEST_GEN = 'TEST_GEN',
  TEST_REPAIR = 'TEST_REPAIR',
  ARCHITECTURE = 'ARCHITECTURE',
  SECURITY_REVIEW = 'SECURITY_REVIEW',
  FINAL_REVIEW = 'FINAL_REVIEW',
}

// ---------------------------------------------------------------------------
// Complexity & Risk Levels
// ---------------------------------------------------------------------------

export type ComplexityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// ---------------------------------------------------------------------------
// Routing Request — Task & Context specification for model selection
// ---------------------------------------------------------------------------

export interface RoutingRequest {
  readonly taskCategory: TaskCategory;
  readonly complexity: ComplexityLevel;
  readonly risk: RiskLevel;
  readonly currentState?: AgentPhase;
  readonly contextTokenCount: number;
  readonly requiredCapabilities?: ReadonlyArray<ModelCapability>;
  readonly remainingBudgetDollars?: number;
  readonly latencyBudgetMs?: number;
  readonly isRepetitive?: boolean;
  readonly iterationCount?: number;
  readonly preferredProviderId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Model Score — Utility breakdown for candidate models
// ---------------------------------------------------------------------------

export interface ModelScore {
  readonly providerId: string;
  readonly modelId: string;
  readonly totalUtility: number;
  readonly successProbability: number;
  readonly estimatedCostDollars: number;
  readonly estimatedLatencyMs: number;
  readonly riskPenalty: number;
  readonly scoreBreakdown: Readonly<Record<string, number>>;
}

// ---------------------------------------------------------------------------
// Routing Decision — Final selected provider and audit trail
// ---------------------------------------------------------------------------

export interface RoutingDecision {
  readonly selectedProvider: ModelProvider;
  readonly selectedModelId: string;
  readonly scores: ReadonlyArray<ModelScore>;
  readonly rationale: string;
  readonly decidedAt: Date;
  readonly deterministic: boolean;
}

// ---------------------------------------------------------------------------
// Policy Rules
// ---------------------------------------------------------------------------

export enum ModelPolicyRule {
  LOW_COMPLEXITY_CHEAP = 'LOW_COMPLEXITY_CHEAP',
  HIGH_COMPLEXITY_REASONING = 'HIGH_COMPLEXITY_REASONING',
  HIGH_RISK_APPROVED = 'HIGH_RISK_APPROVED',
  REPETITIVE_SMALL = 'REPETITIVE_SMALL',
  LONG_CONTEXT_REQUIRED = 'LONG_CONTEXT_REQUIRED',
  UNHEALTHY_EXCLUDED = 'UNHEALTHY_EXCLUDED',
  BUDGET_CRITICAL_LOW_COST = 'BUDGET_CRITICAL_LOW_COST',
}
