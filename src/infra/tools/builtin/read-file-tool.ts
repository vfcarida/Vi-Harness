/**
 * Read File Built-in Tool.
 */
import * as fs from 'node:fs';
import type { Tool } from '../../../core/interfaces/tool.js';
import type { ToolInput, ToolResult, ToolExecutionContext } from '../../../core/model/tool-types.js';
import { ToolCategory, ToolRiskLevel } from '../../../core/model/tool-types.js';
import type { IdFactory } from '../../../core/types/identifiers.js';

export class ReadFileTool implements Tool {
  public readonly definition = {
    name: 'read_file',
    version: '1.0.0',
    description: 'Read contents of a target file',
    category: ToolCategory.READ,
    riskLevel: ToolRiskLevel.LOW,
    mutating: false,
    idempotent: true,
    defaultTimeoutMs: 5000,
    requiredPermissions: ['fs:read'],
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative or absolute file path' },
      },
      required: ['path'],
    },
  };

  constructor(private readonly idFactory: IdFactory) {}

  async execute(input: ToolInput, context: ToolExecutionContext): Promise<ToolResult> {
    const startTime = Date.now();
    const filePath = String(input['path'] ?? '');

    let rawContent = `mock content for ${filePath}`;
    if (filePath && fs.existsSync(filePath)) {
      try {
        rawContent = fs.readFileSync(filePath, 'utf-8');
      } catch {
        // Fallback for non-fs paths
      }
    }

    const output = `[Content of ${filePath}]:\n${rawContent}`;

    return {
      toolCallId: this.idFactory.create<'ToolCall'>(),
      name: this.definition.name,
      output,
      success: true,
      durationMs: Date.now() - startTime,
      metadata: { path: filePath, correlationId: context.correlationId },
    };
  }
}
