/**
 * Agent Runtime Domain Types & Events.
 *
 * Defines runtime execution states, iteration audit records, observability events,
 * and execution result structures.
 */
import type {
  ExecutionId,
  GoalId,
  TaskId,
  IterationId,
  CheckpointId,
} from '../types/identifiers.js';
import type { AgentPhase, StateEvent } from './state.js';
import type { ActionProposal, ActionResult } from './action.js';
import type { Evidence } from './evidence.js';
import type { TokenUsage } from './model-io.js';
import type { TerminationDecision } from './termination.js';
import type { TaskCategory, RiskLevel, ComplexityLevel, ModelRole, DualModelConfig } from './router-types.js';
import type { ContextObject } from './context-object.js';
import type { PolicyDecisionType } from './policy.js';

// ---------------------------------------------------------------------------
// Iteration Phase Breakdown
// ---------------------------------------------------------------------------

export interface PolicyDecisionRecord {
  readonly proposalId: string;
  readonly toolName: string;
  readonly decision: PolicyDecisionType;
  readonly ruleId?: string;
  readonly reason: string;
}

export interface IterationPhases {
  readonly observation: {
    readonly stateBefore: AgentPhase;
    readonly sequenceNumber: number;
    readonly priorToolResultsCount: number;
    readonly priorEvidenceCount: number;
  };
  readonly context: {
    readonly compiledTokens: number;
    readonly entriesCount: number;
  };
  readonly modelDecision: {
    readonly providerId: string;
    readonly modelId: string;
    readonly usage: TokenUsage;
    readonly latencyMs: number;
  };
  readonly actionProposals: ReadonlyArray<ActionProposal>;
  readonly policyDecisions: ReadonlyArray<PolicyDecisionRecord>;
  readonly toolExecutions: ReadonlyArray<ActionResult>;
  readonly verificationResults: {
    readonly performed: boolean;
    readonly status?: string;
    readonly summary?: string;
  };
  readonly evidence: ReadonlyArray<Evidence>;
  readonly stateTransition: {
    readonly from: AgentPhase;
    readonly to: AgentPhase;
    readonly event: StateEvent | null;
  };
  readonly terminationDecision: TerminationDecision;
}

// ---------------------------------------------------------------------------
// Execution Status
// ---------------------------------------------------------------------------

export type AgentExecutionStatus =
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'AWAITING_HUMAN';

// ---------------------------------------------------------------------------
// Observable Agent Event Types
// ---------------------------------------------------------------------------

export enum AgentEventType {
  AgentStarted = 'AgentStarted',
  IterationStarted = 'IterationStarted',
  ModelSelected = 'ModelSelected',
  ModelCalled = 'ModelCalled',
  ActionProposed = 'ActionProposed',
  PolicyEvaluated = 'PolicyEvaluated',
  ToolStarted = 'ToolStarted',
  ToolCompleted = 'ToolCompleted',
  VerificationStarted = 'VerificationStarted',
  EvidenceCreated = 'EvidenceCreated',
  StateUpdated = 'StateUpdated',
  IterationCompleted = 'IterationCompleted',
  AgentPaused = 'AgentPaused',
  AgentCompleted = 'AgentCompleted',
  AgentFailed = 'AgentFailed',
  AgentResumed = 'AgentResumed',
  AgentCancelled = 'AgentCancelled',
}

export interface AgentEvent {
  readonly type: AgentEventType;
  readonly executionId: ExecutionId;
  readonly taskId: TaskId;
  readonly timestamp: Date;
  readonly data: Readonly<Record<string, unknown>>;
}

import type { Iteration } from './iteration.js';

// ---------------------------------------------------------------------------
// Audit Record per Iteration
// ---------------------------------------------------------------------------

export interface IterationRecord {
  readonly iterationId: IterationId;
  readonly sequenceNumber: number;
  readonly startedAt: Date;
  readonly completedAt: Date;
  readonly stateBefore: AgentPhase;
  readonly stateAfter: AgentPhase;
  readonly modelId: string;
  readonly providerId: string;
  readonly actionProposed: ActionProposal | null;
  readonly actionProposals?: ReadonlyArray<ActionProposal>;
  readonly toolResults: ReadonlyArray<ActionResult>;
  readonly evidenceCreated: ReadonlyArray<Evidence>;
  readonly tokenUsage: TokenUsage;
  readonly costDollars: number;
  readonly terminationDecision: TerminationDecision;
  readonly phases?: IterationPhases;
  readonly iterationModel?: Iteration;
}

// ---------------------------------------------------------------------------
// Execution Options & Result
// ---------------------------------------------------------------------------

export interface ExecutionOptions {
  readonly checkpointId?: CheckpointId;
  readonly taskCategory?: TaskCategory;
  readonly riskLevel?: RiskLevel;
  readonly complexity?: ComplexityLevel;
  readonly targetRole?: ModelRole;
  readonly dualModelConfig?: DualModelConfig;
  readonly signal?: AbortSignal;
  readonly relevantObjects?: ReadonlyArray<ContextObject>;
}

export interface ExecutionResult {
  readonly executionId: ExecutionId;
  readonly goalId: GoalId;
  readonly taskId: TaskId;
  readonly success: boolean;
  readonly status: AgentExecutionStatus;
  readonly summary: string;
  readonly iterationCount: number;
  readonly durationMs: number;
  readonly totalCostDollars: number;
  readonly totalTokens: number;
  readonly iterations: ReadonlyArray<IterationRecord>;
  readonly checkpointId?: CheckpointId;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
