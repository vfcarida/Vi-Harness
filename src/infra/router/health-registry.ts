/**
 * Model Health Registry.
 *
 * Caches and checks provider health status to prevent routing requests to
 * unhealthy or failing providers.
 */
import type { ModelProvider } from '../../core/interfaces/model-provider.js';
import type { ModelHealth } from '../../core/model/model-io.js';
import { ProviderHealthStatus } from '../../core/model/model-io.js';

export class ModelHealthRegistry {
  private readonly healthCache = new Map<string, { health: ModelHealth; cachedAt: number }>();
  private readonly cacheTtlMs: number;

  constructor(cacheTtlMs: number = 10000) {
    this.cacheTtlMs = cacheTtlMs;
  }

  /**
   * Check if a provider is healthy enough to receive traffic.
   * Returns false if provider health is UNHEALTHY.
   */
  async isHealthy(provider: ModelProvider): Promise<boolean> {
    const cached = this.healthCache.get(provider.providerId);
    const now = Date.now();

    if (cached && now - cached.cachedAt < this.cacheTtlMs) {
      return cached.health.status !== ProviderHealthStatus.UNHEALTHY;
    }

    try {
      const health = await provider.getHealth();
      this.healthCache.set(provider.providerId, { health, cachedAt: now });
      return health.status !== ProviderHealthStatus.UNHEALTHY;
    } catch {
      this.healthCache.set(provider.providerId, {
        health: {
          providerId: provider.providerId,
          status: ProviderHealthStatus.UNHEALTHY,
          lastChecked: new Date(),
          errorMessage: 'Health check call failed',
        },
        cachedAt: now,
      });
      return false;
    }
  }

  /** Manually record provider health status (e.g. from runtime errors). */
  recordHealth(health: ModelHealth): void {
    this.healthCache.set(health.providerId, {
      health,
      cachedAt: Date.now(),
    });
  }

  /** Clear cached health entries. */
  clear(): void {
    this.healthCache.clear();
  }
}
