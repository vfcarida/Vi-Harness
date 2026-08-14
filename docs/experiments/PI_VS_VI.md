# Experiment: Pi Harness vs. Vi-Harness

> **Objective:** Empirically measure the effect of the agent harness independently from the underlying model.

---

## 1. Experimental Design

In standard coding agent evaluations, model capabilities are frequently conflated with harness capabilities. This experiment isolates the **harness as the primary independent variable** while strictly controlling all other parameters.

```
┌─────────────────────────────────────────────────────────────┐
│                     CONTROL VARIABLES                       │
│  • Model: Identical provider, model ID, and version         │
│  • Model Config: Temperature (0.0), sampling parameters     │
│  • Benchmark Task: Description, system prompt, repo URL     │
│  • Repository State: Pinned initial Git commit SHA          │
│  • Tools: Identical tool definitions and capabilities       │
│  • Environment: OS, Node.js runtime, workspace isolation    │
│  • Constraints: Max iterations, token budget, wall timeout  │
│  • Evaluation Criteria: Empirical verification & acceptance │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    INDEPENDENT VARIABLE                     │
│               Harness Architecture & Runtime                │
│                                                             │
│         Pi Harness                     Vi-Harness           │
│  (Transcript Accumulation)     (Compiled Context + FSM)     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    DEPENDENT VARIABLES                      │
│  • Task Success Rate (Empirical Verification Pass Rate)     │
│  • Total & Peak Context Tokens Consumed                     │
│  • Cost in USD (Mean, Median, p95, Distribution)            │
│  • Latency & Duration (Mean, Median, p95)                   │
│  • Iterations to Completion                                 │
│  • Critical Memory Retention Rate                           │
│  • Regressions Detected & Oscillation Halts                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Core Hypotheses

| ID | Hypothesis | Metric | Rationale |
|---|---|---|---|
| **H1: Context Bloat** | Vi-Harness achieves sublinear context growth, reducing peak context tokens by $\ge 50\%$ compared to Pi on tasks $\ge 25$ iterations. | `peakContextTokens`, `totalTokens` | Vi-Harness's 6-stage Context Compiler deduplicates, ranks, and compresses context per-iteration. |
| **H2: Critical Memory** | Vi-Harness achieves $100\%$ retention of mandatory domain constraints across 50+ iteration horizons, whereas Pi experiences memory loss due to sliding-window truncation. | `criticalMemoryRetention` | Vi-Harness pins security rules, user instructions, and architecture facts as non-evictable invariants. |
| **H3: False Positive Elimination** | Vi-Harness reduces false-positive completion claims to $0\%$. | `falsePositivePassRate` | Vi-Harness requires exit-code evidence from `VerificationEngine`, prohibiting completion based on model self-report. |
| **H4: Early Halting on Failure** | Vi-Harness incurs lower cost on unresolvable tasks by terminating early on oscillation or repetition. | `costOnFailure`, `iterationsOnFailure` | Vi-Harness's `TerminationController` evaluates `LoopFingerprint` cycles rather than spinning until turn limits. |

---

## 3. Protocol & Benchmark Architecture

### A. Execution Pipeline
1. **Workspace Isolation:** For each trial, a clean temporary workspace is prepared by `WorkspaceIsolation` and checked out to the exact `initialCommit`.
2. **Deterministic Seed:** A unique pseudo-random seed is provided to each run for reproducibility.
3. **Adapter Execution:** The selected `HarnessAdapter` (`ViHarnessAdapterRunner` or `PiHarnessAdapterRunner`) executes the task until terminal state.
4. **Result Capture:** All telemetry, test executions, token usages, diffs, and termination reasons are recorded into a `BenchmarkRun` structure.
5. **Statistical Aggregation:** `StatisticalCalculator` computes distribution metrics across repeated runs ($N \ge 5$ per scenario).

### B. Metric Recording Schema
Each trial generates an immutable `BenchmarkRun` record:
```typescript
interface BenchmarkRun {
  readonly runId: string;
  readonly taskId: string;
  readonly harness: string;             // 'Pi' | 'Vi-Harness'
  readonly harnessVersion: string;
  readonly model: string;
  readonly repositoryCommit: string;
  readonly runIndex: number;
  readonly startedAt: Date;
  readonly completedAt: Date;
  readonly durationMs: number;
  readonly success: boolean;
  readonly testsPassed: number;
  readonly testsFailed: number;
  readonly regressions: number;
  readonly iterationCount: number;
  readonly toolCalls: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
  readonly estimatedCostUSD: number;
  readonly terminationReason: string;
  readonly error?: string;
}
```

---

## 4. Current Implementation Status

| Component | Status | Location |
|---|---|---|
| **Benchmark Runner Engine** | ✅ Implemented | `src/infra/eval/default-benchmark-runner.ts` |
| **Vi-Harness Adapter** | ✅ Implemented | `src/infra/eval/vi-harness-adapter-runner.ts` |
| **Pi Harness Adapter** | ✅ Implemented | `src/infra/eval/pi-harness-adapter-runner.ts` |
| **Workspace Isolation** | ✅ Implemented | `src/infra/eval/workspace-isolation.ts` |
| **Statistical Calculator** | ✅ Implemented | `src/infra/eval/statistical-calculator.ts` |
| **Markdown / JSON Reporting** | ✅ Implemented | `src/infra/eval/markdown-report-generator.ts` |
| **Synthetic Context Benchmark** | ✅ Completed | `src/infra/eval/context-benchmark-runner.ts` |
| **Live Multi-Model Trials** | 📋 Planned | Ready for execution via `benchmark-cli.ts` |

---

## 5. Preliminary Findings: Context-Efficiency Benchmark

The context-efficiency sub-experiment evaluated **Naive Accumulation**, **Pi-style Compaction**, and **Vi-Harness Context Compiler** across controlled synthetic long-horizon trajectories (10, 25, 50, 100 iterations) with injected adversarial noise:

| Strategy | Token Savings vs Naive | Peak Context Scaling | Critical Memory Retention |
|---|---|---|---|
| **Vi-Harness Context Compiler** | **85.0% – 86.2%** | **Bounded / Sublinear** | **100.0% (Zero loss)** |
| **Pi-style Compaction Baseline** | 92.5% | Bounded (aggressive loss) | **0.0% (Complete loss)** |
| **Naive Accumulation Baseline** | 0.0% (Baseline) | Linear $O(N)$ Unbounded | 100.0% (High bloat) |

*Full data and methodology documented in `docs/architecture/BENCHMARKING.md` and generated reports.*

---

## 6. Live Benchmark Execution Plan

### Target Task Matrix
1. **Small Bug (Regression & Fix):** 1–5 file edits, existing unit test suite.
2. **Medium Refactor:** API signature upgrade across 5–15 files.
3. **Multi-File Feature:** Implementation of new module against acceptance test suite.
4. **Long-Horizon Debugging:** Flaky test root-cause analysis requiring 25+ observation/action cycles.

### Execution Command
```bash
# Run full benchmark comparison across adapters
npm run benchmark -- --suite standard-suite --adapters Vi-Harness,Pi --runs 5 --output benchmark-results/
```

*Note: In accordance with scientific integrity standards, live model comparative tables will be published only after full multi-trial execution on pinned public benchmark repositories.*
