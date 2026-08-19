/**
 * Vendor-neutral model I/O types and capability contracts.
 *
 * These types define the contract between the agent runtime and any LLM provider.
 * No provider SDK types (OpenAI, Anthropic, Google, etc.) cross this boundary.
 */
import type { ToolDefinition } from './tool-types.js';

// ---------------------------------------------------------------------------
// Model Capabilities
// ---------------------------------------------------------------------------

export enum ModelCapability {
  REASONING = 'REASONING',
  CODING = 'CODING',
  TOOL_USE = 'TOOL_USE',
  STRUCTURED_OUTPUT = 'STRUCTURED_OUTPUT',
  VISION = 'VISION',
  LONG_CONTEXT = 'LONG_CONTEXT',
  STREAMING = 'STREAMING',
  PARALLEL_TOOL_CALLS = 'PARALLEL_TOOL_CALLS',
}

export interface ModelCapabilities {
  readonly capabilities: ReadonlySet<ModelCapability>;
  readonly maxContextTokens: number;
  readonly maxOutputTokens: number;
  readonly supportsSystemPrompt: boolean;
}

// ---------------------------------------------------------------------------
// Model Descriptor — Metadata and cost tracking
// ---------------------------------------------------------------------------

export interface ModelDescriptor {
  readonly id: string;
  readonly name: string;
  readonly providerId: string;
  readonly version: string;
  readonly capabilities: ModelCapabilities;
  readonly costPer1kInputTokensDollars: number;
  readonly costPer1kOutputTokensDollars: number;
}

// ---------------------------------------------------------------------------
// Message types
// ---------------------------------------------------------------------------

export enum MessageRole {
  SYSTEM = 'SYSTEM',
  USER = 'USER',
  ASSISTANT = 'ASSISTANT',
  TOOL_CALL = 'TOOL_CALL',
  TOOL_RESULT = 'TOOL_RESULT',
  TOOL = 'TOOL',
}

export interface ModelMessage {
  readonly role: MessageRole;
  readonly content: string;
  readonly toolCallId?: string;
  readonly name?: string;
  readonly toolCalls?: ReadonlyArray<ToolCall>;
  readonly toolResult?: {
    readonly toolCallId: string;
    readonly name: string;
    readonly output: string;
    readonly isError?: boolean;
  };
  readonly metadata?: Readonly<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Tool call — model requesting a tool execution
// ---------------------------------------------------------------------------

export interface ToolCall {
  readonly id: string;
  readonly name: string;
  readonly input: Readonly<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Token Usage & Cost
// ---------------------------------------------------------------------------

export interface TokenUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
  readonly reasoningTokens?: number;
  readonly cacheReadTokens?: number;
  readonly cacheWriteTokens?: number;
}

// ---------------------------------------------------------------------------
// Structured Output Schema
// ---------------------------------------------------------------------------

export interface StructuredOutputSchema {
  readonly name: string;
  readonly description?: string;
  readonly schema: Readonly<Record<string, unknown>>;
  readonly strict?: boolean;
}

// ---------------------------------------------------------------------------
// Model Request — vendor neutral
// ---------------------------------------------------------------------------

export interface ModelRequest {
  readonly modelId?: string;
  readonly systemPrompt?: string;
  readonly messages: ReadonlyArray<ModelMessage>;
  readonly tools?: ReadonlyArray<ToolDefinition>;
  readonly structuredOutputSchema?: StructuredOutputSchema;
  readonly temperature?: number;
  readonly topP?: number;
  readonly maxTokens?: number;
  readonly stopSequences?: ReadonlyArray<string>;
  readonly reasoningEffort?: 'low' | 'medium' | 'high';
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Stream Chunk — delta output for streaming API
// ---------------------------------------------------------------------------

export interface ModelStreamChunk {
  readonly deltaText?: string;
  readonly deltaToolCall?: Partial<ToolCall>;
  readonly finishReason?: FinishReason;
  readonly usage?: TokenUsage;
}

// ---------------------------------------------------------------------------
// Finish Reason & Retry Metadata
// ---------------------------------------------------------------------------

export enum FinishReason {
  STOP = 'STOP',
  TOOL_CALL = 'TOOL_CALL',
  MAX_TOKENS = 'MAX_TOKENS',
  CONTENT_FILTER = 'CONTENT_FILTER',
  ERROR = 'ERROR',
}

export interface RetryMetadata {
  readonly attemptCount: number;
  readonly totalBackoffMs: number;
  readonly lastError?: string;
}

export interface CacheMetrics {
  readonly cacheReadInputTokens?: number;
  readonly cacheCreationInputTokens?: number;
  readonly cacheDeletedInputTokens?: number;
}

// ---------------------------------------------------------------------------
// Model Response — vendor neutral
// ---------------------------------------------------------------------------

export interface ModelResponse {
  readonly requestId: string;
  readonly modelId: string;
  readonly providerId: string;
  readonly content: string;
  readonly structuredOutput?: Readonly<Record<string, unknown>>;
  readonly toolCalls: ReadonlyArray<ToolCall>;
  readonly usage: TokenUsage;
  readonly finishReason: FinishReason;
  readonly latencyMs: number;
  readonly estimatedCostDollars: number;
  readonly cacheMetrics?: CacheMetrics;
  readonly retryMetadata?: RetryMetadata;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Provider Health
// ---------------------------------------------------------------------------

export enum ProviderHealthStatus {
  HEALTHY = 'HEALTHY',
  DEGRADED = 'DEGRADED',
  UNHEALTHY = 'UNHEALTHY',
}

export interface ModelHealth {
  readonly providerId: string;
  readonly status: ProviderHealthStatus;
  readonly latencyMs?: number;
  readonly lastChecked: Date;
  readonly errorMessage?: string;
}
