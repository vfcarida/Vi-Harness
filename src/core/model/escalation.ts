/**
 * Escalation Domain Types.
 *
 * Human Escalation subsystem models:
 * - EscalationReason (triggers: high risk, uncertainty, conflicting evidence, policy requirements, regressions, etc.)
 * - HumanDecision (APPROVE, REJECT, MODIFY, CANCEL, REQUEST_MORE_EVIDENCE)
 * - EscalationRequest
 * - HumanDecisionRecord
 * - ApprovalPolicy
 *
 * "Human decisions must become durable state/evidence.
 * A human decision must never be represented only as transient prompt text."
 */
import type { EscalationId, TaskId } from '../types/identifiers.js';
import type { Evidence } from './evidence.js';
import type { ActionProposal } from './action.js';
import type { ActionRiskCategory } from './policy.js';

// ---------------------------------------------------------------------------
// Escalation Reasons
// ---------------------------------------------------------------------------

export enum EscalationReason {
  HIGH_RISK = 'HIGH_RISK',
  UNCERTAINTY = 'UNCERTAINTY',
  CONFLICTING_EVIDENCE = 'CONFLICTING_EVIDENCE',
  IRREVERSIBLE_ACTION = 'IRREVERSIBLE_ACTION',
  REPEATED_FAILURE = 'REPEATED_FAILURE',
  REGRESSION = 'REGRESSION',
  BUDGET_EXHAUSTION = 'BUDGET_EXHAUSTION',
  POLICY_REQUIREMENT = 'POLICY_REQUIREMENT',
  MISSING_INFORMATION = 'MISSING_INFORMATION',
  AMBIGUOUS_REQUIREMENTS = 'AMBIGUOUS_REQUIREMENTS',
  POLICY_DENIAL = 'POLICY_DENIAL',
  MAX_REPAIRS_EXCEEDED = 'MAX_REPAIRS_EXCEEDED',
  OSCILLATION = 'OSCILLATION',
  ACCESS_REQUIRED = 'ACCESS_REQUIRED',
  AGENT_REQUEST = 'AGENT_REQUEST',
  BUDGET_WARNING = 'BUDGET_WARNING',
}

// ---------------------------------------------------------------------------
// Human Decision Outcomes
// ---------------------------------------------------------------------------

export enum HumanDecision {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  MODIFY = 'MODIFY',
  CANCEL = 'CANCEL',
  REQUEST_MORE_EVIDENCE = 'REQUEST_MORE_EVIDENCE',
}

// ---------------------------------------------------------------------------
// Escalation Status
// ---------------------------------------------------------------------------

export enum EscalationStatus {
  PENDING = 'PENDING',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  RESOLVED = 'RESOLVED',
  DISMISSED = 'DISMISSED',
  EXPIRED = 'EXPIRED',
}

// ---------------------------------------------------------------------------
// Escalation Request
// ---------------------------------------------------------------------------

export interface EscalationRequest {
  readonly id: EscalationId;
  readonly taskId: TaskId;
  readonly reason: EscalationReason;
  readonly status: EscalationStatus;
  readonly summary: string;
  readonly context: Readonly<Record<string, unknown>>;
  readonly evidence: ReadonlyArray<Evidence>;
  readonly proposedAction?: ActionProposal;
  readonly risk?: ActionRiskCategory | string;
  readonly alternatives: ReadonlyArray<string>;
  readonly createdAt: Date;
  readonly expiresAt?: Date;
}

export interface CreateEscalationParams {
  readonly id?: EscalationId;
  readonly taskId: TaskId;
  readonly reason: EscalationReason;
  readonly summary: string;
  readonly context?: Readonly<Record<string, unknown>>;
  readonly evidence?: ReadonlyArray<Evidence>;
  readonly proposedAction?: ActionProposal;
  readonly risk?: ActionRiskCategory | string;
  readonly alternatives?: ReadonlyArray<string>;
  readonly ttlMs?: number;
}

// ---------------------------------------------------------------------------
// Durable Human Decision Record
// ---------------------------------------------------------------------------

export interface HumanDecisionRecord {
  readonly escalationId: EscalationId;
  readonly taskId: TaskId;
  readonly decision: HumanDecision;
  readonly decidedBy: string;
  readonly decidedAt: Date;
  readonly modifiedAction?: ActionProposal;
  readonly rationale?: string;
}

// ---------------------------------------------------------------------------
// Approval Policy Definition
// ---------------------------------------------------------------------------

export interface ApprovalPolicy {
  readonly requiredReasons: ReadonlyArray<EscalationReason>;
  readonly autoEscalateOnRisk: ReadonlyArray<ActionRiskCategory>;
  readonly defaultTtlMs?: number;
}
