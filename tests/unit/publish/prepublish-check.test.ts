import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrepublishChecker } from '../../../scripts/prepublish-check.js';

describe('Pre-Publish Verification Checker', () => {
  it('validates that current workspace passes prepublish checks', () => {
    const result = PrepublishChecker.runCheck(process.cwd());

    expect(result.passed).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.packageSizeBytes).toBeGreaterThan(0);
    // Package size must be strictly under 5MB
    expect(result.packageSizeBytes).toBeLessThan(5 * 1024 * 1024);
  });

  it('detects missing files and invalid exports when executed on empty root', () => {
    const emptyResult = PrepublishChecker.runCheck(path.resolve(process.cwd(), 'tests'));
    expect(emptyResult.passed).toBe(false);
    expect(emptyResult.errors.length).toBeGreaterThan(0);
  });
});
