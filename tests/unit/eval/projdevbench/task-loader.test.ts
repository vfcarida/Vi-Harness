/**
 * ProjDevBench Task Loader Unit Tests (P010).
 */
import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { ProjDevTaskLoader } from '../../../../src/infra/eval/projdevbench/task-loader.js';
import { UuidV7IdFactory } from '../../../../src/infra/id/uuid-id-factory.js';

describe('ProjDevBench Task Loader — P010', () => {
  const idFactory = new UuidV7IdFactory();
  const fixturesDir = path.resolve(process.cwd(), 'tests', 'fixtures', 'projdevbench');

  it('1. should discover and parse all sample problems from fixtures directory', async () => {
    const problems = await ProjDevTaskLoader.loadProblemsFromDirectory(fixturesDir);
    expect(problems.length).toBe(3);

    const ids = problems.map((p) => p.id).sort();
    expect(ids).toEqual(['cli-markdown-parser', 'http-routing-engine', 'lru-cache-service']);
  });

  it('2. should correctly parse problem metadata, category, difficulty, and mode', async () => {
    const problemPath = path.join(fixturesDir, 'cli-markdown-parser');
    const problem = await ProjDevTaskLoader.loadProblemFromDirectory(problemPath);

    expect(problem.id).toBe('cli-markdown-parser');
    expect(problem.category).toBe('CLI_TOOL');
    expect(problem.difficulty).toBe('EASY');
    expect(problem.mode).toBe('FROM_SCRATCH');
    expect(problem.testCommands).toEqual(['node test.js']);
    expect(problem.specMarkdown).toContain('CLI Markdown Parser');
  });

  it('3. should support category and difficulty filtering', async () => {
    const easyProblems = await ProjDevTaskLoader.loadProblemsFromDirectory(fixturesDir, {
      difficulties: ['EASY'],
    });
    expect(easyProblems).toHaveLength(1);
    expect(easyProblems[0]?.id).toBe('cli-markdown-parser');

    const dataProblems = await ProjDevTaskLoader.loadProblemsFromDirectory(fixturesDir, {
      categories: ['DATA_PROCESSING'],
    });
    expect(dataProblems).toHaveLength(1);
    expect(dataProblems[0]?.id).toBe('lru-cache-service');
  });

  it('4. should map ProjDevProblem to structured Vi-Harness Goal', async () => {
    const problemPath = path.join(fixturesDir, 'lru-cache-service');
    const problem = await ProjDevTaskLoader.loadProblemFromDirectory(problemPath);
    const goal = ProjDevTaskLoader.mapProblemToGoal(problem, idFactory);

    expect(goal.id).toBeDefined();
    expect(goal.description).toContain('[ProjDevBench:DATA_PROCESSING]');
    expect(goal.description).toContain('In-Memory LRU Cache');
    expect(goal.constraints.maxCostDollars).toBe(1.5);
  });
});
