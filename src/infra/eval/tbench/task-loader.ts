/**
 * TBench Task Loader.
 *
 * Discovers and parses Terminal-Bench 2.0 tasks and maps them to Vi-Harness Goals.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { TBenchTask, TBenchCategory, TBenchDifficulty, FilterOpts } from './types.js';
import type { Goal } from '../../../core/model/goal.js';
import { GoalStatus, DEFAULT_GOAL_CONSTRAINTS } from '../../../core/model/goal.js';
import type { IdFactory } from '../../../core/types/identifiers.js';

export class TBenchTaskLoader {
  /**
   * Discovers and loads all TBench tasks in a root directory.
   */
  static async loadFromDir(tasksDir: string, filterOpts?: FilterOpts): Promise<TBenchTask[]> {
    if (!fs.existsSync(tasksDir)) {
      return [];
    }

    const tasks: TBenchTask[] = [];
    const entries = fs.readdirSync(tasksDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const taskDir = path.join(tasksDir, entry.name);
        try {
          const task = await this.loadTask(taskDir);
          if (task) {
            tasks.push(task);
          }
        } catch {
          // Skip invalid task directory
        }
      }
    }

    return this.filter(tasks, filterOpts ?? {});
  }

  /**
   * Parses a single task directory.
   */
  static async loadTask(taskDir: string): Promise<TBenchTask | null> {
    const taskId = path.basename(taskDir);
    const jsonPath = path.join(taskDir, 'task.json');
    const instructionPath = path.join(taskDir, 'instruction.md');
    const testScriptPath = path.join(taskDir, 'test.sh');
    const oracleScriptPath = path.join(taskDir, 'oracle.sh');

    let instruction = '';
    let category: TBenchCategory = 'software-engineering';
    let difficulty: TBenchDifficulty = 'medium';
    let tags: string[] = [];
    let timeout = 1800; // 30 minutes default
    let testScript = '';
    let oracleSolution: string | undefined;
    let workdir: string | undefined;
    let environment: Record<string, string> | undefined;

    // Load task.json if present
    if (fs.existsSync(jsonPath)) {
      try {
        const rawJson = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        if (rawJson.instruction) instruction = String(rawJson.instruction);
        if (rawJson.category) category = rawJson.category as TBenchCategory;
        if (rawJson.difficulty) difficulty = rawJson.difficulty as TBenchDifficulty;
        if (Array.isArray(rawJson.tags)) tags = rawJson.tags.map(String);
        if (typeof rawJson.timeout === 'number') timeout = rawJson.timeout;
        if (rawJson.testScript) testScript = String(rawJson.testScript);
        if (rawJson.oracleSolution) oracleSolution = String(rawJson.oracleSolution);
        if (rawJson.workdir) workdir = String(rawJson.workdir);
        if (rawJson.environment) environment = rawJson.environment;
      } catch {
        // Fallback to individual files
      }
    }

    // Load instruction.md if instruction not yet found
    if (!instruction && fs.existsSync(instructionPath)) {
      instruction = fs.readFileSync(instructionPath, 'utf-8').trim();
    }

    // Load test.sh if testScript not yet populated
    if (!testScript && fs.existsSync(testScriptPath)) {
      testScript = fs.readFileSync(testScriptPath, 'utf-8');
    }

    // Load oracle.sh if oracleSolution not populated
    if (!oracleSolution && fs.existsSync(oracleScriptPath)) {
      oracleSolution = fs.readFileSync(oracleScriptPath, 'utf-8');
    }

    if (!instruction && !testScript) {
      return null;
    }

    return {
      id: taskId,
      instruction: instruction || `Complete the terminal task for ${taskId}`,
      category,
      difficulty,
      tags,
      testScript: testScript || 'exit 0',
      oracleSolution,
      timeout,
      workdir,
      environment,
    };
  }

  /**
   * Filters a list of tasks by category, difficulty, tags, task IDs, or maxTasks.
   */
  static filter(tasks: ReadonlyArray<TBenchTask>, opts: FilterOpts): TBenchTask[] {
    let filtered = [...tasks];

    if (opts.taskIds && opts.taskIds.length > 0) {
      const allowed = new Set(opts.taskIds);
      filtered = filtered.filter((t) => allowed.has(t.id));
    }

    if (opts.categories && opts.categories.length > 0) {
      const allowedCats = new Set(opts.categories);
      filtered = filtered.filter((t) => allowedCats.has(t.category));
    }

    if (opts.difficulties && opts.difficulties.length > 0) {
      const allowedDiffs = new Set(opts.difficulties);
      filtered = filtered.filter((t) => allowedDiffs.has(t.difficulty));
    }

    if (opts.tags && opts.tags.length > 0) {
      const targetTags = new Set(opts.tags);
      filtered = filtered.filter((t) => t.tags.some((tag) => targetTags.has(tag)));
    }

    if (typeof opts.maxTasks === 'number' && opts.maxTasks > 0) {
      filtered = filtered.slice(0, opts.maxTasks);
    }

    return filtered;
  }

  /**
   * Maps a TBenchTask to a Vi-Harness Goal object.
   */
  static mapTaskToGoal(task: TBenchTask, idFactory: IdFactory): Goal {
    const goalId = idFactory.create<'Goal'>();
    const now = new Date();

    return {
      id: goalId,
      description: `[TBench:${task.category.toUpperCase()}:${task.difficulty.toUpperCase()}] ${task.id}: ${task.instruction}`,
      status: GoalStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
      constraints: {
        ...DEFAULT_GOAL_CONSTRAINTS,
        maxIterations: 30,
        maxCostDollars: 2.0,
        maxDurationMs: task.timeout * 1000,
        deadlineMs: task.timeout * 1000,
        requireVerification: false,
      },
      metadata: {
        benchmark: 'TBench',
        tbenchTaskId: task.id,
        category: task.category,
        difficulty: task.difficulty,
        tags: task.tags,
        timeoutSeconds: task.timeout,
      },
    };
  }
}
