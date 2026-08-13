# ADR-003: Standardized Error Model

**Status:** Accepted  
**Date:** 2024-08-12  
**Decision Makers:** Architecture team

## Context

An enterprise agent runtime needs structured, machine-parseable errors for:
- Automated triage and alerting
- Structured logging and observability
- Cause-chain analysis for debugging
- Policy decisions (e.g., retry on transient, escalate on policy denial)

## Decision

**All domain errors extend `HarnessError`**, a structured error class carrying:

| Field | Type | Purpose |
|---|---|---|
| `code` | `ErrorCode` (enum) | Specific failure mode |
| `category` | `ErrorCategory` (enum) | Broad domain area |
| `message` | `string` | Human-readable description |
| `context` | `Record<string, unknown>` | Structured diagnostic metadata |
| `timestamp` | `Date` | When the error occurred |
| `cause` | `Error?` | Chained root cause |

## Design

```typescript
throw new HarnessError({
  code: ErrorCode.MODEL_TIMEOUT,
  category: ErrorCategory.MODEL,
  message: 'Request timed out after 30s',
  context: { provider: 'openai', timeoutMs: 30000 },
  cause: originalError,
});
```

### Error categories:
`CONFIGURATION` · `MODEL` · `TOOL` · `POLICY` · `STATE` · `VERIFICATION` · `INFRASTRUCTURE` · `CONTEXT` · `RUNTIME`

### Consistency guarantee:
Every `ErrorCode` has a mapped `ErrorCategory` in `ERROR_CODE_CATEGORY`. Tests enforce this mapping is exhaustive.

## Rationale

1. **Machine-parseable**: `code` and `category` enable automated routing (retry, escalate, abort).
2. **Observable**: `toJSON()` serialization fits structured logging pipelines.
3. **Debuggable**: `cause` chaining preserves the full error chain.
4. **Extensible**: New codes and categories can be added without changing the error class.

## Consequences

- Infrastructure and domain code must throw `HarnessError` for expected failures.
- Unexpected failures (bugs) may still throw raw `Error`.
- All error codes must be registered in `ERROR_CODE_CATEGORY`.
