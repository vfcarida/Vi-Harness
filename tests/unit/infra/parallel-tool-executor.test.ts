import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ParallelToolExecutor } from '../../../src/infra/tools/parallel-tool-executor.js';
import { DefaultToolRegistry } from '../../../src/infra/tools/default-tool-registry.js';
import { DefaultToolExecutor } from '../../../src/infra/tools/default-tool-executor.js';
import { UuidV7IdFactory } from '../../../src/infra/id/uuid-id-factory.js';
import type { Tool } from '../../../src/core/interfaces/tool.js';
import { ToolCategory, ToolRiskLevel } from '../../../src/core/model/tool-types.js';

describe('ParallelToolExecutor Unit Suite', () => {
  let registry: DefaultToolRegistry;
  let defaultExecutor: DefaultToolExecutor;
  let parallelExecutor: ParallelToolExecutor;
  let idFactory: UuidV7IdFactory;

  beforeEach(() => {
    idFactory = new UuidV7IdFactory();
    registry = new DefaultToolRegistry();
    defaultExecutor = new DefaultToolExecutor({ registry, idFactory });
    parallelExecutor = new ParallelToolExecutor(defaultExecutor, registry);
  });

  it('1. Executes non-mutating tools in parallel', async () => {
    const executionOrder: string[] = [];

    const readToolA: Tool = {
      name: 'read_tool_a',
      description: 'Read Tool A',
      definition: {
        name: 'read_tool_a',
        version: '1.0.0',
        description: 'Read Tool A',
        category: ToolCategory.READ,
        riskLevel: ToolRiskLevel.LOW,
        mutating: false,
        idempotent: true,
        defaultTimeoutMs: 5000,
        requiredPermissions: [],
        inputSchema: { type: 'object' },
      },
      async execute() {
        await new Promise((r) => setTimeout(r, 30));
        executionOrder.push('read_a');
        return {
          toolCallId: idFactory.create<'ToolCall'>(),
          name: 'read_tool_a',
          success: true,
          output: 'A',
          durationMs: 30,
        };
      },
    };

    const readToolB: Tool = {
      name: 'read_tool_b',
      description: 'Read Tool B',
      definition: {
        name: 'read_tool_b',
        version: '1.0.0',
        description: 'Read Tool B',
        category: ToolCategory.READ,
        riskLevel: ToolRiskLevel.LOW,
        mutating: false,
        idempotent: true,
        defaultTimeoutMs: 5000,
        requiredPermissions: [],
        inputSchema: { type: 'object' },
      },
      async execute() {
        await new Promise((r) => setTimeout(r, 10));
        executionOrder.push('read_b');
        return {
          toolCallId: idFactory.create<'ToolCall'>(),
          name: 'read_tool_b',
          success: true,
          output: 'B',
          durationMs: 10,
        };
      },
    };

    registry.register(readToolA);
    registry.register(readToolB);

    const results = await parallelExecutor.executeBatch([
      { toolName: 'read_tool_a', input: {} },
      { toolName: 'read_tool_b', input: {} },
    ]);

    expect(results).toHaveLength(2);
    expect(results[0]?.output).toBe('A');
    expect(results[1]?.output).toBe('B');
    // Because they run in parallel and B is faster (10ms vs 30ms), B finishes first
    expect(executionOrder).toEqual(['read_b', 'read_a']);
  });

  it('2. Executes mutating tools sequentially and preserves positional index in results', async () => {
    const writeOrder: string[] = [];

    const writeTool: Tool = {
      name: 'write_tool',
      description: 'Write Tool',
      definition: {
        name: 'write_tool',
        version: '1.0.0',
        description: 'Write Tool',
        category: ToolCategory.WRITE,
        riskLevel: ToolRiskLevel.MEDIUM,
        mutating: true,
        idempotent: false,
        defaultTimeoutMs: 5000,
        requiredPermissions: [],
        inputSchema: { type: 'object' },
      },
      async execute(input: any) {
        writeOrder.push(input.item);
        return {
          toolCallId: idFactory.create<'ToolCall'>(),
          name: 'write_tool',
          success: true,
          output: `Wrote ${input.item}`,
          durationMs: 5,
        };
      },
    };

    const readTool: Tool = {
      name: 'read_tool',
      description: 'Read Tool',
      definition: {
        name: 'read_tool',
        version: '1.0.0',
        description: 'Read Tool',
        category: ToolCategory.READ,
        riskLevel: ToolRiskLevel.LOW,
        mutating: false,
        idempotent: true,
        defaultTimeoutMs: 5000,
        requiredPermissions: [],
        inputSchema: { type: 'object' },
      },
      async execute() {
        return {
          toolCallId: idFactory.create<'ToolCall'>(),
          name: 'read_tool',
          success: true,
          output: 'Read Data',
          durationMs: 5,
        };
      },
    };

    registry.register(writeTool);
    registry.register(readTool);

    const batch = [
      { toolName: 'write_tool', input: { item: 'step-1' } },
      { toolName: 'read_tool', input: {} },
      { toolName: 'write_tool', input: { item: 'step-2' } },
    ];

    const results = await parallelExecutor.executeBatch(batch);

    expect(results).toHaveLength(3);
    expect(results[0]?.output).toBe('Wrote step-1');
    expect(results[1]?.output).toBe('Read Data');
    expect(results[2]?.output).toBe('Wrote step-2');
    expect(writeOrder).toEqual(['step-1', 'step-2']);
  });

  it('3. Handles failure in one tool call gracefully without crashing the whole batch', async () => {
    const goodTool: Tool = {
      name: 'good_tool',
      description: 'Good Tool',
      definition: {
        name: 'good_tool',
        version: '1.0.0',
        description: 'Good Tool',
        category: ToolCategory.READ,
        riskLevel: ToolRiskLevel.LOW,
        mutating: false,
        idempotent: true,
        defaultTimeoutMs: 5000,
        requiredPermissions: [],
        inputSchema: { type: 'object' },
      },
      async execute() {
        return {
          toolCallId: idFactory.create<'ToolCall'>(),
          name: 'good_tool',
          success: true,
          output: 'Success',
          durationMs: 5,
        };
      },
    };

    const faultyTool: Tool = {
      name: 'faulty_tool',
      description: 'Faulty Tool',
      definition: {
        name: 'faulty_tool',
        version: '1.0.0',
        description: 'Faulty Tool',
        category: ToolCategory.READ,
        riskLevel: ToolRiskLevel.LOW,
        mutating: false,
        idempotent: true,
        defaultTimeoutMs: 5000,
        requiredPermissions: [],
        inputSchema: { type: 'object' },
      },
      async execute() {
        throw new Error('Tool crashed internal exception');
      },
    };

    registry.register(goodTool);
    registry.register(faultyTool);

    const results = await parallelExecutor.executeBatch([
      { toolName: 'good_tool', input: {} },
      { toolName: 'faulty_tool', input: {} },
    ]);

    expect(results).toHaveLength(2);
    expect(results[0]?.success).toBe(true);
    expect(results[1]?.success).toBe(false);
    expect(results[1]?.error).toContain('Tool crashed internal exception');
  });
});
