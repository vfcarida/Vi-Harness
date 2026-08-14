# Vi-Harness

> **Enterprise-Grade, Model-Agnostic Coding-Agent Runtime & Harness**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node.js-%3E%3D20-green.svg)](https://nodejs.org/)
[![Tests](https://img.shields.io/badge/Tests-596%20Passed-brightgreen.svg)](./tests)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

---

## 1. Central Architectural Axiom

> **"The agent is not a persistent conversation. The agent is a stateful, evidence-driven state machine."**

Traditional coding agents accumulate unbounded conversational transcripts, leading to severe context bloat, token cost runaway, and degraded reasoning over long horizons. **Vi-Harness** replaces conversational transcripts with a 14-phase state machine operating over a 4-tier context hierarchy, governed by strict empirical verification evidence.

---

## 2. The 6 Reference Pillars

Vi-Harness synthesizes architectural advances from the leading research and production harnesses:

1. **Meta-Harness (Stanford IRIS Lab, [arXiv:2603.28052](https://arxiv.org/abs/2603.28052))**: Structured per-iteration causal trace logging (`.vi-traces/`) and outer-loop harness diagnostic distillation.
2. **Claude Code (Anthropic, [arXiv:2604.14228](https://arxiv.org/abs/2604.14228))**: Operating system layer for agents with unbypassable permissions and 4-stage progressive compaction (`Snip`, `Micro-compact`, `Collapse`, `Auto-compact`).
3. **Pi ([pi.dev](https://pi.dev))**: Minimalist provider abstraction, session trees, and A/B comparative benchmark baseline.
4. **Hermes ([hermes-agent.org](https://hermes-agent.org))**: Durable RAG memory decoupled from conversational transcripts.
5. **Prime Agent ([Prime Intellect](https://github.com/PrimeIntellect-ai/prime-agent))**: Recursive language models with ROI-driven subagents returning evidence and artifacts without transcript bloat.
6. **Aider ([aider.chat](https://aider.chat))**: AST repository symbol maps, syntax outline compression, and git diff management.

---

## 3. Key Capabilities

```mermaid
flowchart LR
    subgraph Inputs [Inputs & Context]
        AST[AST Repo-Map Index]
        Prefix[Prefix Caching Segregation]
        Budget[Adaptive Context Budget L0-L3]
    end

    subgraph CoreEngine [Stateful Runtime Engine]
        FSM[14-Phase State Machine]
        Fingerprint[Loop Fingerprinter & Oscillation Breaker]
        Policy[Unbypassable Policy Engine]
    end

    subgraph Execution [Execution & Verification]
        Tools[Parallel Tool Executor]
        Impacted[Impacted Test Selector]
        Audit[HMAC SHA-256 Signer]
        Git[Zero-Loss Git Rollback]
    end

    Inputs --> CoreEngine
    CoreEngine --> Execution
```

- **Prefix & Ephemeral Prompt Caching**: Segregates static system prompts, tool schemas, and repo maps with `cacheControl: { type: 'ephemeral' }`, unlocking >80% provider prompt caching discounts.
- **4-Stage Progressive Compaction**: Progressively trims intermediate reasoning while guaranteeing that domain invariants (`mustPreserve = true`) are never pruned.
- **Deterministic Loop Fingerprinting**: Computes SHA-256 state hashes `(phase, error, files, tools, hypothesis)` to prevent infinite loops ($A \to A \to A$) and 2-cycle oscillations ($A \to B \to A \to B$).
- **Selective Impacted Test Selection**: Runs only affected unit/integration tests during intermediate steps, triggering the full test suite on final acceptance passes.
- **Zero-Loss Git Rollback**: Reverts agent-generated changes while strictly preserving uncommitted pre-existing user work.
- **Enterprise Security & Audit**: Shannon entropy ($-\sum p_i \log_2 p_i$) secret scrubbing and cryptographic HMAC SHA-256 signatures over execution journals and checkpoint manifests.

---

## 4. Quickstart

### Prerequisites
- **Node.js**: `>= 20.0.0`
- **npm**: `>= 10.0.0`
- **Git**: `>= 2.30.0`

### Installation
```bash
git clone https://github.com/vfcarida/Vi-Harness.git
cd Vi-Harness
npm install
```

### Build & Typecheck
```bash
npm run build
npm run typecheck
npm run lint
```

### Run Tests
```bash
# Run the complete test suite (84 test files, 596 tests)
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration
```

---

## 5. Benchmarks & Context Efficiency

Vi-Harness includes automated, reproducible benchmark suites comparing context scaling and agent performance against competing paradigms.

### Context Efficiency Benchmark
```bash
npm run benchmark:context
```

**Verified Experimental Results:**
- **Token Savings vs Naive Accumulation**: **85.3%**
- **Critical Memory Retention**: **100.0%** (vs 0.0% in naive compaction over 100-iteration horizons)
- **Context Growth Complexity**: Sublinear $O(\log N)$ or bounded constant, eliminating linear $O(N)$ transcript blowup.

### Canonical Task Benchmark
```bash
npm run benchmark
```
Runs the canonical 7-task SWE evaluation suite across isolated workspace sandboxes, calculating mean, median, and P95 distributions for cost, tokens, and latency.

---

## 6. Architecture & Four-Tier Context Model

Vi-Harness structures all agent knowledge into four explicit tiers:

| Tier | Name | Persistence | Allocation | Content Description |
| :--- | :--- | :--- | :--- | :--- |
| **L0** | **Hot State** | Current Iteration | 35-45% | Active goal, modified file buffers, immediate error stack traces, compiler output. |
| **L1** | **Working Memory** | Active Task | 20-30% | Execution plan checklist, active hypothesis, recent decision records. |
| **L2** | **Episodic History** | Session | 10-15% | Condensed prior attempts, failed tool invocations, summarized branch outcomes. |
| **L3** | **Repository Knowledge** | Permanent | 20-40% | Coding standards, architectural rules, AST Repo-Map symbol graph. |

---

## 7. Project Structure

```
Vi-Harness/
├── docs/                   # Complete architectural, audit, and research documentation
│   ├── architecture/       # Current & target architecture, ADRs, module specifications
│   ├── audit/              # Traceability matrix, baseline reports, verification results
│   ├── research/           # Literature reviews, reference matrix, comparative analysis
│   ├── security/           # Threat model, STRIDE analysis, OWASP LLM mitigations
│   └── testing/            # Test strategy, pyramid breakdown, benchmark protocols
├── src/
│   ├── cli/                # Benchmark and context evaluation CLI tools
│   ├── core/               # Domain interfaces, state machine, domain models (Zero Deps)
│   ├── di/                 # Dependency injection container and modules
│   ├── infra/              # Infrastructure implementations (compiler, security, tools, git)
│   └── runtime/            # State machine iteration loop and runtime engine
└── tests/
    ├── integration/        # End-to-end multi-turn workflows and real git tests
    └── unit/               # Domain, compiler, security, and tool unit tests
```

---

## 8. Documentation

- [Current Architecture Specification](./docs/architecture/CURRENT_ARCHITECTURE.md)
- [Target Architecture Specification](./docs/architecture/TARGET_ARCHITECTURE.md)
- [Literature Review & Research Report](./docs/research/RESEARCH_REPORT.md)
- [Authoritative Reference Matrix](./docs/research/REFERENCE_MATRIX.md)
- [Comprehensive Threat Model](./docs/security/THREAT_MODEL.md)
- [Complete Test Strategy](./docs/testing/TEST_STRATEGY.md)
- [End-to-End Traceability Matrix](./docs/audit/TRACEABILITY_MATRIX.md)
- [Clean-Room Verification Report](./docs/audit/VERIFICATION_REPORT.md)

---

## 9. Citation

If you use Vi-Harness in your research or software engineering projects, please cite:

```bibtex
@software{vi_harness_2026,
  author = {Vi-Harness Contributors},
  title = {Vi-Harness: Enterprise-Grade, Model-Agnostic Coding-Agent Runtime and Harness},
  year = {2026},
  url = {https://github.com/vfcarida/Vi-Harness},
  version = {0.4.0}
}
```

---

## 10. License

Vi-Harness is licensed under the [MIT License](./LICENSE).
