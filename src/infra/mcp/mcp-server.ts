/**
 * Model Context Protocol (MCP) Server for Vi-Harness.
 *
 * Exposes Vi-Harness tools, context stores, and verification engines as a standard MCP server
 * for external MCP clients (e.g. Cursor, Claude Desktop, VS Code, JetBrains).
 */
import type { ToolRegistry } from '../../core/interfaces/tool-registry.js';
import type { ToolExecutor } from '../../core/interfaces/tool-executor.js';
import type { ContextStore } from '../../core/interfaces/context-store.js';
import type {
  McpJsonRpcRequest,
  McpJsonRpcResponse,
  McpToolDefinition,
  McpResourceDefinition,
  McpCallToolResult,
} from './mcp-types.js';

export interface McpServerOptions {
  readonly serverName?: string;
  readonly serverVersion?: string;
  readonly toolRegistry: ToolRegistry;
  readonly toolExecutor?: ToolExecutor;
  readonly contextStore?: ContextStore;
}

export class McpServer {
  readonly serverName: string;
  readonly serverVersion: string;
  readonly toolRegistry: ToolRegistry;
  readonly toolExecutor?: ToolExecutor;
  readonly contextStore?: ContextStore;

  constructor(options: McpServerOptions) {
    this.serverName = options.serverName ?? 'vi-harness-mcp-server';
    this.serverVersion = options.serverVersion ?? '0.4.0';
    this.toolRegistry = options.toolRegistry;
    this.toolExecutor = options.toolExecutor;
    this.contextStore = options.contextStore;
  }

  /**
   * Handle an incoming MCP JSON-RPC request and produce a standard response.
   */
  async handleRequest(request: McpJsonRpcRequest): Promise<McpJsonRpcResponse> {
    if (!request || request.jsonrpc !== '2.0' || request.id === undefined) {
      return {
        jsonrpc: '2.0',
        id: request?.id ?? 0,
        error: { code: -32600, message: 'Invalid Request: Missing required jsonrpc 2.0 or id' },
      };
    }

    try {
      switch (request.method) {
        case 'initialize': {
          return {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: {
                tools: { listChanged: false },
                resources: { subscribe: false, listChanged: false },
              },
              serverInfo: {
                name: this.serverName,
                version: this.serverVersion,
              },
            },
          };
        }

        case 'tools/list': {
          const tools = this.toolRegistry.listTools();
          const mcpTools: McpToolDefinition[] = tools.map((t) => ({
            name: t.definition.name,
            description: t.definition.description,
            inputSchema: {
              type: 'object',
              properties: ((t.definition.inputSchema as Record<string, unknown>)?.['properties'] as Record<string, unknown>) ?? {},
              required: ((t.definition.inputSchema as Record<string, unknown>)?.['required'] as string[]) ?? [],
            },
          }));

          return {
            jsonrpc: '2.0',
            id: request.id,
            result: { tools: mcpTools },
          };
        }

        case 'tools/call': {
          const params = request.params as { name?: string; arguments?: Record<string, unknown> } | undefined;
          const toolName = params?.name;
          const toolInput = params?.arguments ?? {};

          if (!toolName) {
            return {
              jsonrpc: '2.0',
              id: request.id,
              error: { code: -32602, message: 'Invalid params: Missing tool name in tools/call' },
            };
          }

          const tool = this.toolRegistry.getTool(toolName);
          if (!tool) {
            return {
              jsonrpc: '2.0',
              id: request.id,
              result: {
                content: [{ type: 'text', text: `Error: Tool [${toolName}] not found in registry.` }],
                isError: true,
              } satisfies McpCallToolResult,
            };
          }

          try {
            const executionResult = await tool.execute(toolInput, {
              correlationId: `mcp_call_${Date.now()}`,
            });
            return {
              jsonrpc: '2.0',
              id: request.id,
              result: {
                content: [{ type: 'text', text: executionResult.output }],
                isError: !executionResult.success,
              } satisfies McpCallToolResult,
            };
          } catch (err: any) {
            return {
              jsonrpc: '2.0',
              id: request.id,
              result: {
                content: [{ type: 'text', text: `Tool execution failed: ${err?.message ?? String(err)}` }],
                isError: true,
              } satisfies McpCallToolResult,
            };
          }
        }

        case 'resources/list': {
          const resources: McpResourceDefinition[] = [
            {
              uri: 'vi-harness://context/active',
              name: 'Active Agent Context',
              description: 'Four-tier context graph snapshot (L0-L3)',
              mimeType: 'application/json',
            },
          ];

          return {
            jsonrpc: '2.0',
            id: request.id,
            result: { resources },
          };
        }

        case 'resources/read': {
          const params = request.params as { uri?: string } | undefined;
          const uri = params?.uri;

          if (uri === 'vi-harness://context/active') {
            const contents = {
              server: this.serverName,
              version: this.serverVersion,
              status: 'READY',
            };
            return {
              jsonrpc: '2.0',
              id: request.id,
              result: {
                contents: [
                  {
                    uri,
                    mimeType: 'application/json',
                    text: JSON.stringify(contents, null, 2),
                  },
                ],
              },
            };
          }

          return {
            jsonrpc: '2.0',
            id: request.id,
            error: { code: -32602, message: `Resource not found: ${uri}` },
          };
        }

        default: {
          return {
            jsonrpc: '2.0',
            id: request.id,
            error: { code: -32601, message: `Method not found: ${request.method}` },
          };
        }
      }
    } catch (error: any) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: { code: -32603, message: `Internal server error: ${error?.message ?? String(error)}` },
      };
    }
  }
}
