/**
 * Constraint domain type.
 *
 * Constraints define boundaries the agent must respect.
 * They come from goal definitions, policies, and runtime configuration.
 */
import type { ConstraintId } from '../types/identifiers.js';

// ---------------------------------------------------------------------------
// Constraint type
// ---------------------------------------------------------------------------

export enum ConstraintType {
  /** Hard limit on iterations. */
  MAX_ITERATIONS = 'MAX_ITERATIONS',

  /** Hard limit on total cost. */
  MAX_COST = 'MAX_COST',

  /** Hard limit on wall-clock time. */
  MAX_DURATION = 'MAX_DURATION',

  /** Limit on consecutive repair attempts. */
  MAX_REPAIRS = 'MAX_REPAIRS',

  /** Limit on no-progress iterations. */
  MAX_NO_PROGRESS = 'MAX_NO_PROGRESS',

  /** File or directory the agent must not modify. */
  FORBIDDEN_PATH = 'FORBIDDEN_PATH',

  /** Action type the agent must not perform. */
  FORBIDDEN_ACTION = 'FORBIDDEN_ACTION',

  /** Verification must pass before DONE. */
  REQUIRE_VERIFICATION = 'REQUIRE_VERIFICATION',
}

// ---------------------------------------------------------------------------
// Constraint
// ---------------------------------------------------------------------------

export interface Constraint {
  readonly id: ConstraintId;
  readonly type: ConstraintType;
  readonly description: string;
  readonly value: unknown;
  readonly enforced: boolean;
  readonly createdAt: Date;
}
