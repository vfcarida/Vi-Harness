/**
 * Round-Based Continuation Driver (from DeepSeek Harness).
 *
 * Enforces per-goal round admission and graceful budget blocking:
 * - Each model turn for goal work requests admission via `admitRound(goalRef)`.
 * - If rounds are exhausted (`roundsStarted >= maxRounds`), gracefully blocks the goal
 *   with blockerCode 'budget-exhausted' and rejects admission.
 * - Round budget operates independently from token and cost budgets.
 */
import type { GoalRef } from './goal-state.js';
import type { GoalService } from './goal-service.js';

export interface GoalContinuationDriver {
  /**
   * Request admission to run a new round.
   * Returns false if rounds or budgets are exhausted or goal is not active/armed.
   */
  admitRound(goal: GoalRef): boolean;

  /**
   * Block goal when rounds are exhausted.
   */
  onRoundExhausted(goal: GoalRef): void;
}

export class DefaultGoalContinuationDriver implements GoalContinuationDriver {
  constructor(private readonly goalService: GoalService) {}

  admitRound(ref: GoalRef): boolean {
    const view = this.goalService.getById(ref.id);
    if (!view) return false;

    // Must match current revision
    if (view.goal.revision !== ref.revision) return false;

    // Must be active and process-locally armed
    if (view.goal.phase !== 'active' || !view.isArmed) return false;

    // Check round exhaustion
    if (view.goal.roundsStarted >= view.goal.maxRounds) {
      this.onRoundExhausted(ref);
      return false;
    }

    // Check token budget exhaustion
    if (view.goal.tokenBudget && view.goal.tokensUsed >= view.goal.tokenBudget) {
      this.goalService.block(
        ref,
        'budget-exhausted',
        `Token budget exhausted: used ${view.goal.tokensUsed}/${view.goal.tokenBudget} tokens`,
      );
      return false;
    }

    // Check cost budget exhaustion
    if (view.goal.costBudget && view.goal.costUsed >= view.goal.costBudget) {
      this.goalService.block(
        ref,
        'budget-exhausted',
        `Cost budget exhausted: spent $${view.goal.costUsed.toFixed(4)}/$${view.goal.costBudget.toFixed(4)}`,
      );
      return false;
    }

    // Admit round: increment roundsStarted
    try {
      this.goalService.recordUsage(ref, {
        tokens: 0,
        cost: 0,
        roundsIncrement: 1,
      });
      return true;
    } catch {
      return false;
    }
  }

  onRoundExhausted(ref: GoalRef): void {
    const view = this.goalService.getById(ref.id);
    const maxRounds = view ? view.goal.maxRounds : 256;
    try {
      this.goalService.block(
        ref,
        'budget-exhausted',
        `Round budget exhausted: reached maximum of ${maxRounds} rounds`,
      );
    } catch {
      // Ignore if already blocked or revision moved
    }
  }
}
