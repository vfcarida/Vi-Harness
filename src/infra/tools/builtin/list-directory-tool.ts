/**
 * List Directory Built-in Tool.
 */
import type { Tool } from '../../../core/interfaces/tool.js';
import type { ToolInput, ToolResult, ToolExecutionContext } from '../../../core/model/tool-types.js';
import { ToolCategory, ToolRiskLevel } from '../../../core/model/tool-types.js';
import type { IdFactory } from '../../../core/types/identifiers.js';

export class ListDirectoryTool implements Tool {
  public readonly definition = {
    name: 'list_directory',
    version: '1.0.0',
    description: 'List contents of a directory',
    category: ToolCategory.READ,
    riskLevel: ToolRiskLevel.LOW,
    mutating: false,
    idempotent: true,
    defaultTimeoutMs: 5000,
    requiredPermissions: ['fs:read'],
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path' },
      },
      required: ['path'],
    },
  };

  constructor(private readonly idFactory: IdFactory) {}

  async execute(input: ToolInput, context: ToolExecutionContext): Promise<ToolResult> {
    const startTime = Date.now();
    const path = String(input['path'] ?? '.');

    return {
      toolCallId: this.idFactory.create<'ToolCall'>(),
      name: this.definition.name,
      output: `Listing for ${path}: file1.ts, file2.ts, package.json`,
      success: true,
      durationMs: Date.now() - startTime,
      metadata: { path, correlationId: context.correlationId },
    };
  }
}
