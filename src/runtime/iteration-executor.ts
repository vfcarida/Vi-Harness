/**
 * Iteration Executor.
 *
 * "The model proposes; the runtime decides."
 *
 * Executes a single pass through the stateful, evidence-driven agent cycle:
 * 1. Load durable state
 * 2. Compile context
 * 3. Select model via ModelRouter
 * 4. Invoke model via ModelProvider
 * 5. Parse response into ActionProposals
 * 6. Evaluate actions via PolicyEngine (Deny-First)
 * 7. Execute approved tools via ToolExecutor (No Fake Tools / Fallbacks)
 * 8. Collect tool results
 * 9. Verify outcomes via VerificationEngine (No Fake Pass Evidence)
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
import type { ActionResult, ActionProposal } from '../core/model/action.js';
import { ActionResultStatus, ActionType } from '../core/model/action.js';
import type { ModelRequest, ModelMessage } from '../core/model/model-io.js';
import { MessageRole } from '../core/model/model-io.js';
import { PolicyDecisionType } from '../core/model/policy.js';
import { IterationOutcome } from '../core/model/iteration.js';
import { ContextTier } from '../core/model/context.js';
import type { ContextObject } from '../core/model/context-object.js';

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
      evidenceStore,
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

    // Step 1: Load durable state
    const currentState = stateMachine.state;

    // Calculate dynamic context requirements from initial objects, goal, task, and evidence
    const initialObjects = options?.relevantObjects ?? [];
    const recentEvidence = await evidenceStore?.listForTask(task.id);
    const estimatedContextTokens =
      initialObjects.reduce((acc: number, o: ContextObject) => acc + o.costTokens, 0) +
      Math.ceil((goal.description.length + task.description.length) / 4) +
      (recentEvidence ? recentEvidence.reduce((acc: number, e: Evidence) => acc + Math.ceil(e.summary.length / 4), 0) : 0);
    const contextTokenCount = Math.max(1000, estimatedContextTokens);
    const taskCategory =
      options?.taskCategory ??
      (currentState.phase === AgentPhase.PLAN ? TaskCategory.ARCHITECTURE : TaskCategory.CODE_GEN);

    const routingDecision = await router.route({
      taskCategory,
      complexity: options?.complexity ?? 'MEDIUM',
      risk: options?.riskLevel ?? 'LOW',
      currentState: currentState.phase,
      contextTokenCount,
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

    // Step 5: Model Completion — Structured Message Construction
    const messages: ModelMessage[] = [];

    if (compilationResult.compiledContext.entries.length > 0) {
      for (const entry of compilationResult.compiledContext.entries) {
        const roleStr = String(entry.metadata['role'] ?? '');
        const role = (roleStr === 'system' || entry.tier === ContextTier.L3_REPOSITORY)
          ? MessageRole.SYSTEM
          : roleStr === 'assistant'
          ? MessageRole.ASSISTANT
          : roleStr === 'tool'
          ? MessageRole.TOOL
          : MessageRole.USER;

        messages.push({
          role,
          content: entry.content,
          toolCallId: entry.metadata['toolCallId'] ? String(entry.metadata['toolCallId']) : undefined,
          name: entry.metadata['toolName'] ? String(entry.metadata['toolName']) : undefined,
        });
      }
    } else {
      messages.push({
        role: MessageRole.USER,
        content: goal.description,
      });
    }

    const modelRequest: ModelRequest = {
      modelId: routingDecision.selectedModelId,
      messages,
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

    for (const proposal of actionProposals) {
      observerHub.emit({
        type: AgentEventType.ActionProposed,
        executionId,
        taskId: task.id,
        timestamp: clock.now(),
        data: { action: proposal },
      });
    }

    // Step 7 & 8: Policy Evaluation & Multi-Tool Execution (Parallel Safe, Serial Mutating)
    const toolResults: ActionResult[] = [];

    if (actionProposals.length > 0 && params.toolExecutor) {
      const safeProposals: { proposal: ActionProposal; index: number }[] = [];
      const mutatingProposals: { proposal: ActionProposal; index: number }[] = [];

      for (let i = 0; i < actionProposals.length; i++) {
        const prop = actionProposals[i]!;
        if (prop.type === ActionType.MODEL_CALL) continue;

        const toolName = String(
          prop.parameters['toolName'] ??
          prop.description.replace(/^Execute tool \[([^\]]+)\]$/, '$1'),
        );
        const tool = params.toolExecutor.getTool(toolName);

        if (tool && !tool.definition.mutating) {
          safeProposals.push({ proposal: prop, index: i });
        } else {
          mutatingProposals.push({ proposal: prop, index: i });
        }
      }

      const proposalResults: ActionResult[] = new Array(actionProposals.length);

      // Execute safe read-only tools concurrently
      await Promise.all(
        safeProposals.map(async ({ proposal, index }) => {
          const res = await executeSingleProposal(proposal, params, clock);
          proposalResults[index] = res;
        }),
      );

      // Execute mutating tools serially in sequence
      for (const { proposal, index } of mutatingProposals) {
        const res = await executeSingleProposal(proposal, params, clock);
        proposalResults[index] = res;
      }

      for (const res of proposalResults) {
        if (res) toolResults.push(res);
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
      // Rule 3: Missing verification MUST NOT become PASS. Synthetic success is prohibited.
      const ev: Evidence = {
        id: idFactory.create<'Evidence'>(),
        taskId: task.id,
        type: EvidenceType.VERIFICATION,
        outcome: EvidenceOutcome.INCONCLUSIVE,
        summary: 'VERIFICATION_UNAVAILABLE: Verification engine not configured',
        data: { status: 'UNAVAILABLE' },
        createdAt: now,
        pass: false, // MUST NOT BE PASS
        confidence: 0.0,
        affectedFiles: [],
      };
      evidenceCreated.push(ev);
    }

    // Step 11: State Machine Transition
    const hasFailingEvidence = evidenceCreated.some((e) => !e.pass);
    const hasPassedEvidence = evidenceCreated.some((e) => e.pass);
    const hasFailingTool = toolResults.some(
      (t) => t.status === ActionResultStatus.FAILURE || t.status === ActionResultStatus.DENIED
    );

    let nextEvent = StateEvent.VERIFICATION_PASSED;

    if (stateBefore === AgentPhase.INIT) {
      nextEvent = StateEvent.START;
    } else if (stateBefore === AgentPhase.EXPLORE) {
      nextEvent = StateEvent.EXPLORE_COMPLETE;
    } else if (stateBefore === AgentPhase.PLAN) {
      nextEvent = StateEvent.PLAN_READY;
    } else if (stateBefore === AgentPhase.IMPLEMENT) {
      nextEvent = hasFailingTool ? StateEvent.VERIFICATION_FAILED : StateEvent.IMPLEMENTATION_COMPLETE;
    } else if (stateBefore === AgentPhase.VERIFY) {
      nextEvent = hasFailingEvidence || !hasPassedEvidence ? StateEvent.VERIFICATION_FAILED : StateEvent.VERIFICATION_PASSED;
    } else if (stateBefore === AgentPhase.REPAIR) {
      nextEvent = hasFailingTool || hasFailingEvidence || !hasPassedEvidence ? StateEvent.VERIFICATION_FAILED : StateEvent.REPAIR_COMPLETE;
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
    const elapsedMs = clock.now().getTime() - startTimeMs;
    const currentCost = totalCostDollars + modelResponse.estimatedCostDollars;
    const failingEvidenceIds = evidenceCreated.filter((e) => !e.pass).map((e) => e.id);

    const iterationOutcome = hasFailingEvidence || hasFailingTool
      ? IterationOutcome.VERIFICATION_FAILED
      : (hasPassedEvidence ? IterationOutcome.VERIFICATION_PASSED : IterationOutcome.PROGRESS);

    // Map iteration records to Iteration model
    const iterationModels = iterationsSoFar.map((rec) => ({
      id: rec.iterationId,
      taskId: task.id,
      sequenceNumber: rec.sequenceNumber,
      outcome: iterationOutcome,
      fingerprint: {
        filesModified: [],
        hypothesisId: null,
        errorSignature: hasFailingEvidence ? 'ERR_VERIFICATION' : null,
        patchSignature: null,
        failingTests: failingEvidenceIds,
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
      outcome: iterationOutcome,
      fingerprint: {
        filesModified: [],
        hypothesisId: null,
        errorSignature: hasFailingEvidence ? 'ERR_VERIFICATION' : null,
        patchSignature: null,
        failingTests: failingEvidenceIds,
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
      actionProposed: actionProposals[0] ?? null,
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

async function executeSingleProposal(
  proposal: ActionProposal,
  params: IterationExecutorParams,
  clock: Clock,
): Promise<ActionResult> {
  const toolName = String(
    proposal.parameters['toolName'] ??
    proposal.description.replace(/^Execute tool \[([^\]]+)\]$/, '$1'),
  );
  const input = (proposal.parameters['input'] as Record<string, unknown>) ?? proposal.parameters;
  const tool = params.toolExecutor?.getTool(toolName);

  if (!tool) {
    return {
      actionId: proposal.id,
      status: ActionResultStatus.FAILURE,
      output: '',
      durationMs: 0,
      error: `UNKNOWN_TOOL: Tool [${toolName}] is not registered in ToolRegistry`,
      executedAt: clock.now(),
      metadata: { toolName, outcome: 'UNKNOWN_TOOL' },
    };
  }

  if (params.policyEngine) {
    const action = {
      type: tool.definition.category,
      resource: tool.definition.name,
      metadata: input,
      irreversible: proposal.irreversible,
    };
    const evaluation = await params.policyEngine.evaluate(action);
    if (evaluation.decision === PolicyDecisionType.DENY) {
      return {
        actionId: proposal.id,
        status: ActionResultStatus.DENIED,
        output: '',
        durationMs: 0,
        error: `POLICY_DENIED: Execution denied by rule [${evaluation.ruleId ?? 'default'}]`,
        executedAt: clock.now(),
        metadata: { ruleId: evaluation.ruleId, outcome: 'POLICY_DENIED' },
      };
    }
  }

  try {
    const result = await params.toolExecutor!.execute({
      tool,
      input,
      requiresPolicy: false,
    });

    return {
      actionId: proposal.id,
      status: result.success ? ActionResultStatus.SUCCESS : ActionResultStatus.FAILURE,
      output: result.output,
      durationMs: result.durationMs,
      error: result.error,
      executedAt: clock.now(),
      metadata: result.metadata ?? {},
    };
  } catch (err) {
    return {
      actionId: proposal.id,
      status: ActionResultStatus.FAILURE,
      output: '',
      durationMs: 0,
      error: err instanceof Error ? err.message : String(err),
      executedAt: clock.now(),
      metadata: { toolName },
    };
  }
}
