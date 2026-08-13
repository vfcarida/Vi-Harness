/**
 * LoopFingerprint — canonical abstraction for iteration identity.
 *
 * A LoopFingerprint is a stable, comparable representation of what an
 * iteration did. Two iterations with matching fingerprints made no progress
 * relative to each other.
 *
 * Design:
 * - Built from an IterationFingerprint (which comes from the Iteration domain type)
 * - The hash is deterministic: same input → same hash, always
 * - Comparison is field-by-field (not hash-only) for full transparency
 * - The hash enables O(1) exact-repetition detection across history
 *
 * "No progress is defined by comparing consecutive iterations."
 * "Exact repetition is defined by comparing any iteration to history."
 */
import type { Iteration, IterationFingerprint } from '../model/iteration.js';
import type { AgentPhase } from '../model/state.js';

// ---------------------------------------------------------------------------
// LoopFingerprint type
// ---------------------------------------------------------------------------

export interface LoopFingerprint {
  /**
   * Stable canonical hash of the whole fingerprint.
   * Computed deterministically from all fields.
   * Enables O(1) exact-repetition lookup against iteration history.
   */
  readonly hash: string;

  readonly hypothesisId: string | null;
  readonly errorSignature: string | null;
  readonly patchSignature: string | null;

  /**
   * Stable hash identifying a tool + error pair.
   * Format: "<toolName>:<errorSignature>"
   * Null if no tool failure occurred.
   */
  readonly toolFailureSignature: string | null;

  /** Order-independent sorted set of failing test names. */
  readonly failingTests: ReadonlyArray<string>;

  /** Order-independent sorted set of files modified. */
  readonly filesModified: ReadonlyArray<string>;

