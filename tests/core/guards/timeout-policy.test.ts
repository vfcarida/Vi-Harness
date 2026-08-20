import { describe, it, expect } from 'vitest';
import { DefaultTimeoutPolicy } from '../../../src/core/guards/timeout-policy.js';
import type { ToolDefinition } from '../../../src/core/model/tool-types.js';

describe('Tool-Call Timeout Policy — P018', () => {
  const timeoutPolicy = new DefaultTimeoutPolicy();

  it('1. Tool completing before timeout deadline returns standard result', async () => {
    const fastTool: ToolDefinition = {
      name: 'fast_tool',
      parameters: {},
      timeoutMs: 100,
      execute: async () => ({ success: true, output: 'fast-ok' }),
    };

    const res = await timeoutPolicy.enforce(fastTool, async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { success: true, output: 'completed-in-time' };
    });

    expect(res.success).toBe(true);
    expect(res.output).toBe('completed-in-time');
  });

  it('2. Tool exceeding timeout deadline triggers cooperative abort and returns timeout failure', async () => {
    const slowTool: ToolDefinition = {
      name: 'slow_tool',
      parameters: {},
      timeoutMs: 40,
      execute: async () => ({ success: true, output: '' }),
    };

    let signalAborted = false;

    const res = await timeoutPolicy.enforce(slowTool, async (signal) => {
      signal.addEventListener('abort', () => {
        signalAborted = true;
      });
      await new Promise((resolve) => setTimeout(resolve, 150));
      return { success: true, output: 'should-not-reach' };
    });

    expect(res.success).toBe(false);
    expect(res.output).toContain('Tool timed out after 40ms');
    expect(signalAborted).toBe(true);
  });

  it('3. Respects parent signal cancellation immediately', async () => {
    const parentController = new AbortController();

    const tool: ToolDefinition = {
      name: 'parent_abort_tool',
      parameters: {},
      timeoutMs: 500,
      execute: async () => ({ success: true, output: '' }),
    };

    let childSignalAborted = false;

    const promise = timeoutPolicy.enforce(
      tool,
      async (signal) => {
        signal.addEventListener('abort', () => {
          childSignalAborted = true;
        });
        await new Promise((resolve) => setTimeout(resolve, 300));
        return { success: true, output: 'done' };
      },
      parentController.signal,
    );

    // Trigger parent abort
    setTimeout(() => {
      parentController.abort();
    }, 20);

    await promise;
    expect(childSignalAborted).toBe(true);
  });

  it('4. Tool with zero or negative timeout executes without timer deadline', async () => {
    const unboundedTool: ToolDefinition = {
      name: 'unbounded_tool',
      parameters: {},
      timeoutMs: 0,
      execute: async () => ({ success: true, output: '' }),
    };

    const res = await timeoutPolicy.enforce(unboundedTool, async () => {
      return { success: true, output: 'unbounded-ok' };
    });

    expect(res.success).toBe(true);
    expect(res.output).toBe('unbounded-ok');
  });

  it('5. Tool throwing error within timeout duration returns failure ToolResult', async () => {
    const errorTool: ToolDefinition = {
      name: 'error_tool',
      parameters: {},
      timeoutMs: 100,
      execute: async () => ({ success: true, output: '' }),
    };

    const res = await timeoutPolicy.enforce(errorTool, async () => {
      throw new Error('Network reset by peer');
    });

    expect(res.success).toBe(false);
    expect(res.output).toContain('Tool execution failed: Network reset by peer');
  });

  it('6. Uses default timeout when tool does not declare timeoutMs', async () => {
    const customPolicy = new DefaultTimeoutPolicy(30);
    const noTimeoutTool: ToolDefinition = {
      name: 'no_timeout_prop',
      parameters: {},
      execute: async () => ({ success: true, output: '' }),
    };

    const res = await customPolicy.enforce(noTimeoutTool, async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return { success: true, output: 'done' };
    });

    expect(res.success).toBe(false);
    expect(res.output).toContain('Tool timed out after 30ms');
  });
});
