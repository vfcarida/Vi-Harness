/**
 * BenchmarkRunner interface.
 *
 * Evaluates the harness independently from the model and generates
 * machine-readable JSON and human-readable Markdown reports.
 */
import type {
  BenchmarkTask,
  TaskSuite,
  BenchmarkResult,
  BenchmarkReport,
  BenchmarkTaskComparison,
  BenchmarkSuiteResult,
  ModelConfiguration,
  HarnessConfiguration,
  BenchmarkEnvironment,
} from '../model/benchmark-types.js';
import type { HarnessAdapter } from './harness-adapter.js';

export interface BenchmarkRunOptions {
  readonly seed?: string;
  readonly runsPerTask?: number;
  readonly modelConfig: ModelConfiguration;
  readonly harnessConfig?: HarnessConfiguration;
  readonly environment?: BenchmarkEnvironment;
  readonly adapters?: ReadonlyArray<HarnessAdapter>;
  readonly preserveWorkspaces?: boolean;
  readonly workspacesDir?: string;
}

export interface BenchmarkRunner {
  /** Execute a single benchmark task deterministically across one or more adapters. */
  runTask(
    task: BenchmarkTask,
    options: BenchmarkRunOptions,
    adapters?: ReadonlyArray<HarnessAdapter>,
  ): Promise<BenchmarkResult | BenchmarkTaskComparison>;

  /** Execute a full suite of benchmark tasks across one or more adapters. */
  runSuite(
    suite: TaskSuite,
    options: BenchmarkRunOptions,
    adapters?: ReadonlyArray<HarnessAdapter>,
  ): Promise<BenchmarkReport | BenchmarkSuiteResult>;

  /** Serialize report to machine-readable JSON format. */
  generateMachineReadableReport(report: BenchmarkReport | BenchmarkSuiteResult): string;

  /** Generate human-readable Markdown summary report. */
  generateMarkdownSummary(result: BenchmarkSuiteResult | BenchmarkReport): string;
}
