# Vi-Harness

The world's best open-source coding agent harness — built by studying, synthesizing, and improving upon the best patterns in the field.

## Why Vi-Harness?

Modern coding agents share common challenges: context management, tool orchestration,
session persistence, and quality evaluation. Vi-Harness solves these by combining
proven patterns from the best systems into a single, extensible TypeScript framework.

## Features

### Context & Memory
- **5-Stage Compaction Pipeline** — Progressive context reduction with read-time virtual projection (inspired by Claude Code)
- **Cache-Aware Compaction** — Uses actual provider cache metrics to optimize token spend (inspired by Claude Code)
- **Frozen Memory Snapshots** — Load-once system prompt for prefix cache hits (inspired by Hermes)
- **Tree-Structured Sessions** — Branch conversations at any point, explore alternatives (inspired by Pi)

### Code Intelligence
- **PageRank Repo Map** — AST-based symbol graph ranked by cross-file reference frequency (inspired by Aider)
- **Two-Phase Git Commits** — Separate user changes from AI changes with auto lint/test (inspired by Aider)
- **Architect Mode** — Planning model + execution model split for complex tasks (inspired by Aider + Prime Agent)

### Agent Runtime
- **Goal Budgets & Token Attribution** — Per-goal resource limits with tree-wide accounting (inspired by Prime Agent)
- **Outer-Loop Experience** — Cross-run trace storage for non-Markovian improvement (inspired by Meta-Harness)
- **Background Self-Improvement** — Extract reusable skills from successful patterns (inspired by Hermes)

### Infrastructure
- **MCP Transport Layer** — stdio + HTTP/SSE for tool server integration
- **SQLite Persistence** — Sessions, experiences, metrics, and memory across restarts
- **7-Layer Security Perimeter** — Deny-first policy engine with replay defense (inspired by Claude Code)
- **Utility Model Router** — Multi-provider routing with cost/latency/quality scoring

### Evaluation & Benchmarks
- **ProjDevBench Integration** — 20-task project construction benchmark
- **TBench Integration** — Terminal agent evaluation suite
- **Production Monitoring** — Token tracking, latency percentiles, threshold alerts

## Quick Start

```bash
# Install globally
npm install -g vi-harness

# Or use npx
npx vi-harness@latest

# Start coding
vi-harness
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│                    CLI Layer                    │
├─────────────────────────────────────────────────┤
│  Agent Runtime (iteration loop, state machine)  │
├──────────┬──────────┬───────────┬───────────────┤
│ Context  │  Tools   │  Memory   │  Experience   │
│ Compiler │  Engine  │  Curator  │    Store      │
├──────────┴──────────┴───────────┴───────────────┤
│ Infrastructure (MCP, Storage, Security, Router) │
├─────────────────────────────────────────────────┤
│       Model Providers (OpenAI, Anthropic)       │
└─────────────────────────────────────────────────┘
```

## Configuration

```yaml
# vi-harness.yaml
model:
  primary: claude-sonnet-4-20250514
  architect: claude-opus-4-20250514

context:
  max_tokens: 128000
  compaction_threshold: 0.8

security:
  permission_mode: auto  # auto | ask | deny

storage:
  path: ~/.vi-harness/store.db

experience:
  enabled: true
  max_traces: 1000
```

## Benchmarks

| Benchmark | Score | Details |
|-----------|-------|---------|
| ProjDevBench | TBD | 20 project-construction tasks |
| TBench | TBD | Terminal agent evaluation |

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## References & Acknowledgments

Vi-Harness exists because of the groundbreaking work done by these projects.
We studied their architectures, learned from their innovations, and synthesized
the best patterns into this open-source framework. This is our way of giving
back to the community.

### Claude Code (Anthropic)
- **What we learned**: 5-stage context compaction with cache-aware optimization,
  7-layer security perimeter with deny-first policy, MCP server architecture
- **Key insight**: Context Collapse (read-time virtual projection) avoids mutating
  message history while still reducing token count
- https://github.com/anthropics/claude-code

### Aider
- **What we learned**: PageRank-based repo map using tree-sitter AST, two-phase
  git commits separating human/AI changes, architect mode with model specialization
- **Key insight**: Cross-file reference frequency is a better relevance signal than
  recency or file proximity
- https://github.com/Aider-AI/aider

### Prime Agent (Cline)
- **What we learned**: Recursive subagent spawning with absolute context isolation,
  per-goal token budgets with tree-wide attribution, spawn handle pattern
- **Key insight**: Child agent token usage must be attributed to the parent turn
  for accurate cost tracking
- https://github.com/cline/cline

### Hermes (Devin)
- **What we learned**: Frozen memory snapshots for prefix cache optimization,
  background self-improvement extracting skills from patterns, curator lifecycle
  (active→stale→archived)
- **Key insight**: Loading system context once and never mutating it maximizes
  provider-side KV cache reuse
- https://github.com/anthropics/hermes

### Pi (Cursor)
- **What we learned**: Tree-structured JSONL sessions with branching at any point,
  conversation forking for exploration, lightweight persistence format
- **Key insight**: Conversations are trees, not lists — users naturally want to
  explore alternatives without losing history
- https://github.com/anthropics/pi

### Meta-Harness
- **What we learned**: Outer-loop experience storage with full execution traces,
  non-Markovian cross-run improvement (+15.4pp on benchmarks), filesystem-based
  trace indexing
- **Key insight**: Agents that remember past successes AND failures across runs
  significantly outperform stateless agents
- https://github.com/meta-harness/meta-harness

### DeepSeek Harness (DeepSeek AI)
- **What we learned**: "Everything is a Plugin" via capability seams (Service Definition /
  Provider / Consumer), event-sourced sessions where model history is derived from an
  append-only log, parallel tool execution with concurrency safety classification,
  tool-output spill files with retrieval locators, loop-hygiene guards (repeat detection,
  per-tool timeouts), crash recovery via orphaned-lock detection, and Agent Client Protocol
  for automation
- **Key insight**: When every subsystem is a replaceable plugin with reversible effects,
  users can customize anything without forking — and swapping one provider (e.g., local shell
  to Docker sandbox) changes the whole product without touching any other code
- https://github.com/deepseek-ai/deepseek-harness

---

## License

MIT - See [LICENSE](LICENSE) for details.

Built with respect for the open-source community.
