/**
 * Context Compiler Domain Types.
 *
 * "Context is compiled, not accumulated."
 *
 * Defines compilation requests, context budgets, scoring weights,
 * dry-run explanation reports, and metrics for model-aware context compilation.
 */
import type { Goal } from './goal.js';
import type { Task } from './task.js';
import type { AgentState } from './state.js';
import type { Hypothesis } from './hypothesis.js';
import type { Evidence } from './evidence.js';
import type { ContextObject } from './context-object.js';
import type { ModelDescriptor } from './model-io.js';
import type { CompiledContext } from './context.js';
import type { ContextId } from '../types/identifiers.js';

// ---------------------------------------------------------------------------
// Context Budget
// ---------------------------------------------------------------------------

export interface ContextBudget {
  readonly maxTokens: number;
  readonly softLimitTokens: number;
  readonly tierBudgets?: Readonly<Record<string, number>>;
}

// ---------------------------------------------------------------------------
// Scoring Weights
// ---------------------------------------------------------------------------

export interface CompilerScoringWeights {
  readonly importanceWeight: number;
  readonly dependencyWeight: number;
  readonly verificationWeight: number;
  readonly failureRelevanceWeight: number;
  readonly recencyWeight: number;
  readonly tokenCostPenaltyWeight: number;
}

export const DEFAULT_SCORING_WEIGHTS: Readonly<CompilerScoringWeights> = {
  importanceWeight: 0.30,
  dependencyWeight: 0.25,
  verificationWeight: 0.20,
  failureRelevanceWeight: 0.15,
  recencyWeight: 0.10,
  tokenCostPenaltyWeight: 0.05,
};

// ---------------------------------------------------------------------------
// Dry-Run Explanation Types
// ---------------------------------------------------------------------------

export type ItemAction = 'RETAINED' | 'OMITTED' | 'SUMMARIZED' | 'TRIMMED';

export interface CompilationItemExplanation {
  readonly id: ContextId | string;
  readonly type: string;
  readonly action: ItemAction;
  readonly score: number;
  readonly tokenCost: number;
  readonly reason: string;
  readonly mustPreserve: boolean;
}

export interface CompilationExplanation {
  readonly items: ReadonlyArray<CompilationItemExplanation>;
  readonly riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly summary: string;
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

export interface CompilationMetrics {
  readonly inputObjectCount: number;
  readonly tokensBefore: number;
  readonly tokensAfter: number;
  readonly compressionRatio: number; // (tokensBefore - tokensAfter) / tokensBefore
  readonly retainedCount: number;
  readonly omittedCount: number;
  readonly mandatoryRetainedCount: number;
  readonly durationMs: number;
}

// ---------------------------------------------------------------------------
// Context Compilation Request & Result
// ---------------------------------------------------------------------------

export interface ContextCompilationRequest {
  readonly goal: Goal;
  readonly task: Task;
  readonly currentState: AgentState;
  readonly currentFiles?: ReadonlyArray<string>;
  readonly activeHypothesis?: Hypothesis | null;
  readonly recentEvidence?: ReadonlyArray<Evidence>;
  readonly relevantObjects?: ReadonlyArray<ContextObject>;
  readonly targetModelDescriptor: ModelDescriptor;
  readonly budget: ContextBudget;
  readonly dryRun?: boolean;
  readonly weights?: Partial<CompilerScoringWeights>;
}

export interface ContextCompilationResult {
  readonly compiledContext: CompiledContext;
  readonly retainedObjects: ReadonlyArray<ContextObject>;
  readonly explanation?: CompilationExplanation;
  readonly metrics: CompilationMetrics;
}
