# ADR-007: 10 Explicit, Sequenced Iteration Phases

**Status:** Accepted  
**Date:** 2026-08-05  
**Decision Makers:** Architecture team

## Context

The initial `IterationExecutor` design executed one tool call per iteration: the model was called, one tool was parsed and executed, and the loop advanced. This created two problems:

1. **Multiple tool calls required multiple iterations.** A read-file followed by a write-file required two full iterations, doubling the overhead.
2. **Phases were implicit.** The code mixed observation, context compilation, model invocation, tool execution, and verification into a single function without explicit boundaries.

## Decision

**Refactor `IterationExecutor` into 10 explicit, sequenced phases.** Each phase has documented inputs, outputs, and invariants. Phases cannot be reordered, skipped (except where noted), or merged.

The 10 phases are:
1. Observation
2. Context Compilation
3. Model Decision
4. Action Proposals
5. Policy Decisions
6. Tool Executions
7. Verification Results
8. Evidence Recording
9. State Transition
10. Termination Decision

## Rationale

1. **Multiple tool calls per iteration.** The model may propose 0, 1, or N tool calls in Phase 4. All are evaluated in Phase 5 and executed in Phase 6 within the same iteration. This aligns the iteration unit with a "turn" in the model's view of the conversation.

2. **Explicit phase boundaries make invariants enforceable.** Each phase receives specific typed inputs and produces typed outputs. This makes it straightforward to add logging, metrics, or security checks at phase boundaries.

3. **Phase 10 is separate from the loop condition.** The termination decision is computed once per iteration from structured evidence, not from an ad-hoc condition check. This keeps stop logic centralized and testable.

4. **Read and write tools can execute concurrently within Phase 6.** By making tool execution an explicit phase with a known category for each proposed tool, the implementation can safely parallelize `READ` tools and serialize `WRITE` tools.

## Phase Sequencing Invariants

- Phases 1–10 execute in order within every iteration.
- Phase 6 (Tool Executions) may produce zero executions if no proposals pass Phase 5.
- Phase 7 (Verification) may be skipped if the current state does not warrant it.
- Phase 10 always executes and always produces a `TerminationDecision`.

## Consequences

- `IterationPhases` captures the full output of each phase for audit and debugging.
- `IterationRecord` includes `phases?: IterationPhases` for complete per-iteration observability.
- Tests can assert on per-phase outputs, not just final `ExecutionResult` values.
- Phase 9 state transition derivation is currently heuristic-based (if-chains). Future work should formalize this as a pure transition table lookup.

## Alternatives Considered

| Option | Why Rejected |
|---|---|
| Single-phase monolithic loop | Untestable; phases mixed; invariants not enforceable |
| Two-phase (think/act) | Does not support multi-tool calls; verification still implicit |
| Event-driven phases | More flexible but significantly more complex; harder to reason about ordering |