  /**
   * Ordered phase trajectory for this iteration.
   * Used to detect N-phase repeating cycles across the trajectory history.
   */
  readonly stateTrajectory: ReadonlyArray<AgentPhase>;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Build a LoopFingerprint from a full Iteration.
 */
export function buildLoopFingerprint(iteration: Iteration): LoopFingerprint {
  return buildLoopFingerprintFromRaw(iteration.fingerprint);
}

/**
 * Build a LoopFingerprint directly from an IterationFingerprint.
 */
export function buildLoopFingerprintFromRaw(fp: IterationFingerprint): LoopFingerprint {
  const sortedFailingTests = [...fp.failingTests].sort();
  const sortedFilesModified = [...fp.filesModified].sort();

  const hash = computeFingerprintHash({
    hypothesisId: fp.hypothesisId,
    errorSignature: fp.errorSignature,
    patchSignature: fp.patchSignature,
    toolFailureSignature: fp.toolFailureSignature,
    failingTests: sortedFailingTests,
    filesModified: sortedFilesModified,
    stateTrajectory: fp.stateTrajectory,
  });

  return {
    hash,
    hypothesisId: fp.hypothesisId,
    errorSignature: fp.errorSignature,
    patchSignature: fp.patchSignature,
    toolFailureSignature: fp.toolFailureSignature,
    failingTests: sortedFailingTests,
    filesModified: sortedFilesModified,
    stateTrajectory: fp.stateTrajectory,
  };
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

/**
 * Compare two LoopFingerprints for semantic equality.
 *
 * Returns true when ALL of the following match:
 * - hypothesisId
 * - errorSignature
 * - patchSignature
 * - toolFailureSignature
 * - failingTests (order-independent)
 * - filesModified (order-independent)
 * - stateTrajectory (order-sensitive — trajectory matters)
 *
 * The hash shortcut is used first for performance, then fields are verified
 * to guard against hash collisions (defense in depth).
 */
export function loopFingerprintsMatch(a: LoopFingerprint, b: LoopFingerprint): boolean {
  // Fast path: hash comparison
  if (a.hash !== b.hash) return false;

  // Slow path: field-by-field verification (guards against hash collisions)
  if (a.hypothesisId !== b.hypothesisId) return false;
  if (a.errorSignature !== b.errorSignature) return false;
  if (a.patchSignature !== b.patchSignature) return false;
  if (a.toolFailureSignature !== b.toolFailureSignature) return false;

  // Failing tests — already sorted, compare positionally
  if (a.failingTests.length !== b.failingTests.length) return false;
  for (let i = 0; i < a.failingTests.length; i++) {
    if (a.failingTests[i] !== b.failingTests[i]) return false;
  }

  // Files modified — already sorted, compare positionally
  if (a.filesModified.length !== b.filesModified.length) return false;
  for (let i = 0; i < a.filesModified.length; i++) {
    if (a.filesModified[i] !== b.filesModified[i]) return false;
  }

  // State trajectory — order-sensitive
  if (a.stateTrajectory.length !== b.stateTrajectory.length) return false;
  for (let i = 0; i < a.stateTrajectory.length; i++) {
    if (a.stateTrajectory[i] !== b.stateTrajectory[i]) return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Hash computation — deterministic, no external dependencies
// ---------------------------------------------------------------------------

interface HashInput {
  readonly hypothesisId: string | null;
  readonly errorSignature: string | null;
  readonly patchSignature: string | null;
  readonly toolFailureSignature: string | null;
  readonly failingTests: ReadonlyArray<string>;
  readonly filesModified: ReadonlyArray<string>;
  readonly stateTrajectory: ReadonlyArray<AgentPhase>;
}

/**
 * Compute a deterministic hash string from fingerprint fields.
 *
 * Uses a simple stable canonical serialization — no crypto dependency.
 * The canonical form is a pipe-delimited string of all fields, sorted
 * where order-independence is required.
 *
 * Format:
 *   "<hypothesisId>|<errorSignature>|<patchSignature>|<toolFailureSignature>|
 *    <sortedTests:csv>|<sortedFiles:csv>|<trajectory:csv>"
 *
 * Null values are serialized as the literal string "null" to distinguish
 * from empty strings.
 */
export function computeFingerprintHash(input: HashInput): string {
  const parts = [
    input.hypothesisId ?? 'null',
    input.errorSignature ?? 'null',
    input.patchSignature ?? 'null',
    input.toolFailureSignature ?? 'null',
    input.failingTests.join(','),
    input.filesModified.join(','),
    input.stateTrajectory.join(','),
  ];

  // djb2-style hash over the canonical string
  const canonical = parts.join('|');
  return stableHash(canonical);
}

/**
 * Deterministic djb2-inspired string hash.
 *
 * Properties:
 * - Pure function: same input → same output, always
 * - No external dependencies
 * - Not cryptographic — suitable for loop detection only
 * - Output: lowercase hex string
 */
function stableHash(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = (((h << 5) + h) ^ input.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// ---------------------------------------------------------------------------
// Trajectory cycle detection
// ---------------------------------------------------------------------------

/**
 * Detect whether the given phase trajectory forms a repeating cycle of
 * the specified cycle length.
 *
 * Algorithm:
 *   Given trajectory T and cycle length L:
 *   Look at the last (2 * L) elements.
 *   If the last L elements equal the preceding L elements (position by position),
 *   a cycle of length L is confirmed.
 *
 * @param trajectory - Full ordered phase trajectory (all phases across all iterations)
 * @param cycleLength - Minimum cycle length to detect (e.g., 3 for A→B→C→A→B→C)
 * @returns The detected cycle if found, null otherwise
 */
export function detectTrajectoryCycle(
  trajectory: ReadonlyArray<AgentPhase>,
  cycleLength: number,
): ReadonlyArray<AgentPhase> | null {
  if (trajectory.length < cycleLength * 2) return null;

  const tail = trajectory.slice(-cycleLength);
  const preceding = trajectory.slice(-(cycleLength * 2), -cycleLength);

  for (let i = 0; i < cycleLength; i++) {
    if (tail[i] !== preceding[i]) return null;
  }

  return tail;
}
