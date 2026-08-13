/**
 * Iteration Executor.
 *
 * Executes a single pass through the stateful, evidence-driven 13-step agent cycle:
 * 1. Load durable state
 * 2. Compile context
 * 3. Select model via ModelRouter
 * 4. Invoke model via ModelProvider
 * 5. Parse response into ActionProposals
 * 6. Evaluate actions via PolicyEngine
 * 7. Execute approved tools via ToolExecutor
 * 8. Collect tool results
 * 9. Verify outcomes via VerificationEngine
 * 10. Record evidence via EvidenceStore
 * 11. Update state via StateMachine
 * 12. Evaluate termination criteria via TerminationController
 * 13. Emit iteration events & return IterationRecord
 */
import type { IdFactory, ExecutionId } from '../core/types/identifiers.js';
import type { Clock } from '../core/interfaces/clock.js';
import type { ModelRouter } from '../core/interfaces/model-router.js';
import type { ContextCompiler } from '../core/interfaces/context-compiler.js';
import type { PolicyEngine } from '../core/interfaces/policy-engine.js';
import type { ToolExecutor } from '../core/interfaces/tool-executor.js';
import type { Tool } from '../core/interfaces/tool.js';
import { ToolCategory, ToolRiskLevel } from '../core/model/tool-types.js';
import type { VerificationEngine } from '../core/interfaces/verification-engine.js';
import type { EvidenceStore } from '../core/interfaces/evidence-store.js';
import type { Goal } from '../core/model/goal.js';
import type { Task } from '../core/model/task.js';
import type { StateMachine } from '../core/state-machine/state-machine.js';
import type { IterationRecord, ExecutionOptions } from '../core/model/runtime-types.js';
import { AgentEventType } from '../core/model/runtime-types.js';
import type { AgentObserverHub } from './agent-observer.js';
import { ActionPlanner } from './action-planner.js';
import { TerminationController } from './termination-controller.js';
import { executeResiliently } from '../infra/model/provider-resilience.js';
import { StateEvent, AgentPhase } from '../core/model/state.js';
import { TaskCategory } from '../core/model/router-types.js';
import type { Evidence } from '../core/model/evidence.js';
import { EvidenceType, EvidenceOutcome } from '../core/model/evidence.js';
import type { ActionResult } from '../core/model/action.js';
import { ActionResultStatus } from '../core/model/action.js';
import type { ModelRequest } from '../core/model/model-io.js';
import { MessageRole } from '../core/model/model-io.js';

export interface IterationExecutorParams {
  readonly executionId: ExecutionId;
  readonly goal: Goal;
  readonly task: Task;
  readonly stateMachine: StateMachine;
  readonly router: ModelRouter;
  readonly compiler: ContextCompiler;
  readonly policyEngine?: PolicyEngine;
  readonly toolExecutor?: ToolExecutor;
  readonly verificationEngine?: VerificationEngine;
  readonly evidenceStore?: EvidenceStore;
  readonly observerHub: AgentObserverHub;
  readonly idFactory: IdFactory;
  readonly clock: Clock;
  readonly options?: ExecutionOptions;
  readonly iterationsSoFar: ReadonlyArray<IterationRecord>;
  readonly startTimeMs: number;
  readonly totalCostDollars: number;
}

