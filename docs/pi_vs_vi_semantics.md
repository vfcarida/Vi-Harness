# Semantic Differences: Pi Harness vs Vi-Harness

When evaluating coding-agent performance in benchmarks, substituting **Pi Harness** with **Vi-Harness** isolates the harness as the primary independent variable. While both harnesses interact with standard LLMs and coding environments, they implement fundamentally different architectural paradigms.

This document details all semantic and behavioral differences between Pi Harness and Vi-Harness across 6 core architectural dimensions.

---

## 1. Execution Control: Stateful Conversation vs Deterministic State Machine

| Dimension | Pi Harness | Vi-Harness |
| :--- | :--- | :--- |
| **Control Model** | Linear conversation transcript accumulation | Pure deterministic state machine (`AgentPhase` state machine) |
| **Iteration Phases** | Prompt model $\rightarrow$ Parse tool output $\rightarrow$ Append to chat history | `OBSERVE` $\rightarrow$ `CONTEXT` $\rightarrow$ `MODEL` $\rightarrow$ `PROPOSE` $\rightarrow$ `POLICY` $\rightarrow$ `ACT` $\rightarrow$ `VERIFY` $\rightarrow$ `EVIDENCE` $\rightarrow$ `STATE` $\rightarrow$ `TERMINATE` |
| **Phase Enforcement** | Soft prompts requesting "Reasoning" then "Action" | Hard state transitions (`INIT` $\rightarrow$ `EXPLORE` $\rightarrow$ `PLAN` $\rightarrow$ `IMPLEMENT` $\rightarrow$ `VERIFY` $\rightarrow$ `DONE` / `REPAIR`) |
| **State Trajectory** | Derived implicitly from conversation messages | Explicit, durable `stateBefore`, `stateAfter`, and trajectory fingerprints |

### Impact on Benchmark Evaluation
- In **Pi**, the agent can get trapped in unstructured loops or stall by outputting conversational prose without changing phase.
- In **Vi**, progress is measured by verified state machine transitions. Unverified steps trigger automatic repair or escalation.

---

## 2. Context Management: Transcript Accumulation vs Sublinear Context Compilation

| Dimension | Pi Harness | Vi-Harness |
| :--- | :--- | :--- |
| **Context Strategy** | Appends system prompt, user prompt, and all raw tool outputs to message list | Compiles context dynamically per iteration based on task, current state, and token budget |
| **Growth Rate** | $O(N)$ linear token growth per iteration | $O(\log N)$ or sublinear token growth via deduplication, dynamic ranking, and compression |
| **Redundancy** | Duplicate file view outputs remain in context indefinitely | Automatic duplicate removal, stale observation pruning, and mandatory object preservation |
| **Context Metrics** | Reports raw message character length | Reports `inputObjectCount`, `selectedObjects`, `omittedObjects`, compression ratio, and token counts |

### Impact on Benchmark Evaluation
- In **Pi**, long debugging tasks quickly hit model context limits, triggering context truncation that drops system instructions or early findings.
- In **Vi**, context compilation dynamically retains mandatory goal constraints and critical failure evidence while compressing redundant tool outputs, maximizing model reasoning budget.

---

## 3. Security & Policy: Prompt Guidance vs Out-of-Process Deny-First Policy Boundary

| Dimension | Pi Harness | Vi-Harness |
| :--- | :--- | :--- |
| **Security Model** | Implicit trust / prompt instructions asking model to avoid destructive commands | Strict out-of-process Deny-First Policy Engine (`ALLOW` / `DENY` / `REQUIRE_APPROVAL`) |
| **Evaluation Scope** | Basic tool authorization checks | Evaluates file path scopes, destructive commands, shell flags, network access, and risk levels |
| **Bypass Prevention** | Vulnerable to prompt injection or model hallucination | Runtime policy engine runs *before* tool execution; model proposals never grant authorization |
| **Error Feedback** | Uncaught shell errors or silent tool failures | Formats explicit structured error responses (`POLICY_DENIED`, rule ID, risk level) back to model |

### Impact on Benchmark Evaluation
- In **Pi**, malicious or hallucinated LLM outputs can mutate unauthorized repository paths or execute arbitrary shell commands.
- In **Vi**, the runtime strictly blocks policy-violating tool calls and returns actionable structured errors, testing the agent's ability to recover safely.

---

## 4. Success Verification: Synthetic Self-Report vs Empirical Process Evidence

