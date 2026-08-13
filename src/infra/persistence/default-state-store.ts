/**
 * Default State Store.
 *
 * Implements StateStore interface:
 * Manages agent state snapshots and enforces valid transitions with transition history.
 */
import type { StateStore } from '../../core/interfaces/state-store.js';
import type { TaskId, IdFactory } from '../../core/types/identifiers.js';
import type { Clock } from '../../core/interfaces/clock.js';
import type { AgentState, StateEvent, StateTransition } from '../../core/model/state.js';
import { StateMachine } from '../../core/state-machine/state-machine.js';

export interface DefaultStateStoreOptions {
  readonly idFactory: IdFactory;
  readonly clock: Clock;
}

export class DefaultStateStore implements StateStore {
  private readonly stateMachines = new Map<TaskId, StateMachine>();
  private readonly histories = new Map<TaskId, StateTransition[]>();
  private readonly idFactory: IdFactory;
  private readonly clock: Clock;

  constructor(options: DefaultStateStoreOptions) {
    this.idFactory = options.idFactory;
    this.clock = options.clock;
  }

  async getState(taskId: TaskId): Promise<AgentState | undefined> {
    const sm = this.stateMachines.get(taskId);
    return sm?.state;
  }

  async transition(taskId: TaskId, event: StateEvent): Promise<StateTransition> {
    let sm = this.stateMachines.get(taskId);
    if (!sm) {
      sm = new StateMachine({
        taskId,
        idFactory: this.idFactory,
        clock: this.clock,
      });
      this.stateMachines.set(taskId, sm);
    }

    const transition = sm.apply(event);
    const history = this.histories.get(taskId) ?? [];
    history.push(transition);
    this.histories.set(taskId, history);

    return transition;
  }

  async getHistory(taskId: TaskId): Promise<ReadonlyArray<StateTransition>> {
    return this.histories.get(taskId) ?? [];
  }
}
