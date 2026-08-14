# Verification and Evidence — VERIFICATION.md

> "The agent does not self-assess. It verifies through external signals."

## Intent

Verification is the mechanism by which the agent converts external process outcomes (test results, lint output, build status) into structured, queryable evidence. This evidence drives state transitions and informs the context compiler.

**Three properties that distinguish verification in Vi-Harness from self-reporting:**

1. **Completion requires empirical process evidence.** A model statement ("I have completed the task") is not evidence. An exit code of 0 from a test runner is.
2. **Missing verifiers produce `INCONCLUSIVE`, never `PASS`.** If a verification command is not found or the test suite does not exist, the result is explicitly inconclusive — not silently successful.
3. **Regression detection is automatic.** If a previously-passing check now fails, the outcome is `REGRESSION` rather than `FAIL` — and this triggers a distinct terminal state.

---

## `VerificationEngine` Interface

**Responsibility:** Execute one or more verification checks against the current workspace state. Return a structured `VerificationResult`.

**Interface:** `src/core/interfaces/verification-engine.ts`

**Methods:**
```typescript
verify(target: VerificationTarget, profile?: VerificationProfile): Promise<VerificationResult>
runSuite(suite: VerificationSuite, taskId: TaskId): Promise<VerificationResult>
```

**`VerificationTarget`:**
```typescript
{
  type:      string;                      // 'file' | 'test-suite' | 'build' | 'security'
  path?:     string;
  content?:  string;
  taskId?:   TaskId;
  metadata?: Record<string, unknown>;
}
```

**Invariants:**
- `verify()` must never return `VerificationStatus.PASSED` for a check that did not execute successfully.
- `runSuite()` aggregates results from all checks in the suite and returns a composite status.

---

## Verification Profiles

The `VerificationProfile` enum selects which checks are included:

| Profile | Checks included |
|---|---|
| `FAST` | Unit tests only |
| `STANDARD` | Unit tests + typecheck + lint |
| `FULL` | All checks including integration tests and coverage |
| `SECURITY` | Security scan + static analysis |
| `PRE_RELEASE` | All checks + security + coverage threshold |

---

## Verification Structures

### `VerificationCheck`

A single executable check:
```typescript
{
  checkId:        string;
  name:           string;
  command:        string;       // shell command to execute
  tool?:          string;       // optional tool name override
  category:       'unit-test' | 'integration-test' | 'typecheck' | 'linter'
                | 'static-analysis' | 'security-scan' | 'coverage' | 'performance';
  scope:          'file' | 'module' | 'repository';
  timeoutMs?:     number;
  expectedResult?: string;      // expected stdout substring (optional)
  affectedFiles?:  string[];
}
```

### `VerificationCheckExecution`

Execution artifact (what actually ran):
```typescript
{
  id:             string;
  checkId:        string;
  command:        string;
  actualResult:   string;
  stdoutArtifact: string;
  stderrArtifact: string;
  exitCode:       number;
  durationMs:     number;
  timestamp:      Date;
  status:         VerificationStatus;
}
```

### `VerificationResult`

```typescript
{
  status:           VerificationStatus;  // see below
  summary:          string;
  evidenceIds:      EvidenceId[];
  taskId:           TaskId;
  verifiedAt:       Date;
  checkId?:         string;
  suiteId?:         string;
  durationMs:       number;
  confidence:       number;              // 0.0 to 1.0
  scope:            string;
  affectedFiles:    string[];
  checkExecutions?: VerificationCheckExecution[];
  structuredOutput?: Record<string, unknown>;
  rawArtifactRef?:  string;
  details?:         Record<string, unknown>;
}
```

### `VerificationStatus` values

| Status | When |
|---|---|
| `PASSED` | All checks passed with exit code 0 |
| `FAILED` | One or more checks failed |
| `WARNING` | Checks passed with warnings |
| `INCONCLUSIVE` | Command not found or could not execute |
| `SKIPPED` | Check was explicitly skipped |
| `ERROR` | Internal error in the verification engine itself |

---

## `DefaultVerificationEngine` — Implementation

**File:** `src/infra/verification/default-verification-engine.ts`

### Execution sequence

```
VerificationTarget + profile
          │
          ▼
  Select VerificationSuite based on profile
          │
          ▼
  For each VerificationCheck in suite:
      ├─ Execute command via ToolExecutor (run_command)
      ├─ Capture stdout, stderr, exit code, duration
      ├─ Determine VerificationStatus
      └─ Create VerificationCheckExecution record
          │
          ▼
  AcceptanceEvaluator.evaluate(executions, policy)
          │
          ▼
  Build VerificationResult
          │
          ▼
  Record Evidence in EvidenceStore
```

