/**
 * Acceptance Policy Domain Types.
 *
 * Defines explicit criteria required for a task to reach DONE state:
 * - Zero regressions requirement
 * - Minimum confidence threshold
 * - Required verifier checks list
 * - Warning tolerance
 */
import type { Evidence } from './evidence.js';

export interface AcceptancePolicy {
  readonly requiredChecks?: ReadonlyArray<string>;
  readonly minConfidence?: number;
  readonly allowWarnings?: boolean;
  readonly zeroRegressionsRequired: boolean;
}

export const DEFAULT_ACCEPTANCE_POLICY: Readonly<AcceptancePolicy> = {
  requiredChecks: [],
  minConfidence: 0.8,
  allowWarnings: true,
  zeroRegressionsRequired: true,
};

export interface AcceptanceEvaluation {
  readonly satisfied: boolean;
  readonly missingRequirements: ReadonlyArray<string>;
  readonly regressionsDetected: ReadonlyArray<Evidence>;
  readonly warnings: ReadonlyArray<string>;
}
