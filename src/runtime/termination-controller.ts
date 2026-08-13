/**
 * Termination Controller.
 *
 * "Stop conditions live outside the LLM."
 *
 * Evaluates stop conditions using loop control rules:
 * - Max iterations
 * - Cost budget
 * - Wall-clock time budget
 * - Consecutive repair attempts
 * - Repeated hypotheses
 * - Oscillation
 * - No-progress iterations
 */
import type { AgentState } from '../core/model/state.js';
import type { GoalConstraints } from '../core/model/goal.js';
import type { Iteration } from '../core/model/iteration.js';
import type { StateTransition } from '../core/model/state.js';
import type { TerminationDecision } from '../core/model/termination.js';
import { evaluateLoopControl } from '../core/state-machine/loop-control.js';

export class TerminationController {
  /**
   * Evaluate runtime stop conditions.
   */
  static evaluate(params: {
    state: AgentState;
    constraints: GoalConstraints;
    iterations: ReadonlyArray<Iteration>;
    transitions: ReadonlyArray<StateTransition>;
    elapsedMs: number;
    totalCostDollars: number;
  }): TerminationDecision {
    return evaluateLoopControl(params);
  }
}
