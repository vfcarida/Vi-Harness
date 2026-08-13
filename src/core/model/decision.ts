/**
 * Decision domain type.
 *
 * A Decision is a recorded choice the runtime made.
 * Decisions are durable and auditable — they explain why the agent
 * took a particular path.
 */
import type { DecisionId, TaskId, EvidenceId } from '../types/identifiers.js';

// ---------------------------------------------------------------------------
// Decision type
// ---------------------------------------------------------------------------

export enum DecisionType {
  /** Chose a hypothesis / approach. */
  APPROACH_SELECTED = 'APPROACH_SELECTED',

  /** Chose to escalate to human. */
  ESCALATION = 'ESCALATION',

  /** Chose to terminate. */
  TERMINATION = 'TERMINATION',

  /** Chose to retry / repair. */
  RETRY = 'RETRY',

  /** Chose to rollback to a checkpoint. */
  ROLLBACK = 'ROLLBACK',

  /** Chose a model provider. */
  MODEL_SELECTION = 'MODEL_SELECTION',

  /** Policy evaluation result. */
  POLICY_EVALUATION = 'POLICY_EVALUATION',
}

// ---------------------------------------------------------------------------
// Decision
// ---------------------------------------------------------------------------

export interface Decision {
  readonly id: DecisionId;
  readonly taskId: TaskId;
  readonly type: DecisionType;
  readonly description: string;
  readonly rationale: string;
  readonly evidenceIds: ReadonlyArray<EvidenceId>;
  readonly alternatives: ReadonlyArray<string>;
  readonly confidence: number; // 0.0 – 1.0
  readonly decidedAt: Date;
  readonly metadata: Readonly<Record<string, unknown>>;
}
