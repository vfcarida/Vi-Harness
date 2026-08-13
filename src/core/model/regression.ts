/**
 * Regression domain type.
 *
 * A Regression occurs when a previously-passing check now fails.
 * Regressions are a terminal condition — the agent broke something.
 */
import type { RegressionId, TaskId, EvidenceId } from '../types/identifiers.js';

// ---------------------------------------------------------------------------
// Regression
// ---------------------------------------------------------------------------

export interface Regression {
  readonly id: RegressionId;
  readonly taskId: TaskId;

  /** Description of what regressed (e.g. test name, build target). */
  readonly description: string;

  /** Evidence showing the check was previously passing. */
  readonly previousPassEvidenceId: EvidenceId;

  /** Evidence showing the check now fails. */
  readonly currentFailEvidenceId: EvidenceId;

  readonly detectedAt: Date;
}
