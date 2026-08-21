# Troubleshooting Guide

This guide covers common error scenarios, diagnostic steps, and solutions when operating Vi-Harness.

---

## 1. Model Provider & API Issues

### `MODEL_RATE_LIMITED` (HTTP 429)
- **Symptom**: Agent pauses or throws rate limit errors during intensive iteration loops.
- **Cause**: Exceeded requests-per-minute (RPM) or tokens-per-minute (TPM) limit on your LLM API key.
- **Remedy**:
  - The runtime automatically applies exponential backoff with full jitter.
  - For high concurrency, configure fallback providers in `UtilityModelRouter` or use `ArchitectExecutor` with a fast editor model.
  - Enable prefix caching via `PrefixCachingCompiler` to reduce prompt token throughput.

### `MODEL_AUTHENTICATION_FAILED` (HTTP 401/403)
- **Symptom**: Immediate `HarnessError` with category `MODEL` on first iteration.
- **Remedy**:
  - Verify environment variables: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GEMINI_API_KEY`.
  - Check that custom base URLs (`ANTHROPIC_BASE_URL`, `OPENAI_BASE_URL`) point to valid endpoints.

---

## 2. Context & Token Budget Issues

### `CONTEXT_BUDGET_EXCEEDED`
- **Symptom**: Agent cannot fit context within model window or configured tier limit.
- **Remedy**:
  - Enable the multi-tier compaction pipeline in `DefaultContextCompiler`.
  - Use `ContextCollapser` to collapse older turn history into high-density summaries.
  - Leverage `SourceCodeIndexer` repository maps instead of loading full source files into context.

---

## 3. SQLite Storage & Session Locks

### `SQLITE_BUSY: database is locked`
- **Symptom**: Concurrent worker or subagent processes report database locks on `.vi-harness/storage.db`.
- **Remedy**:
  - Ensure WAL mode (Write-Ahead Logging) is enabled in `SqliteStore` configuration (`pragma journal_mode = WAL;`).
  - Vi-Harness defaults to WAL mode with 5000ms busy timeout for concurrent multi-process access.

---

## 4. Policy Engine & Tool Permission Denials

### `POLICY_DENIED`
- **Symptom**: Tool execution aborted with policy rejection.
- **Remedy**:
  - Check `CommandSanitizer` and `DefaultPolicyEngine` logs.
  - If a command accesses paths outside the workspace boundary, configure allowed paths in `PathRestrictionRule`.
  - In non-interactive/CI environments, ensure destructive commands match allowed patterns or are pre-approved.

---

## 5. Diagnostic Logging & Traces

To enable verbose debug logging and JSONL execution traces:
```bash
export DEBUG=vi-harness:*
export LOG_LEVEL=debug
npx tsx examples/basic-agent/index.ts
```

Traces are automatically formatted and stored in `.vi-harness/traces/` or exported via OTLP to `http://localhost:4318`.
