import { describe, it, expect } from 'vitest';
import { StateCorruptionValidator } from '../../../src/infra/persistence/state-corruption-validator.js';
import { AgentPhase } from '../../../src/core/model/state.js';
import type { AgentState } from '../../../src/core/model/state.js';
import { HarnessError } from '../../../src/core/errors/base-error.js';
import { ErrorCode, ErrorCategory } from '../../../src/core/errors/error-codes.js';
import type { StateId, TaskId, IterationId } from '../../../src/core/types/identifiers.js';

describe('StateCorruptionValidator Unit Suite', () => {
  function createValidState(): AgentState {
    return {
      id: 'state-1' as StateId,
      taskId: 'task-1' as TaskId,
      iterationId: 'iter-1' as IterationId,
      phase: AgentPhase.EXPLORE,
      iterationCount: 1,
      repairCount: 0,
      confidence: 0.85,
      activeHypotheses: [],
      pendingQuestions: [],
      workingMemorySummary: 'Initial exploration state',
      updatedAt: new Date(),
      createdAt: new Date(),
    };
  }

  it('1. Passes validation for a well-formed valid AgentState', () => {
    const valid = createValidState();
    expect(() => StateCorruptionValidator.validateOrThrow(valid)).not.toThrow();
  });

  it('2. Throws HarnessError (STATE_CORRUPTED) if state is null or undefined', () => {
    expect(() => StateCorruptionValidator.validateOrThrow(null as any)).toThrow(HarnessError);
    expect(() => StateCorruptionValidator.validateOrThrow(undefined as any)).toThrow(HarnessError);
  });

  it('3. Throws HarnessError if mandatory identifiers (id, taskId, iterationId) are missing', () => {
    const missingId = { ...createValidState(), id: '' as any };
    expect(() => StateCorruptionValidator.validateOrThrow(missingId)).toThrow(HarnessError);

    const missingTaskId = { ...createValidState(), taskId: undefined as any };
    expect(() => StateCorruptionValidator.validateOrThrow(missingTaskId)).toThrow(HarnessError);

    const missingIterId = { ...createValidState(), iterationId: null as any };
    expect(() => StateCorruptionValidator.validateOrThrow(missingIterId)).toThrow(HarnessError);
  });

  it('4. Throws HarnessError if state phase is corrupted or unknown', () => {
    const corruptedPhase = { ...createValidState(), phase: 'INVALID_CORRUPTED_PHASE' as any };
    try {
      StateCorruptionValidator.validateOrThrow(corruptedPhase);
      expect.unreachable('Should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(HarnessError);
      expect(err.code).toBe(ErrorCode.STATE_CORRUPTED);
      expect(err.category).toBe(ErrorCategory.STATE);
      expect(err.message).toContain('Corrupted state phase detected');
    }
  });

  it('5. Throws HarnessError if counters are negative', () => {
    const negativeIteration = { ...createValidState(), iterationCount: -1 };
    expect(() => StateCorruptionValidator.validateOrThrow(negativeIteration)).toThrow(HarnessError);

    const negativeRepair = { ...createValidState(), repairCount: -5 };
    expect(() => StateCorruptionValidator.validateOrThrow(negativeRepair)).toThrow(HarnessError);
  });
});
