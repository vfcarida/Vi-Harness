# Vi-Harness Official Benchmark Evaluation Report

> **Experimental Design**: Isolates the agent harness as the primary independent variable
> holding model, task, tools, timeout, budget, and workspace environment constant.

---

## 1. Experiment Control Parameters

- **Suite**: `Canonical Harness Baseline Evaluation Suite v1` (`suite-baseline-v1`)
- **Model**: `openai/gpt-4o` (Temperature: `0.2`)
- **Trials Per Task**: `3` repeated runs per harness
- **Reproducibility Seed**: `reproducible-seed-9876`
- **Environment**: OS `win32` | Node `v24.16.0` | Isolated Workspaces: `true`
- **Generated At**: `2026-08-13T19:32:07.587Z`

---

## 2. Executive Comparison: Pi vs Vi-Harness

| Harness | Version | Runs | Success Rate | Mean Cost | Median Cost | P95 Cost | Mean Iter | Median Iter | P95 Iter | Mean Latency | Median Latency | P95 Latency |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Vi-Harness** | `0.1.0-vi-harness` | 21 | 100.0% | $0.0005 | $0.0005 | $0.0005 | 5.0 | 5.0 | 5.0 | 199ms | 196ms | 224ms |
| **Pi** | `0.1.0-pi-harness` | 21 | 100.0% | $0.0604 | $0.0635 | $0.0635 | 3.9 | 4.0 | 4.0 | 80ms | 80ms | 80ms |

---

## 3. Token Consumption Distributions

| Harness | Prompt Tokens (Mean / Med / P95) | Completion Tokens (Mean / Med / P95) | Total Tokens (Mean / Med / P95) | StdDev Total Tokens |
| :--- | :--- | :--- | :--- | :--- |
| **Vi-Harness** | 443 / 444 / 505 | 134 / 133 / 139 | 577 / 583 / 636 | 33.1 |
| **Pi** | 18771 / 19800 / 19800 | 1350 / 1400 / 1400 | 20121 / 21200 / 21200 | 2707.2 |

---

## 4. Task-by-Task Comparison Breakdown

| Task ID | Name | Category | Harness | Success | Mean Cost | Median Cost | P95 Cost | Mean Iter | P95 Iter | Mean Latency |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `task-001-small-bug` | Small Bug Fix | `SMALL_BUG` | **Vi-Harness** | 100% | $0.0005 | $0.0005 | $0.0005 | 5.0 | 5.0 | 223ms |
| `task-001-small-bug` | Small Bug Fix | `SMALL_BUG` | **Pi** | 100% | $0.0420 | $0.0420 | $0.0420 | 3.0 | 3.0 | 80ms |
| `task-002-medium-feature` | Medium Feature Implementation | `MEDIUM_FEATURE` | **Vi-Harness** | 100% | $0.0005 | $0.0005 | $0.0005 | 5.0 | 5.0 | 187ms |
| `task-002-medium-feature` | Medium Feature Implementation | `MEDIUM_FEATURE` | **Pi** | 100% | $0.0635 | $0.0635 | $0.0635 | 4.0 | 4.0 | 80ms |
| `task-003-multi-file-refactor` | Multi-File Refactoring | `MULTI_FILE_REFACTOR` | **Vi-Harness** | 100% | $0.0005 | $0.0005 | $0.0005 | 5.0 | 5.0 | 208ms |
| `task-003-multi-file-refactor` | Multi-File Refactoring | `MULTI_FILE_REFACTOR` | **Pi** | 100% | $0.0635 | $0.0635 | $0.0635 | 4.0 | 4.0 | 80ms |
| `task-004-test-repair` | Flaky / Broken Test Repair | `TEST_REPAIR` | **Vi-Harness** | 100% | $0.0005 | $0.0005 | $0.0005 | 5.0 | 5.0 | 193ms |
| `task-004-test-repair` | Flaky / Broken Test Repair | `TEST_REPAIR` | **Pi** | 100% | $0.0635 | $0.0635 | $0.0635 | 4.0 | 4.0 | 80ms |
| `task-005-long-debugging-task` | Long-Horizon Memory Debugging | `LONG_DEBUGGING_TASK` | **Vi-Harness** | 100% | $0.0005 | $0.0005 | $0.0005 | 5.0 | 5.0 | 191ms |
| `task-005-long-debugging-task` | Long-Horizon Memory Debugging | `LONG_DEBUGGING_TASK` | **Pi** | 100% | $0.0635 | $0.0635 | $0.0635 | 4.0 | 4.0 | 80ms |
| `task-006-security-sensitive-change` | Security-Sensitive Permission Modification | `SECURITY_SENSITIVE_CHANGE` | **Vi-Harness** | 100% | $0.0005 | $0.0005 | $0.0005 | 5.0 | 5.0 | 203ms |
| `task-006-security-sensitive-change` | Security-Sensitive Permission Modification | `SECURITY_SENSITIVE_CHANGE` | **Pi** | 100% | $0.0635 | $0.0635 | $0.0635 | 4.0 | 4.0 | 80ms |
| `task-007-regression-repair` | Regression Repair under Precedence Rules | `REGRESSION_REPAIR` | **Vi-Harness** | 100% | $0.0005 | $0.0005 | $0.0005 | 5.0 | 5.0 | 189ms |
| `task-007-regression-repair` | Regression Repair under Precedence Rules | `REGRESSION_REPAIR` | **Pi** | 100% | $0.0635 | $0.0635 | $0.0635 | 4.0 | 4.0 | 80ms |

---

## 5. Statistical Distribution Details

### Harness: Vi-Harness

| Metric: Cost ($) | Mean | Median | P95 | Min | Max | StdDev | Samples |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Value | 0.0005 | 0.0005 | 0.0005 | 0.0005 | 0.0005 | 0 | 21 |

| Metric: Iterations | Mean | Median | P95 | Min | Max | StdDev | Samples |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Value | 5 | 5 | 5 | 5 | 5 | 0 | 21 |

| Metric: Total Tokens | Mean | Median | P95 | Min | Max | StdDev | Samples |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Value | 576.571429 | 583 | 636 | 531 | 636 | 33.130909 | 21 |

| Metric: Latency (ms) | Mean | Median | P95 | Min | Max | StdDev | Samples |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Value | 199.095238 | 196 | 224 | 181 | 244 | 15.536746 | 21 |

### Harness: Pi

| Metric: Cost ($) | Mean | Median | P95 | Min | Max | StdDev | Samples |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Value | 0.060429 | 0.0635 | 0.0635 | 0.042 | 0.0635 | 0.007709 | 21 |

| Metric: Iterations | Mean | Median | P95 | Min | Max | StdDev | Samples |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Value | 3.857143 | 4 | 4 | 3 | 4 | 0.358569 | 21 |

| Metric: Total Tokens | Mean | Median | P95 | Min | Max | StdDev | Samples |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Value | 20121.428571 | 21200 | 21200 | 13650 | 21200 | 2707.1928 | 21 |

| Metric: Latency (ms) | Mean | Median | P95 | Min | Max | StdDev | Samples |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Value | 80 | 80 | 80 | 80 | 80 | 0 | 21 |
