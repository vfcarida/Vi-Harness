# Vi-Harness: Basic Agent Quickstart

This example demonstrates how to embed and run the **Vi-Harness** engine in your application.

## What It Demonstrates
1. **Model Agnosticism**: Registering model providers with the `UtilityModelRouter`.
2. **Deny-First Security**: Enforcing file and command policies before side-effects occur.
3. **Evidence-Gated Execution**: Completing tasks through empirical verification rather than model self-reports.

## Running the Example

```bash
# From the repository root:
npx tsx examples/basic-agent/index.ts
```

## Programmatic Overview

```typescript
import { createRuntime, DefaultPolicyEngine, MockModelProvider } from 'vi-harness';

const runtime = createRuntime({
  // configure router, tools, and verification engines
});

const result = await runtime.execute({
  id: 'goal-1',
  description: 'Inspect codebase and apply bug fix',
  constraints: { maxIterations: 10, maxCostDollars: 2.0 },
  // ...
});
```
