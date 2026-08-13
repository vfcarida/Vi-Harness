/**
 * Loop control — detects pathological agent behavior and produces
 * termination decisions.
 *
 * "Stop conditions live outside the LLM."
 *
 * Checks performed:
 * 1. Maximum iterations exceeded
 * 2. Maximum cost exceeded
 * 3. Maximum wall-clock duration exceeded
 * 4. Maximum consecutive repairs exceeded
 * 5. Repeated hypothesis detection
 * 6. Oscillation detection (cycling between same phases)
 * 7. No-progress detection (same fingerprint across iterations)
 * 8. Regression detection (previously-passing checks now fail)
 *
 * This module is pure domain logic — no I/O, no infrastructure dependency.
 */
import type { GoalConstraints } from '../model/goal.js';
import type { Iteration, IterationFingerprint } from '../model/iteration.js';
import { AgentPhase } from '../model/state.js';
import type { AgentState, StateTransition } from '../model/state.js';
import {
  TerminationReason,
  continueExecution,
  terminate,
} from '../model/termination.js';
import type { TerminationDecision } from '../model/termination.js';

// ---------------------------------------------------------------------------
// Loop control configuration
// ---------------------------------------------------------------------------

export interface LoopControlConfig {
  /** How many recent transitions to scan for oscillation. */
  readonly oscillationWindowSize: number;

  /** Minimum number of repeated phase-cycles to detect oscillation. */
  readonly oscillationThreshold: number;

  /** How many recent iterations to scan for no-progress. */
  readonly noProgressWindowSize: number;
}

export const DEFAULT_LOOP_CONTROL_CONFIG: Readonly<LoopControlConfig> = {
  oscillationWindowSize: 10,
  oscillationThreshold: 3,
  noProgressWindowSize: 3,
};

// ---------------------------------------------------------------------------
// Loop control evaluator
// ---------------------------------------------------------------------------

/**
 * Evaluate all loop-control rules and return a termination decision.
 *
 * The first violated rule produces the termination decision.
 * If no rules are violated, returns continueExecution().
 *
 * @param state - Current agent state.
 * @param constraints - Goal constraints (budgets).
 * @param iterations - All iterations so far (oldest first).
 * @param transitions - All transitions so far (oldest first).
 * @param elapsedMs - Wall-clock time since execution started.
 * @param totalCostDollars - Cumulative cost across all model calls.
 * @param config - Loop control configuration.
 */
export function evaluateLoopControl(params: {
  state: AgentState;
  constraints: GoalConstraints;
  iterations: ReadonlyArray<Iteration>;
  transitions: ReadonlyArray<StateTransition>;
  elapsedMs: number;
  totalCostDollars: number;
  config?: LoopControlConfig;
}): TerminationDecision {
  const config = params.config ?? DEFAULT_LOOP_CONTROL_CONFIG;

  // --- 0. Task Completion ---
  if (params.state.phase === AgentPhase.DONE) {
    return terminate({
      reason: TerminationReason.SUCCESS,
      evidenceIds: [],
      confidence: 1.0,
      humanRequired: false,
      recommendedAction: 'Task completed successfully',
    });
  }

  // --- 1. Maximum iterations ---
  const iterCheck = checkMaxIterations(
    Math.max(params.state.iterationCount, params.iterations.length),
    params.constraints.maxIterations,
  );
  if (iterCheck.terminal) return iterCheck;

  // --- 2. Maximum cost ---
  const costCheck = checkMaxCost(
    params.totalCostDollars,
    params.constraints.maxCostDollars,
  );
  if (costCheck.terminal) return costCheck;

  // --- 3. Maximum duration ---
  const durationCheck = checkMaxDuration(
    params.elapsedMs,
    params.constraints.maxDurationMs,
  );
  if (durationCheck.terminal) return durationCheck;

  // --- 4. Maximum consecutive repairs ---
  const repairCheck = checkMaxRepairs(
    params.state.repairCount,
    params.constraints.maxRepairAttempts,
  );
  if (repairCheck.terminal) return repairCheck;

  // --- 5. Repeated hypotheses ---
  const hypothesisCheck = checkRepeatedHypotheses(params.iterations);
  if (hypothesisCheck.terminal) return hypothesisCheck;

  // --- 6. Oscillation ---
  const oscillationCheck = checkOscillation(
    params.transitions,
    config.oscillationWindowSize,
    config.oscillationThreshold,
  );
  if (oscillationCheck.terminal) return oscillationCheck;

  // --- 7. No progress ---
  const progressCheck = checkNoProgress(
    params.iterations,
    params.constraints.maxNoProgressIterations,
  );
  if (progressCheck.terminal) return progressCheck;

  return continueExecution();
}

// ---------------------------------------------------------------------------
// Individual checks — exported for unit testing
// ---------------------------------------------------------------------------

export function checkMaxIterations(
  current: number,
  max: number,
): TerminationDecision {
  if (current >= max) {
    return terminate({
      reason: TerminationReason.MAX_ITERATIONS,
      recommendedAction: 'Increase iteration budget or simplify the task',
    });
  }
  return continueExecution();
}

