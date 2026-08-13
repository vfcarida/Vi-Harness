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
import type { AgentPhase } from './state.js';
import type { ActionProposal, ActionResult } from './action.js';
import type { Evidence } from './evidence.js';
import type { TokenUsage } from './model-io.js';
import type { TerminationDecision } from './termination.js';
import type { TaskCategory, RiskLevel, ComplexityLevel } from './router-types.js';
import type { ContextObject } from './context-object.js';

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
  readonly toolResults: ReadonlyArray<ActionResult>;
  readonly evidenceCreated: ReadonlyArray<Evidence>;
  readonly tokenUsage: TokenUsage;
  readonly costDollars: number;
  readonly terminationDecision: TerminationDecision;
}

// ---------------------------------------------------------------------------
// Execution Options & Result
// ---------------------------------------------------------------------------

export interface ExecutionOptions {
  readonly checkpointId?: CheckpointId;
  readonly taskCategory?: TaskCategory;
  readonly riskLevel?: RiskLevel;
  readonly complexity?: ComplexityLevel;
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
