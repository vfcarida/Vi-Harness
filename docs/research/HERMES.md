# Research: Hermes (Persistent Agent Memory)

> **Relation to Vi-Harness:** Conceptual foundation for tiered memory categorization and selective retrieval over transcript accumulation.

## What Hermes Is

Hermes represents the class of autonomous agent architectures focused on **persistent, structured memory systems**. Rather than treating agent state as an ephemeral conversation buffer, Hermes designs separate memory stores for different classes of knowledge (working memory, episodic history, and semantic long-term knowledge).

Key premises of the Hermes paradigm:
1. Long-horizon tasks require structured memory beyond token window constraints.
2. Different classes of information decay at different rates and have different retrieval patterns.
3. Information must be retrieved selectively based on relevance, rather than dumped into the context window wholesale.

---

## Memory Categorization & Access Patterns

Hermes structures knowledge by volatility and temporal scope:

```
┌─────────────────────────────────────────────────────────────┐
│ Working Memory (Current Task State & Scratchpad)            │
│ Volatility: High (mutates per sub-task or phase)            │
├─────────────────────────────────────────────────────────────┤
│ Episodic Memory (Past Attempts, Actions & Trajectories)     │
│ Volatility: Medium (accumulates per run/task)               │
├─────────────────────────────────────────────────────────────┤
│ Semantic / Procedural Memory (Facts, Conventions, Skills)   │
│ Volatility: Low (persists across runs and repositories)     │
└─────────────────────────────────────────────────────────────┘
```

---

## What Vi-Harness Takes from Hermes

1. **Four-Tier Context and Memory Model:**
   Vi-Harness adopts the hierarchical memory concept and formalizes it into explicit tiers (`L0_HOT`, `L1_WORKING`, `L2_EPISODIC`, `L3_REPOSITORY` in context; `SHORT_TERM`, `EPISODIC`, `SEMANTIC`, `PROCEDURAL` in memory).

2. **Explicit Memory Lifecycle:**
   Vi-Harness implements an auditable lifecycle for memory records:
   `CANDIDATE` → `ACTIVE` → `STALE` → `INVALIDATED` → `ARCHIVED`, with `PROMOTED` transitions when episodic insights generalize to semantic patterns.

3. **Conflict Detection & Contradiction Resolution:**
   When newly observed facts contradict prior memories, Vi-Harness explicitly detects `MemoryConflict` and resolves it (invalidating stale records rather than silently storing conflicting claims).

---

## What Vi-Harness Does Differently

| Architectural Dimension | Hermes Baseline | Vi-Harness Design |
|---|---|---|
| **Context Assembly** | Dynamic RAG / Vector search injection into prompt | Formal 6-stage Context Compiler (`Retrieval` → `Deduplication` → `Ranking` → `Compression` → `Validation` → `Assembly`) |
| **Invariant Pinning** | Soft relevance ranking (high-score retrieval) | Hard Invariant Pinning (`USER_INSTRUCTION`, `SECURITY_RULE`, `ARCHITECTURE_FACT`, `REGRESSION` evidence can never be auto-evicted) |
| **Context Representation** | Text fragments / chunked documents | Strongly-typed `ContextObject` graph with typed edges (`DEPENDS_ON`, `CONTRADICTS`, `VALIDATES`, `INVALIDATES`) |
| **Token Budgeting** | Threshold truncation or top-K cutoffs | Dynamic token budgeting with soft/hard limits and token-cost penalties during ranking |
| **Isolation & Redaction** | Raw memory injection | Context and Memory Sanitization (`ContextSanitizer` injection stripping, `SecretScrubber` credential redaction) |

---

## Implementation Reference in Vi-Harness

- **Domain Model:**
  - `src/core/model/context.ts` (`ContextTier`, `ContextEntry`, `CompiledContext`)
  - `src/core/model/context-object.ts` (`ContextObject`, `ContextRelation`, `ContextObjectType`, `ContextScope`)
  - `src/core/model/memory-types.ts` (`MemoryTier`, `MemoryStatus`, `MemoryRecord`, `MemoryConflict`)
- **Interfaces:**
  - `src/core/interfaces/context-store.ts` (`ContextStore`)
  - `src/core/interfaces/memory-store.ts` (`MemoryStore`, `MemoryProvider`)
  - `src/core/interfaces/context-compiler.ts` (`ContextCompiler`)
- **Infrastructure:**
  - `src/infra/compiler/default-context-compiler.ts`
  - `src/infra/memory/in-memory-memory-store.ts`

---

## Open Research Questions

1. **Automated Memory Promotion:** What empirical metrics (access frequency, verification pass rate, cross-task recurrence) provide the optimal trigger for promoting episodic debugging traces to permanent semantic rules?
2. **Context Compilation Latency vs. LLM Cost:** Does the computational latency of graph traversal and scoring in the Context Compiler remain negligible relative to LLM latency over 100+ iteration horizons?
3. **Contradiction Resolution in Multi-Agent Scenarios:** When multiple subagents produce contradictory episodic memories, what voting or arbitration policies prevent knowledge degradation?
