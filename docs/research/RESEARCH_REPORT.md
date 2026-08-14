# Vi-Harness: Deep Research & Literature Review

## 1. Executive Summary

This report documents the theoretical, empirical, and architectural research informing the design of **Vi-Harness**. We examine the shift from prompt-based conversational agents to autonomous state machines operating over structured context hierarchies.

---

## 2. Deep Analysis of the 6 Reference Pillars

### 2.1. Meta-Harness: Outer-Loop Harness Engineering (Stanford IRIS Lab, arXiv:2603.28052)
- **Core Thesis**: Rather than treating prompt templates and tool orchestration as fixed artifacts, the agent harness itself should be automatically optimized through causal analysis of execution traces.
- **Key Empirical Finding**: Meta-Harness achieves a **4x token reduction** while improving task accuracy on TerminalBench-2 from 32.4% to 57.6% by removing conversational bloat and focusing context on diagnostic delta states.
- **Vi-Harness Adoption**:
  - `MetaHarnessTraceLogger`: Structured JSONL telemetry capturing causal steps, tool proposals, executions, and policy decisions.
  - `TraceDistiller` & `HarnessDiagnosticEngine`: Outer-loop automated analysis diagnosing cache misses, tool failure hotspots, and policy friction.

### 2.2. Claude Code: Operating System for AI Coding Agents (Anthropic, arXiv:2604.14228)
- **Core Thesis**: Coding agents require an operating system layer that guarantees non-bypassable security permissions, deterministic tool sandboxing, and progressive context compaction.
- **4-Stage Compaction Model**:
  1. `Snip`: Truncates redundant tool outputs (e.g. 5,000-line build logs) down to error heads and tails.
  2. `Micro-compact`: Strips formatting whitespace and stale intermediate reasoning tokens.
  3. `Collapse`: Folds completed sub-trajectories into single-line milestone records.
  4. `Auto-compact`: Engages when context exceeds 75% capacity, preserving critical domain invariants (`mustPreserve = true`).
- **Vi-Harness Adoption**:
  - `ContextCompressor` and `ContextBudgetBalancer` implementing the exact 4-stage pipeline with invariant preservation.

### 2.3. Pi: Minimalism & Clean Provider Abstraction (pi.dev)
- **Core Thesis**: The agent harness should remain minimal, transparent, and model-agnostic, providing session trees and strict provider adapters without vendor lock-in.
- **Vi-Harness Adoption**:
  - `ViHarnessAdapterRunner` and `PiHarnessAdapterRunner` providing side-by-side A/B comparative benchmarking under identical seeds and prompts.

### 2.4. Hermes: Durable Memory Decoupled from History (hermes-agent.org)
- **Core Thesis**: Long-horizon problem solving fails when memory is stored as conversation history. Memory must be a first-class, typed domain entity with its own retrieval, decay, and contradiction resolution lifecycle.
- **Vi-Harness Adoption**:
  - `InMemoryMemoryStore`, `MemoryRetriever`, `MemoryLifecycle`, and `ContradictoryEvidenceResolver`.

### 2.5. Prime Agent: Recursive Language Models & ROI Subagents (Prime Intellect)
- **Core Thesis**: Complex exploration tasks should be delegated to isolated subagents with explicit tool allowances, token budgets, and structured return contracts (artifacts and evidence, never raw transcripts).
- **Vi-Harness Adoption**:
  - `DefaultSubagentManager` enforcing maximum depth constraints (`MAX_SUBAGENT_DEPTH = 3`) and returning `SubagentArtifact` and `Evidence` objects without polluting parent context.

### 2.6. Aider: Syntax-Aware Repo-Map & AST Indexing
- **Core Thesis**: Feeding entire source files into LLM context is wasteful and causes attention degradation. A compressed graph of symbol definitions (classes, methods, signatures) enables the LLM to navigate large codebases efficiently.
- **Vi-Harness Adoption**:
  - `SourceCodeIndexer` generating compact repository maps and selective token ranking in `DefaultContextCompiler`.
