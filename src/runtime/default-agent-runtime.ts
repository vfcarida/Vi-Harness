/**
 * Default Stateful Agent Runtime.
 *
 * Implements AgentRuntime interface:
 * "The agent is not a persistent conversation. The agent is a stateful,
 * evidence-driven state machine."
 *
 * Features:
 * - Iterative non-recursive execution loop (`while` loop with safety bounds)
 * - Durable state & checkpoint saving/restoration
 * - Subscription hub for observable runtime events
 * - Support for pause, resume from checkpoint, cancellation, human escalation
 */
import type { AgentRuntime, AgentObserver } from '../core/interfaces/agent-runtime.js';
import type { IdFactory, ExecutionId, CheckpointId } from '../core/types/identifiers.js';
import type { Clock } from '../core/interfaces/clock.js';
import type { ModelRouter } from '../core/interfaces/model-router.js';
import type { ContextCompiler } from '../core/interfaces/context-compiler.js';
import type { PolicyEngine } from '../core/interfaces/policy-engine.js';
import type { ToolExecutor } from '../core/interfaces/tool-executor.js';
import type { VerificationEngine } from '../core/interfaces/verification-engine.js';
import type { EvidenceStore } from '../core/interfaces/evidence-store.js';
import type { CheckpointStore } from '../core/interfaces/checkpoint-store.js';
import type { Goal } from '../core/model/goal.js';
import type { Task } from '../core/model/task.js';
import { TaskStatus } from '../core/model/task.js';
import { StateMachine } from '../core/state-machine/state-machine.js';
import { AgentPhase, StateEvent } from '../core/model/state.js';
import type {
  ExecutionOptions,
  ExecutionResult,
  AgentExecutionStatus,
  IterationRecord,
} from '../core/model/runtime-types.js';
import { AgentEventType } from '../core/model/runtime-types.js';

import { AgentObserverHub } from './agent-observer.js';
import { IterationExecutor } from './iteration-executor.js';
import { HarnessError } from '../core/errors/base-error.js';
import { ErrorCode, ErrorCategory } from '../core/errors/error-codes.js';

export interface DefaultAgentRuntimeOptions {
  readonly router: ModelRouter;
  readonly compiler: ContextCompiler;
  readonly policyEngine?: PolicyEngine;
  readonly toolExecutor?: ToolExecutor;
  readonly verificationEngine?: VerificationEngine;
  readonly evidenceStore?: EvidenceStore;
  readonly checkpointStore?: CheckpointStore;
  readonly idFactory: IdFactory;
  readonly clock: Clock;
}

interface ActiveExecution {
  readonly executionId: ExecutionId;
  readonly goal: Goal;
  readonly task: Task;
  readonly stateMachine: StateMachine;
  readonly startTimeMs: number;
  readonly observerHub: AgentObserverHub;
  status: AgentExecutionStatus;
  iterations: IterationRecord[];
  totalCostDollars: number;
  totalTokens: number;
  abortController: AbortController;
  latestCheckpointId?: CheckpointId;
}

export class DefaultAgentRuntime implements AgentRuntime {
  private readonly router: ModelRouter;
  private readonly compiler: ContextCompiler;
  private readonly policyEngine?: PolicyEngine;
  private readonly toolExecutor?: ToolExecutor;
  private readonly verificationEngine?: VerificationEngine;
  private readonly evidenceStore?: EvidenceStore;
  private readonly checkpointStore?: CheckpointStore;
  private readonly idFactory: IdFactory;
  private readonly clock: Clock;

  private readonly globalObserverHub = new AgentObserverHub();
  private readonly activeExecutions = new Map<ExecutionId, ActiveExecution>();

  constructor(options: DefaultAgentRuntimeOptions) {
    this.router = options.router;
    this.compiler = options.compiler;
    this.policyEngine = options.policyEngine;
    this.toolExecutor = options.toolExecutor;
    this.verificationEngine = options.verificationEngine;
    this.evidenceStore = options.evidenceStore;
    this.checkpointStore = options.checkpointStore;
    this.idFactory = options.idFactory;
    this.clock = options.clock;
  }

  subscribe(observer: AgentObserver): () => void {
    return this.globalObserverHub.subscribe(observer);
  }

  async execute(goal: Goal, options?: ExecutionOptions): Promise<ExecutionResult> {
    const executionId = this.idFactory.create<'Execution'>();
    const taskId = this.idFactory.create<'Task'>();

    const task: Task = {
      id: taskId,
      goalId: goal.id,
      description: goal.description,
      status: TaskStatus.ACTIVE,
      priority: 1,
      createdAt: this.clock.now(),
      updatedAt: this.clock.now(),
      metadata: {},
    };

    const stateMachine = new StateMachine({
      taskId,
      idFactory: this.idFactory,
      clock: this.clock,
    });

    const execution: ActiveExecution = {
      executionId,
      goal,
      task,
      stateMachine,
      startTimeMs: Date.now(),
      observerHub: this.globalObserverHub,
      status: 'RUNNING',
      iterations: [],
      totalCostDollars: 0,
      totalTokens: 0,
      abortController: new AbortController(),
    };

    this.activeExecutions.set(executionId, execution);

    this.globalObserverHub.emit({
      type: AgentEventType.AgentStarted,
      executionId,
      taskId,
      timestamp: this.clock.now(),
      data: { goalId: goal.id, description: goal.description },
    });

    return this.runLoop(execution, options);
  }