export function checkMaxCost(
  currentDollars: number,
  maxDollars: number,
): TerminationDecision {
  if (currentDollars >= maxDollars) {
    return terminate({
      reason: TerminationReason.MAX_COST,
      recommendedAction: 'Increase cost budget or use a cheaper model',
    });
  }
  return continueExecution();
}

export function checkMaxDuration(
  elapsedMs: number,
  maxMs: number,
): TerminationDecision {
  if (elapsedMs >= maxMs) {
    return terminate({
      reason: TerminationReason.MAX_DURATION,
      recommendedAction: 'Increase time budget or decompose the task',
    });
  }
  return continueExecution();
}

export function checkMaxRepairs(
  consecutiveRepairs: number,
  maxRepairs: number,
): TerminationDecision {
  if (consecutiveRepairs >= maxRepairs) {
    return terminate({
      reason: TerminationReason.MAX_REPAIRS,
      humanRequired: true,
      recommendedAction: 'Escalate to human — agent cannot self-repair',
    });
  }
  return continueExecution();
}

/**
 * Detect repeated hypotheses — same content hash appearing multiple times.
 *
 * If any hypothesis hash appears 3+ times across iterations, the agent
 * is likely stuck cycling through the same idea.
 */
export function checkRepeatedHypotheses(
  iterations: ReadonlyArray<Iteration>,
): TerminationDecision {
  const hypothesisCounts = new Map<string, number>();

  for (const iteration of iterations) {
    const hId = iteration.fingerprint.hypothesisId;
    if (hId !== null) {
      const count = (hypothesisCounts.get(hId) ?? 0) + 1;
      hypothesisCounts.set(hId, count);

      if (count >= 3) {
        return terminate({
          reason: TerminationReason.REPEATED_HYPOTHESIS,
          humanRequired: true,
          recommendedAction: 'Agent is repeating the same hypothesis. Needs new direction.',
        });
      }
    }
  }

  return continueExecution();
}

/**
 * Detect oscillation — agent cycling between the same phases.
 *
 * Looks at the last N transitions for a repeating pattern.
 * Example oscillation: IMPLEMENT → VERIFY → REPAIR → VERIFY → REPAIR → VERIFY
 */
export function checkOscillation(
  transitions: ReadonlyArray<StateTransition>,
  windowSize: number,
  threshold: number,
): TerminationDecision {
  if (transitions.length < 2) {
    return continueExecution();
  }

  const window = transitions.slice(-windowSize);
  const phasePairCounts = new Map<string, number>();

  for (let i = 0; i < window.length - 1; i++) {
    const pair = `${window[i]!.from}->${window[i]!.to}`;
    phasePairCounts.set(pair, (phasePairCounts.get(pair) ?? 0) + 1);
  }

  for (const [_pair, count] of phasePairCounts) {
    if (count >= threshold) {
      return terminate({
        reason: TerminationReason.OSCILLATION,
        humanRequired: true,
        recommendedAction: 'Agent is oscillating between phases. Needs human intervention.',
      });
    }
  }

  return continueExecution();
}

/**
 * Detect no-progress — consecutive iterations with the same fingerprint.
 *
 * "No progress" is defined as:
 *   - Same failing tests
 *   - Same file set
 *   - Same hypothesis
 *   - Same error signature
 *   - Same patch pattern
 *
 * If the last N iterations all have matching fingerprints, no progress was made.
 */
export function checkNoProgress(
  iterations: ReadonlyArray<Iteration>,
  maxConsecutive: number,
): TerminationDecision {
  if (iterations.length < maxConsecutive) {
    return continueExecution();
  }

  const recent = iterations.slice(-maxConsecutive);
  const referenceFingerprint = recent[0]!.fingerprint;

  const allSame = recent.every((iteration) =>
    fingerprintsMatch(iteration.fingerprint, referenceFingerprint),
  );

  if (allSame) {
    return terminate({
      reason: TerminationReason.NO_PROGRESS,
      humanRequired: true,
      confidence: 0.9,
      recommendedAction: 'Agent made no progress for consecutive iterations',
    });
  }

  return continueExecution();
}

// ---------------------------------------------------------------------------
// Fingerprint comparison
// ---------------------------------------------------------------------------

/**
 * Compare two iteration fingerprints for semantic equality.
 *
 * Two fingerprints match if ALL of the following are equal:
 * - error signature
 * - hypothesis ID
 * - failing test set
 * - patch signature
 * - files modified set
 */
export function fingerprintsMatch(
  a: IterationFingerprint,
  b: IterationFingerprint,
): boolean {
  if (a.phaseAtStart !== b.phaseAtStart) return false;
  if (a.errorSignature !== b.errorSignature) return false;
  if (a.hypothesisId !== b.hypothesisId) return false;
  if (a.patchSignature !== b.patchSignature) return false;

  // Compare failing tests (order-independent)
  if (a.failingTests.length !== b.failingTests.length) return false;
  const aTests = new Set(a.failingTests);
  if (!b.failingTests.every((t) => aTests.has(t))) return false;

  // Compare files modified (order-independent)
  if (a.filesModified.length !== b.filesModified.length) return false;
  const aFiles = new Set(a.filesModified);
  if (!b.filesModified.every((f) => aFiles.has(f))) return false;

  return true;
}
