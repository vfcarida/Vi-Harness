/**
 * Termination domain types.
 *
 * "Stop conditions live outside the LLM."
 *
 * TerminationDecision is the explicit, structured object the runtime
 * produces when deciding whether to stop the agent loop.
 *
 * Every terminal decision MUST carry:
 * - reason: WHY execution stopped (enum, not a string)
 * - evidence: structured items explaining the detection, not a single string
 * - iterationsAnalyzed: how many iterations were considered
 *
 * The LLM never receives raw termination data; it only receives
 * the structured reason after the runtime has decided.
 */
import type { EvidenceId } from '../types/identifiers.js';

// ---------------------------------------------------------------------------
// Termination reason — why the loop stopped
// ---------------------------------------------------------------------------

export enum TerminationReason {
  /** All verification passed — task is done. */
  SUCCESS = 'SUCCESS',

  /** Maximum iteration count reached. */
  MAX_ITERATIONS = 'MAX_ITERATIONS',

  /** Cost budget exhausted. */
  MAX_COST = 'MAX_COST',

  /** Wall-clock time limit exceeded. */
  MAX_DURATION = 'MAX_DURATION',

  /** Consecutive repair attempts exceeded threshold. */
  MAX_REPAIRS = 'MAX_REPAIRS',

  /** Agent repeated the same hypothesis too many times. */
  REPEATED_HYPOTHESIS = 'REPEATED_HYPOTHESIS',

  /** Agent is oscillating between approaches (pair-cycle detection). */
  OSCILLATION = 'OSCILLATION',

  /** Agent's phase trajectory forms a repeating cycle (N-phase cycle detection). */
  TRAJECTORY_OSCILLATION = 'TRAJECTORY_OSCILLATION',

  /** Agent made no progress for N consecutive iterations. */
  NO_PROGRESS = 'NO_PROGRESS',

  /** Exact same iteration fingerprint (hash) seen in a previous iteration. */
  EXACT_REPETITION = 'EXACT_REPETITION',

  /** The same tool failed with the same error signature too many times. */
  REPEATED_TOOL_FAILURE = 'REPEATED_TOOL_FAILURE',

  /** Previously-passing tests now fail. */
  REGRESSION = 'REGRESSION',

  /** Policy violation that cannot be resolved. */
  POLICY_VIOLATION = 'POLICY_VIOLATION',

  /** Human requested cancellation. */
  CANCELLED = 'CANCELLED',

  /** Unrecoverable error. */
  UNRECOVERABLE_ERROR = 'UNRECOVERABLE_ERROR',

  /** Human escalation required. */
  HUMAN_REQUIRED = 'HUMAN_REQUIRED',
}

// ---------------------------------------------------------------------------
// Structured termination evidence — explains the detection, not just the reason
// ---------------------------------------------------------------------------

export type TerminationEvidenceType =
  | 'FINGERPRINT_MATCH'
  | 'HYPOTHESIS_REPETITION'
  | 'OSCILLATION_PATTERN'
  | 'BUDGET_EXHAUSTION'
  | 'TOOL_FAILURE_REPETITION'
  | 'NO_PROGRESS_SPAN'
  | 'TRAJECTORY_CYCLE'
  | 'BUDGET_LIMIT'
  | 'ACCEPTANCE_GATE';

export interface TerminationEvidence {
  /** The kind of evidence. */
  readonly type: TerminationEvidenceType;

  /** Human-readable description of this specific evidence item. */
  readonly description: string;

  /** Optional structured data for programmatic analysis. */
  readonly data?: Readonly<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Termination decision — the runtime's verdict
// ---------------------------------------------------------------------------

export interface TerminationDecision {
  /** Whether the loop should terminate. */
  readonly terminal: boolean;

  /** Why the loop is terminating (only set if terminal === true). */
  readonly reason: TerminationReason | null;

  /** Structured evidence items explaining the detection. */
  readonly evidence: ReadonlyArray<TerminationEvidence>;

  /** How many iterations were analyzed to reach this decision. */
  readonly iterationsAnalyzed: number;

  /** Evidence IDs from the evidence store supporting this decision. */
  readonly evidenceIds: ReadonlyArray<EvidenceId>;

  /** Confidence in the decision (0.0 – 1.0). */
  readonly confidence: number;

  /** Whether human intervention is needed. */
  readonly humanRequired: boolean;

  /** What the runtime recommends doing next. */
  readonly recommendedAction: string;

  /** When this decision was made. */
  readonly decidedAt: Date;
}

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

export function continueExecution(): TerminationDecision {
  return {
    terminal: false,
    reason: null,
    evidence: [],
    iterationsAnalyzed: 0,
    evidenceIds: [],
    confidence: 1.0,
    humanRequired: false,
    recommendedAction: 'continue',
    decidedAt: new Date(),
  };
}

export function terminate(params: {
  reason: TerminationReason;
  evidence?: ReadonlyArray<TerminationEvidence>;
  iterationsAnalyzed?: number;
  evidenceIds?: ReadonlyArray<EvidenceId>;
  confidence?: number;
  humanRequired?: boolean;
  recommendedAction?: string;
}): TerminationDecision {
  return {
    terminal: true,
    reason: params.reason,
    evidence: params.evidence ?? [],
    iterationsAnalyzed: params.iterationsAnalyzed ?? 0,
    evidenceIds: params.evidenceIds ?? [],
    confidence: params.confidence ?? 1.0,
    humanRequired: params.humanRequired ?? false,
    recommendedAction: params.recommendedAction ?? 'stop',
    decidedAt: new Date(),
  };
}
