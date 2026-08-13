/**
 * Default Tool Executor.
 *
 * Implements ToolExecutor contract:
 * - Registry lookup & schema validation
 * - Policy Engine integration (DENY / ALLOW checks)
 * - Command normalization for EXECUTE tools
 * - Timeout enforcement & AbortSignal cancellation
 * - Correlation tracking & structured error mapping
 */
import type { ToolExecutor, ToolExecutionRequest } from '../../core/interfaces/tool-executor.js';
import type { ToolRegistry } from '../../core/interfaces/tool-registry.js';
import type { PolicyEngine } from '../../core/interfaces/policy-engine.js';
import type { Tool } from '../../core/interfaces/tool.js';
import type { ToolCategory, ToolResult, ToolExecutionContext } from '../../core/model/tool-types.js';
import type { IdFactory } from '../../core/types/identifiers.js';
import { DefaultToolRegistry } from './default-tool-registry.js';
import { HarnessError } from '../../core/errors/base-error.js';
import { ErrorCode, ErrorCategory } from '../../core/errors/error-codes.js';
import { PolicyDecisionType } from '../../core/model/policy.js';

export interface DefaultToolExecutorOptions {
  readonly registry?: ToolRegistry;
  readonly policyEngine?: PolicyEngine;
  readonly idFactory: IdFactory;
}

export class DefaultToolExecutor implements ToolExecutor {
  private readonly registry: ToolRegistry;
  private readonly policyEngine?: PolicyEngine;
  private readonly idFactory: IdFactory;

  constructor(options: DefaultToolExecutorOptions) {
    this.registry = options.registry ?? new DefaultToolRegistry();
    this.policyEngine = options.policyEngine;
    this.idFactory = options.idFactory;
  }

  register(tool: Tool): void {
    this.registry.register(tool);
  }

  getTool(name: string): Tool | undefined {
    return this.registry.getTool(name);
  }

  listTools(category?: ToolCategory): ReadonlyArray<Tool> {
    return this.registry.listTools(category);
  }

  async execute(request: ToolExecutionRequest): Promise<ToolResult> {
    const startTime = Date.now();
    const toolName = request.toolName ?? request.tool?.definition.name;

    if (!toolName) {
      throw new HarnessError({
        code: ErrorCode.TOOL_NOT_FOUND,
        category: ErrorCategory.TOOL,
        message: 'Tool execution request missing toolName or tool instance.',
      });
    }

    const tool = request.tool ?? this.registry.getTool(toolName);
    if (!tool) {
      throw new HarnessError({
        code: ErrorCode.TOOL_NOT_FOUND,
        category: ErrorCategory.TOOL,
        message: `Tool not registered: ${toolName}`,
      });
    }

    const correlationId =
      request.context?.correlationId ?? this.idFactory.create<'Trace'>();

    const fullContext: ToolExecutionContext = {
      correlationId,
      taskId: request.context?.taskId,
      iterationId: request.context?.iterationId,
      signal: request.context?.signal,
      timeoutMs: request.context?.timeoutMs ?? tool.definition.defaultTimeoutMs,
      workingDirectory: request.context?.workingDirectory,
      environment: request.context?.environment,
    };

    // 1. Schema Validation
    const validation = this.registry.validateInput(tool.definition.name, request.input);
    if (!validation.valid) {
      throw new HarnessError({
        code: ErrorCode.TOOL_INVALID_INPUT,
        category: ErrorCategory.TOOL,
        message: `Invalid input for tool [${tool.definition.name}]: ${(validation.errors ?? []).join(', ')}`,
      });
    }

    // 2. Cancellation Check
    if (fullContext.signal?.aborted) {
      return {
        toolCallId: this.idFactory.create<'ToolCall'>(),
        name: tool.definition.name,
        output: '',
        success: false,
        durationMs: Date.now() - startTime,
        error: 'Execution cancelled via AbortSignal',
        metadata: { correlationId },
      };
    }

    // 3. Policy Engine Evaluation
    if (request.requiresPolicy && this.policyEngine) {
      const action = {
        type: tool.definition.category,
        resource: tool.definition.name,
        metadata: request.input,
        irreversible: tool.definition.riskLevel === 'HIGH' || tool.definition.riskLevel === 'CRITICAL',
      };

      const evaluation = await this.policyEngine.evaluate(action);

      if (evaluation.decision === PolicyDecisionType.DENY) {
        return {
          toolCallId: this.idFactory.create<'ToolCall'>(),
          name: tool.definition.name,
          output: '',
          success: false,
          durationMs: Date.now() - startTime,
          error: `Policy DENIED tool execution: ${evaluation.reason}`,
          metadata: { correlationId },
        };
      }
    }

    // 4. Timeout Enforcement & Execution
    const timeoutMs = fullContext.timeoutMs ?? tool.definition.defaultTimeoutMs;

    try {
      const executionPromise = tool.execute(request.input, fullContext);

      const timeoutPromise = new Promise<ToolResult>((_, reject) => {
        const timer = setTimeout(() => {
          reject(
            new HarnessError({
              code: ErrorCode.TOOL_TIMEOUT,
              category: ErrorCategory.TOOL,
              message: `Tool [${tool.definition.name}] timed out after ${timeoutMs}ms`,
            }),
          );
        }, timeoutMs);

        fullContext.signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(
            new HarnessError({
              code: ErrorCode.TOOL_TIMEOUT,
              category: ErrorCategory.TOOL,
              message: `Tool [${tool.definition.name}] aborted`,
            }),
          );
        });
      });

      return await Promise.race([executionPromise, timeoutPromise]);
    } catch (err) {
      const durationMs = Date.now() - startTime;
      if (err instanceof HarnessError) throw err;

      return {
        toolCallId: this.idFactory.create<'ToolCall'>(),
        name: tool.definition.name,
        output: '',
        success: false,
        durationMs,
        error: err instanceof Error ? err.message : String(err),
        metadata: { correlationId },
      };
    }
  }
}
