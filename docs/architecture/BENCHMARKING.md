# Benchmarking — BENCHMARKING.md

> "We evaluate the harness independently from the underlying model."

## Intent

A benchmark that controls only the model but not the harness cannot attribute performance differences to the model. Vi-Harness was designed to be the *harness* variable in a controlled experiment.

The benchmarking framework provides the infrastructure for that experiment: a shared task specification, isolated workspaces, pluggable harness adapters, repeated runs, and per-run metric collection (not just averages).

---

## Experimental Design

The controlled variables in a Pi vs Vi-Harness experiment:

| Variable | How it is held constant |
|---|---|
| Model | Same `ModelConfiguration.providerId` + `modelId` |
| Model version | Same `ModelConfiguration.modelVersion` |
| System prompt / task description | Same `BenchmarkTask.description` + `systemPrompt` |
| Repository | Same `BenchmarkTask.repositoryUrl` + `initialCommit` |
| Tools | Same `HarnessConfiguration.tools` |
| Environment | Same OS, Node.js version, container state |
| Token budget | Same `BenchmarkBudget.maxTokens` + `maxCostUSD` |
| Iteration limit | Same `BenchmarkBudget.maxIterations` |
| Evaluation criteria | Same `SuccessCriteria` + `EvidenceCriteria` |
| Timeout | Same `TimeoutConfig` |

**Independent variable:** Harness (`PiHarnessAdapterRunner` vs `ViHarnessAdapterRunner`).

---

## Core Interfaces

### `HarnessAdapter`

**Interface:** `src/core/interfaces/harness-adapter.ts`

**Responsibility:** Pluggable harness execution unit. Receives a `BenchmarkTask` and an isolated `HarnessExecutionContext`, executes the task, and returns a structured `HarnessExecutionResult`.

```typescript
interface HarnessAdapter {
  readonly name:    string;    // 'Vi-Harness' | 'Pi'
  readonly version: string;
  execute(
    task:    BenchmarkTask,
    context: HarnessExecutionContext,
  ): Promise<HarnessExecutionResult>;
}
```

**`HarnessExecutionContext`:**
```typescript
{
  runIndex:       number;          // 0-indexed trial number
  seed:           string;          // deterministic seed for reproducibility
  workspacePath:  string;          // isolated temp workspace root
  modelConfig:    ModelConfiguration;
  environment:    BenchmarkEnvironment;
  initialCommit:  string;          // Git baseline commit
  idFactory:      IdFactory;
  clock:          Clock;
}
```

**`HarnessExecutionResult`:**
```typescript
{
  success:          boolean;
  finalState:       string;          // agent phase or harness-specific state
  changedFiles:     string[];        // agent-owned modified files
  finalDiff:        string;          // unified diff relative to baseline
  tests: {
    total:          number;
    passed:         number;
    failed:         number;
    passRate:       number;
  };
  regressions:      number;
  iterations:       number;
  toolCalls:        number;
  tokens: {
    promptTokens:   number;
    completionTokens: number;
    totalTokens:    number;
  };
  estimatedCost:    number;          // USD
  duration:         number;          // ms
  terminationReason: string;
  error?:           string;          // populated if execution crashed
}
```

---

### `BenchmarkRunner`

**Interface:** `src/core/interfaces/benchmark-runner.ts`

**Responsibility:** Orchestrate repeated runs of one or more tasks across one or more harness adapters. Generate both machine-readable JSON and human-readable Markdown reports.

```typescript
interface BenchmarkRunner {
  runTask(task, options, adapters?): Promise<BenchmarkResult | BenchmarkTaskComparison>
  runSuite(suite, options, adapters?): Promise<BenchmarkReport | BenchmarkSuiteResult>
  generateMachineReadableReport(report): string   // JSON
  generateMarkdownSummary(result): string          // Markdown
}
```

---

## Domain Types

### `BenchmarkTask`

The unit of benchmark work. Shared identically across all harnesses:

```typescript
{
  id:              string;
  name:            string;
  description:     string;          // the task given to the agent
  category:        BaselineScenarioCategory;  // SMALL_BUG | MEDIUM_REFACTOR | ...
  repositoryUrl:   string;
  initialCommit:   string;          // pinned starting commit
  systemPrompt?:   string;
  budget:          BenchmarkBudget;
  timeout:         TimeoutConfig;
  successCriteria: SuccessCriteria;
  evidenceCriteria: EvidenceCriteria;
  regressionCriteria: RegressionCriteria;
  metadata?:       Record<string, unknown>;
}
```

### `BenchmarkRun` (per harness, per trial)

```typescript
{
  runId:             string;
  taskId:            string;
  harness:           string;
  harnessVersion:    string;
  model:             string;
  modelVersion?:     string;
  repositoryCommit:  string;
  runIndex:          number;
  startedAt:         Date;
  completedAt:       Date;
  durationMs:        number;
  success:           boolean;
  testsPassed:       number;
  testsFailed:       number;
  regressions:       number;
  iterationCount:    number;
  toolCalls:         number;
  inputTokens:       number;
  outputTokens:      number;
  totalTokens:       number;
  estimatedCostUSD:  number;
  terminationReason: string;
  error?:            string;
}
```

### `BenchmarkResult` (aggregate over N runs)

```typescript
{
  taskId:         string;
  harness:        string;
  runs:           BenchmarkRun[];          // all individual runs (not just averages)
  successRate:    number;
  meanDurationMs: number;
  medianDurationMs: number;
  p95DurationMs:  number;
  meanCostUSD:    number;
  medianCostUSD:  number;
  p95CostUSD:     number;
  meanIterations: number;
  medianIterations: number;
  costDistribution: number[];              // per-run costs
  iterationDistribution: number[];         // per-run iteration counts
}
```

