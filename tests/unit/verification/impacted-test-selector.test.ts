/**
 * Impacted Test Selector Unit Tests.
 *
 * Verifies selective test file determination based on modified source code paths,
 * pattern matching, and full test suite fallback on final acceptance passes.
 */
import { describe, it, expect } from 'vitest';
import { ImpactedTestSelector } from '../../../src/infra/index.js';

describe('ImpactedTestSelector Unit Tests', () => {
  const selector = new ImpactedTestSelector();

  const allRepoTests = [
    'tests/unit/auth/login.test.ts',
    'tests/unit/auth/logout.test.ts',
    'tests/unit/compiler/context-compiler.test.ts',
    'tests/unit/memory/memory-store.test.ts',
    'tests/integration/auth-flow.test.ts',
    'tests/integration/harness-e2e.test.ts',
  ];

  it('selects only affected unit and integration test files for modified source files', () => {
    const result = selector.selectImpactedTests({
      modifiedFiles: ['src/auth/login.ts'],
      allAvailableTestFiles: allRepoTests,
      isFinalAcceptancePass: false,
    });

    expect(result.runFullSuite).toBe(false);
    expect(result.selectedTestFiles).toContain('tests/unit/auth/login.test.ts');
    expect(result.selectedTestFiles).toContain('tests/integration/auth-flow.test.ts');
    expect(result.selectedTestFiles).not.toContain('tests/unit/memory/memory-store.test.ts');
  });

  it('triggers full test suite execution on final acceptance passes', () => {
    const result = selector.selectImpactedTests({
      modifiedFiles: ['src/auth/login.ts'],
      allAvailableTestFiles: allRepoTests,
      isFinalAcceptancePass: true,
    });

    expect(result.runFullSuite).toBe(true);
    expect(result.selectedTestFiles.length).toBe(allRepoTests.length);
  });
});
