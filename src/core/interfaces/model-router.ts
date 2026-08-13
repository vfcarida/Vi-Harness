/**
 * ModelRouter interface.
 *
 * "The runtime is model agnostic and must support hot-swapping."
 *
 * Evaluates candidate model providers based on utility calculation,
 * policy constraints, capability matching, budget limits, health,
 * and task requirements. Enables hot-swapping different models per iteration.
 */
import type { ModelProvider } from './model-provider.js';
import type { RoutingRequest, RoutingDecision } from '../model/router-types.js';

export interface ModelRouter {
  /** Route a task request to the optimal model provider. */
  route(request: RoutingRequest): Promise<RoutingDecision>;

  /** Register a model provider in the router's candidate pool. */
  registerProvider(provider: ModelProvider): void;

  /** Unregister a provider by providerId. Returns true if removed. */
  unregisterProvider(providerId: string): boolean;

  /** List all registered providers. */
  listProviders(): ReadonlyArray<ModelProvider>;

  /** Enable or disable policy-driven deterministic mode for testing. */
  setDeterministicMode(enabled: boolean): void;
}
