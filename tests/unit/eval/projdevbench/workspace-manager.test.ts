/**
 * ProjDevBench Workspace Manager Unit Tests (P010).
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  ProjDevWorkspaceManager,
  ProjDevTaskLoader,
} from '../../../../src/infra/eval/projdevbench/index.js';

describe('ProjDevBench Workspace Manager — P010', () => {
  const fixturesDir = path.resolve(process.cwd(), 'tests', 'fixtures', 'projdevbench');

  it('1. should create isolated workspace with scaffold template files', async () => {
    const manager = new ProjDevWorkspaceManager();
    const problem = await ProjDevTaskLoader.loadProblemFromDirectory(
      path.join(fixturesDir, 'lru-cache-service'),
    );

    const workspace = await manager.createWorkspace(problem);
    expect(fs.existsSync(workspace.workspacePath)).toBe(true);

    // Verify template file copied
    const lruFile = path.join(workspace.workspacePath, 'lru-cache.js');
    expect(fs.existsSync(lruFile)).toBe(true);
    expect(fs.readFileSync(lruFile, 'utf-8')).toContain('export class LruCache');

    // Verify test file copied from source dir
    const testFile = path.join(workspace.workspacePath, 'test.js');
    expect(fs.existsSync(testFile)).toBe(true);

    await workspace.cleanup();
    expect(fs.existsSync(workspace.workspacePath)).toBe(false);
  });

  it('2. should track modified files in workspace', async () => {
    const manager = new ProjDevWorkspaceManager();
    const problem = await ProjDevTaskLoader.loadProblemFromDirectory(
      path.join(fixturesDir, 'cli-markdown-parser'),
    );

    const workspace = await manager.createWorkspace(problem);

    // Create a new source file
    fs.writeFileSync(
      path.join(workspace.workspacePath, 'parser.js'),
      'export function parseMarkdown() {}',
      'utf-8',
    );

    const files = await workspace.getModifiedFiles();
    expect(files).toContain('parser.js');

    await workspace.cleanup();
  });
});
