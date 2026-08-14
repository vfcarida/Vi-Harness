/**
 * Meta-Harness Causal Trace & Execution Telemetry Domain Types.
 *
 * Implements structured trace data models inspired by Meta-Harness (Stanford IRIS Lab, arXiv:2603.28052).
 * Records end-to-end execution traces enabling causal reasoning over agent success,
 * failures, token consumption, and outer-loop harness optimization.
 */
import type { TaskId, ExecutionId, IterationId } from '../types/identifiers.js';
import type { ModelMessage, ToolCall } from './model-io.js';
import type { ActionResult } from './action.js';
import type { PolicyDecision } from './policy.js';
import type { Evidence } from './evidence.js';
import type { AgentPhase } from './state.js';

export interface IterationTraceRecord {
  readonly traceId: string;
  readonly executionId: ExecutionId;
  readonly taskId: TaskId;
  readonly iterationId: IterationId;
  readonly sequenceNumber: number;
  readonly phaseBefore: AgentPhase;
  readonly phaseAfter: AgentPhase;
  readonly selectedProviderId: string;
  readonly selectedModelId: string;
  readonly targetRole: string;
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly cachedTokens?: number;
  readonly totalTokens: number;
  readonly costDollars: number;
  readonly messages: ReadonlyArray<ModelMessage>;
  readonly proposedToolCalls: ReadonlyArray<ToolCall>;
  readonly policyDecisions: ReadonlyArray<PolicyDecision>;
  readonly executedToolResults: ReadonlyArray<ActionResult>;
  readonly evidenceCreated: ReadonlyArray<Evidence>;
  readonly gitDiffSha?: string;
  readonly durationMs: number;
  readonly timestamp: Date;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ExecutionTraceSummary {
  readonly executionId: ExecutionId;
  readonly taskId: TaskId;
  readonly goalDescription: string;
  readonly success: boolean;
  readonly finalPhase: AgentPhase;
  readonly totalIterations: number;
  readonly totalTokens: number;
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly cachedTokens: number;
  readonly totalCostDollars: number;
  readonly totalDurationMs: number;
  readonly totalToolCalls: number;
  readonly failureEvidenceCount: number;
  readonly passesEvidenceCount: number;
  readonly traces: ReadonlyArray<IterationTraceRecord>;
  readonly startedAt: Date;
  readonly finishedAt: Date;
}
