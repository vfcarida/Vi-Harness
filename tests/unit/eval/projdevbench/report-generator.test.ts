/**
 * ProjDevBench Report Generator Unit Tests (P010).
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  ProjDevReportGenerator,
  type ProjDevBenchmarkReport,
} from '../../../../src/infra/eval/projdevbench/index.js';

describe('ProjDevBench Report Generator — P010', () => {
  const mockReport: ProjDevBenchmarkReport = {
    benchmarkName: 'ProjDevBench',
    timestamp: '2026-01-01T00:00:00Z',
    harnessName: 'Vi-Harness',
    modelId: 'claude-3-7-sonnet',
    totalProblems: 2,
    completedProblems: 2,
    overallScore: 82.5,
    executionScoreAverage: 80.0,
    codeReviewScoreAverage: 90.0,
    categoryScores: {
      CLI_TOOL: { score: 85.0, count: 1 },
      DATA_PROCESSING: { score: 80.0, count: 1 },
    },
    problemScores: [
      {
        problemId: 'cli-markdown-parser',
        title: 'Markdown Parser',
        category: 'CLI_TOOL',
        difficulty: 'EASY',
        mode: 'FROM_SCRATCH',
        executionScore: 1.0,
        codeReviewScore: 1.0,
        finalScore: 1.0,
        testVerdicts: [{ name: 'test.js', verdict: 'AC', executionTimeMs: 40 }],
        reviewFeedback: ['PASS: Source created'],
        tokenUsage: { inputTokens: 1000, outputTokens: 200, totalTokens: 1200 },
        costDollars: 0.01,
        durationMs: 400,
        iterationCount: 2,
        success: true,
      },
    ],
    leaderboardComparison: [
      { agent: 'Vi-Harness', score: 82.5, referenceModel: 'claude-3-7-sonnet', isBaseline: false },
      { agent: 'OpenAI Codex', score: 77.85, referenceModel: 'code-davinci-002', isBaseline: true },
      { agent: 'Cursor', score: 75.32, referenceModel: 'claude-3-5-sonnet', isBaseline: true },
    ],
    totalTokens: 5000,
    totalCostDollars: 0.035,
    totalDurationMs: 1200,
  };

  it('1. should format rich Markdown report with leaderboard comparison and problem tables', () => {
    const md = ProjDevReportGenerator.generateMarkdownReport(mockReport);

    expect(md).toContain('# ProjDevBench (Project Development Benchmark) Report');
    expect(md).toContain('82.50%');
    expect(md).toContain('Official ProjDevBench Leaderboard Comparison');
    expect(md).toContain('OpenAI Codex');
    expect(md).toContain('Cursor');
    expect(md).toContain('cli-markdown-parser');
    expect(md).toContain('CLI_TOOL');
  });

  it('2. should write JSON and Markdown report files to disk', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vi-report-gen-'));

    const { jsonPath, mdPath } = await ProjDevReportGenerator.writeReportFiles(mockReport, tempDir);

    expect(fs.existsSync(jsonPath)).toBe(true);
    expect(fs.existsSync(mdPath)).toBe(true);

    const savedJson = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    expect(savedJson.overallScore).toBe(82.5);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
