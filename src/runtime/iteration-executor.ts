/**
 * Iteration Executor.
 *
 * "The model proposes; the runtime decides."
 *
 * Executes a single pass through the stateful, evidence-driven agent cycle:
 * OBSERVE -> CONTEXT -> MODEL -> PROPOSE -> POLICY -> ACT -> OBSERVE RESULT -> VERIFY -> EVIDENCE -> STATE -> NEXT ITERATION
 *
 * Explicit Iteration Phases:
 * 1. Observation (durable state, prior iteration outcomes, prior evidence)
 * 2. Context Compilation (model-aware context including prior tool results & structured errors)
 * 3. Model Decision (routing and completion execution)
 * 4. Action Proposals (parsing single or multiple tool calls)
 * 5. Policy Decisions (Deny-First security evaluation)
 * 6. Tool Executions (safe parallel, mutating serial execution with structured error formatting)
 * 7. Verification Results (running actual verification checks — no synthetic pass)
 * 8. Evidence (recording evidence in EvidenceStore)
 * 9. State Transition (derived strictly from actual evidence & tool results)
 * 10. Termination Decision (evaluating stop conditions & trajectory metrics)
 */
import type { IdFactory, ExecutionId, HypothesisId } from '../core/types/identifiers.js';
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

export interface PolicyDecisionRecord {
  readonly proposalId: string;
  readonly toolName: string;
  readonly decision: PolicyDecisionType;
  readonly ruleId?: string;
  readonly reason: string;
}

export interface IterationPhases {
  readonly observation: {
    readonly stateBefore: AgentPhase;
    readonly sequenceNumber: number;
    readonly priorToolResultsCount: number;
    readonly priorEvidenceCount: number;
  };
  readonly context: {
    readonly compiledTokens: number;
    readonly entriesCount: number;
  };
  readonly modelDecision: {
    readonly providerId: string;
    readonly modelId: string;
    readonly usage: { inputTokens: number; outputTokens: number; totalTokens: number };
    readonly latencyMs: number;
  };
  readonly actionProposals: ReadonlyArray<ActionProposal>;
  readonly policyDecisions: ReadonlyArray<PolicyDecisionRecord>;
  readonly toolExecutions: ReadonlyArray<ActionResult>;
  readonly evidence: ReadonlyArray<Evidence>;
  readonly stateTransition: {
    readonly from: AgentPhase;
    readonly to: AgentPhase;
    readonly event: StateEvent;
  };
  readonly terminationDecision: ReturnType<typeof TerminationController.evaluate>;
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

    // -----------------------------------------------------------------------
    // PHASE 1: OBSERVATION
    // -----------------------------------------------------------------------
    const currentState = stateMachine.state;
    const recentEvidence = await evidenceStore?.listForTask(task.id);

    // -----------------------------------------------------------------------
    // PHASE 2: CONTEXT COMPILATION
    // -----------------------------------------------------------------------
    const initialObjects = options?.relevantObjects ?? [];
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

