/**
 * Default Tool Executor.
 *
 * Implements ToolExecutor contract:
 * - Application-level input sanitization & prototype pollution defense
 * - Registry lookup & schema validation
 * - Policy Engine integration (DENY / ALLOW checks)
 * - Timeout enforcement & AbortSignal cancellation
 * - Output secret scrubbing
 * - Correlation tracking & structured metadata mapping
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
import { SecretScrubber } from '../security/secret-scrubber.js';

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

    // 1. Prototype Pollution & Malicious Argument Defense
    const sanitizedInput = sanitizeToolInput(request.input);

    const correlationId =
      request.context?.correlationId ?? this.idFactory.create<'Trace'>();
    const timeoutMs = request.context?.timeoutMs ?? tool.definition.defaultTimeoutMs;

    const fullContext: ToolExecutionContext = {
      correlationId,
      taskId: request.context?.taskId,
      iterationId: request.context?.iterationId,
      signal: request.context?.signal,
      timeoutMs,
      workingDirectory: request.context?.workingDirectory,
      environment: request.context?.environment,
    };

    const baseMetadata: Record<string, unknown> = {
      correlationId,
      toolName: tool.definition.name,
      version: tool.definition.version,
      inputSchema: tool.definition.inputSchema,
      validatedInput: sanitizedInput,
      timeoutMs,
      riskLevel: tool.definition.riskLevel,
      mutating: tool.definition.mutating,
      idempotent: tool.definition.idempotent,
    };

    // 2. Schema Validation
    const validation = this.registry.validateInput(tool.definition.name, sanitizedInput);
    if (!validation.valid) {
      throw new HarnessError({
        code: ErrorCode.TOOL_INVALID_INPUT,
        category: ErrorCategory.TOOL,
        message: `Invalid input for tool [${tool.definition.name}]: ${(validation.errors ?? []).join(', ')}`,
      });
    }

    // 3. Cancellation Check
    if (fullContext.signal?.aborted) {
      return {
        toolCallId: this.idFactory.create<'ToolCall'>(),
        name: tool.definition.name,
        output: '',
        success: false,
        durationMs: Date.now() - startTime,
        error: 'Execution cancelled via AbortSignal',
        metadata: baseMetadata,
      };
    }

    // 4. Policy Engine Evaluation (Unbypassable for Security-Critical Operations)
    const isSecurityCritical =
      tool.definition.mutating ||
      tool.definition.irreversible === true ||
      tool.definition.category === 'EXECUTE' ||
      tool.definition.category === 'DESTRUCTIVE' ||
      tool.definition.requiresNetwork === true ||
      tool.definition.riskLevel === 'HIGH' ||
      tool.definition.riskLevel === 'CRITICAL' ||
      tool.definition.filesystemScope === 'system' ||
      request.requiresPolicy !== false;

    if (this.policyEngine && isSecurityCritical) {
      const actionResource = String(
        sanitizedInput['path'] ??
        sanitizedInput['cmd'] ??
        sanitizedInput['command'] ??
        sanitizedInput['url'] ??
        tool.definition.name,
      );

      const action = {
        type: tool.definition.category,
        resource: actionResource,
        metadata: {
          ...sanitizedInput,
          toolName: tool.definition.name,
          path: sanitizedInput['path'],
          cmd: sanitizedInput['cmd'] ?? sanitizedInput['command'],
          url: sanitizedInput['url'],
        },
        irreversible:
          tool.definition.irreversible ??
          (tool.definition.riskLevel === 'HIGH' || tool.definition.riskLevel === 'CRITICAL'),
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
          metadata: { ...baseMetadata, ruleId: evaluation.ruleId, decision: evaluation.decision, errorCode: 'POLICY_DENIED' },
        };
      }

      if (
        evaluation.decision === PolicyDecisionType.REQUIRE_APPROVAL ||
        evaluation.decision === PolicyDecisionType.ESCALATE
      ) {
        return {
          toolCallId: this.idFactory.create<'ToolCall'>(),
          name: tool.definition.name,
          output: '',
          success: false,
          durationMs: Date.now() - startTime,
          error: `Policy REQUIRES_APPROVAL for tool execution: ${evaluation.reason}`,
          metadata: { ...baseMetadata, ruleId: evaluation.ruleId, decision: evaluation.decision, errorCode: 'REQUIRES_APPROVAL' },
        };
      }
    }

    // 5. Timeout Enforcement & Execution
    try {
      const executionPromise = tool.execute(sanitizedInput, fullContext);

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

      const res = await Promise.race([executionPromise, timeoutPromise]);
      const scrubbedOutput = SecretScrubber.scrub(res.output);
      const scrubbedError = res.error ? SecretScrubber.scrub(res.error) : undefined;

      return {
        ...res,
        output: scrubbedOutput,
        error: scrubbedError,
        durationMs: res.durationMs || (Date.now() - startTime),
        metadata: {
          ...baseMetadata,
          ...(res.metadata ?? {}),
        },
      };
    } catch (err) {
      const durationMs = Date.now() - startTime;
      if (err instanceof HarnessError) throw err;

      const rawError = err instanceof Error ? err.message : String(err);
      return {
        toolCallId: this.idFactory.create<'ToolCall'>(),
        name: tool.definition.name,
        output: '',
        success: false,
        durationMs,
        error: SecretScrubber.scrub(rawError),
        metadata: baseMetadata,
      };
    }
  }
}

/**
 * Deep sanitization to prevent prototype pollution and null-byte injection.
 */
function sanitizeToolInput(input: Record<string, unknown>): Record<string, unknown> {
  if (!input || typeof input !== 'object') return {};

  const clean: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    // 1. Prototype pollution guard
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }

    // 2. Value sanitization
    if (typeof value === 'string') {
      // Strip null bytes
      clean[key] = value.replace(/\0/g, '');
    } else if (Array.isArray(value)) {
      clean[key] = value.map((item) => {
        if (typeof item === 'string') return item.replace(/\0/g, '');
        if (typeof item === 'object' && item !== null) return sanitizeToolInput(item as Record<string, unknown>);
        return item;
      });
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = sanitizeToolInput(value as Record<string, unknown>);
    } else {
      clean[key] = value;
    }
  }

  return clean;
}
