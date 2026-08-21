# Operational Runbook & Production Deployment Guide

This runbook describes operational procedures, monitoring setups, deployment profiles, and disaster recovery guidelines for running Vi-Harness in production and CI/CD pipelines.

---

## 1. Deployment Profiles

Vi-Harness supports declarative configuration profiles loaded via `ProfileLoader`:

| Profile | Target Environment | Key Characteristics |
| :--- | :--- | :--- |
| `headless` | Background workers, queue processors | No interactive prompt; automatic human escalation timeout; JSON logging. |
| `ci` | GitHub Actions, GitLab CI | Strict timeout limits; zero network exfiltration; sandbox isolation. |
| `web` | Web / SaaS API backend | HTTP ACP / MCP transport; rate limiting; bearer token authentication. |
| `eval` | Benchmark evaluation runs | Deterministic test clocks; mock/replay providers; metric aggregation. |

### Activating a Profile:
```typescript
import { createRuntime } from 'vi-harness';

const runtime = createRuntime({
  profile: 'headless',
  profilesDir: './profiles',
});
```

---

## 2. Environment Variables Reference

| Variable | Description | Default |
| :--- | :--- | :--- |
| `OPENAI_API_KEY` | API Key for OpenAI / compatible endpoints | `""` |
| `ANTHROPIC_API_KEY` | API Key for Anthropic Claude endpoints | `""` |
| `GEMINI_API_KEY` | API Key for Google Gemini endpoints | `""` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Base endpoint for OTLP traces & metrics | `http://localhost:4318` |
| `OTEL_SERVICE_NAME` | Service name reported in OTLP spans | `vi-harness` |
| `VI_HARNESS_AUDIT_KEY` | HMAC SHA-256 key for signing audit records | Auto-generated random key |
| `VI_HARNESS_STORAGE_PATH` | Path to persistent SQLite database | `.vi-harness/storage.db` |

---

## 3. Distributed Observability & Monitoring

### OpenTelemetry Setup
Vi-Harness includes native zero-SDK OTLP exporter (`OtlpTelemetryExporter`):
- Traces sent to `${OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`.
- Token and latency metrics sent to `${OTEL_EXPORTER_OTLP_ENDPOINT}/v1/metrics`.

### Key Metrics to Alert On:
- `agent.model.latency.ms` > 15,000ms: Model endpoint degradation.
- `agent.model.cost.dollars`: Spending anomaly detection against goal budgets.
- `agent.tool.calls.failure_rate` > 0.20: High tool failure rate indicating environmental issues.
- `agent.iterations.count` approaching `maxIterations`: Agent stalling or cycling.

---

## 4. Disaster Recovery & Rollback

1. **State Recovery**: If an agent process crashes mid-execution, load the session from `SqliteSessionStore` or replay from `session.jsonl`.
2. **Git Rollback**: If agent modifications fail verification or cause unintended state changes, invoke:
   ```typescript
   await gitManager.rollbackCheckpoint(checkpointSha);
   ```
   This safely rolls back agent-committed deltas while preserving pre-existing user unstaged edits.
