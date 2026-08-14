/**
 * Source Code Indexer & Symbol Map Unit Tests.
 *
 * Tests:
 * 1. Multi-language symbol parsing (TypeScript, Python, Go).
 * 2. Repository-wide symbol map generation and compact rendering.
 * 3. Dynamic Context Manager (/drop, /add, /focus) and non-dropping invariant guarantees.
 */
import { describe, it, expect } from 'vitest';
import {
  SourceCodeIndexer,
  DynamicContextManager,
} from '../../../src/infra/index.js';
import {
  SymbolKind,
  ContextObjectType,
  ContextTier,
  ContextScope,
  type ContextObject,
} from '../../../src/core/index.js';

describe('Source Code Indexer & Symbol Map Suite (Prompt 5)', () => {
  describe('1. TypeScript / JavaScript Parsing', () => {
    it('should extract classes, interfaces, types, enums, functions, and class methods', () => {
      const tsCode = `
import { Router } from './router.js';
import type { Goal } from './goal.js';

export interface CodeBlock {
  language: string;
  code: string;
}

export type SymbolName = string | number;

export enum Status {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
}

export class TaskExecutor {
  public async executeTask(goal: Goal): Promise<boolean> {
    return true;
  }

  private validate(data: unknown): void {}
}

export async function computeScore(x: number, y: number): Promise<number> {
  return x + y;
}
`;

      const fileMap = SourceCodeIndexer.parseFile('src/task-executor.ts', tsCode);
      expect(fileMap.language).toBe('typescript');
      expect(fileMap.imports).toHaveLength(2);
      expect(fileMap.exports).toContain('CodeBlock');
      expect(fileMap.exports).toContain('SymbolName');
      expect(fileMap.exports).toContain('Status');
      expect(fileMap.exports).toContain('TaskExecutor');
      expect(fileMap.exports).toContain('computeScore');

      const symbols = fileMap.symbols;
      expect(symbols.find((s) => s.name === 'CodeBlock' && s.kind === SymbolKind.INTERFACE)).toBeDefined();
      expect(symbols.find((s) => s.name === 'SymbolName' && s.kind === SymbolKind.TYPE_ALIAS)).toBeDefined();
      expect(symbols.find((s) => s.name === 'Status' && s.kind === SymbolKind.ENUM)).toBeDefined();
      expect(symbols.find((s) => s.name === 'TaskExecutor' && s.kind === SymbolKind.CLASS)).toBeDefined();
      expect(symbols.find((s) => s.name === 'executeTask' && s.kind === SymbolKind.METHOD)).toBeDefined();
      expect(symbols.find((s) => s.name === 'computeScore' && s.kind === SymbolKind.FUNCTION)).toBeDefined();

      expect(fileMap.outline).toContain('interface CodeBlock');
      expect(fileMap.outline).toContain('class TaskExecutor');
      expect(fileMap.outline).toContain('executeTask');
    });
  });

  describe('2. Python & Go Parsing', () => {
    it('should extract Python classes, functions, and methods', () => {
      const pyCode = `
import os
from typing import List

class AgentRuntime:
    def __init__(self, name: str):
        self.name = name

    def run(self, task: str) -> bool:
        return True

def standalone_helper(x: int) -> int:
    return x * 2
`;

      const fileMap = SourceCodeIndexer.parseFile('backend/runtime.py', pyCode);
      expect(fileMap.language).toBe('python');
      expect(fileMap.symbols.find((s) => s.name === 'AgentRuntime' && s.kind === SymbolKind.CLASS)).toBeDefined();
      expect(fileMap.symbols.find((s) => s.name === 'run' && s.kind === SymbolKind.METHOD)).toBeDefined();
      expect(fileMap.symbols.find((s) => s.name === 'standalone_helper' && s.kind === SymbolKind.FUNCTION)).toBeDefined();
    });

    it('should extract Go structs, methods, and functions', () => {
      const goCode = `
package main

import "fmt"

type ServerConfig struct {
    Port int
}

func (s *ServerConfig) Start() error {
    return nil
}

func MainHandler(w int) {
}
`;

      const fileMap = SourceCodeIndexer.parseFile('cmd/server.go', goCode);
      expect(fileMap.language).toBe('go');
      expect(fileMap.symbols.find((s) => s.name === 'ServerConfig' && s.kind === SymbolKind.CLASS)).toBeDefined();
      expect(fileMap.symbols.find((s) => s.name === 'Start' && s.kind === SymbolKind.METHOD)).toBeDefined();
      expect(fileMap.symbols.find((s) => s.name === 'MainHandler' && s.kind === SymbolKind.FUNCTION)).toBeDefined();
    });
  });

  describe('3. Repository-Wide Symbol Map & Compact Rendering', () => {
    it('should build a repository map and render within token constraints', () => {
      const files = new Map<string, string>([
        ['src/auth/service.ts', 'export class AuthService { login(): void {} }'],
        ['src/auth/jwt.ts', 'export function verifyToken(t: string): boolean { return true; }'],
        ['src/db/client.ts', 'export class DatabaseClient { connect(): void {} }'],
      ]);

      const repoMap = SourceCodeIndexer.buildRepoMap(files);
      expect(repoMap.totalFiles).toBe(3);
      expect(repoMap.totalSymbols).toBe(3);

      const rendered = SourceCodeIndexer.renderRepoMap(repoMap, {
        maxTokens: 500,
        focusFiles: ['src/auth/service.ts'],
      });

      expect(rendered).toContain('File: src/auth/service.ts');
      expect(rendered).toContain('AuthService');
      expect(rendered).toContain('File: src/auth/jwt.ts');
      expect(rendered).toContain('verifyToken');
    });
  });

  describe('4. Dynamic Context Manager & Slash Commands', () => {
    it('should handle /drop, /add, /focus and filter out dropped files while preserving invariants', () => {
      const manager = new DynamicContextManager(['src/app.ts', 'src/large-logs.ts']);

      expect(manager.getState().activeFiles.has('src/app.ts')).toBe(true);
      expect(manager.getState().activeFiles.has('src/large-logs.ts')).toBe(true);

      // 1. Drop a file
      manager.parseCommand('/drop src/large-logs.ts');
      expect(manager.getState().droppedFiles.has('src/large-logs.ts')).toBe(true);
      expect(manager.getState().activeFiles.has('src/large-logs.ts')).toBe(false);

      // 2. Filter context objects
      const now = new Date();
      const mockObjects: ContextObject[] = [
        {
          id: 'ctx-1' as any,
          tier: ContextTier.L2_PROJECT,
          type: ContextObjectType.FILE,
          content: 'HUGE RAW LOGS...',
          source: 'file',
          timestamp: now,
          importance: 0.5,
          confidence: 1.0,
          scope: ContextScope.GLOBAL,
          dependencies: [],
          lastUsed: now,
          lastVerified: now,
          costTokens: 10000,
          tags: ['file'],
          version: 1,
          active: true,
          metadata: { filePath: 'src/large-logs.ts' },
        },
        {
          id: 'ctx-2' as any,
          tier: ContextTier.L3_REPOSITORY,
          type: ContextObjectType.DECISION,
          content: 'CRITICAL INVARIANT: Never bypass security policy.',
          source: 'user',
          timestamp: now,
          importance: 1.0,
          confidence: 1.0,
          scope: ContextScope.GLOBAL,
          dependencies: [],
          lastUsed: now,
          lastVerified: now,
          costTokens: 20,
          tags: ['must_preserve', 'decision'],
          version: 1,
          active: true,
          metadata: {},
        },
        {
          id: 'ctx-3' as any,
          tier: ContextTier.L2_PROJECT,
          type: ContextObjectType.FILE,
          content: 'export function app() {}',
          source: 'file',
          timestamp: now,
          importance: 0.8,
          confidence: 1.0,
          scope: ContextScope.GLOBAL,
          dependencies: [],
          lastUsed: now,
          lastVerified: now,
          costTokens: 50,
          tags: ['file'],
          version: 1,
          active: true,
          metadata: { filePath: 'src/app.ts' },
        },
      ];

      const filtered = manager.filterContextObjects(mockObjects);
      expect(filtered).toHaveLength(2);
      expect(filtered.find((o) => o.id === 'ctx-1')).toBeUndefined(); // Dropped file was removed
      expect(filtered.find((o) => o.id === 'ctx-2')).toBeDefined(); // Critical invariant preserved!
      expect(filtered.find((o) => o.id === 'ctx-3')).toBeDefined(); // Active file preserved!

      // 3. Re-add dropped file
      manager.parseCommand('/add src/large-logs.ts');
      expect(manager.getState().droppedFiles.has('src/large-logs.ts')).toBe(false);
      expect(manager.getState().activeFiles.has('src/large-logs.ts')).toBe(true);

      const reFiltered = manager.filterContextObjects(mockObjects);
      expect(reFiltered).toHaveLength(3);
    });
  });
});
