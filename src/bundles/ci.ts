// Pattern: Built-in CI Benchmark Bundle (ref: DeepSeek Harness)
/**
 * CI Benchmark & Evaluation Bundle.
 *
 * Configured for running ProjDevBench & TBench evaluations with automated report generation.
 */
import type { Bundle } from '../core/plugin/composition.js';

export const CI_BUNDLE: Bundle = {
  name: 'ci',
  description: 'Continuous Integration benchmark execution and markdown/JSON report synthesis',
  plugins: [
    {
      id: 'benchmark-runner',
      plugin: '@vi-harness/eval-benchmark-runner',
    },
    {
      id: 'report-generator',
      plugin: '@vi-harness/eval-report-markdown',
      config: { outputDir: './benchmark-results' },
    },
  ],
};
