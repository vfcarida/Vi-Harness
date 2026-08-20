import { describe, it, expect } from 'vitest';
import {
  DefaultPluginContext,
  WaterfallEngine,
  type ToolExecutionRecord,
  type ToolPreExecuteDecision,
} from '../../../src/core/plugin/index.js';

describe('Waterfall Interception Engine — P017', () => {
  it('1. agent/pre-step: allows listener to inspect turn and step and return decision', async () => {
    const ctx = new DefaultPluginContext();

    ctx.intercept('agent/pre-step', async (messages, turn, step, next) => {
      if (turn > 10) {
        return { decision: 'REJECT', reason: 'Turn limit exceeded in middleware' };
      }
      return next();
    });

    const allowDecision = await ctx.waterfall('agent/pre-step', [], 1, 1);
    expect(allowDecision.decision).toBe('ALLOW');

    const rejectDecision = await ctx.waterfall('agent/pre-step', [], 15, 1);
    expect(rejectDecision.decision).toBe('REJECT');
    expect(rejectDecision.reason).toContain('Turn limit exceeded');
  });

  it('2. agent/request: intercepts and mutates ModelRequest before LLM transmission', async () => {
    const ctx = new DefaultPluginContext();

    ctx.intercept('agent/request', async (req, next) => {
      const modified = {
        ...req,
        temperature: 0.2,
      };
      return next(modified);
    });

    const originalReq: any = {
      modelId: 'gpt-4o',
      messages: [],
      temperature: 0.9,
    };

    const finalReq = await ctx.waterfall('agent/request', originalReq);
    expect(finalReq.temperature).toBe(0.2);
  });

  it('3. tools/pre-execute: denies execution or rewrites tool arguments', async () => {
    const ctx = new DefaultPluginContext();

    ctx.intercept('tools/pre-execute', async (execution, next) => {
      if (execution.toolName === 'dangerous_command') {
        return {
          allow: false,
          reason: 'Blocked by security interceptor',
        };
      }
      if (execution.input.query) {
        return next({
          ...execution,
          input: { query: String(execution.input.query).trim() },
        });
      }
      return next();
    });

    // Case A: Blocked tool
    const blocked = await ctx.waterfall('tools/pre-execute', {
      toolName: 'dangerous_command',
      input: {},
    });
    expect(blocked.allow).toBe(false);
    expect(blocked.reason).toContain('Blocked by security');

    // Case B: Allowed tool with argument sanitization
    const allowed = await ctx.waterfall('tools/pre-execute', {
      toolName: 'search_symbols',
      input: { query: '   testQuery   ' },
    });
    expect(allowed.allow).toBe(true);
  });

  it('4. tools/post-execute: redacts or transforms tool results before context inclusion', async () => {
    const ctx = new DefaultPluginContext();

    ctx.intercept('tools/post-execute', async (execution, result, next) => {
      if (typeof result.output === 'string' && result.output.includes('SECRET_API_KEY')) {
        const redacted = {
          ...result,
          output: result.output.replace(/SECRET_API_KEY=\w+/, 'SECRET_API_KEY=[REDACTED]'),
        };
        return next(execution, redacted);
      }
      return next();
    });

    const execution: ToolExecutionRecord = {
      toolName: 'read_file',
      input: { path: '.env' },
    };

    const rawResult: any = {
      success: true,
      output: 'SECRET_API_KEY=sk-123456789\nPORT=3000',
    };

    const processed = await ctx.waterfall('tools/post-execute', execution, rawResult);
    expect(processed.output).toContain('SECRET_API_KEY=[REDACTED]');
    expect(processed.output).not.toContain('sk-123456789');
  });

  it('5. Middleware chaining: executes handlers in sequential registration order', async () => {
    const engine = new WaterfallEngine();
    const order: string[] = [];

    engine.register('agent/request', async (req, next) => {
      order.push('step-1');
      return next();
    });

    engine.register('agent/request', async (req, next) => {
      order.push('step-2');
      return next();
    });

    engine.register('agent/request', async (req, next) => {
      order.push('step-3');
      return next();
    });

    await engine.execute('agent/request', { modelId: 'test', messages: [] } as any);
    expect(order).toEqual(['step-1', 'step-2', 'step-3']);
  });

  it('6. Short-circuit: halts pipeline immediately when a handler does not call next()', async () => {
    const engine = new WaterfallEngine();
    const order: string[] = [];

    engine.register('tools/pre-execute', async (exec, next) => {
      order.push('h1');
      return { allow: false, reason: 'Short-circuited at h1' };
    });

    engine.register('tools/pre-execute', async (exec, next) => {
      order.push('h2'); // Should not be reached
      return next();
    });

    const decision = await engine.execute('tools/pre-execute', { toolName: 'rm', input: {} });
    expect(order).toEqual(['h1']);
    expect(decision.allow).toBe(false);
    expect(decision.reason).toContain('Short-circuited at h1');
  });

  it('7. Disposer removes interceptor from the waterfall chain', async () => {
    const ctx = new DefaultPluginContext();
    let hitCount = 0;

    const disposer = ctx.intercept('agent/request', async (req, next) => {
      hitCount++;
      return next();
    });

    await ctx.waterfall('agent/request', { modelId: 'test', messages: [] } as any);
    expect(hitCount).toBe(1);

    disposer();
    await ctx.waterfall('agent/request', { modelId: 'test', messages: [] } as any);
    expect(hitCount).toBe(1);
  });

  it('8. Default returns are provided when no interceptors are registered', async () => {
    const engine = new WaterfallEngine();

    const preStep = await engine.execute('agent/pre-step', [], 1, 1);
    expect(preStep.decision).toBe('ALLOW');

    const req: any = { modelId: 'default-model' };
    const reqOut = await engine.execute('agent/request', req);
    expect(reqOut).toBe(req);

    const exec: any = { toolName: 'git' };
    const preExec = await engine.execute('tools/pre-execute', exec);
    expect(preExec.allow).toBe(true);

    const res: any = { success: true };
    const postExec = await engine.execute('tools/post-execute', exec, res);
    expect(postExec).toBe(res);
  });

  it('9. Propagates async errors from within waterfall interceptor', async () => {
    const engine = new WaterfallEngine();

    engine.register('agent/request', async () => {
      throw new Error('Async network failure during request hook');
    });

    await expect(
      engine.execute('agent/request', { modelId: 'test', messages: [] } as any),
    ).rejects.toThrow('Async network failure during request hook');
  });
});
