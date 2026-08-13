/**
 * Iteration domain type.
 *
 * An Iteration is one pass through the agent loop:
 *   Context Compile → Model → Action Proposal → Policy → Tool → Verify → Evidence → State Update
 *
 * Iterations are the atomic unit of progress tracking.
 * "No progress" is defined by comparing consecutive iterations.
 */
import type {
  IterationId,
  TaskId,
  EvidenceId,
  HypothesisId,
  ActionId,
} from '../types/identifiers.js';
import type { AgentPhase } from './state.js';

// ---------------------------------------------------------------------------
// Iteration outcome
// ---------------------------------------------------------------------------

export enum IterationOutcome {
  /** Made meaningful progress toward the goal. */
  PROGRESS = 'PROGRESS',

  /** No meaningful change from previous iteration. */
  NO_PROGRESS = 'NO_PROGRESS',

  /** Verification passed — task may be complete. */
  VERIFICATION_PASSED = 'VERIFICATION_PASSED',

  /** Verification failed — repair needed. */
  VERIFICATION_FAILED = 'VERIFICATION_FAILED',

  /** Escalated to human or blocked. */
  ESCALATED = 'ESCALATED',

  /** Terminated by loop control. */
  TERMINATED = 'TERMINATED',
}

// ---------------------------------------------------------------------------
// Iteration fingerprint — used to detect "no progress" and oscillation
// ---------------------------------------------------------------------------

export interface IterationFingerprint {
  /** Set of files touched in this iteration. */
  readonly filesModified: ReadonlyArray<string>;

  /** Active hypothesis ID (if any). */
  readonly hypothesisId: HypothesisId | null;

  /** Hash of the error signature (if verification failed). */
  readonly errorSignature: string | null;

  /** Hash of the patch content (if code was written). */
  readonly patchSignature: string | null;

  /** Names of failing tests (if verification ran). */
  readonly failingTests: ReadonlyArray<string>;

  /** Phase the agent was in at start of iteration. */
  readonly phaseAtStart: AgentPhase;

  /**
   * Ordered sequence of phases the agent visited this iteration.
   * Used for N-phase trajectory oscillation detection.
   * Example: [IMPLEMENT, VERIFY, REPAIR]
   */
  readonly stateTrajectory: ReadonlyArray<AgentPhase>;

  /**
   * Stable hash identifying a specific tool + error combination.
   * Format: "<toolName>:<errorCodeOrMessage hash>"
   * Null if no tool failure occurred in this iteration.
   * Used for repeated tool failure detection.
   */
  readonly toolFailureSignature: string | null;
}

// ---------------------------------------------------------------------------
// Iteration — one pass through the agent loop
// ---------------------------------------------------------------------------

export interface Iteration {
  readonly id: IterationId;
  readonly taskId: TaskId;
  readonly sequenceNumber: number;
  readonly outcome: IterationOutcome;
  readonly fingerprint: IterationFingerprint;
  readonly evidenceIds: ReadonlyArray<EvidenceId>;
  readonly actionIds: ReadonlyArray<ActionId>;
  readonly startedAt: Date;
  readonly completedAt: Date;
  readonly durationMs: number;
  readonly costDollars: number;
  readonly metadata: Readonly<Record<string, unknown>>;
}
