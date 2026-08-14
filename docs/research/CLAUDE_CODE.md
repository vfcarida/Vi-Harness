# Research: Claude Code (Tool-First Coding Workflows)

> **Relation to Vi-Harness:** Practical inspiration for developer tool ergonomics, iterative file editing/testing patterns, and structured tool-call feedback mechanisms.

## What Claude Code Is

Claude Code represents state-of-the-art **tool-first coding agent engineering**. It integrates deeply into developer terminal environments, providing an agentic CLI capable of inspecting codebases, executing terminal commands, modifying files, and debugging test failures iteratively.

Key strengths of the Claude Code approach:
1. **Tool-First Ergonomics:** Directly models real software developer behavior (Read file → Search symbols → Write patch → Execute tests).
2. **Structured Tool Feedback:** Tool outputs are returned with correlation identifiers rather than plain conversational text.
3. **Interactive Human-in-the-Loop:** Seamlessly transitions between autonomous tool execution and human confirmation for sensitive actions.

---

## What Vi-Harness Takes from Claude Code

1. **First-Class Tool-Call Linkage:**
   Tool outputs are delivered back to the model as `MessageRole.TOOL` messages explicitly bound to their originating proposal via `toolCallId` and tool `name`. Structured errors (such as `UNKNOWN_TOOL` or `POLICY_DENIED`) are returned in this standard format rather than crashing the harness.

2. **Core Tool Suite Alignment:**
   Vi-Harness implements the fundamental tool primitives needed for software engineering: `read_file`, `write_file`, `list_directory`, and `run_command`, equipped with timeout controls and exit status reporting.

3. **Subagent & Parallel Execution:**
   Safe exploration tools (e.g., directory listing, file reading) execute in parallel, reflecting modern coding agent performance patterns.

---

## What Vi-Harness Does Differently

| Architectural Aspect | Claude Code Paradigm | Vi-Harness Implementation |
|---|---|---|
| **Model Coupling** | Specialized for Anthropic Claude models | Completely vendor-neutral; hot-swappable providers via `ModelRouter` and `ModelProvider` |
| **Execution Paradigm** | Interactive conversational assistant | Autonomous, deterministic, evidence-driven `StateMachine` |
| **Context Strategy** | Conversation transcript with progressive compaction | Compiled context assembled per iteration from 4 tiers (`L0_HOT` to `L3_REPOSITORY`) |
| **Security Layering** | User-prompted confirmations in CLI | 4-layer security architecture (Application validation, Deny-First `PolicyEngine`, Sandbox isolation, `SecretScrubber` / `ContextSanitizer`) |
| **Reversibility** | Local file edits / Git working tree | Git baseline capture, delta ownership tracking, and Checkpoint/Rollback subsystem |
| **Acceptance Criteria** | Conversational agreement with user | Formal `AcceptancePolicy` evaluated against empirical `VerificationEngine` artifacts |

---

## Implementation Reference in Vi-Harness

- **Tool Execution Subsystem:**
  - `src/core/interfaces/tool.ts` & `src/core/interfaces/tool-executor.ts`
  - `src/infra/tools/default-tool-executor.ts`
  - `src/infra/tools/parallel-tool-executor.ts`
  - `src/infra/tools/builtin/` (`read-file-tool.ts`, `write-file-tool.ts`, `list-directory-tool.ts`, `run-command-tool.ts`)
- **Security & Scrubber:**
  - `src/infra/security/path-validator.ts`
  - `src/infra/security/secret-scrubber.ts`
  - `src/infra/tools/command-sanitizer.ts`
- **Model I/O:**
  - `src/core/model/model-io.ts` (`ModelMessage`, `MessageRole`, `ToolCall`, `TokenUsage`)

---

## Open Research Questions

1. **Tool Output Summarization Thresholds:** At what output token size should large compiler/test logs be summarized before being presented to the model?
2. **Deterministic Tool Sandboxing:** How can terminal tool execution be isolated reliably across heterogeneous developer environments (Linux, macOS, Windows) without container overhead?
3. **Cross-Model Tool Use Fidelity:** What differences in JSON schema interpretation and tool call emission exist across different frontier models when using the same tool definitions?
