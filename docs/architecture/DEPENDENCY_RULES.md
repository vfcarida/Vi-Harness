# Dependency Rules

This document defines the allowed and forbidden dependency directions between architectural layers.

## Layer Hierarchy

```
Runtime  →  DI  →  Infrastructure  →  Core
                                       ↑
                          (all arrows point here)
```

## Rules

### ✅ Allowed

| From | To | Example |
|---|---|---|
| `infra/*` | `core/interfaces/*` | `ConsoleLogger` implements `Logger` |
| `infra/*` | `core/errors/*` | `EnvConfiguration` throws `HarnessError` |
| `infra/*` | `core/types/*` | `UuidV7IdFactory` returns `Id<T>` |
| `di/*` | `core/interfaces/*` | Token definitions reference interface types |
| `di/*` | `infra/*` | `DefaultModule` instantiates infrastructure classes |
| `runtime/*` | `core/*` | Runtime uses domain types and interfaces |
| `runtime/*` | `di/*` | Runtime resolves services from the container |
| `core/interfaces/*` | `core/model/*` | Interfaces use domain model types |
| `core/interfaces/*` | `core/types/*` | Interfaces use branded types |
| `core/model/*` | `core/types/*` | Model types use branded identifiers |
| `core/errors/*` | `core/types/*` | Errors may reference type definitions |

### ❌ Forbidden

| From | To | Reason |
|---|---|---|
| `core/*` | `infra/*` | Domain must not depend on infrastructure |
| `core/*` | `di/*` | Domain must not know about the container |
| `core/*` | `runtime/*` | Domain must not know about orchestration |
| `core/*` | any npm package except TypeScript built-ins | Domain must be dependency-free |
| `infra/*` | `runtime/*` | Infrastructure must not depend on orchestration |
| `infra/*` | `di/*` | Infrastructure must not depend on wiring |
| Any layer | vendor LLM SDKs (in domain types) | LLM types must not cross the provider boundary |

### ⚠️ Conditional

| From | To | Condition |
|---|---|---|
| `infra/*` | npm packages (`uuid`, `zod`) | Allowed — infrastructure is where external deps live |
| `runtime/*` | `infra/*` | Discouraged — prefer resolving through DI |

## Enforcement

1. **Compile-time**: TypeScript path restrictions (no path alias from core to infra).
2. **Code review**: PRs must not introduce forbidden imports.
3. **Future**: ESLint `import/no-restricted-paths` rule can automate enforcement.

## Circular Dependency Prevention

- No module may import from its own barrel (`index.ts`) — always use direct file imports within a module.
- Cross-layer imports always go in one direction (toward core).
- If two modules need each other, extract the shared dependency into `core/types/` or `core/interfaces/`.
