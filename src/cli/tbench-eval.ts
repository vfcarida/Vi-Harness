#!/usr/bin/env node
/**
 * TBench Benchmark CLI Executable.
 */
import { runTBenchCli } from './commands/tbench.js';

runTBenchCli().catch((err) => {
  console.error('[ERROR] TBench runner failed:', err);
  process.exit(1);
});
