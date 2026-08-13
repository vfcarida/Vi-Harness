/**
 * Termination domain types.
 *
 * "Stop conditions live outside the LLM."
 *
 * TerminationDecision is the explicit, structured object the runtime
 * produces when deciding whether to stop the agent loop.
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

  /** Agent is oscillating between approaches. */
  OSCILLATION = 'OSCILLATION',

  /** Agent made no progress for N consecutive iterations. */
  NO_PROGRESS = 'NO_PROGRESS',

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
// Termination decision — the runtime's verdict
// ---------------------------------------------------------------------------

export interface TerminationDecision {
  /** Whether the loop should terminate. */
  readonly terminal: boolean;

  /** Why the loop is terminating (only set if terminal === true). */
  readonly reason: TerminationReason | null;

  /** Evidence supporting the termination decision. */
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
    evidenceIds: [],
    confidence: 1.0,
    humanRequired: false,
    recommendedAction: 'continue',
    decidedAt: new Date(),
  };
}

export function terminate(params: {
  reason: TerminationReason;
  evidenceIds?: ReadonlyArray<EvidenceId>;
  confidence?: number;
  humanRequired?: boolean;
  recommendedAction?: string;
}): TerminationDecision {
  return {
    terminal: true,
    reason: params.reason,
    evidenceIds: params.evidenceIds ?? [],
    confidence: params.confidence ?? 1.0,
    humanRequired: params.humanRequired ?? false,
    recommendedAction: params.recommendedAction ?? 'stop',
    decidedAt: new Date(),
  };
}
