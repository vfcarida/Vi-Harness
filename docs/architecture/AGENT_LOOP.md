# Agent Loop — AGENT_LOOP.md

> "The model proposes; the runtime decides."

## Intent

The agent loop is the core execution contract of Vi-Harness. Its purpose is to transform a `Goal` into an `ExecutionResult` through a sequence of deterministic, auditable iterations — each iteration being a complete observe → act → verify cycle.

The loop is intentionally **not** a conversation. It does not accumulate messages. It does not pass state through a growing transcript. Each iteration begins with a fresh, compiled context window constructed from structured objects.

---

## Interfaces

### `AgentRuntime` (`src/core/interfaces/agent-runtime.ts`)

**Responsibility:** Top-level orchestration. Accepts a `Goal`, manages execution lifecycle (pause, resume, abort), and emits structured events.

**Input:** `Goal` + optional `ExecutionOptions`.

**Output:** `ExecutionResult`.

**Methods:**
```typescript
execute(goal: Goal, options?: ExecutionOptions): Promise<ExecutionResult>
pause(executionId: ExecutionId): Promise<void>
resume(executionId: ExecutionId, options?: ExecutionOptions): Promise<ExecutionResult>
abort(executionId: ExecutionId): Promise<void>
subscribe(observer: AgentObserver): () => void
```

**Lifecycle:**
```
construct → execute() → [RUNNING → PAUSED → RUNNING] → COMPLETED | FAILED | CANCELLED
```

**Invariants:**
- A single `DefaultAgentRuntime` instance may manage multiple concurrent executions (each keyed by `ExecutionId`).
- `pause()` and `resume()` are defined on the interface but the current `DefaultAgentRuntime` implementation has partial support — resume from a prior checkpoint is the intended path.
- `abort()` sets an internal `AbortController` signal and causes the iteration loop to terminate at the next safe checkpoint.

**Failure modes:**
- Unrecoverable internal error → `FAILED` with `TerminationReason.UNRECOVERABLE_ERROR`.
- Budget or iteration limit → `BUDGET_EXCEEDED` with appropriate `TerminationReason`.
- External `abort()` call → `CANCELLED` with `TerminationReason.CANCELLED`.

**Implementation:** `src/runtime/default-agent-runtime.ts`

---

### `IterationExecutor` (`src/runtime/iteration-executor.ts`)

**Responsibility:** Execute a single pass through the 10-phase agent cycle. Returns an `IterationRecord` — an immutable, auditable snapshot of everything that happened in that iteration.

**Input:** `IterationExecutorParams` (goal, task, state machine, all service dependencies, prior iterations, elapsed time, cost).

**Output:** `IterationRecord`.

---

## The 10 Phases

### Phase 1 — Observation

