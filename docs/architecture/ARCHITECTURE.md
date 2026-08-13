# Vi-Harness Architecture

> "The agent is not a persistent conversation. The agent is a stateful, evidence-driven state machine."

## System Overview

Vi-Harness is an enterprise-grade, model-agnostic coding-agent harness. It provides the runtime infrastructure for executing coding tasks through an evidence-driven agent loop, without coupling to any specific LLM provider.

## Core Architectural Thesis

The system is designed around 10 principles:

1. **Model-agnostic by contract, not by adapter** — vendor-neutral interfaces, not wrapper layers
2. **Conversation is ephemeral; state is durable** — no reliance on chat history for correctness
3. **Context is compiled, not accumulated** — only minimum necessary context per model call
4. **Memory is retrieved, not injected wholesale** — semantic retrieval, not full context dumps
5. **The model proposes; the runtime decides** — policy enforcement on all actions
6. **Tests generate evidence** — verification produces structured, queryable outcomes
7. **Every irreversible action is policy-controlled** — ALLOW / DENY / ESCALATE decisions
8. **Every meaningful milestone is reversible** — checkpoint/restore for rollback
9. **Subagents return artifacts/evidence, not raw transcripts** — structured composition
10. **Stop conditions live outside the LLM** — runtime controls iteration bounds

## Layered Architecture

```
┌─────────────────────────────────────────┐
│              Runtime Layer              │
│         (Agent loop orchestration)      │
├─────────────────────────────────────────┤
│           DI / Wiring Layer             │
│      (Container, modules, tokens)       │
├─────────────────────────────────────────┤
│         Infrastructure Layer            │
│    (Logging, clock, config, ID gen)     │
│   Implements core interfaces (ports)    │
├─────────────────────────────────────────┤
│            Core / Domain Layer          │
│  Types · Errors · Model · Interfaces   │
│       ZERO external dependencies        │
└─────────────────────────────────────────┘
```

**Dependency rule**: All arrows point **inward** toward Core. Core never imports from Infrastructure, DI, or Runtime.

## Four-Tier Context Architecture

| Tier | Name | Contents | Volatility |
|---|---|---|---|
| L0 | Hot Context | Current task, files, hypothesis, failure | Per iteration |
| L1 | Working Memory | Plan, decisions, recent evidence | Per phase |
| L2 | Episodic Memory | Previous attempts, failed approaches | Per task |
| L3 | Repository Memory | Architecture, standards, constraints | Rarely |

## Agent Loop (Core Flow)

```
User/CI/IDE → Goal Manager → State Machine → Context Compiler
    → Model Router → Agent Runtime → Policy → Tool Execution
    → Verification → Evidence → State Update → Context Compiler
    → next iteration / DONE / HUMAN_REQUIRED
```

## State Machine

```
IDLE → PLANNING → EXECUTING → VERIFYING
                      ↑            ↓
                      └── FAILED ←─┘
                      
VERIFYING → COMPLETED (on pass)
VERIFYING → EXECUTING (on fail, retry)
    *     → AWAITING_HUMAN (on escalate)
    *     → RECOVERING (on critical failure)
```

## Key Design Decisions

See [ADR index](adr/) for detailed records:
- [ADR-001: TypeScript](adr/001-typescript-choice.md)
- [ADR-002: Dependency Injection](adr/002-dependency-injection.md)
- [ADR-003: Error Model](adr/003-error-model.md)
- [ADR-004: Context Tiers](adr/004-context-tiers.md)
- [ADR-005: Interface-First Design](adr/005-interface-first-design.md)
