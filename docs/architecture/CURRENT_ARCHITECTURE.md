# Vi-Harness: Current Architecture Specification

## 1. Architectural Philosophy

Vi-Harness is built on the foundational thesis:
> **"The agent is not a persistent conversation. The agent is a stateful, evidence-driven state machine."**

Conversations degrade with horizon length due to context window saturation, attention dilution, and the "lost-in-the-middle" effect. Vi-Harness replaces unbounded conversational transcripts with an evidence-driven finite state machine operating over four distinct context tiers.

---

## 2. High-Level System Architecture

```mermaid
flowchart TD
    subgraph UI_CLI [User & CLI Interface]
        CLI[Benchmark & Agent CLI]
        Adapter[Pi Compatibility Adapter]
    end

    subgraph Runtime [Agent Runtime Layer]
        RuntimeEngine[DefaultAgentRuntime]
        LoopExecutor[IterationExecutor]
        Fingerprinter[LoopFingerprinter]
        Planner[ActionPlanner]
        Terminator[TerminationController]
    end

    subgraph Domain [Core Domain Layer - Zero External Dependencies]
        StateMachine[Agent State Machine\n14 Canonical Phases]
        DomainModels[Action, Context, Evidence, Memory, State]
        ErrorTaxonomy[Domain & Infra Error Hierarchy]
    end

    subgraph Infra [Infrastructure Services]
        Compiler[PrefixCaching & 4-Stage Compressor]
        Router[Utility Model Router\nArchitect vs Editor]
        Policy[Unbypassable Policy Engine\nLocal Sandbox & Risk Classifier]
        Tools[Parallel & Builtin Tool Executor]
        Verifier[Verification Engine & Impacted Selector]
        Memory[RAG Memory & Lifecycle Store]
        Telemetry[Meta-Harness Trace Logger & Distiller]
        Git[Git Checkpoint & Rollback Manager]
    end

    UI_CLI --> RuntimeEngine
    RuntimeEngine --> LoopExecutor
    LoopExecutor --> StateMachine
    LoopExecutor --> Compiler
    LoopExecutor --> Router
    LoopExecutor --> Policy
    LoopExecutor --> Tools
    LoopExecutor --> Verifier
    LoopExecutor --> Fingerprinter
    LoopExecutor --> Telemetry
    LoopExecutor --> Git
```

---

## 3. The 14 Canonical Agent Phases

```mermaid
stateDiagram-v2
    [*] --> INIT: Goal Accepted
    INIT --> EXPLORE: Discover Problem Space
    EXPLORE --> PLAN: Formulate Hypothesis
    PLAN --> IMPLEMENT: Propose Tool Actions
    IMPLEMENT --> VERIFY: Execute Impacted Tests
    VERIFY --> REPAIR: Tests Failed
    REPAIR --> IMPLEMENT: Apply Fix
    VERIFY --> DONE: All Acceptance Checks Pass
    
    EXPLORE --> BLOCKED: External Dependency Missing
    PLAN --> BLOCKED: Unresolvable Resource
    IMPLEMENT --> HUMAN_REQUIRED: Irreversible / Security Trigger
    
    IMPLEMENT --> OSCILLATION_DETECTED: Loop Trap Detected
    REPAIR --> OSCILLATION_DETECTED: Stagnant Failure Loop
    
    VERIFY --> REGRESSION_DETECTED: Prior Passing Tests Broke
    IMPLEMENT --> BUDGET_EXCEEDED: Token/Cost Exceeded
    
    DONE --> [*]
    OSCILLATION_DETECTED --> [*]
    REGRESSION_DETECTED --> [*]
    BUDGET_EXCEEDED --> [*]
    CANCELLED --> [*]
    FAILED --> [*]
```

---

## 4. The Four-Tier Context Model (L0 - L3)

| Tier | Name | Persistence | Typical Token Budget | Contents |
| :--- | :--- | :--- | :--- | :--- |
| **L0** | **Hot State** | Current Turn | 35-45% | Active goal, modified file buffers, immediate error stack traces, compiler output. |
| **L1** | **Working Memory** | Active Task | 20-30% | Execution plan checklist, current working hypothesis, recent decision records. |
| **L2** | **Episodic History** | Session | 10-15% | Condensed prior attempts, failed tool invocations, summarized branch outcomes. |
| **L3** | **Repository Knowledge** | Permanent | 20-40% | Coding standards, architectural rules, AST Repo-Map symbol graph. |

---

## 5. End-to-End Execution Sequence

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Runtime as AgentRuntime
    participant Compiler as PrefixCachingCompiler
    participant Router as ModelRouter
    participant Model as LLM Provider
    participant Policy as PolicyEngine
    participant Tool as ToolExecutor
    participant Verifier as VerificationEngine
    participant Telemetry as MetaHarnessTraceLogger
    participant Git as GitCheckpointManager

    User->>Runtime: submitGoal(goal)
    Runtime->>Git: captureBaseline()
    
    loop Each Iteration until Terminal Phase
        Runtime->>Compiler: compile(state, budget)
        Compiler-->>Runtime: segregatedContext { static, dynamic }
        Runtime->>Router: selectModel(phase, budget)
        Router-->>Runtime: modelSpec (Architect / Editor)
        Runtime->>Model: generateResponse(messages)
        Model-->>Runtime: actionProposals
        
        loop Each Proposed Action
            Runtime->>Policy: evaluate(actionProposal)
            alt Policy ALLOW
                Runtime->>Tool: execute(action)
                Tool-->>Runtime: actionResult
            else Policy REQUIRE_APPROVAL
                Runtime->>Runtime: transitionTo(HUMAN_REQUIRED)
            else Policy DENY
                Runtime->>Runtime: recordPolicyDenial(evidence)
            end
        end
        
        Runtime->>Verifier: verifyImpacted(modifiedFiles)
        Verifier-->>Runtime: verificationEvidence (PASS / FAIL / INCONCLUSIVE)
        Runtime->>Telemetry: recordIteration(traceRecord)
        Runtime->>Git: createCheckpoint(iterationId)
        Runtime->>Runtime: evaluateTransitions(state, evidence)
    end
    
    Runtime-->>User: executionResult (DONE / FAILED)
```