| Dimension | Pi Harness | Vi-Harness |
| :--- | :--- | :--- |
| **Completion Criteria** | Model output text (e.g., "I have completed the task successfully") | Empirical verification engine checks (typecheck, unit tests, integration tests, lint, static checks) |
| **Evidence Generation** | None — assumes model self-report is accurate | Produces `VerificationCheck` objects with command, exit code, stdout/stderr artifacts, duration |
| **Missing Verifier Behavior** | Treats missing test suite as implicit success (`PASS`) | Explicitly produces `INCONCLUSIVE` or `UNAVAILABLE` evidence — synthetic `PASS` is prohibited |
| **Regression Prevention** | No baseline comparison | Captures baseline check results and flags regressions if previously passing checks fail |

### Impact on Benchmark Evaluation
- In **Pi**, an LLM can hallucinate success without writing or running tests, causing false-positive benchmark passes.
- In **Vi**, success requires empirical process evidence satisfying an explicit `AcceptancePolicy`.

---

## 5. Termination & Loop Control: Turn Limits vs Multimodal Loop Detection

| Dimension | Pi Harness | Vi-Harness |
| :--- | :--- | :--- |
| **Stop Conditions** | Simple max turn counter or LLM stop token | External multi-criteria `TerminationController` |
| **Loop Fingerprinting** | None — relies on model recognizing its own repetition | Calculates `LoopFingerprint` (hypothesis ID, error signature, patch diff signature, failing test IDs) |
| **Detection Capabilities** | Simple turn limit exhaustion | Detects exact repetition, oscillation, no progress, repeated repair, and budget exhaustion |
| **Termination Reason** | Generic `MAX_TURNS` or `STOP_TOKEN` | Explains explicit root cause (`EXACT_REPETITION`, `OSCILLATION_DETECTED`, `BUDGET_EXCEEDED`, etc.) |

### Impact on Benchmark Evaluation
- In **Pi**, repeating the exact same failing tool call 10 times consumes the full turn budget without actionable diagnostic metrics.
- In **Vi**, loop control halts oscillating execution early, saving API costs and providing granular diagnostic classification for benchmarking.

---

## 6. Workspace & Git Isolation: Direct Overwrites vs Agent Baseline Delta Tracking

| Dimension | Pi Harness | Vi-Harness |
| :--- | :--- | :--- |
| **Workspace Handling** | Mutates repository files directly without baseline isolation | Captures Git baseline before execution |
| **Delta Tracking** | Hard to separate pre-existing user changes from agent changes | Calculates exact agent-owned delta relative to baseline commit |
| **Rollback Safety** | Destructive git checkout / clean | Reverts only agent-owned changes, preserving pre-existing user modifications |
| **Diff Generation** | Computes generic unindexed diff | Generates precise, verified unified diff of agent changes (`finalDiff`) |

### Impact on Benchmark Evaluation
- In **Pi**, benchmark evaluation can be polluted by uncommitted pre-existing changes in the benchmark workspace.
- In **Vi**, baseline capture ensures clean isolation, accurate diff reporting, and crash-safe rollback capabilities.

---

## Benchmark Metric Mapping Matrix

| Benchmark Property | Pi Harness Metric | Vi-Harness `PiBenchmarkResult` Projection |
| :--- | :--- | :--- |
| `success` | LLM self-reported completion | Empirical verification pass rate $\ge$ threshold AND valid termination state (`DONE`) |
| `finalState` | `completed` / `max_turns` | Exact Vi state machine phase (`DONE`, `FAILED`, `REPAIR`, `BLOCKED`, `BUDGET_EXCEEDED`) |
| `changedFiles` | List of written files | Precise agent-owned file delta from `GitManager` |
| `finalDiff` | Unstructured diff | Verified unified git patch relative to baseline |
| `tests` | Model self-reported test count | Measured verification check executions (`total`, `passed`, `failed`, `passRate`) |
| `iterations` | Turn count | `result.iterationCount` |
| `modelCalls` | Turn count | Total LLM completion requests executed across all iterations |
| `tokens` | Accumulated conversation tokens | Summed prompt & completion token consumption across all iterations |
| `estimatedCost` | Simple token rate estimation | Exact cost tracked by `CostTracker` across providers and models |
| `duration` | Total wall-clock time | Measured runtime execution time in milliseconds |
| `terminationReason` | `turn_limit` / `stop` | Explicit `TerminationReason` (`COMPLETED`, `EXACT_REPETITION`, `BUDGET_EXCEEDED`, etc.) |
