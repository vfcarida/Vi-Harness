/**
 * Context domain types.
 *
 * Implements the four-tier context architecture:
 *   L0 = Hot Context      (current task, files, hypothesis, failure)
 *   L1 = Working Memory   (current plan, active decisions, recent evidence)
 *   L2 = Episodic Memory  (previous attempts, failed approaches)
 *   L3 = Repository Memory (architecture, domain constraints, standards)
 */
import type { ContextId } from '../types/identifiers.js';

// ---------------------------------------------------------------------------
// Context tiers
// ---------------------------------------------------------------------------

export enum ContextTier {
  /** Current task, current files, current hypothesis, current failure. */
  L0_HOT = 'L0_HOT',

  /** Current plan, active decisions, recent evidence. */
  L1_WORKING = 'L1_WORKING',

  /** Previous attempts, failed approaches, prior debugging trajectories. */
  L2_EPISODIC = 'L2_EPISODIC',

  /** Architecture, domain constraints, coding standards, permanent decisions. */
  L3_REPOSITORY = 'L3_REPOSITORY',
}

// ---------------------------------------------------------------------------
// Context entry — a single piece of context in any tier
// ---------------------------------------------------------------------------

export interface ContextEntry {
  readonly id: ContextId;
  readonly tier: ContextTier;
  readonly content: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly createdAt: Date;
  readonly expiresAt?: Date;
  readonly tokenEstimate: number;
}

// ---------------------------------------------------------------------------
// Compiled context — assembled from multiple tiers for a model call
// ---------------------------------------------------------------------------

export interface CompiledContext {
  readonly entries: ReadonlyArray<ContextEntry>;
  readonly totalTokenEstimate: number;
  readonly compiledAt: Date;
}
