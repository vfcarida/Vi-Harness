# ADR-005: Interface-First Design and Model Agnosticism

**Status:** Accepted  
**Date:** 2024-08-12  
**Decision Makers:** Architecture team

## Context

The system must be **model-agnostic by contract, not by adapter**. This means:
- No LLM provider SDK types should leak into the domain layer
- No vendor-specific model types should cross the provider abstraction
- Providers must be hot-swappable without restarting the runtime
- The system should work with any LLM that supports chat completions + function calling

## Decision

**Define all architectural boundaries as TypeScript interfaces in the core layer.** Infrastructure implements these interfaces. The domain layer never imports from infrastructure.

### 13 core interfaces:

| Interface | Responsibility |
|---|---|
| `ModelProvider` | Vendor-neutral LLM completion contract |
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
| `StateStore` | State management + transition enforcement |
| `AgentRuntime` | Top-level goal execution |

### Vendor-neutral model types:
`ModelRequest`, `ModelResponse`, `ModelMessage`, `ToolCall`, `ModelUsage`, `FinishReason`

These types define what crosses the LLM boundary. Provider adapters translate between these types and vendor SDK types.

## Rationale

1. **Testability**: Every interface can be stubbed for unit testing.
2. **Composability**: Interfaces are small — each has 2-5 methods.
3. **Hot-swapping**: The `ModelRouter` can swap providers mid-execution.
4. **Future-proofing**: New providers are added by implementing `ModelProvider`, not by modifying the runtime.
5. **Package splitting**: When the system grows, `core/` can become an independent package.

## Consequences

- All interfaces live in `src/core/interfaces/`.
- All domain types live in `src/core/model/` and `src/core/types/`.
- Infrastructure implementations live in `src/infra/`.
- DI wiring lives in `src/di/`.
- The dependency arrow always points **inward** toward `core/`.
