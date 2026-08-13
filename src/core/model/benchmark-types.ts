/**
 * Benchmark and Evaluation Framework Domain Types.
 *
 * PRINCIPLE:
 * We evaluate the harness independently from the underlying model.
 * A benchmark result must always identify:
 * MODEL + HARNESS VERSION + TOOLS + POLICY + BUDGET + TASK + ENVIRONMENT
 *
 * Single opaque "agent scores" without full metadata are explicitly forbidden.
 */
import type { TaskId } from '../types/identifiers.js';

// ---------------------------------------------------------------------------
// Environment & Configurations
// ---------------------------------------------------------------------------

export interface BenchmarkEnvironment {
  readonly os: string;
  readonly nodeVersion: string;
  readonly harnessVersion: string;
  readonly isolatedWorkspace: boolean;
  readonly containerized: boolean;
  readonly variables: Readonly<Record<string, string>>;
}

export interface ModelConfiguration {
  readonly providerId: string;
  readonly modelId: string;
  readonly temperature: number;
  readonly maxTokens?: number;
}

export interface HarnessConfiguration {
  readonly harnessVersion: string;
  readonly tools: ReadonlyArray<string>;
  readonly policy: string;
  readonly contextStrategy: string;
  readonly memoryEnabled: boolean;
}

export interface BenchmarkBudget {
  readonly maxTokens: number;
  readonly maxCostUSD: number;
  readonly maxIterations: number;
}

export interface TimeoutConfig {
  readonly perIterationMs: number;
  readonly totalTaskMs: number;
}

// ---------------------------------------------------------------------------
// Evaluation Criteria
// ---------------------------------------------------------------------------

export interface SuccessCriteria {
  readonly expectedFinalState: string;
  readonly minTestPassRate: number;
  readonly requiredArtifacts?: ReadonlyArray<string>;
}

export interface EvidenceCriteria {
  readonly minConfidence: number;
  readonly allowWarnings: boolean;
  readonly requiredEvidenceTypes: ReadonlyArray<string>;
}

export interface RegressionCriteria {
  readonly zeroRegressionsRequired: boolean;
  readonly baselineChecks: ReadonlyArray<string>;
}

// ---------------------------------------------------------------------------
// Tasks & Suites
// ---------------------------------------------------------------------------

export enum BaselineScenarioCategory {
  SMALL_BUG = 'SMALL_BUG',
  MEDIUM_FEATURE = 'MEDIUM_FEATURE',
  MULTI_FILE_REFACTOR = 'MULTI_FILE_REFACTOR',
  TEST_REPAIR = 'TEST_REPAIR',
  LONG_DEBUGGING_TASK = 'LONG_DEBUGGING_TASK',
  SECURITY_SENSITIVE_CHANGE = 'SECURITY_SENSITIVE_CHANGE',
  REGRESSION_REPAIR = 'REGRESSION_REPAIR',
}

export interface BenchmarkTask {
  readonly id: string;
  readonly name: string;
  readonly category: BaselineScenarioCategory;
  readonly description: string;
  readonly repositoryPath: string;
  readonly successCriteria: SuccessCriteria;
  readonly evidenceCriteria: EvidenceCriteria;
  readonly regressionCriteria: RegressionCriteria;
  readonly budget: BenchmarkBudget;
  readonly timeout: TimeoutConfig;
}

export interface TaskSuite {
  readonly suiteId: string;
  readonly name: string;
  readonly description: string;
  readonly tasks: ReadonlyArray<BenchmarkTask>;
}

// ---------------------------------------------------------------------------
// Benchmark Metadata (Required for all benchmark results)
// ---------------------------------------------------------------------------

export interface BenchmarkMetadata {
  readonly modelId: string;
  readonly providerId: string;
  readonly harnessVersion: string;
  readonly tools: ReadonlyArray<string>;
  readonly policy: string;
  readonly budget: BenchmarkBudget;
  readonly taskId: string;
  readonly environment: BenchmarkEnvironment;
  readonly reproducibilitySeed: string;
  readonly timestamp: Date;
}

// ---------------------------------------------------------------------------
// Metric Taxonomies
// ---------------------------------------------------------------------------

export interface CorrectnessMetrics {
  readonly taskSuccess: boolean;
  readonly testPassRate: number;
  readonly regressionRate: number;
  readonly totalTestsRun: number;
  readonly testsPassed: number;
  readonly regressionsDetected: number;
}

export interface EfficiencyMetrics {
  readonly totalTokens: number;
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalCostUSD: number;
  readonly iterations: number;
  readonly toolCalls: number;
  readonly totalLatencyMs: number;
}

export interface ContextEfficiencyMetrics {
  readonly averageContextSizeTokens: number;
  readonly maxContextSizeTokens: number;
  readonly averageCompressionRatio: number;
  readonly retrievedMemoryVolumeBytes: number;
}

export interface ReliabilityMetrics {
  readonly recoverySuccess: boolean;
  readonly loopFrequency: number;
  readonly oscillationFrequency: number;
  readonly escalationRate: number;
  readonly processCrashesRecovered: number;
}

export interface ModelEfficiencyMetrics {
  readonly modelId: string;
  readonly success: boolean;
  readonly costUSD: number;
  readonly successToCostRatio: number;
}

// ---------------------------------------------------------------------------
// Results & Reports
// ---------------------------------------------------------------------------

export interface BenchmarkResult {
  readonly taskId: TaskId;
  readonly metadata: BenchmarkMetadata;
  readonly correctness: CorrectnessMetrics;
  readonly efficiency: EfficiencyMetrics;
  readonly contextEfficiency: ContextEfficiencyMetrics;
  readonly reliability: ReliabilityMetrics;
  readonly modelEfficiency: ModelEfficiencyMetrics;
  readonly executionTimeMs: number;
}

export interface VarianceMetrics {
  readonly stdDevSuccessRate: number;
  readonly stdDevTotalTokens: number;
  readonly stdDevTotalCostUSD: number;
}

export interface BenchmarkReport {
  readonly reportId: string;
  readonly suiteId: string;
  readonly metadata: HarnessConfiguration & { readonly environment: BenchmarkEnvironment };
  readonly results: ReadonlyArray<BenchmarkResult>;
  readonly aggregatedMetrics: {
    readonly overallSuccessRate: number;
    readonly avgTestPassRate: number;
    readonly totalTokens: number;
    readonly totalCostUSD: number;
    readonly avgIterations: number;
    readonly avgContextCompressionRatio: number;
    readonly avgEscalationRate: number;
  };
  readonly variance: VarianceMetrics;
  readonly generatedAt: Date;
}
