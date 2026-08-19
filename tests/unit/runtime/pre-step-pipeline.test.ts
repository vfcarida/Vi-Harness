/**
 * Pre-Step Interception Waterfall Tests.
 *
 * Validates DeepSeek Harness waterfall pattern:
 * 1. Sequential message modification across listeners.
 * 2. Short-circuit early rejection stopping downstream listeners.
 * 3. Object-based interceptor integration.
 * 4. Abort signal handling.
 */
import { describe, it, expect, vi } from 'vitest';
import { PreStepPipeline } from '../../../src/runtime/pre-step-pipeline.js';
import type {
  PreStepEvent,
  PreStepDecision,
  PreStepListener,
  PreStepInterceptor,
} from '../../../src/core/model/pre-step.js';
import { MessageRole, type ModelMessage } from '../../../src/core/model/model-io.js';

describe('PreStepPipeline (DeepSeek Harness Waterfall)', () => {
  it('1. Passes messages through unchanged when no listeners registered', async () => {
    const pipeline = new PreStepPipeline();
    const initialMessages: ModelMessage[] = [
      { role: MessageRole.USER, content: 'Original message' },
    ];

    const event: PreStepEvent = {
      messages: initialMessages,
      turn: 1,
      step: 1,
    };

    const decision = await pipeline.run(event);
    expect(decision.kind).toBe('enter');
    if (decision.kind === 'enter') {
      expect(decision.messages).toEqual(initialMessages);
    }
  });

  it('2. Sequentially rewrites messages through multiple waterfall listeners', async () => {
    const pipeline = new PreStepPipeline();

    // Listener 1: Injects repo map context
    const repoMapListener: PreStepListener = (evt) => {
      const repoMapMessage: ModelMessage = {
        role: MessageRole.SYSTEM,
        content: '[REPO MAP] src/index.ts, src/core.ts',
      };
      return {
        kind: 'enter',
        messages: [repoMapMessage, ...evt.messages],
      };
    };

    // Listener 2: Appends architectural guidance
    const guidanceListener: PreStepListener = (evt) => {
      const guidanceMessage: ModelMessage = {
        role: MessageRole.USER,
        content: 'Follow SOLID principles strictly.',
      };
      return {
        kind: 'enter',
        messages: [...evt.messages, guidanceMessage],
      };
    };

    pipeline.use(repoMapListener).use(guidanceListener);

    const initialMessages: ModelMessage[] = [
      { role: MessageRole.USER, content: 'Implement the feature.' },
    ];

    const event: PreStepEvent = {
      messages: initialMessages,
      turn: 1,
      step: 1,
    };

    const decision = await pipeline.run(event);
    expect(decision.kind).toBe('enter');
    if (decision.kind === 'enter') {
      expect(decision.messages).toHaveLength(3);
      expect(decision.messages[0]?.content).toContain('[REPO MAP]');
      expect(decision.messages[1]?.content).toBe('Implement the feature.');
      expect(decision.messages[2]?.content).toContain('Follow SOLID principles');
    }
  });

  it('3. Early rejection halts waterfall and stops downstream listeners from running', async () => {
    const downstreamSpy = vi.fn();

    const pipeline = new PreStepPipeline();

    // Listener 1: Rejects unsafe prompt
    const securityGate: PreStepListener = (evt) => {
      const isUnsafe = evt.messages.some((m) => m.content.includes('DROP DATABASE'));
      if (isUnsafe) {
        return {
          kind: 'reject',
          reason: 'Security violation: destructive database command detected.',
        };
      }
      return { kind: 'enter', messages: evt.messages };
    };

    // Listener 2: Downstream listener that should NOT be called
    const downstreamListener: PreStepListener = (evt) => {
      downstreamSpy();
      return { kind: 'enter', messages: evt.messages };
    };

    pipeline.use(securityGate).use(downstreamListener);

    const event: PreStepEvent = {
      messages: [{ role: MessageRole.USER, content: 'Please DROP DATABASE prod;' }],
      turn: 1,
      step: 1,
    };

    const decision = await pipeline.run(event);
    expect(decision.kind).toBe('reject');
    if (decision.kind === 'reject') {
      expect(decision.reason).toContain('Security violation');
    }
    expect(downstreamSpy).not.toHaveBeenCalled();
  });

  it('4. Supports object-based PreStepInterceptor implementations', async () => {
    class CustomInterceptor implements PreStepInterceptor {
      readonly name = 'prefix-enricher';
      intercept(evt: PreStepEvent): PreStepDecision {
        const enriched = evt.messages.map((m) => ({
          ...m,
          content: `[ENRICHED] ${m.content}`,
        }));
        return { kind: 'enter', messages: enriched };
      }
    }

    const pipeline = new PreStepPipeline();
    pipeline.use(new CustomInterceptor());

    const event: PreStepEvent = {
      messages: [{ role: MessageRole.USER, content: 'Hello' }],
      turn: 1,
      step: 1,
    };

    const decision = await pipeline.run(event);
    expect(decision.kind).toBe('enter');
    if (decision.kind === 'enter') {
      expect(decision.messages[0]?.content).toBe('[ENRICHED] Hello');
    }
  });

  it('5. Handles AbortSignal cancellation before/during waterfall', async () => {
    const abortController = new AbortController();
    abortController.abort();

    const pipeline = new PreStepPipeline();
    const listener = vi.fn().mockReturnValue({ kind: 'enter', messages: [] });
    pipeline.use(listener);

    const event: PreStepEvent = {
      messages: [{ role: MessageRole.USER, content: 'Task' }],
      turn: 1,
      step: 1,
      signal: abortController.signal,
    };

    const decision = await pipeline.run(event);
    expect(decision.kind).toBe('reject');
    if (decision.kind === 'reject') {
      expect(decision.reason).toContain('aborted');
    }
    expect(listener).not.toHaveBeenCalled();
  });
});
