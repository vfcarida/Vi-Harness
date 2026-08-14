# Vi-Harness: Prioritized Implementation Plan

## 1. Plan Overview

This plan defines the concrete implementation roadmap for bringing Vi-Harness to international enterprise standards of software engineering, agent reliability, and token efficiency.

---

## 2. Planned Changes Matrix

| Change ID | Title | Linked Findings | Linked References | Priority | Risk | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **C-001** | Prefix Caching Context Segregation | `F-001` | `R-001`, `R-002` | P0 | LOW | ✅ Implemented & Verified |
| **C-002** | Causal Execution Trace Logging & Distillation | `F-002` | `R-001`, `R-010` | P0 | LOW | ✅ Implemented & Verified |
| **C-003** | 4-Stage Progressive Compaction with Invariant Preservation | `F-003` | `R-002` | P0 | MEDIUM | ✅ Implemented & Verified |
| **C-004** | Deterministic Loop Fingerprinting & Oscillation Breaker | `F-004` | `R-001`, `R-009` | P0 | LOW | ✅ Implemented & Verified |
| **C-005** | Dynamic Context Budget Balancer (L0-L3) | `F-001`, `F-003` | `R-002`, `R-005` | P1 | LOW | ✅ Implemented & Verified |
| **C-006** | Speculative Streaming Tool Call Parser | `F-008` | `R-002` | P1 | LOW | ✅ Implemented & Verified |
| **C-007** | Cryptographic HMAC SHA-256 Audit Signing | `F-005` | `R-007`, `R-008` | P1 | LOW | ✅ Implemented & Verified |
| **C-008** | Shannon Entropy High-Entropy Credential Redaction | `F-006` | `R-007`, `R-008` | P1 | LOW | ✅ Implemented & Verified |
| **C-009** | Selective Impacted Test Execution Engine | `F-007` | `R-006`, `R-009` | P1 | LOW | ✅ Implemented & Verified |
| **C-010** | Non-Destructive Git Checkpointing & Safe Rollback | `F-010` | `R-006` | P0 | MEDIUM | ✅ Implemented & Verified |

---

## 3. Detailed Change Specifications

### C-001: Prefix Caching Context Segregation
- **Files Affected**: `src/infra/compiler/prefix-caching-compiler.ts`, `src/core/model/caching-types.ts`.
- **Implementation**: Separates static invariant blocks (system prompt, tool schemas, AST repo map) marked with `cacheControl: { type: 'ephemeral' }` from dynamic per-turn blocks.
- **Verification**: `tests/unit/compiler/prefix-caching-compiler.test.ts`.

### C-002: Causal Execution Trace Distillation (Meta-Harness)
- **Files Affected**: `src/infra/logging/meta-harness-trace-logger.ts`, `src/infra/telemetry/trace-distiller.ts`, `src/infra/telemetry/harness-diagnostic-engine.ts`.
- **Implementation**: Writes JSONL per iteration with token breakdown, tool stats, and policy actions; distills bottleneck reports and outer-loop adaptation patches.
- **Verification**: `tests/unit/telemetry/trace-distiller.test.ts`, `tests/integration/meta-harness-production-flow.test.ts`.

### C-003: 4-Stage Progressive Compaction with Invariant Preservation
- **Files Affected**: `src/infra/compiler/context-compressor.ts`.
- **Implementation**: Applies `Snip` -> `Micro-compact` -> `Collapse` -> `Auto-compact` pipeline while ensuring domain invariants (`mustPreserve = true`) are never stripped.
- **Verification**: `tests/unit/compiler/multi-tier-compaction.test.ts`.

### C-004: Deterministic Loop Fingerprinting & Oscillation Breaker
- **Files Affected**: `src/runtime/loop-fingerprinter.ts`.
- **Implementation**: Computes SHA-256 state hashes and flags 3-step stagnation or 2-cycle oscillation transitions to `AgentPhase.OSCILLATION_DETECTED`.
- **Verification**: `tests/unit/runtime/loop-fingerprinter.test.ts`.

### C-005: Dynamic Context Budget Balancer
- **Files Affected**: `src/infra/compiler/context-budget-balancer.ts`.
- **Implementation**: Computes phase-specific token allocations across L0, L1, L2, and L3 context tiers with non-starvation minimum floors.
- **Verification**: `tests/unit/compiler/context-budget-balancer.test.ts`.

### C-006: Speculative Streaming Tool Call Parser
- **Files Affected**: `src/infra/model/streaming-tool-parser.ts`.
- **Implementation**: Incremental JSON parser with brace balancing for early tool identification and pre-flight policy evaluation during LLM streaming.
- **Verification**: `tests/unit/model/streaming-tool-parser.test.ts`.

### C-007: Cryptographic HMAC SHA-256 Audit Signing
- **Files Affected**: `src/infra/security/audit-integrity-signer.ts`.
- **Implementation**: Generates and verifies HMAC SHA-256 cryptographic signatures over execution journals, checkpoint manifests, and telemetry records.
- **Verification**: `tests/unit/security/audit-integrity-signer.test.ts`.

### C-008: Shannon Entropy High-Entropy Credential Redaction
- **Files Affected**: `src/infra/security/secret-scrubber.ts`.
- **Implementation**: Computes Shannon entropy ($-\sum p_i \log_2 p_i$) on tokens $\ge 32$ chars and redacts random keys with entropy $\ge 4.5$.
- **Verification**: `tests/unit/security/audit-integrity-signer.test.ts`.

### C-009: Selective Impacted Test Execution Engine
- **Files Affected**: `src/infra/verification/impacted-test-selector.ts`.
- **Implementation**: Maps modified source files to impacted unit/integration tests for fast feedback during iteration steps, falling back to full suite on final acceptance.
- **Verification**: `tests/unit/verification/impacted-test-selector.test.ts`.

### C-010: Non-Destructive Git Checkpointing & Safe Rollback
- **Files Affected**: `src/infra/git/default-git-manager.ts`, `src/infra/git/default-rollback-manager.ts`, `src/infra/git/real-git-manager.ts`.
- **Implementation**: Baseline diff capture before agent execution; preserves user-owned dirty modifications while reverting agent-owned changes during rollback.
- **Verification**: `tests/integration/git-real-repository.test.ts`.
