# ADR-001: TypeScript as the Implementation Language

**Status:** Accepted  
**Date:** 2024-08-12  
**Decision Makers:** Architecture team

## Context

Vi-Harness is an enterprise-grade, model-agnostic coding-agent harness. The implementation language must support:

- Strong static typing for interface contracts and architectural boundary enforcement
- Native async/await for concurrent model I/O, tool execution, and subagent orchestration
- Rich ecosystem compatibility with LLM provider SDKs, testing frameworks, and observability tools
- Composable interfaces with generics, branded types, and discriminated unions

## Decision

**Use TypeScript on Node.js** as the implementation language and runtime.

## Rationale

1. **Type safety**: Strict mode with `noUncheckedIndexedAccess`, branded types, and `satisfies` enables compile-time enforcement of architectural rules (e.g., domain layer cannot import infrastructure).

2. **Interface-first design**: TypeScript interfaces map directly to the architectural contracts. Generics enable parameterized types like `Id<T>` without runtime overhead.

3. **Async I/O**: Native `async/await` with `Promise<T>` provides clean, composable asynchronous operations — essential for model calls, tool execution, and verification.

4. **Ecosystem**: Every major LLM SDK (OpenAI, Anthropic, Google) has first-class TypeScript support. The testing ecosystem (Vitest) and tooling (ESLint, Prettier) are mature.

5. **Developer availability**: TypeScript is one of the most widely-adopted languages, reducing hiring and onboarding friction.

## Alternatives Considered

| Language | Pros | Cons |
|---|---|---|
| Python | ML ecosystem, fast prototyping | Weak typing, GIL limits concurrency |
| Go | Performance, binary distribution | Verbose interfaces, no generics until recently, no branded types |
| Rust | Memory safety, performance | High learning curve, slow iteration, ecosystem gaps for LLM SDKs |

## Consequences

- All source code is TypeScript with strict compiler options.
- Node.js >= 20 is required as the runtime.
- ESM (`"type": "module"`) is the module system.
- `.js` extensions are required in import paths (NodeNext resolution).
