# Vi-Harness: Target Architecture Specification

## 1. Target Architecture Overview

The target state of Vi-Harness unites the **evidence-driven state machine** with **outer-loop automated adaptation (Meta-Harness)**, **progressive context compaction (Claude Code)**, and **cryptographic audit trails (Zero-Trust Enterprise)**.

```mermaid
flowchart TB
    subgraph Client [Client & CLI Layer]
        CLI[Benchmark & Execution CLI]
        PiAdapter[Pi-Compatible Harness Adapter]
    end

    subgraph OuterLoop [Outer-Loop Adaptation - Meta-Harness]
        TraceLog[JSONL Causal Trace Logger]
        Distiller[Trace Distiller]
        DiagnosticEngine[Harness Diagnostic Engine]
        ConfigAdapter[Dynamic Config Patch Engine]
        TraceLog --> Distiller --> DiagnosticEngine --> ConfigAdapter
    end

    subgraph InnerLoop [Inner-Loop Agentic State Machine]
        direction TB
        Runtime[DefaultAgentRuntime]
        LoopExec[IterationExecutor]
        Fingerprinter[Deterministic Loop Fingerprinter]
        
        Runtime --> LoopExec
        LoopExec --> Fingerprinter
    end

    subgraph Subsystems [Modular Domain Subsystems]
        ContextSubsystem[Prefix Caching & 4-Stage Compactor]
        RoutingSubsystem[Utility Model Router - Architect/Editor]
        PolicySubsystem[Unbypassable Policy Engine & Local Sandbox]
        ToolSubsystem[Parallel & Builtin Tool Executor]
        VerificationSubsystem[Selective Impacted Test Selector]
        MemorySubsystem[Decoupled Durable RAG Memory Store]
        GitSubsystem[Non-Destructive Git Checkpoint Manager]
        SecuritySubsystem[HMAC SHA-256 Signer & Shannon Entropy Scrubber]
    end

    Client --> Runtime
    LoopExec --> ContextSubsystem
    LoopExec --> RoutingSubsystem
    LoopExec --> PolicySubsystem
    LoopExec --> ToolSubsystem
    LoopExec --> VerificationSubsystem
    LoopExec --> MemorySubsystem
    LoopExec --> GitSubsystem
    LoopExec --> SecuritySubsystem
    LoopExec --> TraceLog
    ConfigAdapter -.-> LoopExec
```

---

## 2. Key Architecture Invariants

1. **The Model Proposes, The Runtime Decides**:
   The LLM never directly executes commands, transitions state, or creates Git commits. All proposals pass through deterministic verification and policy evaluation.
2. **Sublinear Context Invariant**:
   Context size across long horizons ($N \ge 100$ iterations) is bounded by $O(\log N)$ or constant bounds, preventing linear token explosion and cost runaway.
3. **Evidence-Driven DONE Gate**:
   A task may transition to `AgentPhase.DONE` if and only if empirical verification evidence (test pass, typecheck pass, lint pass) exists and has been validated by `AcceptanceEvaluator`.
4. **Zero-Loss User Rollback**:
   Agent rollbacks revert only agent-owned file modifications, preserving any uncommitted user work present prior to agent invocation.
5. **Cryptographic Tamper-Proof Audit**:
   Every state checkpoint, journal entry, and execution trace is signed with HMAC SHA-256 to ensure enterprise compliance and forensic auditability.
