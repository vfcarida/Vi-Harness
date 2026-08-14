/**
 * Model Context Protocol (MCP) Domain Types.
 *
 * Implements JSON-RPC 2.0 data structures compliant with the Model Context Protocol (MCP)
 * for tool and resource interoperability.
 */

export interface McpJsonRpcRequest {
  readonly jsonrpc: '2.0';
  readonly id: string | number;
  readonly method: string;
  readonly params?: Record<string, unknown>;
}

export interface McpJsonRpcResponse<T = unknown> {
  readonly jsonrpc: '2.0';
  readonly id: string | number;
  readonly result?: T;
  readonly error?: {
    readonly code: number;
    readonly message: string;
    readonly data?: unknown;
  };
}

export interface McpToolDefinition {
  readonly name: string;
  readonly description?: string;
  readonly inputSchema: {
    readonly type: 'object';
    readonly properties?: Record<string, unknown>;
    readonly required?: ReadonlyArray<string>;
  };
}

export interface McpResourceDefinition {
  readonly uri: string;
  readonly name: string;
  readonly description?: string;
  readonly mimeType?: string;
}

export interface McpResourceContent {
  readonly uri: string;
  readonly mimeType?: string;
  readonly text?: string;
  readonly blob?: string;
}

export interface McpCallToolResult {
  readonly content: ReadonlyArray<{
    readonly type: 'text' | 'image' | 'resource';
    readonly text?: string;
    readonly data?: string;
    readonly mimeType?: string;
  }>;
  readonly isError?: boolean;
}