    // Construct structured messages for model (including prior tool outputs & evidence)
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
        content: `Goal: ${goal.description}\nTask: ${task.description}`,
      });
    }

    // Append prior iteration tool results & evidence to message stream
    for (const priorIter of iterationsSoFar) {
      for (const res of priorIter.toolResults) {
        const toolCallId = String(res.metadata['toolCallId'] ?? res.actionId);
        const toolName = String(res.metadata['toolName'] ?? 'tool');
        messages.push({
          role: MessageRole.TOOL,
          content: res.output || (res.error ? res.error : 'Execution finished'),
          toolCallId,
          name: toolName,
        });
      }
      for (const ev of priorIter.evidenceCreated) {
        messages.push({
          role: MessageRole.SYSTEM,
          content: `[VERIFICATION_EVIDENCE] Check: ${ev.checkId}, Outcome: ${ev.outcome}, Pass: ${ev.pass}, Summary: ${ev.summary}`,
        });
      }
    }

    // -----------------------------------------------------------------------
    // PHASE 3: MODEL DECISION
    // -----------------------------------------------------------------------
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

    // -----------------------------------------------------------------------
    // PHASE 4: ACTION PROPOSALS (MULTIPLE TOOL CALL SUPPORT)
    // -----------------------------------------------------------------------
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

    // -----------------------------------------------------------------------
    // PHASE 5 & 6: POLICY DECISIONS & TOOL EXECUTIONS
    // -----------------------------------------------------------------------
    const policyDecisions: PolicyDecisionRecord[] = [];
    const toolResults: ActionResult[] = [];

    if (actionProposals.length > 0 && params.toolExecutor) {
      const safeProposals: { proposal: ActionProposal; index: number }[] = [];
      const mutatingProposals: { proposal: ActionProposal; index: number }[] = [];

      for (let i = 0; i < actionProposals.length; i++) {
        const prop = actionProposals[i]!;
        if (prop.type === ActionType.MODEL_CALL) continue;

        const toolName = extractToolName(prop);
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
          const res = await executeSingleProposalWithPolicy(proposal, params, clock, policyDecisions);
          proposalResults[index] = res;
        }),
      );

      // Execute mutating tools serially in sequence
      for (const { proposal, index } of mutatingProposals) {
        const res = await executeSingleProposalWithPolicy(proposal, params, clock, policyDecisions);
        proposalResults[index] = res;
      }

      for (const res of proposalResults) {
        if (res) {
          toolResults.push(res);
          observerHub.emit({
            type: AgentEventType.ToolCompleted,
            executionId,
            taskId: task.id,
            timestamp: clock.now(),
            data: { result: res },
          });
        }
      }
    }

    // -----------------------------------------------------------------------
    // PHASE 7 & 8: VERIFICATION RESULTS & EVIDENCE RECORDING
    // -----------------------------------------------------------------------
    const evidenceCreated: Evidence[] = [];
    const now = clock.now();

    const hasTestRunAction = actionProposals.some((p) => {
      if (p.type === ActionType.TEST_RUN) return true;
      const desc = p.description.toLowerCase();
      const cmd = String(p.parameters['cmd'] ?? p.parameters['command'] ?? p.parameters['input'] ?? '').toLowerCase();
      return desc.includes('test') || cmd.includes('test');
    });

    if (params.verificationEngine) {
      if (currentState.phase === AgentPhase.VERIFY || hasTestRunAction) {
        const vResult = await params.verificationEngine.verify({
          type: 'test-suite',
          content: task.description,
        });

        const ev: Evidence = {
          id: idFactory.create<'Evidence'>(),
          taskId: task.id,
          type: EvidenceType.TEST_RESULT,
          outcome: vResult.status === 'PASSED' ? EvidenceOutcome.PASS : EvidenceOutcome.FAIL,
          summary: vResult.summary ?? (vResult.status === 'PASSED' ? 'Verification Suite Passed' : 'Verification Suite Failed'),
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

        observerHub.emit({
          type: AgentEventType.EvidenceCreated,
          executionId,
          taskId: task.id,
          timestamp: now,
          data: { evidence: ev },
        });
      }
    } else {
      // Missing verification MUST NOT become PASS. Synthetic success prohibited.
      const ev: Evidence = {
        id: idFactory.create<'Evidence'>(),
        taskId: task.id,
        type: EvidenceType.VERIFICATION,
        outcome: EvidenceOutcome.INCONCLUSIVE,
        summary: 'VERIFICATION_UNAVAILABLE: Verification engine not configured',
        data: { status: 'UNAVAILABLE' },
        createdAt: now,
        pass: false,
        confidence: 0.0,
        affectedFiles: [],
      };
      evidenceCreated.push(ev);
      if (params.evidenceStore) {
        await params.evidenceStore.record(ev);
      }

      observerHub.emit({
        type: AgentEventType.EvidenceCreated,
        executionId,
        taskId: task.id,
        timestamp: now,
        data: { evidence: ev },
      });
    }

    // -----------------------------------------------------------------------
    // PHASE 9: DERIVED STATE TRANSITION (STRICT RESULTS-BASED)
    // -----------------------------------------------------------------------
    const hasFailingEvidence = evidenceCreated.some((e) => !e.pass);
    const hasPassedEvidence = evidenceCreated.some((e) => e.pass);
    const hasFailingTool = toolResults.some(
      (t) => t.status === ActionResultStatus.FAILURE || t.status === ActionResultStatus.DENIED,
    );

    let nextEvent: StateEvent | null = StateEvent.VERIFICATION_PASSED;

    if (stateBefore === AgentPhase.INIT) {
      nextEvent = StateEvent.START;
    } else if (stateBefore === AgentPhase.EXPLORE) {
      nextEvent = StateEvent.EXPLORE_COMPLETE;
    } else if (stateBefore === AgentPhase.PLAN) {
      nextEvent = StateEvent.PLAN_READY;
    } else if (stateBefore === AgentPhase.IMPLEMENT) {
      nextEvent = StateEvent.IMPLEMENTATION_COMPLETE;
    } else if (stateBefore === AgentPhase.VERIFY) {
      nextEvent = (hasFailingEvidence || !hasPassedEvidence) ? StateEvent.VERIFICATION_FAILED : StateEvent.VERIFICATION_PASSED;
    } else if (stateBefore === AgentPhase.REPAIR) {
      nextEvent = hasPassedEvidence ? StateEvent.REPAIR_COMPLETE : null;
    }

    if (nextEvent && stateMachine.phase !== AgentPhase.DONE && !stateMachine.isTerminal) {
      try {
        stateMachine.apply(nextEvent, {
          evidenceIds: evidenceCreated.map((e) => e.id),
        });
      } catch {
        if (stateMachine.phase === AgentPhase.REPAIR && hasFailingEvidence) {
          try {
            stateMachine.apply(StateEvent.ESCALATE);
          } catch {
            // Ignore if escalation not possible
          }
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

    // -----------------------------------------------------------------------
    // PHASE 10: TERMINATION DECISION
    // -----------------------------------------------------------------------
    const elapsedMs = clock.now().getTime() - startTimeMs;
    const currentCost = totalCostDollars + modelResponse.estimatedCostDollars;
    const failingEvidenceIds = evidenceCreated.filter((e) => !e.pass).map((e) => e.id);

    const iterationOutcome = hasFailingEvidence || hasFailingTool
      ? IterationOutcome.VERIFICATION_FAILED
      : (hasPassedEvidence ? IterationOutcome.VERIFICATION_PASSED : IterationOutcome.PROGRESS);

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
        stateTrajectory: [rec.stateBefore],
        toolFailureSignature: null,
      },
      evidenceIds: rec.evidenceCreated.map((e) => e.id),
      actionIds: [],
      startedAt: rec.startedAt,
      completedAt: rec.completedAt,
      durationMs: rec.completedAt.getTime() - rec.startedAt.getTime(),
      costDollars: rec.costDollars,
      metadata: {},
    }));

    const filesModified = toolResults
      .map((r) => String(r.metadata['path'] ?? ''))
      .filter((p) => p.length > 0);

    const failingTool = toolResults.find((r) => r.status === ActionResultStatus.FAILURE || r.status === ActionResultStatus.DENIED);
    const toolFailureSignature = failingTool
      ? `${failingTool.metadata['toolName'] ?? 'tool'}:${failingTool.metadata['errorCode'] ?? failingTool.status}`
      : null;

    const currentIterationModel = {
      id: iterationId,
      taskId: task.id,
      sequenceNumber,
      outcome: iterationOutcome,
      fingerprint: {
        filesModified,
        hypothesisId: (actionProposals[0]?.id ? (actionProposals[0].id as unknown as HypothesisId) : null),
        errorSignature: hasFailingEvidence ? 'ERR_VERIFICATION' : null,
        patchSignature: filesModified.length > 0 ? `patch-${filesModified.join(',')}` : null,
        failingTests: failingEvidenceIds,
        phaseAtStart: stateBefore,
        stateTrajectory: [stateBefore],
        toolFailureSignature,
      },
      evidenceIds: evidenceCreated.map((e) => e.id),
      actionIds: actionProposals.map((a) => a.id),
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
      actionProposals,
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

function extractToolName(proposal: ActionProposal): string {
  if (proposal.parameters['toolName']) {
    return String(proposal.parameters['toolName']);
  }
  const match = proposal.description.match(/^Execute tool \[([^\]]+)\]$/);
  if (match && match[1]) {
    return match[1];
  }
  return proposal.description;
}

