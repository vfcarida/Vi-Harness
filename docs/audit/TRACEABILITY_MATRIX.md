# Vi-Harness: End-to-End Traceability Matrix

| Finding ID | Finding Description | Reference ID | Reference Title | Change ID | Implementation Module | Verification ID | Verification Test Suite | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **F-001** | Static Prefix Caching Segregation | `R-001`, `R-002` | Meta-Harness & Claude Code | `C-001` | `src/infra/compiler/prefix-caching-compiler.ts` | `V-001` | `tests/unit/compiler/prefix-caching-compiler.test.ts` | ✅ Verified PASS |
| **F-002** | Causal Execution Trace Distillation | `R-001`, `R-010` | Meta-Harness & TerminalBench-2 | `C-002` | `src/infra/telemetry/trace-distiller.ts` | `V-002` | `tests/unit/telemetry/trace-distiller.test.ts` | ✅ Verified PASS |
| **F-003** | 4-Stage Progressive Compaction | `R-002` | Claude Code Operating System | `C-003` | `src/infra/compiler/context-compressor.ts` | `V-003` | `tests/unit/compiler/multi-tier-compaction.test.ts` | ✅ Verified PASS |
| **F-004** | Loop Fingerprinting & Oscillation Breaker | `R-001`, `R-009` | Meta-Harness & SWE-bench | `C-004` | `src/runtime/loop-fingerprinter.ts` | `V-004` | `tests/unit/runtime/loop-fingerprinter.test.ts` | ✅ Verified PASS |
| **F-005** | Cryptographic HMAC SHA-256 Audit Signing | `R-007`, `R-008` | NIST AI RMF & OWASP LLM | `C-007` | `src/infra/security/audit-integrity-signer.ts` | `V-005` | `tests/unit/security/audit-integrity-signer.test.ts` | ✅ Verified PASS |
| **F-006** | Shannon Entropy High-Entropy Credential Redaction | `R-007`, `R-008` | NIST AI RMF & OWASP LLM | `C-008` | `src/infra/security/secret-scrubber.ts` | `V-006` | `tests/unit/security/audit-integrity-signer.test.ts` | ✅ Verified PASS |
| **F-007** | Selective Impacted Test Execution | `R-006`, `R-009` | Aider & SWE-bench | `C-009` | `src/infra/verification/impacted-test-selector.ts` | `V-007` | `tests/unit/verification/impacted-test-selector.test.ts` | ✅ Verified PASS |
| **F-008** | Speculative Streaming Tool Call Parser | `R-002` | Claude Code Protocols | `C-006` | `src/infra/model/streaming-tool-parser.ts` | `V-008` | `tests/unit/model/streaming-tool-parser.test.ts` | ✅ Verified PASS |
| **F-009** | Subagent Swarm Artifact Protocol | `R-005` | Prime Agent Recursive Models | `C-005` | `src/infra/subagent/default-subagent-manager.ts` | `V-009` | `tests/unit/infra/subagent-manager.test.ts` | ✅ Verified PASS |
| **F-010** | Non-Destructive Git Checkpointing & Rollback | `R-006` | Aider Git Architecture | `C-010` | `src/infra/git/real-git-manager.ts` | `V-010` | `tests/integration/git-real-repository.test.ts` | ✅ Verified PASS |
