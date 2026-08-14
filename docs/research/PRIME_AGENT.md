# Research: Prime Agent (Structured Action Loops)

> **Relation to Vi-Harness:** Direct architectural precursor for decomposing agent cognition into discrete, enforceable execution phases rather than monolithic generation turns.

## What Prime Agent Is

Prime Agent represents agent architectures centered on **formal control loops**. Rather than treating agent decision-making as freeform conversational interaction ("chatting with tools"), Prime Agent frames the agent as an iterative state machine that observes the environment, plans, proposes actions, executes them through tools, and reflects on outcomes.

Key principles of the Prime Agent model:
1. **Decomposed Cognition:** Observation, reasoning, planning, and execution must not be conflated into a single unstructured generation step.
2. **Explicit Action Proposals:** The agent emits structured action proposals that can be inspected and validated before execution.
3. **Structured Reflection:** Environmental feedback is incorporated through structured reflection rather than unstructured dialog history.

---

## The Prime Agent Loop

The conceptual model of structured agency:

```
┌─────────────────────────────────────────────────────────────┐
│                      1. OBSERVE                             │
│       Collect environment state, history, and goals         │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      2. REASON / PLAN                       │
│      Formulate hypothesis, select strategy, draft plan      │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      3. PROPOSE ACTION                      │
│        Emit explicit tool invocations with arguments        │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                         4. ACT                              │
│       Execute tools in environment and capture output       │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                        5. REFLECT                           │
│        Assess success/failure and update mental state       │
└─────────────────────────────────────────────────────────────┘
```

---

## What Vi-Harness Takes from Prime Agent

1. **Phase-Driven Iteration Loop:**
   Vi-Harness adopts the decomposed loop philosophy and expands it from a 5-step conversational abstraction into **10 explicit, enforceable engineering phases** in `IterationExecutor`.

2. **The "Model Proposes; Runtime Decides" Principle:**
   The model does not execute actions directly; it emits `ActionProposal` objects. Authorization, safety checks, and dispatch are strictly owned by the runtime.

3. **Multi-Action Turns:**
   Like Prime Agent, Vi-Harness does not constrain an iteration to a single tool call. The model can propose multiple tool calls (e.g., inspecting multiple files in parallel), and the runtime executes safe actions concurrently.

---

## What Vi-Harness Does Differently

| Feature | Prime Agent Paradigm | Vi-Harness Implementation |
|---|---|---|
| **Phase Enforcement** | Soft prompts / conversational formatting | Hard architectural phases in code with typed input/output boundaries |
| **Security & Policy** | In-prompt safety rules | Out-of-process Deny-First `PolicyEngine` with replay defense and secret scrubbing |
| **Verification** | Model self-reflection ("Did this work?") | Empirical `VerificationEngine` (test suites, typecheck, lint, exit codes) |
| **State Machine** | Implicit / conceptual state | Pure domain `StateMachine` with 14 canonical phases and immutable `StateTransition` history |
| **Termination** | Model decides when to stop | External `TerminationController` evaluating 14 objective stop conditions (oscillation, budget, regression) |
| **Context Management** | Conversation history accumulation | 6-stage Context Compiler producing token-bounded compiled context |

---

## Implementation Reference in Vi-Harness

- **Runtime & Loop Execution:**
  - `src/runtime/iteration-executor.ts` (10-phase execution pipeline)
  - `src/runtime/action-planner.ts` (Action proposal parsing and spoofing key stripping)
  - `src/runtime/termination-controller.ts` (External stop conditions & loop fingerprinting)
- **Domain Models & State:**
  - `src/core/model/state.ts` (`AgentPhase`, `StateEvent`, `AgentState`, `StateTransition`)
  - `src/core/model/action.ts` (`ActionProposal`, `ActionResult`, `ActionType`)
  - `src/core/state-machine/state-machine.ts` (Deterministic state machine)

---

## Open Research Questions

1. **Phase Skipping Optimization:** Under what conditions can read-only iterations safely bypass the `VERIFY` phase without compromising evidence fidelity?
2. **Dynamic Turn Depth:** How does varying the maximum number of tool proposals per turn affect convergence speed versus policy evaluation overhead?
3. **Multi-Agent State Synchronization:** In hierarchical workflows, how should child agent state transitions propagate to parent state machines without loss of granularity?
