# Vi-Harness — Architecture

> "The agent is not a persistent conversation. The agent is a stateful, evidence-driven state machine."

## Table of Contents

1. [Architectural Thesis](#1-architectural-thesis)
2. [Layer Model](#2-layer-model)
3. [Dependency Rules](#3-dependency-rules)
4. [State Machine](#4-state-machine)
5. [Execution Flow](#5-execution-flow)
6. [Interface Inventory](#6-interface-inventory)
7. [Key Design Decisions](#7-key-design-decisions)
8. [Known Limitations](#8-known-limitations)

---

## 1. Architectural Thesis

Vi-Harness encodes ten principles that distinguish it from conversation-accumulation harnesses:

| # | Principle | Implication |
|---|---|---|
| 1 | **Model-agnostic by contract** | Vendor SDKs never cross the `core/` boundary |
| 2 | **Conversation is ephemeral; state is durable** | Correctness does not depend on chat history |
| 3 | **Context is compiled, not accumulated** | Minimum necessary context per model call |
| 4 | **Memory is retrieved, not injected wholesale** | Semantic retrieval with relevance scoring |
| 5 | **The model proposes; the runtime decides** | Policy engine evaluates all proposals |
| 6 | **Tests generate evidence** | Verification produces structured, queryable `Evidence` records |
| 7 | **Every irreversible action is policy-controlled** | ALLOW / DENY / REQUIRE\_APPROVAL / ESCALATE |
| 8 | **Every meaningful milestone is reversible** | `CheckpointStore` snapshots before destructive steps |
| 9 | **Subagents return artifacts, not transcripts** | Structured composition, not nested conversations |
| 10 | **Stop conditions live outside the LLM** | `TerminationController` evaluates 14 conditions |

---

## 2. Layer Model

```
┌──────────────────────────────────────────────────────────────┐
│  CLI / Eval  (src/cli/, src/infra/eval/)                     │
│  Benchmark runner, harness adapters, context benchmark       │
├──────────────────────────────────────────────────────────────┤
│  Runtime  (src/runtime/)                                     │
│  DefaultAgentRuntime · IterationExecutor (10 phases)        │
│  ActionPlanner · TerminationController · AgentObserverHub   │
├──────────────────────────────────────────────────────────────┤
│  DI  (src/di/)                                               │
│  Container · Tokens · DefaultModule                          │
├──────────────────────────────────────────────────────────────┤
│  Infrastructure  (src/infra/)                                │
│  Model providers · Router · Compiler · Policy engine        │
│  Verification · Git · Memory · Evidence · Checkpoint        │
│  Tools · Security · Telemetry · Persistence · Resilience    │
├──────────────────────────────────────────────────────────────┤
│  Core  (src/core/)                     ZERO external deps   │
│  Types · Errors · Model (37 VOs) · Interfaces (33)         │
│  State machine (6 files)                                     │
└──────────────────────────────────────────────────────────────┘
```

### Module responsibilities

| Module | Path | Status |
|---|---|---|
| Core types | `src/core/types/` | ✅ Implemented |
| Core domain model | `src/core/model/` | ✅ Implemented (37 value objects) |
| Core interfaces | `src/core/interfaces/` | ✅ Implemented (33 contracts) |
| State machine | `src/core/state-machine/` | ✅ Implemented |
| ID factory | `src/infra/id/` | ✅ Implemented (UUIDv7) |
| Logging | `src/infra/logging/` | ✅ Implemented |
| Clock | `src/infra/time/` | ✅ Implemented |
| Config | `src/infra/config/` | ✅ Implemented |
| Model providers | `src/infra/model/` | ✅ OpenAI-compatible + Mock + Scripted |
| Model router | `src/infra/router/` | ✅ Implemented |
| Context compiler | `src/infra/compiler/` | ✅ Implemented (6-stage pipeline) |
| Context store | `src/infra/context/` | ✅ In-memory implementation |
| Memory store | `src/infra/memory/` | ✅ In-memory implementation |
| Evidence store | `src/infra/evidence/` | ✅ Implemented |
| Security / Policy | `src/infra/security/` | ✅ Implemented (5 rules, 16 attack vectors) |
| Verification | `src/infra/verification/` | ✅ Implemented |
| Git manager | `src/infra/git/` | ✅ Implemented |
| Checkpoint store | `src/infra/checkpoint/` | ✅ Implemented |
| Tools | `src/infra/tools/` | ✅ 4 built-in tools |
| Benchmark / Eval | `src/infra/eval/` | ✅ Implemented |
| Runtime | `src/runtime/` | ✅ Implemented |
| DI container | `src/di/` | ✅ Implemented |
| CLI | `src/cli/` | ✅ Implemented |
| Auth | `src/auth/` | 🔬 Stub only |

---

## 3. Dependency Rules

**The single architectural invariant:**

```
Runtime → Infrastructure → Core
                              ↑
              (all imports point inward)
```

- `core/` imports **nothing** outside its own subtree and Node.js built-ins.
- `infra/` imports from `core/` only.
- `runtime/` imports from `infra/` and `core/`.
- `di/` imports from `infra/` and `core/` to wire them together.
- `cli/` and `infra/eval/` import from `runtime/` downward.

Violations are detected by ESLint import rules. See [`DEPENDENCY_RULES.md`](DEPENDENCY_RULES.md).

---

## 4. State Machine

The agent has **14 canonical phases** (`AgentPhase` enum):

```
INIT
  │
  ▼
EXPLORE ──────────────────────► BLOCKED
  │                              │
  ▼                              ▼
PLAN                         HUMAN_REQUIRED
  │
  ▼
IMPLEMENT
  │
  ▼
VERIFY
  │  ├──── PASS ──────────────► DONE ✓
  │  └──── FAIL ──────────────► REPAIR
  │                              │
  │         ◄─── repaired ───────┘
  │
  ├──────────────────────────► REGRESSION_DETECTED ✗
  ├──────────────────────────► OSCILLATION_DETECTED ✗
  ├──────────────────────────► BUDGET_EXCEEDED ✗
  ├──────────────────────────► CANCELLED ✗
  └──────────────────────────► FAILED ✗

✓ = success terminal   ✗ = failure terminal
```

**Terminal phases** (no transitions out): `DONE`, `BUDGET_EXCEEDED`, `REGRESSION_DETECTED`, `OSCILLATION_DETECTED`, `CANCELLED`, `FAILED`.

**Human-resumable phases**: `HUMAN_REQUIRED`, `BLOCKED`.

**Runtime-only events** (LLM can never emit these): `BUDGET_EXHAUSTED`, `REGRESSION_FOUND`, `OSCILLATION_FOUND`, `NO_PROGRESS`, `MAX_REPAIRS_EXCEEDED`, `CANCEL`, `BLOCK`.

Implementation: `src/core/state-machine/state-machine.ts` — pure domain logic, no I/O, no async.

---

## 5. Execution Flow

```
Goal
  │
  ▼
DefaultAgentRuntime.execute(goal)
  │ creates Task, StateMachine, ExecutionId
  │
  ▼
while (not terminal):
  │
  ▼
IterationExecutor.executeIteration()  ← 10 explicit phases
  │
  ├─ ① OBSERVE       — durable state, prior results, prior evidence
  ├─ ② CONTEXT       — compile token-bounded context from ContextStore
  ├─ ③ MODEL         — route → select provider → call → measure
  ├─ ④ PROPOSE       — parse 0..N tool calls from model response
  ├─ ⑤ POLICY        — deny-first evaluation of each proposal
  ├─ ⑥ ACT           — execute: safe reads parallel, writes serial
  ├─ ⑦ VERIFY        — run actual verification checks (no synthetic PASS)
  ├─ ⑧ EVIDENCE      — persist structured Evidence in EvidenceStore
  ├─ ⑨ STATE         — transition derived from actual outcomes + evidence
  └─ ⑩ TERMINATE     — evaluate 14 stop conditions
        │
        ├─ terminal: false → next iteration
        └─ terminal: true  → return ExecutionResult
```

See [`AGENT_LOOP.md`](AGENT_LOOP.md) for the full phase specification.

---

## 6. Interface Inventory

All 33 core interfaces live in `src/core/interfaces/`. Each has exactly one or more implementations in `src/infra/`.

| Interface | Implementation(s) | Document |
|---|---|---|
| `AgentRuntime` | `DefaultAgentRuntime` | [AGENT_LOOP.md](AGENT_LOOP.md) |
| `ModelProvider` | `OpenAICompatibleProvider`, `MockModelProvider`, `ScriptedModelProvider` | [MODEL_ROUTING.md](MODEL_ROUTING.md) |
| `ModelRouter` | `UtilityModelRouter` | [MODEL_ROUTING.md](MODEL_ROUTING.md) |
| `ContextCompiler` | `DefaultContextCompiler` | [CONTEXT_ENGINEERING.md](CONTEXT_ENGINEERING.md) |
| `ContextStore` | `InMemoryContextStore` | [CONTEXT_ENGINEERING.md](CONTEXT_ENGINEERING.md) |
| `MemoryStore` | `InMemoryMemoryStore` | [CONTEXT_ENGINEERING.md](CONTEXT_ENGINEERING.md) |
| `ToolExecutor` | `DefaultToolExecutor` | [TOOL_EXECUTION.md](TOOL_EXECUTION.md) |
| `PolicyEngine` | `DefaultPolicyEngine` | [SECURITY.md](SECURITY.md) |
| `VerificationEngine` | `DefaultVerificationEngine` | [VERIFICATION.md](VERIFICATION.md) |
| `EvidenceStore` | `DefaultEvidenceStore` | [VERIFICATION.md](VERIFICATION.md) |
| `CheckpointStore` | `DefaultCheckpointStore` | [PERSISTENCE.md](PERSISTENCE.md) |
| `GitManager` | `DefaultGitManager`, `RealGitManager` | [PERSISTENCE.md](PERSISTENCE.md) |
| `BenchmarkRunner` | `DefaultBenchmarkRunner` | [BENCHMARKING.md](BENCHMARKING.md) |
| `HarnessAdapter` | `ViHarnessAdapterRunner`, `PiHarnessAdapterRunner` | [BENCHMARKING.md](BENCHMARKING.md) |

---

## 7. Key Design Decisions

| ADR | Decision | Status |
|---|---|---|
| [ADR-001](adr/001-typescript-choice.md) | TypeScript with strict mode | Accepted |
| [ADR-002](adr/002-dependency-injection.md) | Lightweight manual DI — no decorators | Accepted |
| [ADR-003](adr/003-error-model.md) | Structured `HarnessError` with `ErrorCode` | Accepted |
| [ADR-004](adr/004-context-tiers.md) | Four-tier context model (L0–L3) | Accepted |
| [ADR-005](adr/005-interface-first-design.md) | Interface-first, all implementations are replaceable | Accepted |
| [ADR-006](adr/006-security-model.md) | Deny-first policy engine; model output is untrusted | Accepted |
| [ADR-007](adr/007-iteration-phases.md) | 10 explicit, sequenced iteration phases | Accepted |

---

## 8. Known Limitations

| Limitation | Affected Component | Future Design |
|---|---|---|
| All stores are in-memory; no persistence across process restarts | `ContextStore`, `MemoryStore`, `EvidenceStore`, `CheckpointStore` | SQLite / Redis backends planned |
| `ContextStore` imports from `infra/context/` — a dependency inversion violation | `ContextStore` interface | Move `ContextGraph` type to `core/` |
| No kernel-level OS isolation | Security layer | Requires external container / gVisor wrapping |
| `pause()` and `resume()` on `AgentRuntime` are partially implemented | `DefaultAgentRuntime` | Full checkpoint-based resume planned |
| No Anthropic or Google Gemini provider | `ModelProvider` | Planned (see roadmap) |
| Human escalation has no UI | `HUMAN_REQUIRED` phase | Browser/web-socket interface planned |
