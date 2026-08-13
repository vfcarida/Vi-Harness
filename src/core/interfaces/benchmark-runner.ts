/**
 * BenchmarkRunner interface.
 *
 * Evaluates the harness independently from the model and generates machine-readable reports.
 */
import type {
  BenchmarkTask,
  TaskSuite,
  BenchmarkResult,
  BenchmarkReport,
  ModelConfiguration,
  HarnessConfiguration,
  BenchmarkEnvironment,
} from '../model/benchmark-types.js';

export interface BenchmarkRunOptions {
  readonly seed?: string;
  readonly runsPerTask?: number;
  readonly modelConfig: ModelConfiguration;
  readonly harnessConfig: HarnessConfiguration;
  readonly environment: BenchmarkEnvironment;
}

export interface BenchmarkRunner {
  /** Execute a single benchmark task deterministically. */
  runTask(task: BenchmarkTask, options: BenchmarkRunOptions): Promise<BenchmarkResult>;

  /** Execute a full suite of benchmark tasks. */
  runSuite(suite: TaskSuite, options: BenchmarkRunOptions): Promise<BenchmarkReport>;

  /** Serialize report to machine-readable JSON format. */
  generateMachineReadableReport(report: BenchmarkReport): string;
}
