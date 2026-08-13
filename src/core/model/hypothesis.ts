/**
 * Hypothesis domain type.
 *
 * A Hypothesis is the agent's current theory about what to do.
 * Tracking hypotheses enables detection of repeated approaches
 * and oscillation between competing theories.
 */
import type { HypothesisId, TaskId, EvidenceId } from '../types/identifiers.js';

// ---------------------------------------------------------------------------
// Hypothesis status
// ---------------------------------------------------------------------------

export enum HypothesisStatus {
  /** Currently being pursued. */
  ACTIVE = 'ACTIVE',

  /** Validated by evidence — hypothesis was correct. */
  VALIDATED = 'VALIDATED',

  /** Invalidated by evidence — hypothesis was wrong. */
  INVALIDATED = 'INVALIDATED',

  /** Superseded by a newer hypothesis. */
  SUPERSEDED = 'SUPERSEDED',

  /** Abandoned without conclusive evidence. */
  ABANDONED = 'ABANDONED',
}

// ---------------------------------------------------------------------------
// Hypothesis
// ---------------------------------------------------------------------------

export interface Hypothesis {
  readonly id: HypothesisId;
  readonly taskId: TaskId;
  readonly description: string;
  readonly status: HypothesisStatus;

  /** Signature for deduplication — detects repeated hypotheses. */
  readonly contentHash: string;

  /** Evidence that supports or refutes this hypothesis. */
  readonly evidenceIds: ReadonlyArray<EvidenceId>;

  /** How many times a hypothesis with this content hash has been tried. */
  readonly attemptCount: number;

  readonly createdAt: Date;
  readonly updatedAt: Date;
}
