# ADR-002: Lightweight Dependency Injection without Decorators

**Status:** Accepted  
**Date:** 2024-08-12  
**Decision Makers:** Architecture team

## Context

The system requires dependency inversion to keep the domain layer independent from infrastructure. Services must be wirable through interfaces, testable with stubs, and replaceable at runtime.

## Decision

**Use a custom lightweight DI container** based on typed factory functions and symbol tokens. No decorator-based DI frameworks (InversifyJS, tsyringe, TypeDI).

## Design

```typescript
// Tokens are namespaced symbols
const TOKENS = {
  Logger: Symbol.for('vi-harness.Logger'),
};

// Factories are plain functions
container.registerSingleton(TOKENS.Logger, () => new ConsoleLogger());

// Resolution is explicit
const logger = container.resolve<Logger>(TOKENS.Logger);
```

### Key features:
- **Transient**: New instance per `resolve()` call
- **Singleton**: Lazily created, cached after first `resolve()`
- **Instance**: Pre-constructed value registered directly
- **Method chaining**: Fluent API for registration
- **Reset**: Clear singleton cache for test isolation

## Rationale

1. **No reflection magic**: Decorator-based DI requires `reflect-metadata` and `experimentalDecorators`, adding hidden complexity.

2. **Debuggable**: Factory functions are plain TypeScript — inspectable, breakpointable, stack-traceable.

3. **Zero dependencies**: The container is < 100 lines of code with no external dependencies.

4. **Portable**: Works with any TypeScript configuration. No dependency on decorator support.

5. **Explicit wiring**: The `DefaultModule` makes all registrations visible in one place.

## Alternatives Considered

| Framework | Pros | Cons |
|---|---|---|
| InversifyJS | Mature, feature-rich | Decorator metadata, complex API, large dependency |
| tsyringe | Microsoft-backed | Requires `reflect-metadata`, decorator-dependent |
| Awilix | Proxy-based, no decorators | Large API surface, magic resolution |
| Manual wiring | Simplest | No interface for modules, no singleton caching |

## Consequences

- All service registrations are explicit factory functions.
- `ContainerModule` is the extension point for grouping registrations.
- No runtime reflection or metadata is used.
- Tests can override any registration by calling `register()` after the module.
