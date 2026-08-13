# ADR-004: Four-Tier Context Architecture

**Status:** Accepted  
**Date:** 2024-08-12  
**Decision Makers:** Architecture team

## Context

LLM context windows are finite and expensive. Naively accumulating all conversation history leads to:
- Token budget exhaustion
- Irrelevant context diluting important signals
- Increased latency and cost
- Reduced model performance on long contexts

The architectural principle: **"Context is compiled, not accumulated."**

## Decision

**Implement a four-tier context hierarchy** where each tier has distinct characteristics:

| Tier | Name | Contents | Volatility |
|---|---|---|---|
| **L0** | Hot Context | Current task, current files, current hypothesis, current failure | Changes every iteration |
| **L1** | Working Memory | Current plan, active decisions, recent evidence | Changes per task phase |
| **L2** | Episodic Memory | Previous attempts, failed approaches, debugging trajectories | Persists across retries |
| **L3** | Repository Memory | Architecture, domain constraints, coding standards | Rarely changes |

## Design

The `ContextCompiler` assembles context for each model call by:
1. Always including L0 (current state)
2. Selectively including L1 based on the current phase
3. Retrieving from L2 only when relevant (semantic search via `MemoryStore`)
4. Including L3 only when the task touches architectural boundaries

The total context sent to the model is bounded by a token budget.

## Rationale

1. **Cost efficiency**: Only the minimum necessary context is sent to the model.
2. **Relevance**: Higher tiers are only included when they add signal.
3. **Scalability**: L2 and L3 can grow unboundedly without affecting per-call cost.
4. **Separation of concerns**: Each tier has a different lifecycle and storage strategy.

## Consequences

- Context entries carry a `tier` field (`ContextTier` enum).
- `ContextCompiler.compile()` accepts a token budget and tier selection.
- `MemoryStore` handles retrieval-based access for L2/L3.
- `ContextStore` handles direct CRUD for L0/L1.
