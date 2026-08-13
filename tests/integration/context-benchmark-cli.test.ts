/**
 * Context Benchmark CLI Integration Tests.
 *
 * Validates CLI invocation, options parsing, and report generation on disk.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { runContextCli } from '../../src/cli/context-benchmark-cli.js';

describe('Context Benchmark CLI Integration', { timeout: 30000 }, () => {
  let testOutDir: string;

  beforeEach(() => {
    testOutDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vi-context-cli-test-'));
  });

  afterEach(() => {
    try {
      if (fs.existsSync(testOutDir)) {
        fs.rmSync(testOutDir, { recursive: true, force: true });
      }
    } catch {
      // ignore
    }
  });

  it('1. CLI Help Flag: Displays help and returns 0', async () => {
    const exitCode = await runContextCli(['--help']);
    expect(exitCode).toBe(0);
  });

  it('2. CLI Execution: Runs context benchmark and generates JSON and Markdown files', async () => {
    const exitCode = await runContextCli([
      '--horizons',
      '10,25',
      '--output',
      testOutDir,
      '--format',
      'all',
    ]);

    expect(exitCode).toBe(0);

    const jsonFile = path.join(testOutDir, 'context-benchmark-report.json');
    const mdFile = path.join(testOutDir, 'context-benchmark-report.md');

    expect(fs.existsSync(jsonFile)).toBe(true);
    expect(fs.existsSync(mdFile)).toBe(true);

    const jsonContent = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
    expect(jsonContent.suiteId).toBe('context-efficiency-suite-v1');
    expect(jsonContent.comparisonsByHorizon['10']).toBeDefined();
    expect(jsonContent.comparisonsByHorizon['25']).toBeDefined();

    const mdContent = fs.readFileSync(mdFile, 'utf-8');
    expect(mdContent).toContain('Vi-Harness Context-Efficiency & Bloat Elimination Benchmark');
    expect(mdContent).toContain('Critical Memory Survival & Retention Analysis');
  });
});
