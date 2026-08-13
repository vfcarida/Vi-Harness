/**
 * Evidence Domain Types.
 *
 * Evidence is the output of verification — unit tests, linters, builds, static analysis.
 * "Completion must be evidence-driven."
 * "Do not interpret raw model statements as evidence."
 */
import type { EvidenceId, TaskId } from '../types/identifiers.js';

// ---------------------------------------------------------------------------
// Evidence Outcome & Type Discriminators
// ---------------------------------------------------------------------------

export enum EvidenceOutcome {
  PASS = 'PASS',
  FAIL = 'FAIL',
  WARNING = 'WARNING',
  INCONCLUSIVE = 'INCONCLUSIVE',
  REGRESSION = 'REGRESSION',
}

export enum EvidenceType {
  TEST_RESULT = 'TEST_RESULT',
  LINT_RESULT = 'LINT_RESULT',
  BUILD_RESULT = 'BUILD_RESULT',
  RUNTIME_OUTPUT = 'RUNTIME_OUTPUT',
  DIFF = 'DIFF',
  VERIFICATION = 'VERIFICATION',
  HUMAN_FEEDBACK = 'HUMAN_FEEDBACK',
}

// ---------------------------------------------------------------------------
// Evidence Record Structure
// ---------------------------------------------------------------------------

export interface Evidence {
  readonly id: EvidenceId;
  readonly taskId: TaskId;
  readonly type: EvidenceType;
  readonly outcome: EvidenceOutcome;
  readonly summary: string;
  readonly data: Readonly<Record<string, unknown>>;
  readonly createdAt: Date;
  readonly pass: boolean;
  readonly checkId?: string;
  readonly suiteId?: string;
  readonly confidence: number; // 0.0 to 1.0
  readonly affectedFiles: ReadonlyArray<string>;
  readonly rawArtifactRef?: string;
}
