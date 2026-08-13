# Module Map

This document describes every module in Vi-Harness, its responsibility, and its location.

## Core Layer (`src/core/`)

The domain layer. Has **zero** dependencies on infrastructure, DI, or runtime.

### `core/types/`
| File | Contents |
|---|---|
| `branded.ts` | `Brand<T, B>` phantom type utility |
| `identifiers.ts` | `Id<T>` branded type, domain-specific IDs (`TaskId`, `GoalId`, etc.), `IdFactory` interface |
| `result.ts` | `Result<T, E>` discriminated union, `ok()`, `fail()` factories |

### `core/errors/`
| File | Contents |
|---|---|
| `error-codes.ts` | `ErrorCode` enum, `ErrorCategory` enum, `ERROR_CODE_CATEGORY` mapping |
| `base-error.ts` | `HarnessError` class (extends `Error`) |

### `core/model/`
| File | Contents |
|---|---|
| `context.ts` | `ContextTier` enum, `ContextEntry`, `CompiledContext` |
| `evidence.ts` | `EvidenceType` enum, `Evidence` |
| `model-io.ts` | `MessageRole`, `FinishReason`, `ModelMessage`, `ModelRequest`, `ModelResponse`, `ModelUsage`, `ToolCall` |
| `policy.ts` | `PolicyDecisionType` enum, `PolicyAction`, `PolicyDecision` |
| `state.ts` | `AgentPhase` enum, `StateEvent` enum, `AgentState`, `StateTransition` |
| `tool-types.ts` | `ToolInput`, `ToolDefinition`, `ToolResult` |
| `verification.ts` | `VerificationStatus` enum, `VerificationResult` |

### `core/interfaces/`
| File | Interface | Methods |
|---|---|---|
| `logger.ts` | `Logger` | `debug`, `info`, `warn`, `error`, `fatal`, `child` |
| `clock.ts` | `Clock` | `now`, `timestamp` |
| `configuration.ts` | `Configuration` | `get`, `getRequired`, `has`, `set` |
| `model-provider.ts` | `ModelProvider` | `complete`, `listModels` |
| `model-router.ts` | `ModelRouter` | `route`, `registerProvider` |
| `context-store.ts` | `ContextStore` | `get`, `set`, `delete`, `list` |
| `memory-store.ts` | `MemoryStore` | `retrieve`, `store`, `forget` |
| `context-compiler.ts` | `ContextCompiler` | `compile` |
| `tool.ts` | `Tool` | `definition`, `execute` |
| `tool-executor.ts` | `ToolExecutor` | `execute`, `register`, `getTool`, `listTools` |
| `policy-engine.ts` | `PolicyEngine` | `evaluate`, `addRule`, `removeRule` |
| `verification-engine.ts` | `VerificationEngine` | `verify` |
| `evidence-store.ts` | `EvidenceStore` | `record`, `get`, `query` |
| `checkpoint-store.ts` | `CheckpointStore` | `create`, `restore`, `list`, `delete` |
| `state-store.ts` | `StateStore` | `getState`, `transition`, `getHistory` |
| `agent-runtime.ts` | `AgentRuntime` | `execute`, `pause`, `resume`, `abort` |

---

## Infrastructure Layer (`src/infra/`)

Concrete implementations of core interfaces.

| File | Implements | Description |
|---|---|---|
| `id/uuid-id-factory.ts` | `IdFactory` | UUIDv7-based ID generation |
| `logging/console-logger.ts` | `Logger` | Structured JSON console output |
| `time/system-clock.ts` | `Clock` | Real system time |
| `time/test-clock.ts` | `Clock` | Deterministic test time |
| `config/env-configuration.ts` | `Configuration` | Env vars + overrides + Zod validation |

---

## DI Layer (`src/di/`)

Wiring layer connecting interfaces to implementations.

| File | Contents |
|---|---|
| `tokens.ts` | `TOKENS` — namespaced `Symbol` constants for each service |
| `container.ts` | `Container` — lightweight DI with transient/singleton/instance registration |
| `module.ts` | `ContainerModule` interface |
| `default-module.ts` | `DefaultModule` — registers bootstrap infrastructure |

---

## Test Layer (`tests/`)

| File | Tests |
|---|---|
| `unit/core/errors.test.ts` | HarnessError construction, serialization, enum consistency |
| `unit/core/identifiers.test.ts` | Result type factories |
| `unit/infra/console-logger.test.ts` | Logger interface, JSON output, child context, level filtering |
| `unit/infra/system-clock.test.ts` | Clock interface compliance |
| `unit/infra/test-clock.test.ts` | Deterministic time control |
| `unit/infra/env-configuration.test.ts` | Config get/set/has, Zod validation, prefix filtering |
| `unit/infra/uuid-id-factory.test.ts` | UUIDv7 format, uniqueness, time-ordering |
| `unit/di/container.test.ts` | Registration, resolution, singleton caching, cross-wiring |
| `unit/di/default-module.test.ts` | Module registration, interface compliance through DI |
