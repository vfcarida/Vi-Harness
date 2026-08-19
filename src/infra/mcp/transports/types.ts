/**
 * MCP and JSON-RPC Transport Interfaces.
 *
 * Provides the protocol-agnostic transport abstraction for stdio, HTTP/SSE, and custom transports.
 */
import type { McpJsonRpcRequest, McpJsonRpcResponse } from '../mcp-types.js';

export type JsonRpcHandler = (message: McpJsonRpcRequest) => Promise<McpJsonRpcResponse>;

export interface Transport {
  readonly name: string;
  readonly isRunning: boolean;
  start(config?: Record<string, unknown>): Promise<void>;
  stop(): Promise<void>;
  onMessage(handler: JsonRpcHandler): void;
  sendNotification?(method: string, params?: unknown): Promise<void>;
}

export interface StdioTransportOptions {
  readonly inStream?: NodeJS.ReadableStream;
  readonly outStream?: NodeJS.WritableStream;
  readonly errStream?: NodeJS.WritableStream;
  readonly maxLineLength?: number;
}

export interface HttpTransportOptions {
  readonly port?: number;
  readonly host?: string;
  readonly apiKey?: string;
  readonly enableCors?: boolean;
  readonly corsOrigin?: string;
  readonly maxBodySizeBytes?: number;
  readonly rateLimitBurst?: number; // max token bucket burst
  readonly rateLimitSustained?: number; // tokens per second
  readonly idleTimeoutMs?: number;
}

export interface TransportConfig {
  readonly type: string;
  readonly options?: Record<string, unknown>;
}