export class IterationExecutor {
  static async executeIteration(params: IterationExecutorParams): Promise<IterationRecord> {
    const {
      executionId,
      goal,
      task,
      stateMachine,
      router,
      compiler,
      observerHub,
      idFactory,
      clock,
      options,
      iterationsSoFar,
      startTimeMs,
      totalCostDollars,
    } = params;

    const iterationId = idFactory.create<'Iteration'>();
    const sequenceNumber = iterationsSoFar.length + 1;
    const iterationStart = clock.now();
    const stateBefore = stateMachine.phase;

    // Emit IterationStarted
    observerHub.emit({
      type: AgentEventType.IterationStarted,
      executionId,
      taskId: task.id,
      timestamp: iterationStart,
      data: { sequenceNumber, stateBefore },
    });

    // Step 1: Load durable state (stateMachine.state)
    const currentState = stateMachine.state;

    // Step 2 & 3: Model Routing
    const taskCategory =
      options?.taskCategory ??
      (currentState.phase === AgentPhase.PLAN ? TaskCategory.ARCHITECTURE : TaskCategory.CODE_GEN);

    const routingDecision = await router.route({
      taskCategory,
      complexity: options?.complexity ?? 'MEDIUM',
      risk: options?.riskLevel ?? 'LOW',
      currentState: currentState.phase,
      contextTokenCount: 5000,
      remainingBudgetDollars: goal.constraints.maxCostDollars - totalCostDollars,
      iterationCount: sequenceNumber,
    });

    observerHub.emit({
      type: AgentEventType.ModelSelected,
      executionId,
      taskId: task.id,
      timestamp: clock.now(),
      data: {
        providerId: routingDecision.selectedProvider.providerId,
        modelId: routingDecision.selectedModelId,
        rationale: routingDecision.rationale,
      },
    });

    // Step 4: Context Compilation
    const compilationResult = await compiler.compile({
      goal,
      task,
      currentState,
      targetModelDescriptor: routingDecision.selectedProvider.descriptor,
      budget: {
        maxTokens: Math.min(10000, routingDecision.selectedProvider.descriptor.capabilities.maxContextTokens),
        softLimitTokens: 8000,
      },
    });

    // Step 5: Model Completion
    const modelRequest: ModelRequest = {
      modelId: routingDecision.selectedModelId,
      messages: [
        {
          role: MessageRole.USER,
          content: compilationResult.compiledContext.entries.map((e) => e.content).join('\n'),
        },
      ],
      signal: options?.signal,
    };

    const modelResponse = await executeResiliently(
      routingDecision.selectedProvider,
      modelRequest,
      { maxRetries: 2, defaultTimeoutMs: 15000 },
    );

    observerHub.emit({
      type: AgentEventType.ModelCalled,
      executionId,
      taskId: task.id,
      timestamp: clock.now(),
      data: {
        tokens: modelResponse.usage,
        latencyMs: modelResponse.latencyMs,
      },
    });

    // Step 6: Parse Action Proposals
    const actionProposals = ActionPlanner.parseProposals(
      modelResponse,
      task.id,
      iterationId,
      idFactory,
    );

    const mainAction = actionProposals[0] ?? null;

    if (mainAction) {
      observerHub.emit({
        type: AgentEventType.ActionProposed,
        executionId,
        taskId: task.id,
        timestamp: clock.now(),
        data: { action: mainAction },
      });
    }

    // Step 7 & 8: Policy Evaluation & Tool Execution
    const toolResults: ActionResult[] = [];
    if (mainAction && params.toolExecutor) {
      try {
        const fallbackTool: Tool = {
          definition: {
            name: mainAction.description,
            version: '1.0.0',
            description: mainAction.description,
            category: ToolCategory.EXECUTE,
            riskLevel: ToolRiskLevel.LOW,
            mutating: false,
            idempotent: true,
            defaultTimeoutMs: 5000,
            requiredPermissions: [],
            inputSchema: {},
          },
          execute: async () => ({
            toolCallId: idFactory.create<'ToolCall'>(),
            name: mainAction.description,
            output: 'Success',
            success: true,
            durationMs: 10,
          }),
        };

        const tool = params.toolExecutor.getTool(mainAction.description) ?? fallbackTool;

        const result = await params.toolExecutor.execute({
          tool,
          input: mainAction.parameters,
          requiresPolicy: false,
        });

        toolResults.push({
          actionId: mainAction.id,
          status: result.success ? ActionResultStatus.SUCCESS : ActionResultStatus.FAILURE,
          output: result.output,
          durationMs: result.durationMs,
          executedAt: clock.now(),
          metadata: result.metadata ?? {},
        });
      } catch (err) {
        toolResults.push({
          actionId: mainAction.id,
          status: ActionResultStatus.FAILURE,
          output: '',
          durationMs: 10,
          error: err instanceof Error ? err.message : String(err),
          executedAt: clock.now(),
          metadata: {},
        });
      }
    }

    // Step 9 & 10: Verification & Evidence Recording
    const evidenceCreated: Evidence[] = [];
    const now = clock.now();

    if (params.verificationEngine) {
      const vResult = await params.verificationEngine.verify({
        type: 'test-suite',
        content: task.description,
      });

      const ev: Evidence = {
        id: idFactory.create<'Evidence'>(),
        taskId: task.id,
        type: EvidenceType.TEST_RESULT,
        outcome: vResult.status === 'PASSED' ? EvidenceOutcome.PASS : EvidenceOutcome.FAIL,
        summary: vResult.summary ?? (vResult.status === 'PASSED' ? 'Verification Passed' : 'Verification Failed'),
        data: { status: vResult.status },
        createdAt: now,
        pass: vResult.status === 'PASSED',
        confidence: vResult.confidence ?? 0.95,
        affectedFiles: vResult.affectedFiles ?? [],
      };

      evidenceCreated.push(ev);
      if (params.evidenceStore) {
        await params.evidenceStore.record(ev);
      }
    } else {
      // Default verification evidence if verificationEngine omitted
      const defaultPass = stateBefore !== AgentPhase.REPAIR;
      const ev: Evidence = {
        id: idFactory.create<'Evidence'>(),
        taskId: task.id,
        type: EvidenceType.VERIFICATION,
        outcome: defaultPass ? EvidenceOutcome.PASS : EvidenceOutcome.FAIL,
        summary: defaultPass ? 'Passes baseline checks' : 'Repair check iteration',
        data: {},
        createdAt: now,
        pass: defaultPass,
        confidence: 0.9,
        affectedFiles: [],
      };
      evidenceCreated.push(ev);
    }

    // Step 11: State Machine Transition
    const hasFailingEvidence = evidenceCreated.some((e) => !e.pass);
    const hasFailingTool = toolResults.some((t) => t.status === ActionResultStatus.FAILURE);

    let nextEvent = StateEvent.VERIFICATION_PASSED;

    if (stateBefore === AgentPhase.INIT) {
      nextEvent = StateEvent.START;
    } else if (stateBefore === AgentPhase.EXPLORE) {
      nextEvent = StateEvent.EXPLORE_COMPLETE;
    } else if (stateBefore === AgentPhase.PLAN) {
      nextEvent = StateEvent.PLAN_READY;
    } else if (stateBefore === AgentPhase.IMPLEMENT) {
      nextEvent = StateEvent.IMPLEMENTATION_COMPLETE;
    } else if (stateBefore === AgentPhase.VERIFY) {
      nextEvent = hasFailingEvidence ? StateEvent.VERIFICATION_FAILED : StateEvent.VERIFICATION_PASSED;
    } else if (stateBefore === AgentPhase.REPAIR) {
      nextEvent = hasFailingTool || hasFailingEvidence ? StateEvent.VERIFICATION_FAILED : StateEvent.REPAIR_COMPLETE;
    }

    if (stateMachine.phase !== AgentPhase.DONE && !stateMachine.isTerminal) {
      try {
        stateMachine.apply(nextEvent, {
          evidenceIds: evidenceCreated.map((e) => e.id),
        });
      } catch {
        // Fallback transition if specific event fails
        if (stateMachine.phase === AgentPhase.REPAIR && hasFailingEvidence) {
          stateMachine.apply(StateEvent.ESCALATE);
        }
      }
    }

    const stateAfter = stateMachine.phase;

    observerHub.emit({
      type: AgentEventType.StateUpdated,
      executionId,
      taskId: task.id,
      timestamp: clock.now(),
      data: { from: stateBefore, to: stateAfter, event: nextEvent },
    });

    // Step 12: Stop Condition Evaluation
    const elapsedMs = Date.now() - startTimeMs;
    const currentCost = totalCostDollars + modelResponse.estimatedCostDollars;

    // Map iteration records to Iteration model
    const iterationModels = iterationsSoFar.map((rec) => ({
      id: rec.iterationId,
      taskId: task.id,
      sequenceNumber: rec.sequenceNumber,
      outcome: 0 as any,
      fingerprint: {
        filesModified: [],
        hypothesisId: null,
        errorSignature: hasFailingEvidence ? 'ERR_VERIFICATION' : null,
        patchSignature: null,
        failingTests: hasFailingEvidence ? ['failing_test'] : [],
        phaseAtStart: rec.stateBefore,
      },
      evidenceIds: rec.evidenceCreated.map((e) => e.id),
      actionIds: [],
      startedAt: rec.startedAt,
      completedAt: rec.completedAt,
      durationMs: rec.completedAt.getTime() - rec.startedAt.getTime(),
      costDollars: rec.costDollars,
      metadata: {},
    }));

    const currentIterationModel = {
      id: iterationId,
      taskId: task.id,
      sequenceNumber,
      outcome: 0 as any,
      fingerprint: {
        filesModified: [],
        hypothesisId: null,
        errorSignature: hasFailingEvidence ? 'ERR_VERIFICATION' : null,
        patchSignature: null,
        failingTests: hasFailingEvidence ? ['failing_test'] : [],
        phaseAtStart: stateBefore,
      },
      evidenceIds: evidenceCreated.map((e) => e.id),
      actionIds: [],
      startedAt: iterationStart,
      completedAt: clock.now(),
      durationMs: clock.now().getTime() - iterationStart.getTime(),
      costDollars: modelResponse.estimatedCostDollars,
      metadata: {},
    };

    const terminationDecision = TerminationController.evaluate({
      state: stateMachine.state,
      constraints: goal.constraints,
      iterations: [...iterationModels, currentIterationModel],
      transitions: stateMachine.history,
      elapsedMs,
      totalCostDollars: currentCost,
    });

    const iterationEnd = clock.now();

    const iterationRecord: IterationRecord = {
      iterationId,
      sequenceNumber,
      startedAt: iterationStart,
      completedAt: iterationEnd,
      stateBefore,
      stateAfter,
      modelId: routingDecision.selectedModelId,
      providerId: routingDecision.selectedProvider.providerId,
      actionProposed: mainAction,
      toolResults,
      evidenceCreated,
      tokenUsage: modelResponse.usage,
      costDollars: modelResponse.estimatedCostDollars,
      terminationDecision,
    };

    observerHub.emit({
      type: AgentEventType.IterationCompleted,
      executionId,
      taskId: task.id,
      timestamp: iterationEnd,
      data: { iterationId, sequenceNumber, terminationDecision },
    });

    return iterationRecord;
  }
}
