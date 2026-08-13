/**
 * Statistical Calculator for Benchmark Evaluation.
 *
 * Computes mean, median, p95 (95th percentile), min, max, and sample standard deviation
 * across repeated experimental benchmark runs.
 */
import type { StatisticalDistribution } from '../../core/model/benchmark-types.js';

export class StatisticalCalculator {
  /**
   * Compute complete statistical distribution for a series of numeric metrics.
   */
  static computeDistribution(samples: ReadonlyArray<number>): StatisticalDistribution {
    if (samples.length === 0) {
      return {
        mean: 0,
        median: 0,
        p95: 0,
        min: 0,
        max: 0,
        stdDev: 0,
        samples: [],
      };
    }

    const sorted = [...samples].sort((a, b) => a - b);
    const n = sorted.length;

    const sum = sorted.reduce((acc, val) => acc + val, 0);
    const mean = sum / n;

    // Median calculation
    let median: number;
    if (n % 2 === 1) {
      median = sorted[Math.floor(n / 2)]!;
    } else {
      const mid1 = sorted[n / 2 - 1]!;
      const mid2 = sorted[n / 2]!;
      median = (mid1 + mid2) / 2;
    }

    // P95 calculation (95th percentile using nearest rank method with boundary safety)
    const p95Index = Math.min(n - 1, Math.max(0, Math.ceil(0.95 * n) - 1));
    const p95 = sorted[p95Index]!;

    const min = sorted[0]!;
    const max = sorted[n - 1]!;

    // Standard deviation
    let stdDev = 0;
    if (n > 1) {
      const variance = sorted.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (n - 1);
      stdDev = Math.sqrt(variance);
    }

    return {
      mean: Number(mean.toFixed(6)),
      median: Number(median.toFixed(6)),
      p95: Number(p95.toFixed(6)),
      min: Number(min.toFixed(6)),
      max: Number(max.toFixed(6)),
      stdDev: Number(stdDev.toFixed(6)),
      samples: sorted,
    };
  }
}
