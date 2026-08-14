# Vi-Harness: Related Projects & Comparative Analysis

## 1. Feature & Architectural Comparison Matrix

| Architectural Feature | Vi-Harness | Claude Code | Pi | Aider | OpenHands | LangGraph |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **State Machine Axiom** | ✅ 14 Canonical Phases | ⚠️ Partial | ❌ Raw Session Tree | ❌ Chat Loop | ⚠️ Event Stream | ⚠️ Generic Graph |
| **Evidence-Driven DONE Gate** | ✅ Explicit Verifier Evidence | ✅ Tool Verification | ❌ Conversational | ❌ Git Commit | ⚠️ Evaluation Run | ❌ User Choice |
| **Prefix Caching Segregation** | ✅ `PrefixCachingCompiler` | ✅ Ephemeral Caching | ❌ Monolithic | ❌ Full Map | ❌ Monolithic | ⚠️ Manual Header |
| **4-Stage Compaction** | ✅ Snip/Micro/Collapse/Auto | ✅ 4-Stage Engine | ❌ Truncation Only | ❌ Fixed Window | ❌ Truncation | ❌ Manual |
| **Loop Fingerprint & Oscillation Breaker** | ✅ SHA-256 State Hashing | ⚠️ Max Steps | ❌ None | ❌ None | ⚠️ Basic Steps | ❌ None |
| **Causal Trace Distillation (Meta-Harness)** | ✅ JSONL Distiller + Diagnostics | ❌ None | ❌ None | ❌ None | ❌ None | ❌ None |
| **Unbypassable Policy Engine** | ✅ Pre-Flight Risk Classifier | ✅ Unbypassable | ❌ Basic | ❌ Prompt Only | ⚠️ Docker Only | ❌ None |
| **HMAC SHA-256 Audit Signing** | ✅ Tamper-Proof Logs | ❌ None | ❌ None | ❌ None | ❌ None | ❌ None |
| **Zero-Loss Git Rollback** | ✅ Preserves User Changes | ⚠️ Git Checkout | ❌ None | ✅ Git Commits | ⚠️ Git Patch | ❌ None |
| **Model-Agnostic Routing** | ✅ Architect / Editor Dual | ❌ Anthropic Only | ✅ Multi-Provider | ✅ Multi-Provider | ✅ Multi-Provider | ✅ Multi-Provider |

---

## 2. Summary of Competitive Differentiation

1. **Deterministic State Machine vs Conversational Trap**: Unlike LangChain or CrewAI which rely on persistent conversation histories that degrade over time, Vi-Harness treats every iteration as a deterministic state transition governed by empirical verification evidence.
2. **Sublinear Context Scaling**: By combining AST symbol mapping, prefix caching segregation, and 4-stage progressive compaction, Vi-Harness bounds context growth to $O(\log N)$ or bounded constants rather than linear unbounded blowup.
3. **Enterprise Defense-in-Depth**: From Shannon entropy credential scrubbing to SHA-256 cryptographic audit logs and unbypassable local sandboxes, Vi-Harness provides security controls suitable for regulated production codebases.