**What happens:** Reads the current `AgentState` from the `StateMachine`. Collects prior tool results (from the previous iteration's `IterationRecord`) and prior verification evidence (from `EvidenceStore`).

**Invariants:**
- The observation is a read-only snapshot. The phase does not mutate any store.
- Prior tool results are carried forward as `MessageRole.TOOL` messages in Phase 2.
- Prior verification evidence is carried forward as `MessageRole.SYSTEM` messages tagged `[VERIFICATION_EVIDENCE]`.

**Output fields:** `IterationPhases.observation` — `stateBefore`, `sequenceNumber`, `priorToolResultsCount`, `priorEvidenceCount`.

---

### Phase 2 — Context Compilation

**What happens:** Calls `ContextCompiler.compile(request)` to assemble a token-bounded context window from the `ContextStore`, current goal, active hypothesis, recent evidence, and current agent state.

**Invariants:**
- Context is compiled per-iteration. No context is carried from the previous iteration except through the `ContextStore` and `EvidenceStore`.
- Mandatory objects (`USER_INSTRUCTION`, `SECURITY_RULE`, `ARCHITECTURE_FACT`, approved constraints, regression evidence) are never automatically discarded.
- The compiler emits `CompilationMetrics` (tokens before/after, compression ratio, retained/omitted counts) for every call.

**Output fields:** `IterationPhases.context` — `compiledTokens`, `entriesCount`.

See [`CONTEXT_ENGINEERING.md`](CONTEXT_ENGINEERING.md) for the full compiler specification.

---

### Phase 3 — Model Decision

**What happens:** Calls `ModelRouter.route(request)` to select a provider, then calls `ModelProvider.complete(request)` via `executeResiliently()` (retry + fallback wrapper). Measures latency and token usage.

**Invariants:**
- The model is selected per-iteration. The same model is not guaranteed to be used across iterations.
- Token usage and cost are accumulated and checked against `Goal.constraints.maxCostDollars`.
- `executeResiliently()` handles transient errors (rate limits, timeouts) with configurable retry and fallback.

**Output fields:** `IterationPhases.modelDecision` — `providerId`, `modelId`, `usage`, `latencyMs`.

See [`MODEL_ROUTING.md`](MODEL_ROUTING.md).

---

### Phase 4 — Action Proposals

**What happens:** The `ActionPlanner` parses the model response. The model may propose 0, 1, or N tool calls. Each proposal is a structured `ActionProposal`.

**Invariants:**
- The runtime does not inject a default action if the model proposes zero tool calls.
- Security keys (`userApproved`, `permissionContext`, `securityOverride`) are stripped from all proposals before any further processing. A model cannot grant itself permissions through its own output.
- Each `ActionProposal` carries a unique `proposalId`, the tool name, and the input arguments.

**Output fields:** `IterationPhases.actionProposals` — array of `ActionProposal`.

---

### Phase 5 — Policy Decisions

**What happens:** For each `ActionProposal`, the `PolicyEngine.evaluate(action, context)` is called. Each proposal receives one of: `ALLOW`, `DENY`, `REQUIRE_APPROVAL`, `ALLOW_WITH_RESTRICTIONS`, `ESCALATE`.

**Invariants (Deny-First precedence):**
1. If **any** rule returns `DENY` → overall decision is `DENY`.
2. Else if **any** rule returns `REQUIRE_APPROVAL` or `ESCALATE` → decision is `REQUIRE_APPROVAL`.
3. Else if **any** rule returns `ALLOW_WITH_RESTRICTIONS` → decision is `ALLOW_WITH_RESTRICTIONS`.
4. Otherwise → `ALLOW`.

Denied proposals return a structured `ToolResult` error payload (never a silent failure):
```json
{
  "success": false,
  "errorCode": "POLICY_DENIED",
  "message": "Execution denied by policy rule [credential-protection]: path '.env' is forbidden"
}
```

**Output fields:** `IterationPhases.policyDecisions` — array of `PolicyDecisionRecord`.

See [`SECURITY.md`](SECURITY.md).

---

### Phase 6 — Tool Executions

**What happens:** Executes approved proposals through `ToolExecutor.execute()`.

**Execution ordering:**
- `READ` category tools → executed **in parallel** (safe, no state mutation).
- `WRITE` and `EXECUTE` category tools → executed **serially** (preserves order, prevents races).
- `DESTRUCTIVE` category tools → executed serially and preceded by a checkpoint.

**Invariants:**
- Unregistered tool names receive a structured `UNKNOWN_TOOL` error:
  ```json
  { "success": false, "errorCode": "UNKNOWN_TOOL", "message": "Tool [xyz] is not registered" }
  ```
- All tool inputs pass through prototype pollution guard and null-byte stripping before execution.
- All tool outputs pass through `SecretScrubber` before being stored or returned to the model.

**Output fields:** `IterationPhases.toolExecutions` — array of `ActionResult`.

See [`TOOL_EXECUTION.md`](TOOL_EXECUTION.md).

---

### Phase 7 — Verification

**What happens:** Calls `VerificationEngine.verify()` or `runSuite()` to execute actual verification checks (tests, lint, typecheck, build). Produces a `VerificationResult`.

**Invariants:**
- Verification is performed when the agent's phase indicates it makes sense (e.g., after writes in `IMPLEMENT`).
- A check with a missing command produces `VerificationStatus.INCONCLUSIVE`, **never** `PASSED`.
- A previously-passing check that now fails produces `VerificationStatus.FAILED` with outcome `REGRESSION`.
- The runtime uses five profiles: `FAST`, `STANDARD`, `FULL`, `SECURITY`, `PRE_RELEASE`.

**Output fields:** `IterationPhases.verificationResults` — `performed`, `status`, `summary`.

See [`VERIFICATION.md`](VERIFICATION.md).

---

### Phase 8 — Evidence Recording

**What happens:** Converts `VerificationResult` outputs into structured `Evidence` records and persists them in `EvidenceStore`.

**Evidence outcomes:** `PASS`, `FAIL`, `WARNING`, `INCONCLUSIVE`, `REGRESSION`.

**Invariants:**
- Evidence is immutable once created.
- Every `Evidence` record carries: `taskId`, `type`, `outcome`, `confidence`, `affectedFiles`, and optionally a `rawArtifactRef`.
- Regression evidence is never discarded by the context compiler — it is treated as a mandatory invariant.

**Output fields:** `IterationPhases.evidence` — array of `Evidence`.

---

### Phase 9 — State Transition

**What happens:** The `StateMachine.transition(event)` is called with an event **derived from actual tool results and evidence** — not from the model's text output.

**Derivation rules (current implementation):**
- File read tools only → no state advance; agent remains in `EXPLORE`.
- Write tools executed → `IMPLEMENTATION_COMPLETE` event → transition to `VERIFY`.
- Verification `PASS` → `VERIFICATION_PASSED` → transition to `DONE` (if acceptance policy satisfied).
- Verification `FAIL` → `VERIFICATION_FAILED` → transition to `REPAIR`.
- Evidence `REGRESSION` → `REGRESSION_FOUND` → transition to `REGRESSION_DETECTED` (terminal).

**Invariants:**
- The LLM never writes directly to the state machine.
- All `RUNTIME_ONLY_EVENTS` (budget, oscillation, regression, no-progress, max-repairs) are emitted by the runtime, not parsed from model output.
- Every transition is recorded as an immutable `StateTransition` with `from`, `to`, `event`, `timestamp`, and `evidenceIds`.

**Output fields:** `IterationPhases.stateTransition` — `from`, `to`, `event`.

---

### Phase 10 — Termination Decision

**What happens:** `TerminationController.evaluate(iterations, currentState, budget)` evaluates 14 stop conditions and returns a `TerminationDecision`.

**Stop conditions evaluated:**

| Condition | `TerminationReason` |
|---|---|
| All verification passed, acceptance policy satisfied | `SUCCESS` |
| `maxIterations` reached | `MAX_ITERATIONS` |
| `maxCostDollars` exceeded | `MAX_COST` |
| `maxDurationMs` exceeded | `MAX_DURATION` |
| `maxRepairAttempts` exceeded | `MAX_REPAIRS` |
| Exact same iteration fingerprint seen before | `EXACT_REPETITION` |
| Agent oscillating between two approaches | `OSCILLATION` |
| Phase trajectory forms a repeating N-cycle | `TRAJECTORY_OSCILLATION` |
| Same hypothesis repeated N times | `REPEATED_HYPOTHESIS` |
| No measurable progress for N iterations | `NO_PROGRESS` |
| Same tool failure signature repeated N times | `REPEATED_TOOL_FAILURE` |
| Previously-passing verification now fails | `REGRESSION` |
| Policy violation that cannot be resolved | `POLICY_VIOLATION` |
| Human intervention required | `HUMAN_REQUIRED` |

**Invariants:**
- `terminal: false` → the outer `while` loop continues with the next iteration.
- `terminal: true` → the loop exits and `ExecutionResult` is assembled.
- The LLM receives the termination reason only **after** the runtime has decided — it cannot influence stop conditions.

**Output fields:** `IterationPhases.terminationDecision` — `terminal`, `reason`, `evidence`, `confidence`.

---

## Observable Events

The runtime emits structured `AgentEvent` objects to all subscribed `AgentObserver` instances:

| Event | When |
|---|---|
| `AgentStarted` | Execution begins |
| `IterationStarted` | Phase 1 begins |
| `ModelSelected` | Phase 3 routing complete |
| `ModelCalled` | Phase 3 completion returned |
| `ActionProposed` | Phase 4 proposal parsed |
| `PolicyEvaluated` | Phase 5 decision made |
| `ToolStarted` | Phase 6 tool begins |
| `ToolCompleted` | Phase 6 tool returns |
| `VerificationStarted` | Phase 7 begins |
| `EvidenceCreated` | Phase 8 record persisted |
| `StateUpdated` | Phase 9 transition applied |
| `IterationCompleted` | Phase 10 complete |
| `AgentPaused` | `pause()` called |
| `AgentResumed` | `resume()` called |
| `AgentCompleted` | Terminal phase reached (success) |
| `AgentFailed` | Terminal phase reached (failure) |
| `AgentCancelled` | `abort()` called |

---

## Known Limitations

| Limitation | Impact |
|---|---|
| `pause()` / `resume()` partially implemented | Cannot reliably resume from mid-iteration pauses |
| State transitions are heuristic-derived in Phase 9 | Complex multi-tool iterations may derive suboptimal transitions |
| No distributed iteration support | A single `DefaultAgentRuntime` instance is single-process |
| Observer errors are not isolated | An observer that throws propagates to the runtime |

---

## Future Design

- **Distributed execution**: Fan-out safe read tools across worker threads in Phase 6.
- **Typed state machine events**: Phase 9 event derivation formalized as a pure function with a lookup table, not imperative if-chains.
- **Per-phase timeouts**: Each phase has its own timeout budget, not just a global iteration timeout.
- **Replay support**: Given an `IterationRecord` history, the loop can be replayed deterministically.
