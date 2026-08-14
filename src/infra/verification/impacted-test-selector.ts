/**
 * Selective Impacted Test Selector.
 *
 * Optimizes verification efficiency and token consumption by selecting only tests
 * directly or transitively affected by the modified files in the current iteration.
 */
import * as path from 'node:path';

export interface TestSelectionRule {
  readonly sourcePattern: RegExp;
  readonly testPatterns: ReadonlyArray<string>;
}

export class ImpactedTestSelector {
  private readonly defaultTestAssociations: ReadonlyArray<TestSelectionRule> = [
    {
      sourcePattern: /src\/(?:core|infra|runtime)\/(.+)\.ts$/,
      testPatterns: [
        'tests/unit/$1.test.ts',
        'tests/unit/*/$1.test.ts',
        'tests/integration/*$1*.test.ts',
      ],
    },
    {
      sourcePattern: /src\/auth\/(.+)\.ts$/,
      testPatterns: ['tests/unit/auth/$1.test.ts', 'tests/integration/auth*.test.ts'],
    },
    {
      sourcePattern: /src\/compiler\/(.+)\.ts$/,
      testPatterns: ['tests/unit/compiler/$1.test.ts', 'tests/integration/*context*.test.ts'],
    },
  ];

  /**
   * Determine the most relevant test commands and paths for a set of modified files.
   */
  selectImpactedTests(params: {
    modifiedFiles: ReadonlyArray<string>;
    allAvailableTestFiles: ReadonlyArray<string>;
    isFinalAcceptancePass?: boolean;
  }): {
    readonly selectedTestFiles: ReadonlyArray<string>;
    readonly runFullSuite: boolean;
    readonly rationale: string;
  } {
    // If it is the final acceptance pass, run the entire test suite
    if (params.isFinalAcceptancePass || params.modifiedFiles.length === 0) {
      return {
        selectedTestFiles: params.allAvailableTestFiles,
        runFullSuite: true,
        rationale: 'Final acceptance pass or root change requires full test suite execution.',
      };
    }

    const selectedSet = new Set<string>();

    for (const modFile of params.modifiedFiles) {
      const normalizedMod = modFile.replace(/\\/g, '/');
      const baseName = path.basename(normalizedMod, path.extname(normalizedMod));

      // Direct match: look for test file with the same base name
      for (const testFile of params.allAvailableTestFiles) {
        const normalizedTest = testFile.replace(/\\/g, '/');
        if (normalizedTest.includes(baseName)) {
          selectedSet.add(testFile);
        }
      }

      // Pattern and module match
      const dirSegments = path.dirname(normalizedMod).split('/').filter(Boolean);
      const moduleName = dirSegments[dirSegments.length - 1];

      for (const rule of this.defaultTestAssociations) {
        const match = rule.sourcePattern.exec(normalizedMod);
        if (match) {
          const subPath = match[1] ?? '';
          for (const pattern of rule.testPatterns) {
            const resolvedPattern = pattern.replace(/\$1/g, subPath);
            const regexStr = resolvedPattern
              .replace(/\./g, '\\.')
              .replace(/\*\*/g, '.*')
              .replace(/\*/g, '[^/]*');
            const patternRegex = new RegExp(`^${regexStr}$`, 'i');

            for (const testFile of params.allAvailableTestFiles) {
              const normalizedTest = testFile.replace(/\\/g, '/');
              if (patternRegex.test(normalizedTest)) {
                selectedSet.add(testFile);
              }
            }
          }
        }
      }

      // Also match integration tests mentioning the module name
      if (moduleName && moduleName !== 'src') {
        for (const testFile of params.allAvailableTestFiles) {
          const normalizedTest = testFile.replace(/\\/g, '/');
          if (normalizedTest.includes(moduleName) && normalizedTest.includes('integration')) {
            selectedSet.add(testFile);
          }
        }
      }
    }

    const selectedList = Array.from(selectedSet);

    if (selectedList.length === 0) {
      // Fallback to full suite if no direct impact mapping found
      return {
        selectedTestFiles: params.allAvailableTestFiles,
        runFullSuite: true,
        rationale: 'No specific affected test found; falling back to full suite.',
      };
    }

    return {
      selectedTestFiles: selectedList,
      runFullSuite: false,
      rationale: `Selected ${selectedList.length} affected test(s) corresponding to ${params.modifiedFiles.length} modified file(s).`,
    };
  }
}