### Missing command handling

If a check's command is not found (exit code 127 on Unix or `ENOENT`):
- Status → `INCONCLUSIVE` (not `PASSED`)
- Evidence outcome → `INCONCLUSIVE`
- The iteration continues, but the agent is not credited with passing verification

---

## `AcceptanceEvaluator`

**File:** `src/infra/verification/acceptance-evaluator.ts`

**Responsibility:** Evaluate whether a set of verification results satisfies the configured `AcceptancePolicy` and return an acceptance decision.

**`AcceptancePolicy` fields:**
```typescript
{
  minPassRate:             number;   // minimum fraction of checks that must pass
  requiredCategories:      string[]; // categories that must have at least one PASSED check
  zeroRegressions:         boolean;
  allowInconclusive:       boolean;
}
```

**Failure modes:**
- Pass rate below threshold → acceptance fails.
- A required category has no passing check → acceptance fails.
- `zeroRegressions: true` and any `REGRESSION` evidence exists → acceptance fails.

---

## `EvidenceStore` Interface

**Responsibility:** Persist and query structured `Evidence` records produced by verification.

**Interface:** `src/core/interfaces/evidence-store.ts`

**Methods:**
```typescript
record(evidence: Evidence): Promise<void>
get(id: EvidenceId): Promise<Evidence | undefined>
query(filter: EvidenceFilter): Promise<ReadonlyArray<Evidence>>
listForTask(taskId: TaskId): Promise<ReadonlyArray<Evidence>>
clear(): Promise<void>
```

**`Evidence` record:**
```typescript
{
  id:            EvidenceId;
  taskId:        TaskId;
  type:          EvidenceType;      // TEST_RESULT | LINT_RESULT | BUILD_RESULT | RUNTIME_OUTPUT | DIFF | VERIFICATION | HUMAN_FEEDBACK
  outcome:       EvidenceOutcome;   // PASS | FAIL | WARNING | INCONCLUSIVE | REGRESSION
  summary:       string;
  data:          Record<string, unknown>;   // check-specific structured data
  createdAt:     Date;
  pass:          boolean;
  checkId?:      string;
  suiteId?:      string;
  confidence:    number;            // 0.0 to 1.0
  affectedFiles: string[];
  rawArtifactRef?: string;
}
```

**Invariants:**
- Evidence is append-only. Records are never mutated or deleted during a task run.
- `REGRESSION` evidence is flagged as a mandatory invariant in the context compiler — it is never omitted.

---

## Evidence → State Transition

Evidence produced in Phase 8 drives the state transition in Phase 9:

| Evidence outcome | State event emitted |
|---|---|
| `PASS` (acceptance policy satisfied) | `VERIFICATION_PASSED` → `DONE` |
| `FAIL` | `VERIFICATION_FAILED` → `REPAIR` |
| `REGRESSION` | `REGRESSION_FOUND` → `REGRESSION_DETECTED` (terminal) |
| `INCONCLUSIVE` | No automatic transition; agent may re-attempt verification |

---

## `EvidenceAggregator` and Contradiction Resolution

**File:** `src/infra/evidence/` (aggregator and contradiction resolver)

When multiple evidence records conflict (e.g., one check passes, another fails for the same file), the `EvidenceAggregator` applies a resolution strategy:

1. `REGRESSION` evidence overrides all other outcomes for the same check.
2. `FAIL` overrides `INCONCLUSIVE`.
3. `PASS` and `FAIL` for the same check in the same iteration → `FAIL` wins (conservative).

**The `ContradictoryEvidenceResolver`** detects and flags evidence conflicts for inclusion in the context compiler's mandatory invariants.

---

## Known Limitations

| Limitation | Impact |
|---|---|
| Verification commands are executed via `run_command` | Subject to the same security constraints as other commands |
| No baseline check registry persisted across runs | Regression detection only works within a single execution |
| `VerificationEngine` does not currently parse test output formats | Test counts (`passed`, `failed`) are extracted from exit codes only |
| Coverage threshold enforcement not yet implemented | `PRE_RELEASE` profile exists but threshold check is not wired |

---

## Future Design

- **Structured test output parsing**: Parse JUnit XML, TAP, pytest output for per-test pass/fail counts.
- **Persistent baseline registry**: Store baseline check results in `CheckpointStore` for cross-run regression detection.
- **Language-agnostic profiles**: Python (pytest + mypy + ruff), Go (go test + golangci-lint), Rust (cargo test + clippy).
- **Coverage threshold enforcement**: `PRE_RELEASE` profile enforces a configurable line coverage minimum.
- **Parallel check execution**: Run non-conflicting checks concurrently within a suite.
