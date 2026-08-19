/**
 * Pre-Step Interception Pipeline (DeepSeek Harness Waterfall Pattern).
 *
 * Provides a sequential waterfall interception mechanism before every agent
 * step. Listeners can inspect, rewrite messages, inject context (e.g. repo maps,
 * architectural guidance), or reject the step entirely.
 */
import type {
  PreStepEvent,
  PreStepDecision,
  PreStepListener,
  PreStepInterceptor,
} from '../core/model/pre-step.js';
import type { ModelMessage } from '../core/model/model-io.js';

export class PreStepPipeline {
  private readonly listeners: Array<PreStepListener | PreStepInterceptor> = [];

  constructor(initialListeners?: ReadonlyArray<PreStepListener | PreStepInterceptor>) {
    if (initialListeners) {
      this.listeners.push(...initialListeners);
    }
  }

  /**
   * Register a pre-step listener or interceptor to the waterfall.
   */
  use(listener: PreStepListener | PreStepInterceptor): this {
    this.listeners.push(listener);
    return this;
  }

  /**
   * Returns the count of registered listeners.
   */
  get length(): number {
    return this.listeners.length;
  }

  /**
   * Execute the registered listeners in sequence as a waterfall.
   *
   * If any listener returns `{ kind: 'reject' }`, execution halts immediately.
   * Otherwise, each listener's modified messages are passed to the next listener.
   */
  async run(event: PreStepEvent): Promise<PreStepDecision> {
    return PreStepPipeline.runWaterfall(this.listeners, event);
  }

  /**
   * Static helper to execute a list of listeners as a waterfall.
   */
  static async runWaterfall(
    listeners: ReadonlyArray<PreStepListener | PreStepInterceptor>,
    initialEvent: PreStepEvent,
  ): Promise<PreStepDecision> {
    let currentMessages: ReadonlyArray<ModelMessage> = initialEvent.messages;

    for (const listener of listeners) {
      if (initialEvent.signal?.aborted) {
        return { kind: 'reject', reason: 'Pre-step execution aborted' };
      }

      const event: PreStepEvent = {
        ...initialEvent,
        messages: currentMessages,
      };

      let decision: PreStepDecision;
      if (typeof listener === 'function') {
        decision = await listener(event);
      } else if (typeof listener === 'object' && listener !== null && 'intercept' in listener) {
        decision = await listener.intercept(event);
      } else {
        continue;
      }

      if (decision.kind === 'reject') {
        return decision;
      }

      currentMessages = decision.messages;
    }

    return {
      kind: 'enter',
      messages: currentMessages,
    };
  }
}
