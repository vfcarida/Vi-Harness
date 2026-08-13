/**
 * Memory Lifecycle Manager.
 *
 * Implements promotion rules and invalidation:
 * - Promotion: Short-term / Episodic memory is promoted to Semantic or Procedural when:
 *   1. Recurrence count >= 2
 *   2. Importance >= 0.8
 *   3. Success count >= 2
 *   4. Explicit user decision or architectural significance
 * - Invalidation & Staleness:
 *   - Stale: Marked STALE when architecture changes or system facts are superseded.
 *   - Invalidated: Marked INVALIDATED when contradicting evidence is proven.
 *   - Expired: Marked EXPIRED when TTL expires.
 */
import type { MemoryRecord } from '../../core/model/memory-types.js';
import { MemoryStatus, MemoryTier } from '../../core/model/memory-types.js';

export class MemoryLifecycle {
  /**
   * Evaluate whether a MemoryRecord qualifies for promotion to long-term tier.
   */
  static shouldPromote(record: MemoryRecord): boolean {
    if (record.status === MemoryStatus.STALE || record.status === MemoryStatus.INVALIDATED) {
      return false;
    }

    if (record.tier === MemoryTier.SEMANTIC || record.tier === MemoryTier.PROCEDURAL) {
      return false; // Already promoted
    }

    // Rule 1: High importance & recurrence
    if (record.importance >= 0.8 && record.recurrenceCount >= 2) {
      return true;
    }

    // Rule 2: Successful reuse history
    if (record.successCount >= 2 && record.confidence >= 0.8) {
      return true;
    }

    // Rule 3: Explicit user decision or failure avoidance tag
    if (
      record.tags.includes('user_decision') ||
      record.tags.includes('failure_avoidance') ||
      record.tags.includes('architecture')
    ) {
      return true;
    }

    return false;
  }

  /**
   * Determine optimal target tier for a promoted memory record.
   */
  static determinePromotedTier(record: MemoryRecord): MemoryTier {
    if (record.tags.includes('pattern') || record.tags.includes('workflow') || record.tags.includes('skill')) {
      return MemoryTier.PROCEDURAL;
    }
    return MemoryTier.SEMANTIC;
  }

  /**
   * Check if a record is expired based on current timestamp and expiresAt.
   */
  static isExpired(record: MemoryRecord, now: Date): boolean {
    if (!record.expiresAt) return false;
    return now.getTime() > record.expiresAt.getTime();
  }
}
