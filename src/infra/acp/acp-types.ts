/**
 * Agent Client Protocol (ACP) Types & Interfaces.
 *
 * Reference: DeepSeek Harness — Agent Client Protocol (ACP)
 * Dedicated JSON-RPC 2.0 automation protocol for headless CI, script control,
 * and multi-agent orchestration.
 */
import type { SessionEvent } from '../../core/model/session-types.js';

export interface AcpNewSessionParams {
  readonly provider?: string;
  readonly model?: string;
  readonly goalDescription?: string;
  readonly sessionDir?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface AcpNewSessionResult {
  readonly sessionId: string;
}

export interface AcpSendMessageParams {
  readonly sessionId: string;
  readonly message: string;
  readonly options?: Record<string, unknown>;
}

export interface AcpSendMessageResult {
  readonly messageId: string;
  readonly executionId?: string;
  readonly success: boolean;
  readonly summary?: string;
}

export interface AcpSessionStatusParams {
  readonly sessionId: string;
}

export type AcpAgentStatus = 'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PAUSED' | 'CANCELLED';

export interface AcpSessionStatusResult {
  readonly sessionId: string;
  readonly status: AcpAgentStatus;
  readonly phase?: string;
  readonly iterationCount: number;
  readonly totalTokens: number;
  readonly totalCostDollars: number;
  readonly activeExecutionId?: string;
}

export interface AcpCancelSessionParams {
  readonly sessionId: string;
  readonly reason?: string;
}

export interface AcpCancelSessionResult {
  readonly sessionId: string;
  readonly cancelled: boolean;
}

export interface AcpSessionHistoryParams {
  readonly sessionId: string;
}

export interface AcpSessionHistoryResult {
  readonly sessionId: string;
  readonly events: ReadonlyArray<SessionEvent>;
}

export interface AcpAgentIdleParams {
  readonly sessionId: string;
  readonly timeoutMs?: number;
}

export interface AcpAgentIdleResult {
  readonly sessionId: string;
  readonly idle: boolean;
  readonly status: AcpAgentStatus;
}
