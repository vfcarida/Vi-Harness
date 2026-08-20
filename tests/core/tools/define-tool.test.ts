import { describe, it, expect } from 'vitest';
import { defineTool } from '../../../src/core/tools/define-tool.js';

describe('defineTool DSL & Schema Generation — P018', () => {
  it('1. Generates valid JSON Schema with required fields and types', () => {
    const tool = defineTool({
      name: 'search_files',
      description: 'Search repository files',
      parameters: {
        pattern: { type: 'string', description: 'Regex pattern', required: true },
        maxResults: { type: 'integer', description: 'Limit', default: 10, minimum: 1 },
        caseSensitive: { type: 'boolean', description: 'Match case' },
      },
      isConcurrencySafe: () => true,
      timeoutMs: 15000,
      execute: async (args) => {
        return `Found results for ${args.pattern}`;
      },
    });

    expect(tool.name).toBe('search_files');
    expect(tool.description).toBe('Search repository files');
    expect(tool.timeoutMs).toBe(15000);
    expect(tool.isConcurrencySafe?.({})).toBe(true);

    expect(tool.parameters).toEqual({
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Regex pattern' },
        maxResults: { type: 'integer', description: 'Limit', default: 10, minimum: 1 },
        caseSensitive: { type: 'boolean', description: 'Match case' },
      },
      required: ['pattern'],
    });
  });

  it('2. Executes successfully and formats primitive/string output', async () => {
    const tool = defineTool({
      name: 'greet',
      description: 'Greet user',
      parameters: {
        name: { type: 'string', required: true },
      },
      execute: async (args) => {
        return `Hello, ${args.name}!`;
      },
    });

    const res = await tool.execute({ name: 'Alice' });
    expect(res.success).toBe(true);
    expect(res.output).toBe('Hello, Alice!');
  });

  it('3. Formats structured object return values as JSON', async () => {
    const tool = defineTool({
      name: 'inspect_ast',
      description: 'Inspect AST',
      parameters: {
        filePath: { type: 'string', required: true },
      },
      execute: async (args) => {
        return { file: args.filePath, symbols: ['A', 'B'], count: 2 };
      },
    });

    const res = await tool.execute({ filePath: 'main.ts' });
    expect(res.success).toBe(true);
    const parsed = JSON.parse(res.output);
    expect(parsed.file).toBe('main.ts');
    expect(parsed.count).toBe(2);
  });

  it('4. Traps errors in execution and returns failure ToolResult', async () => {
    const tool = defineTool({
      name: 'failing_tool',
      description: 'A tool that fails',
      parameters: {},
      execute: async () => {
        throw new Error('Connection refused by remote host');
      },
    });

    const res = await tool.execute({});
    expect(res.success).toBe(false);
    expect(res.output).toContain('Tool execution failed: Connection refused by remote host');
  });

  it('5. Dynamic isConcurrencySafe logic based on arguments', () => {
    const tool = defineTool({
      name: 'file_op',
      description: 'File operation',
      parameters: {
        mode: { type: 'string', enum: ['read', 'write'], required: true },
      },
      isConcurrencySafe: (args) => args.mode === 'read',
      execute: async () => 'done',
    });

    expect(tool.isConcurrencySafe?.({ mode: 'read' })).toBe(true);
    expect(tool.isConcurrencySafe?.({ mode: 'write' })).toBe(false);
  });

  it('6. Passes execution context to execute handler', async () => {
    let capturedCtx: any;

    const tool = defineTool({
      name: 'ctx_tool',
      description: 'Context tool',
      parameters: {},
      execute: async (args, ctx) => {
        capturedCtx = ctx;
        return 'ok';
      },
    });

    await tool.execute({}, { sessionId: 'sess-99' });
    expect(capturedCtx).toEqual({ sessionId: 'sess-99' });
  });

  it('7. Handles tool returning object with output property directly', async () => {
    const tool = defineTool({
      name: 'wrapped_output_tool',
      description: 'Wrapped output',
      parameters: {},
      execute: async () => {
        return { output: 'explicitly-wrapped' };
      },
    });

    const res = await tool.execute({});
    expect(res.success).toBe(true);
    expect(res.output).toBe('explicitly-wrapped');
  });
});
