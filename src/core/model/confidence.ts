/**
 * Confidence domain type.
 *
 * Confidence is a structured assessment of how sure the agent is
 * about a hypothesis, decision, or outcome.
 */

// ---------------------------------------------------------------------------
// Confidence level — discretized bands
// ---------------------------------------------------------------------------

export enum ConfidenceLevel {
  VERY_LOW = 'VERY_LOW',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  VERY_HIGH = 'VERY_HIGH',
}

// ---------------------------------------------------------------------------
// Confidence — a structured assessment
// ---------------------------------------------------------------------------

export interface Confidence {
  /** Numeric score in [0.0, 1.0]. */
  readonly score: number;

  /** Discretized level. */
  readonly level: ConfidenceLevel;

  /** Why this confidence level was assigned. */
  readonly rationale: string;
}

// ---------------------------------------------------------------------------
// Factory helper
// ---------------------------------------------------------------------------

export function createConfidence(score: number, rationale: string): Confidence {
  const clamped = Math.max(0, Math.min(1, score));
  let level: ConfidenceLevel;

  if (clamped < 0.2) {
    level = ConfidenceLevel.VERY_LOW;
  } else if (clamped < 0.4) {
    level = ConfidenceLevel.LOW;
  } else if (clamped < 0.6) {
    level = ConfidenceLevel.MEDIUM;
  } else if (clamped < 0.8) {
    level = ConfidenceLevel.HIGH;
  } else {
    level = ConfidenceLevel.VERY_HIGH;
  }

  return { score: clamped, level, rationale };
}
