import { describe, it, expect, beforeEach } from 'vitest';
import {
  AgentPhase,
  StateEvent,
  TerminationReason,
  DEFAULT_GOAL_CONSTRAINTS,
  evaluateLoopControl,
  checkMaxIterations,
  checkMaxCost,
  checkMaxDuration,
  checkMaxRepairs,
  checkRepeatedHypotheses,
  checkOscillation,
  checkNoProgress,
  fingerprintsMatch,
} from '../../../src/core/index.js';
import type {
  AgentState,
  GoalConstraints,
  Iteration,
  IterationFingerprint,
  StateTransition,
} from '../../../src/core/index.js';
import { UuidV7IdFactory } from '../../../src/infra/id/uuid-id-factory.js';

describe('Loop Control Engine', () => {
  let idFactory: UuidV7IdFactory;

  beforeEach(() => {
    idFactory = new UuidV7IdFactory();
  });

  const createDummyState = (override?: Partial<AgentState>): AgentState => ({
    id: idFactory.create<'State'>(),
    taskId: idFactory.create<'Task'>(),
    phase: AgentPhase.IMPLEMENT,
    previousPhase: AgentPhase.PLAN,
    iterationId: idFactory.create<'Iteration'>(),
    iterationCount: 1,
    repairCount: 0,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...override,
  });

  const createDummyFingerprint = (
    override?: Partial<IterationFingerprint>,
  ): IterationFingerprint => ({
    filesModified: ['src/app.ts'],
    hypothesisId: idFactory.create<'Hypothesis'>(),
    errorSignature: 'ERR_001',
    patchSignature: 'PATCH_AAA',
    failingTests: ['test_1'],
    phaseAtStart: AgentPhase.IMPLEMENT,
    ...override,
  });

  const createDummyIteration = (
    seq: number,
    fingerprint?: IterationFingerprint,
  ): Iteration => ({
    id: idFactory.create<'Iteration'>(),
    taskId: idFactory.create<'Task'>(),
    sequenceNumber: seq,
    outcome: 0 as any, // IterationOutcome
    fingerprint: fingerprint ?? createDummyFingerprint(),
    evidenceIds: [],
    actionIds: [],
    startedAt: new Date(),
    completedAt: new Date(),
    durationMs: 1000,
    costDollars: 0.05,
    metadata: {},
  });

  describe('Budget & Limit Checks', () => {
    it('checkMaxIterations should terminate when iteration count exceeds or equals limit', () => {
      expect(checkMaxIterations(5, 10).terminal).toBe(false);
      const res = checkMaxIterations(10, 10);
      expect(res.terminal).toBe(true);
      expect(res.reason).toBe(TerminationReason.MAX_ITERATIONS);
    });

    it('checkMaxCost should terminate when total cost exceeds or equals limit', () => {
      expect(checkMaxCost(4.5, 5.0).terminal).toBe(false);
      const res = checkMaxCost(5.0, 5.0);
      expect(res.terminal).toBe(true);
      expect(res.reason).toBe(TerminationReason.MAX_COST);
    });

    it('checkMaxDuration should terminate when elapsed time exceeds or equals limit', () => {
      expect(checkMaxDuration(1000, 5000).terminal).toBe(false);
      const res = checkMaxDuration(5000, 5000);
      expect(res.terminal).toBe(true);
      expect(res.reason).toBe(TerminationReason.MAX_DURATION);
    });

    it('checkMaxRepairs should terminate and request human when repair count exceeds limit', () => {
      expect(checkMaxRepairs(2, 5).terminal).toBe(false);
      const res = checkMaxRepairs(5, 5);
      expect(res.terminal).toBe(true);
      expect(res.reason).toBe(TerminationReason.MAX_REPAIRS);
      expect(res.humanRequired).toBe(true);
    });
  });

  describe('Repeated Hypotheses', () => {
    it('should terminate if same hypothesisId is tried 3 or more times', () => {
      const hypId = idFactory.create<'Hypothesis'>();
      const fp = createDummyFingerprint({ hypothesisId: hypId });

      const iters = [
        createDummyIteration(1, fp),
        createDummyIteration(2, fp),
        createDummyIteration(3, fp),
      ];

      const res = checkRepeatedHypotheses(iters);
      expect(res.terminal).toBe(true);
      expect(res.reason).toBe(TerminationReason.REPEATED_HYPOTHESIS);
      expect(res.humanRequired).toBe(true);
    });

    it('should continue if hypotheses differ', () => {
      const iters = [
        createDummyIteration(1, createDummyFingerprint()),
        createDummyIteration(2, createDummyFingerprint()),
        createDummyIteration(3, createDummyFingerprint()),
      ];
      expect(checkRepeatedHypotheses(iters).terminal).toBe(false);
    });
  });

  describe('Oscillation Detection', () => {
    it('should detect oscillation when transitions repeat phase pairs within window', () => {
      const transitions: StateTransition[] = [
        { id: '1', from: AgentPhase.REPAIR, to: AgentPhase.VERIFY, event: StateEvent.REPAIR_COMPLETE, timestamp: new Date(), stateId: '' as any, evidenceIds: [], metadata: {} },
        { id: '2', from: AgentPhase.VERIFY, to: AgentPhase.REPAIR, event: StateEvent.VERIFICATION_FAILED, timestamp: new Date(), stateId: '' as any, evidenceIds: [], metadata: {} },
        { id: '3', from: AgentPhase.REPAIR, to: AgentPhase.VERIFY, event: StateEvent.REPAIR_COMPLETE, timestamp: new Date(), stateId: '' as any, evidenceIds: [], metadata: {} },
        { id: '4', from: AgentPhase.VERIFY, to: AgentPhase.REPAIR, event: StateEvent.VERIFICATION_FAILED, timestamp: new Date(), stateId: '' as any, evidenceIds: [], metadata: {} },
        { id: '5', from: AgentPhase.REPAIR, to: AgentPhase.VERIFY, event: StateEvent.REPAIR_COMPLETE, timestamp: new Date(), stateId: '' as any, evidenceIds: [], metadata: {} },
        { id: '6', from: AgentPhase.VERIFY, to: AgentPhase.REPAIR, event: StateEvent.VERIFICATION_FAILED, timestamp: new Date(), stateId: '' as any, evidenceIds: [], metadata: {} },
      ];

      const res = checkOscillation(transitions, 10, 3);
      expect(res.terminal).toBe(true);
      expect(res.reason).toBe(TerminationReason.OSCILLATION);
      expect(res.humanRequired).toBe(true);
    });

    it('should not trigger oscillation when transitions are progressive', () => {
      const transitions: StateTransition[] = [
        { id: '1', from: AgentPhase.INIT, to: AgentPhase.EXPLORE, event: StateEvent.START, timestamp: new Date(), stateId: '' as any, evidenceIds: [], metadata: {} },
        { id: '2', from: AgentPhase.EXPLORE, to: AgentPhase.PLAN, event: StateEvent.EXPLORE_COMPLETE, timestamp: new Date(), stateId: '' as any, evidenceIds: [], metadata: {} },
        { id: '3', from: AgentPhase.PLAN, to: AgentPhase.IMPLEMENT, event: StateEvent.PLAN_READY, timestamp: new Date(), stateId: '' as any, evidenceIds: [], metadata: {} },
      ];
      expect(checkOscillation(transitions, 10, 3).terminal).toBe(false);
    });
  });

  describe('No Progress Detection & Fingerprints', () => {
    it('fingerprintsMatch should correctly evaluate equality across all fields', () => {
      const fp1 = createDummyFingerprint();
      const fp2 = { ...fp1 };
      const fp3 = { ...fp1, errorSignature: 'ERR_002' };

      expect(fingerprintsMatch(fp1, fp2)).toBe(true);
      expect(fingerprintsMatch(fp1, fp3)).toBe(false);
    });

    it('checkNoProgress should detect identical consecutive fingerprints', () => {
      const fp = createDummyFingerprint();
      const iters = [
        createDummyIteration(1, fp),
        createDummyIteration(2, fp),
        createDummyIteration(3, fp),
      ];

      const res = checkNoProgress(iters, 3);
      expect(res.terminal).toBe(true);
      expect(res.reason).toBe(TerminationReason.NO_PROGRESS);
      expect(res.humanRequired).toBe(true);
    });

    it('checkNoProgress should continue if any fingerprint aspect changes', () => {
      const fp1 = createDummyFingerprint({ patchSignature: 'A' });
      const fp2 = createDummyFingerprint({ patchSignature: 'B' });
      const fp3 = createDummyFingerprint({ patchSignature: 'C' });

      const iters = [
        createDummyIteration(1, fp1),
        createDummyIteration(2, fp2),
        createDummyIteration(3, fp3),
      ];

      expect(checkNoProgress(iters, 3).terminal).toBe(false);
    });
  });

  describe('Full evaluateLoopControl Aggregator', () => {
    it('should return continueExecution when all limits and rules are respected', () => {
      const state = createDummyState({ iterationCount: 2, repairCount: 1 });
      const constraints: GoalConstraints = { ...DEFAULT_GOAL_CONSTRAINTS };

      const res = evaluateLoopControl({
        state,
        constraints,
        iterations: [createDummyIteration(1)],
        transitions: [],
        elapsedMs: 5000,
        totalCostDollars: 0.1,
      });

      expect(res.terminal).toBe(false);
      expect(res.reason).toBeNull();
    });

    it('should prioritize earlier checks (e.g. maxIterations before maxCost)', () => {
      const state = createDummyState({ iterationCount: 50 });
      const constraints: GoalConstraints = {
        ...DEFAULT_GOAL_CONSTRAINTS,
        maxIterations: 10,
        maxCostDollars: 1.0,
      };

      const res = evaluateLoopControl({
        state,
        constraints,
        iterations: [],
        transitions: [],
        elapsedMs: 100,
        totalCostDollars: 500.0,
      });

      expect(res.terminal).toBe(true);
      expect(res.reason).toBe(TerminationReason.MAX_ITERATIONS);
    });
  });
});
