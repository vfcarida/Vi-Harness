/**
 * Default Resume Manager.
 *
 * Implements ResumeManager interface:
 * Restores state machine and execution context from durable stores and recovery decisions.
 */
import type { ResumeManager, ResumeResult } from '../../core/interfaces/resume-manager.js';
import type { StateStore } from '../../core/interfaces/state-store.js';
import type { CheckpointStore } from '../../core/interfaces/checkpoint-store.js';
import type { TaskId, IdFactory } from '../../core/types/identifiers.js';
import type { Clock } from '../../core/interfaces/clock.js';
import type { RecoveryDecision } from '../../core/model/recovery-types.js';
import type { AgentState } from '../../core/model/state.js';
import { AgentPhase } from '../../core/model/state.js';

export interface DefaultResumeManagerOptions {
  readonly stateStore: StateStore;
  readonly checkpointStore: CheckpointStore;
  readonly idFactory: IdFactory;
  readonly clock: Clock;
}

export class DefaultResumeManager implements ResumeManager {
  private readonly stateStore: StateStore;
  private readonly checkpointStore: CheckpointStore;
  private readonly idFactory: IdFactory;
  private readonly clock: Clock;

  constructor(options: DefaultResumeManagerOptions) {
    this.stateStore = options.stateStore;
    this.checkpointStore = options.checkpointStore;
    this.idFactory = options.idFactory;
    this.clock = options.clock;
  }

  async resumeTask(taskId: TaskId, decision: RecoveryDecision): Promise<ResumeResult> {
    let state: AgentState | undefined;

    if (decision.targetCheckpointId) {
      state = await this.checkpointStore.restore(decision.targetCheckpointId);
    } else {
      state = await this.stateStore.getState(taskId);
    }

    if (!state) {
      const now = this.clock.now();
      state = {
        id: this.idFactory.create<'State'>(),
        taskId,
        phase: AgentPhase.INIT,
        previousPhase: null,
        iterationId: this.idFactory.create<'Iteration'>(),
        iterationCount: 0,
        repairCount: 0,
        metadata: {},
        createdAt: now,
        updatedAt: now,
      };
    }

    return {
      state,
      resumedFromCheckpoint: decision.targetCheckpointId,
      actionToTake: decision.action,
    };
  }
}
