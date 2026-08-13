/**
 * Failure domain type.
 *
 * A Failure is a structured record of something that went wrong.
 * Failures feed into loop control for regression and oscillation detection.
 */
import type { FailureId, TaskId, IterationId, EvidenceId } from '../types/identifiers.js';

// ---------------------------------------------------------------------------
// Failure category
// ---------------------------------------------------------------------------

export enum FailureCategory {
  TEST_FAILURE = 'TEST_FAILURE',
  BUILD_FAILURE = 'BUILD_FAILURE',
  LINT_FAILURE = 'LINT_FAILURE',
  TYPE_CHECK_FAILURE = 'TYPE_CHECK_FAILURE',
  RUNTIME_ERROR = 'RUNTIME_ERROR',
  TOOL_ERROR = 'TOOL_ERROR',
  POLICY_DENIAL = 'POLICY_DENIAL',
  TIMEOUT = 'TIMEOUT',
  UNKNOWN = 'UNKNOWN',
}

// ---------------------------------------------------------------------------
// Failure
// ---------------------------------------------------------------------------

export interface Failure {
  readonly id: FailureId;
  readonly taskId: TaskId;
  readonly iterationId: IterationId;
  readonly category: FailureCategory;
  readonly message: string;

  /** Signature for deduplication — same signature means same failure. */
  readonly signature: string;

  readonly evidenceId: EvidenceId;
  readonly recoverable: boolean;
  readonly occurredAt: Date;
}
