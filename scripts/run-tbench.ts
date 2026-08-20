#!/usr/bin/env node
/**
 * Standalone TBench Execution Script.
 *
 * Runs Terminal Agent benchmark evaluation against container/sandbox environments,
 * evaluates task completions, and generates Markdown/JSON leaderboard reports.
 */
import * as path from 'node:path';
import { runTBenchCli } from '../src/cli/commands/tbench.js';

async function main() {
  console.log('💻 Starting Terminal Agent (TBench) Evaluation...');

  const args = process.argv.slice(2);
  const outputDir = path.resolve(process.cwd(), 'benchmark-results', 'tbench');

  const cliArgs: string[] = ['--output', outputDir];

  // Default to smoke mode in script runner for speed unless overridden
  if (!args.includes('--full')) {
    cliArgs.push('--smoke');
  }

  try {
    await runTBenchCli(cliArgs);
    console.log('\n✅ TBench benchmark execution finished successfully.');
    process.exit(0);
  } catch (err: any) {
    console.error('\n❌ TBench execution failed:', err.message);
    process.exit(1);
  }
}

main();
