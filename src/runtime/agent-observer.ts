/**
 * Agent Observer Hub.
 *
 * Provides event subscription and broadcasting for runtime observability events.
 */
import type { AgentObserver } from '../core/interfaces/agent-runtime.js';
import type { AgentEvent } from '../core/model/runtime-types.js';

export class AgentObserverHub {
  private readonly observers = new Set<AgentObserver>();

  /** Subscribe an observer. Returns unsubscribe function. */
  subscribe(observer: AgentObserver): () => void {
    this.observers.add(observer);
    return () => {
      this.observers.delete(observer);
    };
  }

  /** Broadcast an AgentEvent to all subscribed observers. */
  emit(event: AgentEvent): void {
    for (const observer of this.observers) {
      try {
        observer.onEvent(event);
      } catch {
        // Observers must not crash the runtime
      }
    }
  }

  /** Remove all observers. */
  clear(): void {
    this.observers.clear();
  }
}
