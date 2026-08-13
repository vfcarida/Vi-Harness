/**
 * Context Benchmark Strategy Interface.
 *
 * Defines the contract that all 3 benchmark strategies must implement
 * to process trajectory steps and evaluate critical memory retention.
 */
import type {
  TrajectoryStep,
  CriticalMemoryItem,
  ContextStrategyType,
} from '../../../core/model/context-benchmark-types.js';

export interface StrategyStepResult {
  readonly compiledContextText: string;
  readonly contextTokens: number;
}

export interface RetentionEvaluationResult {
  readonly retentionRate: number;
  readonly retainedCount: number;
  readonly totalInjected: number;
  readonly retained: ReadonlyArray<string>;
  readonly lost: ReadonlyArray<string>;
}

export interface ContextBenchmarkStrategy {
  readonly name: ContextStrategyType;
  readonly displayName: string;

  /**
   * Reset strategy state before beginning a new trajectory.
   */
  reset(): void;

  /**
   * Process a single step from the trajectory and return the compiled context and token count.
   */
  processStep(step: TrajectoryStep, stepIndex: number): Promise<StrategyStepResult>;

  /**
   * Evaluate whether critical memory items survived in the current compiled context.
   */
  evaluateRetention(injectedItems: ReadonlyArray<CriticalMemoryItem>): RetentionEvaluationResult;

  /**
   * Retrieve current raw context text.
   */
  getCurrentContextText(): string;
}
