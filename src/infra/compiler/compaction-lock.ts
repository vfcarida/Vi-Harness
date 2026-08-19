/**
 * Lock-Based Compaction with Crash Recovery (DeepSeek Harness inspired).
 *
 * Implements CompactionLock interface:
 * - Brackets compaction operations with start/end events (`compaction/start`, `compaction/end`).
 * - Prevents concurrent compaction runs on the same session.
 * - Detects orphaned locks (caused by mid-compaction crashes or timeouts).
 * - Provides safe crash recovery to clear orphaned locks on task/session resume.
 */
import type { CompactionLock } from '../../core/model/compiler-types.js';

export interface LockState {
  readonly sessionId: string;
  readonly locked: boolean;
  readonly acquiredAt: Date;
  readonly lastEvent: 'compaction/start' | 'compaction/end' | 'compaction/error';
  readonly lastError?: Error;
  readonly timeoutMs: number;
}

export interface InMemoryCompactionLockOptions {
  readonly timeoutMs?: number; // default: 30,000ms
}

export class InMemoryCompactionLock implements CompactionLock {
  private readonly locks = new Map<string, LockState>();
  private readonly defaultTimeoutMs: number;

  constructor(options?: InMemoryCompactionLockOptions) {
    this.defaultTimeoutMs = options?.timeoutMs ?? 30_000;
  }

  /**
   * Acquire exclusive compaction lock for a session.
   * Emits 'compaction/start'.
   * Returns false if already locked.
   */
  acquire(sessionId: string): boolean {
    const existing = this.locks.get(sessionId);

    if (existing && existing.locked) {
      return false;
    }

    const state: LockState = {
      sessionId,
      locked: true,
      acquiredAt: new Date(),
      lastEvent: 'compaction/start',
      timeoutMs: this.defaultTimeoutMs,
    };

    this.locks.set(sessionId, state);
    return true;
  }

  /**
   * Release compaction lock for a session.
   * Emits 'compaction/end' (or 'compaction/error' if error provided).
   */
  release(sessionId: string, error?: Error): void {
    const existing = this.locks.get(sessionId);
    if (!existing) return;

    const state: LockState = {
      ...existing,
      locked: false,
      lastEvent: error ? 'compaction/error' : 'compaction/end',
      lastError: error,
    };

    this.locks.set(sessionId, state);
  }

  /**
   * Detect if a lock was left orphaned mid-compaction (e.g. from process crash or timeout).
   */
  isOrphaned(sessionId: string): boolean {
    const existing = this.locks.get(sessionId);
    if (!existing || !existing.locked) {
      return false;
    }

    const elapsedMs = Date.now() - existing.acquiredAt.getTime();
    return elapsedMs >= existing.timeoutMs;
  }

  /**
   * Clean up and recover an orphaned lock.
   */
  recover(sessionId: string): void {
    const existing = this.locks.get(sessionId);
    if (!existing) return;

    this.locks.set(sessionId, {
      ...existing,
      locked: false,
      lastEvent: 'compaction/end',
    });
  }

  /**
   * Inspect current lock state for telemetry or testing.
   */
  getLockState(sessionId: string): LockState | undefined {
    return this.locks.get(sessionId);
  }

  /**
   * Force lock into orphaned state (useful for simulated crash testing).
   */
  forceOrphaned(sessionId: string): void {
    const existing = this.locks.get(sessionId);
    if (existing) {
      this.locks.set(sessionId, {
        ...existing,
        locked: true,
        acquiredAt: new Date(Date.now() - existing.timeoutMs - 1000),
      });
    } else {
      this.locks.set(sessionId, {
        sessionId,
        locked: true,
        acquiredAt: new Date(Date.now() - this.defaultTimeoutMs - 1000),
        lastEvent: 'compaction/start',
        timeoutMs: this.defaultTimeoutMs,
      });
    }
  }

  /**
   * Clear all locks.
   */
  clear(): void {
    this.locks.clear();
  }
}
