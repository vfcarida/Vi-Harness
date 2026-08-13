/**
 * Pi Replacement Adapter Domain & Contract Types.
 *
 * Defines the vendor-neutral benchmark adapter contract for executing coding tasks
 * through Vi-Harness while exposing the standardized benchmark interface required to
 * compare Pi Harness vs Vi-Harness as the primary independent variable.
 */
import type { ModelProvider } from '../interfaces/model-provider.js';
import type { ModelRouter } from '../interfaces/model-router.js';
import type { ContextCompiler } from '../interfaces/context-compiler.js';
import type { PolicyEngine } from '../interfaces/policy-engine.js';
import type { ToolExecutor } from '../interfaces/tool-executor.js';
import type { VerificationEngine } from '../interfaces/verification-engine.js';
import type { EvidenceStore } from '../interfaces/evidence-store.js';
import type { GitManager } from '../interfaces/git-manager.js';
import type { CheckpointStore } from '../interfaces/checkpoint-store.js';
import type { IdFactory } from '../types/identifiers.js';
import type { Clock } from '../interfaces/clock.js';
import type { ContextObject } from './context-object.js';

// ---------------------------------------------------------------------------
// Benchmark Task Input Contract (Pi-Compatible Task Definition)
// ---------------------------------------------------------------------------

export interface PiBenchmarkTask {
  /** Unique benchmark task identifier */
  readonly id: string;

  /** Human-readable task name */
  readonly name?: string;

  /** Detailed task instruction / requirement */
  readonly description: string;

  /** Target repository working directory path */
  readonly repositoryPath?: string;
  readonly workingDirectory?: string;
  readonly repoPath?: string;

  /** Cost constraint in USD */
  readonly maxCostUSD?: number;

  /** Total token budget limit */
  readonly maxTokens?: number;
  readonly tokenBudget?: number;

  /** Maximum iterations / turns allowed */
  readonly maxIterations?: number;
  readonly maxTurns?: number;
  readonly turnLimit?: number;

  /** Task wall-clock timeout in milliseconds */
  readonly maxDurationMs?: number;
  readonly timeoutMs?: number;

  /** List of tool names required for task */
  readonly requiredTools?: ReadonlyArray<string>;

  /** Optional initial context objects / files */
  readonly initialContextObjects?: ReadonlyArray<ContextObject>;

  /** Task category metadata */
  readonly category?: string;

  /** Risk level metadata */
  readonly riskLevel?: string;
}

// ---------------------------------------------------------------------------
// Benchmark Test Breakdown
// ---------------------------------------------------------------------------

export interface PiTestResults {
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly passRate: number;
}

// ---------------------------------------------------------------------------
// Token Breakdown
// ---------------------------------------------------------------------------

export interface PiTokenUsage {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
}

// ---------------------------------------------------------------------------
// Benchmark Result Output Contract (Standardized Evaluation Result)
// ---------------------------------------------------------------------------

export interface PiBenchmarkResult {
  /** Whether the benchmark task completed successfully */
  readonly success: boolean;

  /** Final state machine phase (e.g. 'DONE', 'FAILED', 'REPAIR', 'HUMAN_REQUIRED') */
  readonly finalState: string;

  /** List of workspace files modified by agent execution */
  readonly changedFiles: ReadonlyArray<string>;

  /** Git unified diff of all agent-owned changes relative to baseline */
  readonly finalDiff: string;

  /** Test pass/fail metrics from verification engine */
  readonly tests: PiTestResults;

  /** Total iterations executed */
  readonly iterations: number;

  /** Total LLM model completion calls made */
  readonly modelCalls: number;

  /** Token consumption breakdown */
  readonly tokens: PiTokenUsage;

  /** Total calculated cost in USD */
  readonly estimatedCost: number;

  /** Total execution duration in milliseconds */
  readonly duration: number;

  /** Termination reason (e.g. 'SUCCESS', 'MAX_ITERATIONS', 'EXACT_REPETITION', 'POLICY_DENIED') */
  readonly terminationReason: string;

  /** Optional benchmark task ID */
  readonly taskId: string;
}

// ---------------------------------------------------------------------------
// ViHarness Options
// ---------------------------------------------------------------------------

export interface ViHarnessOptions {
  /** Optional custom model router */
  readonly router?: ModelRouter;

  /** Primary model provider (if router is omitted, UtilityModelRouter with this provider is created) */
  readonly primaryProvider?: ModelProvider;

  /** Optional context compiler */
  readonly compiler?: ContextCompiler;

  /** Optional security policy engine */
  readonly policyEngine?: PolicyEngine;

  /** Optional tool executor */
  readonly toolExecutor?: ToolExecutor;

  /** Optional verification engine */
  readonly verificationEngine?: VerificationEngine;

  /** Optional evidence store */
  readonly evidenceStore?: EvidenceStore;

  /** Optional durable checkpoint store */
  readonly checkpointStore?: CheckpointStore;

  /** Optional Git manager for real repository delta and diff calculation */
  readonly gitManager?: GitManager;

  /** Optional ID factory */
  readonly idFactory?: IdFactory;

  /** Optional clock implementation */
  readonly clock?: Clock;

  /** Harness version identifier */
  readonly harnessVersion?: string;
}