  async pause(executionId: ExecutionId): Promise<void> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      throw new HarnessError({
        code: ErrorCode.STATE_INVALID_TRANSITION,
        category: ErrorCategory.STATE,
        message: `Active execution not found for pause: ${executionId}`,
      });
    }

    execution.status = 'PAUSED';
    execution.abortController.abort();

    // Save Checkpoint if CheckpointStore is available
    if (this.checkpointStore) {
      const checkpoint = await this.checkpointStore.create(execution.stateMachine.state, 'paused');
      execution.latestCheckpointId = checkpoint.id;
    }

    this.globalObserverHub.emit({
      type: AgentEventType.AgentPaused,
      executionId,
      taskId: execution.task.id,
      timestamp: this.clock.now(),
      data: { checkpointId: execution.latestCheckpointId },
    });
  }

  async resume(executionId: ExecutionId, options?: ExecutionOptions): Promise<ExecutionResult> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      throw new HarnessError({
        code: ErrorCode.STATE_INVALID_TRANSITION,
        category: ErrorCategory.STATE,
        message: `Execution not found to resume: ${executionId}`,
      });
    }

    // Restore from Checkpoint if requested
    if (options?.checkpointId && this.checkpointStore) {
      const restoredState = await this.checkpointStore.restore(options.checkpointId);
      if (restoredState) {
        const restoredMachine = new StateMachine({
          taskId: restoredState.taskId,
          idFactory: this.idFactory,
          clock: this.clock,
          initialPhase: restoredState.phase,
        });
        (execution as any).stateMachine = restoredMachine;
      }
    }

    execution.status = 'RUNNING';
    execution.abortController = new AbortController();

    this.globalObserverHub.emit({
      type: AgentEventType.AgentResumed,
      executionId,
      taskId: execution.task.id,
      timestamp: this.clock.now(),
      data: { checkpointId: options?.checkpointId },
    });

    return this.runLoop(execution, options);
  }

  async abort(executionId: ExecutionId): Promise<void> {
    const execution = this.activeExecutions.get(executionId);
    if (execution) {
      execution.status = 'CANCELLED';
      execution.abortController.abort();

      if (execution.stateMachine.phase !== AgentPhase.CANCELLED && !execution.stateMachine.isTerminal) {
        try {
          execution.stateMachine.apply(StateEvent.CANCEL);
        } catch {
          // Ignore if transition illegal
        }
      }

      this.globalObserverHub.emit({
        type: AgentEventType.AgentCancelled,
        executionId,
        taskId: execution.task.id,
        timestamp: this.clock.now(),
        data: {},
      });
    }
  }

  private async runLoop(
    execution: ActiveExecution,
    options?: ExecutionOptions,
  ): Promise<ExecutionResult> {
    const { goal, task, stateMachine, observerHub, executionId } = execution;

    // Iterative non-recursive loop
    while (execution.status === 'RUNNING') {
      // Cancellation check
      if (options?.signal?.aborted || execution.abortController.signal.aborted) {
        execution.status = 'CANCELLED';
        break;
      }

      // Terminal state check
      if (stateMachine.isTerminal) {
        if (stateMachine.phase === AgentPhase.DONE) {
          execution.status = 'COMPLETED';
        } else if (stateMachine.phase === AgentPhase.CANCELLED) {
          execution.status = 'CANCELLED';
        } else {
          execution.status = 'FAILED';
        }
        break;
      }

      if (stateMachine.phase === AgentPhase.HUMAN_REQUIRED) {
        execution.status = 'AWAITING_HUMAN';
        break;
      }

      try {
        const iterationRecord = await IterationExecutor.executeIteration({
          executionId,
          goal,
          task,
          stateMachine,
          router: this.router,
          compiler: this.compiler,
          policyEngine: this.policyEngine,
          toolExecutor: this.toolExecutor,
          verificationEngine: this.verificationEngine,
          evidenceStore: this.evidenceStore,
          observerHub,
          idFactory: this.idFactory,
          clock: this.clock,
          options,
          iterationsSoFar: execution.iterations,
          startTimeMs: execution.startTimeMs,
          totalCostDollars: execution.totalCostDollars,
        });

        execution.iterations.push(iterationRecord);
        execution.totalCostDollars += iterationRecord.costDollars;
        execution.totalTokens += iterationRecord.tokenUsage.totalTokens;

        // Check loop control termination decision
        if (iterationRecord.terminationDecision.terminal) {
          if (iterationRecord.terminationDecision.humanRequired) {
            execution.status = 'AWAITING_HUMAN';
          } else {
            execution.status = 'FAILED';
          }
          break;
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        observerHub.emit({
          type: AgentEventType.AgentFailed,
          executionId,
          taskId: task.id,
          timestamp: this.clock.now(),
          data: { error: errorMsg },
        });
        execution.status = 'FAILED';
        break;
      }
    }

    const durationMs = Date.now() - execution.startTimeMs;
    const success = execution.status === 'COMPLETED';

    const summary = success
      ? `Goal completed successfully in ${execution.iterations.length} iterations.`
      : `Execution terminated with status ${execution.status}. Phase: ${stateMachine.phase}.`;

    const finalEventType = success
      ? AgentEventType.AgentCompleted
      : execution.status === 'CANCELLED'
        ? AgentEventType.AgentCancelled
        : AgentEventType.AgentFailed;

    observerHub.emit({
      type: finalEventType,
      executionId,
      taskId: task.id,
      timestamp: this.clock.now(),
      data: { success, status: execution.status, durationMs },
    });

    return {
      executionId,
      goalId: goal.id,
      taskId: task.id,
      success,
      status: execution.status,
      summary,
      iterationCount: execution.iterations.length,
      durationMs,
      totalCostDollars: execution.totalCostDollars,
      totalTokens: execution.totalTokens,
      iterations: execution.iterations,
      checkpointId: execution.latestCheckpointId,
    };
  }
}
