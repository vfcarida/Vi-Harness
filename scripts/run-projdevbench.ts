#!/usr/bin/env node
/**
 * Standalone ProjDevBench Execution Script.
 *
 * Runs project-construction benchmark evaluations with isolated workspaces,
 * score calculation, and JSON/Markdown report output.
 */
import * as path from 'node:path';
import * as fs from 'node:fs';
import { runProjDevBenchCli } from '../src/cli/projdevbench-eval.js';

async function main() {
  console.log('🏗️  Starting ProjDevBench Benchmark Evaluation...');

  const args = process.argv.slice(2);
  const taskArg = args.find((a) => a.startsWith('--task='))?.split('=')[1];
  const outputDir = path.resolve(process.cwd(), 'benchmark-results', 'projdevbench');

  const cliArgs: string[] = ['--output', outputDir];

  if (taskArg) {
    // If specific task provided
    cliArgs.push('--category', 'FULL_STACK');
  }

  try {
    await runProjDevBenchCli(cliArgs);
    console.log('\n✅ ProjDevBench benchmark execution finished successfully.');
    process.exit(0);
  } catch (err: any) {
    console.error('\n❌ ProjDevBench execution failed:', err.message);
    process.exit(1);
  }
}

main();
