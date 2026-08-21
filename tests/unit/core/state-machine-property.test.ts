import { describe, it, expect } from 'vitest';
import { StateMachine } from '../../../src/core/state-machine/state-machine.js';
import { AgentPhase, StateEvent } from '../../../src/core/model/state.js';
import { UuidV7IdFactory } from '../../../src/infra/id/uuid-id-factory.js';
import { SystemClock } from '../../../src/infra/time/system-clock.js';
import type { EvidenceId } from '../../../src/core/types/identifiers.js';

describe('StateMachine Property-Based & Invariant Fuzzing (F015)', () => {
  const idFactory = new UuidV7IdFactory();
  const clock = new SystemClock();

  it('preserves invariant that terminal states cannot transition to non-terminal states under random event fuzzing', () => {
    const terminalPhases = [AgentPhase.DONE, AgentPhase.FAILED, AgentPhase.CANCELLED];
    const eventTypes = Object.values(StateEvent);

    for (const terminalPhase of terminalPhases) {
      for (let i = 0; i < 30; i++) {
        const sm = new StateMachine({
          taskId: idFactory.create<'Task'>(),
          idFactory,
          clock,
          initialPhase: terminalPhase,
        });

        // Pick random event
        const randomEvent = eventTypes[Math.floor(Math.random() * eventTypes.length)]!;
        try {
          sm.apply(randomEvent);
        } catch {
          // Expected: transitions from terminal state throw
        }

        // Invariant: Must remain terminal
        expect([AgentPhase.DONE, AgentPhase.FAILED, AgentPhase.CANCELLED]).toContain(sm.phase);
      }
    }
  });

  it('guarantees valid canonical phase transitions from INIT to DONE', () => {
    for (let run = 0; run < 10; run++) {
      const sm = new StateMachine({
        taskId: idFactory.create<'Task'>(),
        idFactory,
        clock,
        initialPhase: AgentPhase.INIT,
      });

      expect(sm.phase).toBe(AgentPhase.INIT);

      sm.apply(StateEvent.START);
      expect(sm.phase).toBe(AgentPhase.EXPLORE);

      sm.apply(StateEvent.EXPLORE_COMPLETE);
      expect(sm.phase).toBe(AgentPhase.PLAN);

      sm.apply(StateEvent.PLAN_READY);
      expect(sm.phase).toBe(AgentPhase.IMPLEMENT);

      sm.apply(StateEvent.IMPLEMENTATION_COMPLETE);
      expect(sm.phase).toBe(AgentPhase.VERIFY);

      sm.apply(StateEvent.VERIFICATION_PASSED, {
        evidenceIds: [idFactory.create<'Evidence'>() as EvidenceId],
      });
      expect(sm.phase).toBe(AgentPhase.DONE);
      expect(sm.isTerminal).toBe(true);
    }
  });
});
