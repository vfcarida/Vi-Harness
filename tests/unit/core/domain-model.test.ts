import { describe, it, expect } from 'vitest';
import {
  TerminationReason,
  continueExecution,
  terminate,
  createBudgetEntry,
  createBudget,
  BudgetDimension,
  ConfidenceLevel,
  createConfidence,
  DEFAULT_GOAL_CONSTRAINTS,
  GoalStatus,
  TaskStatus,
  HypothesisStatus,
  ActionType,
  ActionResultStatus,
  FailureCategory,
} from '../../../src/core/index.js';

describe('Domain Model Value Objects & Entities', () => {
  describe('TerminationDecision', () => {
    it('continueExecution factory should construct a non-terminal decision', () => {
      const decision = continueExecution();
      expect(decision.terminal).toBe(false);
      expect(decision.reason).toBeNull();
      expect(decision.confidence).toBe(1.0);
      expect(decision.humanRequired).toBe(false);
      expect(decision.recommendedAction).toBe('continue');
      expect(decision.decidedAt).toBeInstanceOf(Date);
    });

    it('terminate factory should construct a terminal decision with reasons and defaults', () => {
      const decision = terminate({
        reason: TerminationReason.MAX_ITERATIONS,
      });

      expect(decision.terminal).toBe(true);
      expect(decision.reason).toBe(TerminationReason.MAX_ITERATIONS);
      expect(decision.humanRequired).toBe(false);
      expect(decision.confidence).toBe(1.0);
      expect(decision.recommendedAction).toBe('stop');
    });
  });

  describe('Budget & BudgetEntry', () => {
    it('createBudgetEntry should correctly calculate remaining and exhausted state', () => {
      const entry1 = createBudgetEntry(BudgetDimension.ITERATIONS, 50, 20);
      expect(entry1.limit).toBe(50);
      expect(entry1.consumed).toBe(20);
      expect(entry1.remaining).toBe(30);
      expect(entry1.exhausted).toBe(false);

      const entry2 = createBudgetEntry(BudgetDimension.COST_DOLLARS, 10.0, 10.0);
      expect(entry2.remaining).toBe(0);
      expect(entry2.exhausted).toBe(true);

      const entry3 = createBudgetEntry(BudgetDimension.DURATION_MS, 1000, 1500);
      expect(entry3.remaining).toBe(0);
      expect(entry3.exhausted).toBe(true);
    });

    it('createBudget should aggregate multiple entries and flag anyExhausted', () => {
      const e1 = createBudgetEntry(BudgetDimension.ITERATIONS, 10, 2);
      const e2 = createBudgetEntry(BudgetDimension.COST_DOLLARS, 5, 5);

      const budget = createBudget([e1, e2]);
      expect(budget.anyExhausted).toBe(true);
      expect(budget.entries).toHaveLength(2);
    });
  });

  describe('Confidence', () => {
    it('createConfidence should clamp score between 0 and 1', () => {
      const cLow = createConfidence(-0.5, 'Negative');
      expect(cLow.score).toBe(0);
      expect(cLow.level).toBe(ConfidenceLevel.VERY_LOW);

      const cHigh = createConfidence(1.5, 'Over one');
      expect(cHigh.score).toBe(1.0);
      expect(cHigh.level).toBe(ConfidenceLevel.VERY_HIGH);
    });

    it('createConfidence should categorize into correct discretized levels', () => {
      expect(createConfidence(0.1, '').level).toBe(ConfidenceLevel.VERY_LOW);
      expect(createConfidence(0.3, '').level).toBe(ConfidenceLevel.LOW);
      expect(createConfidence(0.5, '').level).toBe(ConfidenceLevel.MEDIUM);
      expect(createConfidence(0.7, '').level).toBe(ConfidenceLevel.HIGH);
      expect(createConfidence(0.9, '').level).toBe(ConfidenceLevel.VERY_HIGH);
    });
  });

  describe('Goal Constraints & Enums', () => {
    it('DEFAULT_GOAL_CONSTRAINTS should be frozen with conservative defaults', () => {
      expect(DEFAULT_GOAL_CONSTRAINTS.maxIterations).toBe(50);
      expect(DEFAULT_GOAL_CONSTRAINTS.maxCostDollars).toBe(10.0);
      expect(DEFAULT_GOAL_CONSTRAINTS.requireVerification).toBe(true);
    });

    it('domain enums should be populated correctly', () => {
      expect(GoalStatus.ACTIVE).toBe('ACTIVE');
      expect(TaskStatus.COMPLETED).toBe('COMPLETED');
      expect(HypothesisStatus.VALIDATED).toBe('VALIDATED');
      expect(ActionType.FILE_WRITE).toBe('FILE_WRITE');
      expect(ActionResultStatus.SUCCESS).toBe('SUCCESS');
      expect(FailureCategory.TEST_FAILURE).toBe('TEST_FAILURE');
    });
  });
});
