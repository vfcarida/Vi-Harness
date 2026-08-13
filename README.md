# Vi-Harness

> Enterprise-grade, model-agnostic coding-agent harness.

**"The agent is not a persistent conversation. The agent is a stateful, evidence-driven state machine."**

## What is Vi-Harness?

Vi-Harness is an agent runtime framework for building coding agents that are:

- **Model-agnostic** — swap LLM providers (OpenAI, Anthropic, Google, local) without changing business logic
- **Cost-efficient** — compiled context with four-tier memory, not accumulated conversation history
- **Reliable** — deterministic state machine with checkpoints, verification, and evidence-driven decisions
- **Secure** — policy engine controlling every irreversible action with ALLOW/DENY/ESCALATE
- **Observable** — structured errors, logging, and state transitions for enterprise monitoring
- **Reversible** — checkpoint/restore for every meaningful milestone

## Quick Start

```bash
# Install dependencies
npm install

# Run the test suite
npm test

# Type check
npm run typecheck

# Build
npm run build
```

## Project Structure

```
src/
├── core/                    # Domain layer — ZERO infrastructure dependencies
│   ├── types/               # Branded types, identifiers, Result<T,E>
│   ├── errors/              # HarnessError, ErrorCode, ErrorCategory
│   ├── model/               # Domain value objects (context, evidence, state, etc.)
│   └── interfaces/          # All abstract contracts (16 interfaces)
├── infra/                   # Infrastructure — implements core interfaces
│   ├── id/                  # UUIDv7 ID factory
│   ├── logging/             # Structured console logger
│   ├── time/                # System clock + deterministic test clock
│   └── config/              # Env-based configuration with Zod validation
├── di/                      # Dependency injection container + wiring
│   ├── container.ts         # Lightweight DI (no decorators, no reflection)
│   ├── tokens.ts            # Service injection tokens
│   └── default-module.ts    # Bootstrap infrastructure registrations
└── index.ts                 # Public API barrel export

tests/
└── unit/                    # Unit tests (Vitest)
    ├── core/                # Error model, Result type
    ├── infra/               # Logger, clock, config, ID factory
    └── di/                  # Container, default module

docs/
└── architecture/
    ├── ARCHITECTURE.md      # System overview
    ├── MODULE_MAP.md        # Module boundaries and responsibilities
    ├── DEPENDENCY_RULES.md  # Allowed/forbidden dependency directions
    └── adr/                 # Architecture Decision Records
        ├── 001-typescript-choice.md
        ├── 002-dependency-injection.md
        ├── 003-error-model.md
        ├── 004-context-tiers.md
        └── 005-interface-first-design.md
```

## Architecture

The system uses a **layered architecture** with strict dependency rules:

```
Runtime  →  DI  →  Infrastructure  →  Core
                                       ↑
                        (all arrows point inward)
```

**Core has zero external dependencies.** Infrastructure implements core interfaces. DI wires them together.

### Core Interfaces

| Interface | Responsibility |
|---|---|
| `ModelProvider` | Vendor-neutral LLM completion |
| `ModelRouter` | Task-based provider selection |
| `ContextStore` | Context entry CRUD |
| `MemoryStore` | Semantic context retrieval |
| `ContextCompiler` | Context assembly with token budgets |
| `Tool` | Single tool definition + execution |
| `ToolExecutor` | Tool registry + execution gateway |
| `PolicyEngine` | Action evaluation (ALLOW/DENY/ESCALATE) |
| `VerificationEngine` | Artifact verification |
| `EvidenceStore` | Evidence persistence + querying |
| `CheckpointStore` | State snapshot/restore |
| `StateStore` | State management + transitions |
| `AgentRuntime` | Top-level goal execution |

### Context Tiers

| Tier | Name | Contents |
|---|---|---|
| L0 | Hot Context | Current task, files, hypothesis |
| L1 | Working Memory | Plan, decisions, recent evidence |
| L2 | Episodic Memory | Previous attempts, failed approaches |
| L3 | Repository Memory | Architecture, standards, constraints |

## Development

```bash
npm test              # Run unit tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
npm run typecheck     # TypeScript strict check
npm run lint          # ESLint
npm run format        # Prettier
npm run build         # Compile to dist/
```

## Design Decisions

All major decisions are recorded as ADRs in [docs/architecture/adr/](docs/architecture/adr/).

## License

MIT
