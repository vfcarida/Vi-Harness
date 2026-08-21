/**
 * Circuit Breaker for External Model Providers & API Transports.
 *
 * Prevents cascading failures and resource exhaustion during sustained downstream
 * provider outages by transitioning across three states:
 * - CLOSED (normal operation)
 * - OPEN (fast-failing calls immediately without hitting network)
 * - HALF_OPEN (probing recovery with limited canary traffic)
 */
import { HarnessError } from '../../core/errors/base-error.js';
import { ErrorCode, ErrorCategory } from '../../core/errors/error-codes.js';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  readonly failureThreshold?: number; // Consecutive failures to open circuit (default: 5)
  readonly recoveryTimeoutMs?: number; // Time to wait before testing half-open (default: 30000ms)
  readonly successThreshold?: number; // Successes in half-open state to close circuit (default: 2)
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;

  private readonly failureThreshold: number;
  private readonly recoveryTimeoutMs: number;
  private readonly successThreshold: number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.recoveryTimeoutMs = options.recoveryTimeoutMs ?? 30000;
    this.successThreshold = options.successThreshold ?? 2;
  }

  get currentState(): CircuitState {
    this.evaluateState();
    return this.state;
  }

  get isAvailable(): boolean {
    const state = this.currentState;
    return state === 'CLOSED' || state === 'HALF_OPEN';
  }

  /**
   * Execute an asynchronous action through the circuit breaker.
   */
  async execute<T>(action: () => Promise<T>): Promise<T> {
    if (!this.isAvailable) {
      throw new HarnessError({
        code: ErrorCode.MODEL_UNAVAILABLE,
        category: ErrorCategory.MODEL,
        message: `Circuit breaker is OPEN. Fast-failing downstream request to prevent cascading failure.`,
      });
    }

    try {
      const result = await action();
      this.recordSuccess();
      return result;
    } catch (err: unknown) {
      this.recordFailure();
      throw err;
    }
  }

  recordSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.reset();
      }
    } else if (this.state === 'CLOSED') {
      this.failureCount = 0;
    }
  }

  recordFailure(): void {
    this.lastFailureTime = Date.now();
    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.failureCount = this.failureThreshold;
      this.successCount = 0;
    } else if (this.state === 'CLOSED') {
      this.failureCount++;
      if (this.failureCount >= this.failureThreshold) {
        this.state = 'OPEN';
      }
    }
  }

  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
  }

  private evaluateState(): void {
    if (this.state === 'OPEN') {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.recoveryTimeoutMs) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
      }
    }
  }
}