**Design principle:** Individual run records are always preserved. Aggregate statistics are computed from them — never replacing them.

---

## Implementations

### `DefaultBenchmarkRunner`

**File:** `src/infra/eval/default-benchmark-runner.ts`

**Execution sequence for `runTask()`:**

```
BenchmarkTask + adapters
      │
      ▼
For each adapter:
  For each trial (0..runsPerTask-1):
    │
    ├─ WorkspaceIsolation.createIsolatedWorkspace()
    │    └─ Clone or copy repo to temp dir
    │
    ├─ HarnessAdapter.execute(task, context)
    │    └─ Full harness execution in isolated workspace
    │
    ├─ Record BenchmarkRun
    │
    └─ WorkspaceIsolation.cleanup() (unless preserveWorkspaces: true)
      │
      ▼
StatisticalCalculator.computeAggregates(runs)
      │
      ▼
BenchmarkResult (or BenchmarkTaskComparison for multi-adapter)
```

### `StatisticalCalculator`

**File:** `src/infra/eval/statistical-calculator.ts`

Computes: mean, median, p95, standard deviation, min, max for latency, cost, and iteration count distributions.

### `WorkspaceIsolation`

**File:** `src/infra/eval/workspace-isolation.ts`

Creates a fresh isolated workspace for each trial run. Ensures that run N cannot pollute run N+1 through shared filesystem state.

### `MarkdownReportGenerator`

**File:** `src/infra/eval/markdown-report-generator.ts`

Generates human-readable Markdown from a `BenchmarkSuiteResult` or `BenchmarkReport`. Includes per-harness tables, success rates, cost distributions, and task-level comparison.

---

## Harness Adapters

### `ViHarnessAdapterRunner`

**File:** `src/infra/eval/vi-harness-adapter-runner.ts`

Wraps `ViHarness` (`src/infra/adapter/vi-harness-adapter.ts`) for benchmark execution. Translates:
```
BenchmarkTask → Goal → DefaultAgentRuntime.execute() → ExecutionResult → HarnessExecutionResult
```

Wires real `DefaultGitManager`, `DefaultEvidenceStore`, and `DefaultVerificationEngine` for each run.

### `PiHarnessAdapterRunner`

**File:** `src/infra/eval/pi-harness-adapter-runner.ts`

Adapter wrapper for Pi harness execution. Implements the same `HarnessAdapter` interface, enabling direct side-by-side comparison in `runTask()` with both adapters.

---

## Context-Efficiency Benchmark

A separate benchmark compares three context strategies across synthetic long-horizon tasks.

**File:** `src/infra/eval/context-benchmark-runner.ts`

**Strategies compared:**

| Strategy | Description |
|---|---|
| Naive accumulation | All tool outputs appended to a growing message list |
| Pi-style compaction | Sliding window: keep last 6 turns, summarize earlier turns |
| Vi-Harness compiler | 6-stage compilation pipeline with deduplication and invariant pinning |

**Task horizons:** 10, 25, 50, and 100 iterations.

**Adversarial injections:**
- Repeated tool output (recurring linter warnings)
- Irrelevant verbose logs (40+ test assertions, memory metrics)
- Stale hypotheses (superseded by later observations)
- Important architectural decisions (must survive to end)
- Contradictory observations (transient failures)
- Large files (3,500–8,000 token schemas)

**Metrics collected:**
- `contextTokens` at each iteration
- `cumulativeTokens` across all iterations
- `peakContext` (maximum single-call token count)
- `compressionRatio` (Vi-Harness compiler only)
- `criticalMemoryRetained` (boolean per iteration)
- `taskSuccess` (did the critical memory survive to iteration N?)

**CLI runner:** `npm run benchmark:context`

**Report format:** JSON (machine-readable) + Markdown summary. Output to `benchmark-results/`.

---

## Report Metadata Requirements

Every benchmark result must carry:

```typescript
{
  harness:        string;    // 'Vi-Harness' | 'Pi'
  harnessVersion: string;
  model:          string;
  modelVersion?:  string;
  tools:          string[];
  policy:         string;
  contextStrategy: string;
  environment:    BenchmarkEnvironment;
  taskId:         string;
  repositoryCommit: string;
  startedAt:      Date;
  completedAt:    Date;
}
```

**Design principle:** Single opaque "agent scores" without full metadata are explicitly forbidden. A result without harness + model + commit + environment context is not reproducible and should not be published.

---

## Known Limitations

| Limitation | Impact |
|---|---|
| No live Pi harness benchmark results yet | Pi vs Vi-Harness comparison is not yet measured |
| `WorkspaceIsolation` uses temp directories | Temp directory cleanup can fail on Windows |
| Context benchmark uses synthetic trajectories | Real-world trajectories may behave differently |
| Statistical calculator assumes normal distribution | p95 may be imprecise for small sample sizes (< 10 runs) |
| No benchmark result persistence | Results are not stored in a database; only written to `benchmark-results/` |

---

## Future Design

- **Live benchmark runs**: Automated Pi vs Vi-Harness runs on a public coding task dataset.
- **SWE-bench compatibility**: Adapter to run Vi-Harness on SWE-bench task format.
- **Benchmark result persistence**: Store all run records in SQLite for longitudinal analysis.
- **Confidence intervals**: Report 95% confidence intervals, not just point estimates.
- **Regression detection between runs**: Alert when a new harness version performs significantly worse on a task.
