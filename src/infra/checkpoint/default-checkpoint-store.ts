/**
 * Default Checkpoint Store.
 *
 * Implements CheckpointStore interface:
 * Creates, restores, lists, and manages Checkpoints.
 */
import type { CheckpointStore } from '../../core/interfaces/checkpoint-store.js';
import type { CheckpointId, TaskId, IdFactory } from '../../core/types/identifiers.js';
import type { Clock } from '../../core/interfaces/clock.js';
import type { Checkpoint, CreateCheckpointParams } from '../../core/model/checkpoint.js';
import type { AgentState } from '../../core/model/state.js';
import { HarnessError } from '../../core/errors/base-error.js';
import { ErrorCode, ErrorCategory } from '../../core/errors/error-codes.js';

export interface DefaultCheckpointStoreOptions {
  readonly idFactory: IdFactory;
  readonly clock: Clock;
}

export class DefaultCheckpointStore implements CheckpointStore {
  private readonly checkpoints = new Map<CheckpointId, Checkpoint>();
  private readonly idFactory: IdFactory;
  private readonly clock: Clock;

  constructor(options: DefaultCheckpointStoreOptions) {
    this.idFactory = options.idFactory;
    this.clock = options.clock;
  }

  async create(params: CreateCheckpointParams | AgentState, label?: string): Promise<Checkpoint> {
    const now = this.clock.now();

    // Check if params is an AgentState object directly
    if ('phase' in params && 'taskId' in params) {
      const state = params as AgentState;
      const checkpoint: Checkpoint = {
        id: this.idFactory.create<'Checkpoint'>(),
        taskId: state.taskId,
        iteration: state.iterationCount,
        state,
        evidenceSummary: 'Checkpoint created from state snapshot',
        modelId: 'system',
        createdAt: now,
        reason: label ?? 'Manual snapshot',
        agentOwnedFiles: [],
        userOwnedFiles: [],
        label,
      };
      this.checkpoints.set(checkpoint.id, checkpoint);
      return checkpoint;
    }

    // Otherwise params is CreateCheckpointParams
    const p = params as CreateCheckpointParams;
    const checkpoint: Checkpoint = {
      id: p.id ?? this.idFactory.create<'Checkpoint'>(),
      taskId: p.taskId,
      iteration: p.iteration ?? p.state.iterationCount,
      gitRef: p.gitRef,
      state: p.state,
      evidenceSummary: p.evidenceSummary ?? 'Milestone snapshot',
      modelId: p.modelId ?? 'system',
      createdAt: now,
      reason: p.reason ?? label ?? 'State checkpoint',
      agentOwnedFiles: p.agentOwnedFiles ?? [],
      userOwnedFiles: p.userOwnedFiles ?? [],
      label: p.label ?? label,
      metadata: p.metadata,
    };

    this.checkpoints.set(checkpoint.id, checkpoint);
    return checkpoint;
  }

  async restore(id: CheckpointId): Promise<AgentState> {
    const cp = this.checkpoints.get(id);
    if (!cp) {
      throw new HarnessError({
        code: ErrorCode.STATE_INVALID_TRANSITION,
        category: ErrorCategory.STATE,
        message: `Checkpoint not found: ${id}`,
      });
    }
    return cp.state;
  }

  async getCheckpoint(id: CheckpointId): Promise<Checkpoint | undefined> {
    return this.checkpoints.get(id);
  }

  async list(taskId: TaskId): Promise<ReadonlyArray<Checkpoint>> {
    const list = Array.from(this.checkpoints.values()).filter((c) => c.taskId === taskId);
    list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return list;
  }

  async delete(id: CheckpointId): Promise<boolean> {
    return this.checkpoints.delete(id);
  }

  async clear(): Promise<void> {
    this.checkpoints.clear();
  }
}