async function executeSingleProposalWithPolicy(
  proposal: ActionProposal,
  params: IterationExecutorParams,
  clock: Clock,
  policyDecisions: PolicyDecisionRecord[],
): Promise<ActionResult> {
  const toolName = extractToolName(proposal);
  const toolCallId = String(proposal.parameters['toolCallId'] ?? proposal.id);
  const input = (proposal.parameters['input'] as Record<string, unknown>) ?? proposal.parameters;
  const tool = params.toolExecutor?.getTool(toolName);

  if (!tool) {
    const errorPayload = JSON.stringify({
      success: false,
      errorCode: 'UNKNOWN_TOOL',
      message: `Tool [${toolName}] is not registered in ToolRegistry`,
    });
    return {
      actionId: proposal.id,
      status: ActionResultStatus.FAILURE,
      output: '',
      durationMs: 0,
      error: errorPayload,
      executedAt: clock.now(),
      metadata: { toolCallId, toolName, errorCode: 'UNKNOWN_TOOL', outcome: 'UNKNOWN_TOOL' },
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
    policyDecisions.push({
      proposalId: proposal.id,
      toolName: tool.definition.name,
      decision: evaluation.decision,
      ruleId: evaluation.ruleId,
      reason: evaluation.reason,
    });

    if (evaluation.decision === PolicyDecisionType.DENY) {
      const errorPayload = JSON.stringify({
        success: false,
        errorCode: 'POLICY_DENIED',
        message: `Execution denied by policy rule [${evaluation.ruleId ?? 'default'}]: ${evaluation.reason}`,
      });
      return {
        actionId: proposal.id,
        status: ActionResultStatus.DENIED,
        output: '',
        durationMs: 0,
        error: errorPayload,
        executedAt: clock.now(),
        metadata: { toolCallId, toolName, ruleId: evaluation.ruleId, errorCode: 'POLICY_DENIED', outcome: 'POLICY_DENIED' },
      };
    }
  }

  try {
    const result = await params.toolExecutor!.execute({
      tool,
      input,
      requiresPolicy: false,
    });

    const outputContent = result.success
      ? result.output
      : JSON.stringify({
          success: false,
          errorCode: (result.metadata?.['errorCode'] as string) ?? 'TOOL_EXECUTION_FAILED',
          message: result.error ?? 'Tool execution failed',
        });

    return {
      actionId: proposal.id,
      status: result.success ? ActionResultStatus.SUCCESS : ActionResultStatus.FAILURE,
      output: outputContent,
      durationMs: result.durationMs,
      error: result.error,
      executedAt: clock.now(),
      metadata: { toolCallId, toolName, ...(result.metadata ?? {}) },
    };
  } catch (err) {
    const errorPayload = JSON.stringify({
      success: false,
      errorCode: 'TOOL_EXECUTION_FAILED',
      message: err instanceof Error ? err.message : String(err),
    });
    return {
      actionId: proposal.id,
      status: ActionResultStatus.FAILURE,
      output: '',
      durationMs: 0,
      error: errorPayload,
      executedAt: clock.now(),
      metadata: { toolCallId, toolName, errorCode: 'TOOL_EXECUTION_FAILED' },
    };
  }
}
