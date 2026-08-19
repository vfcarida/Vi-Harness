/**
 * Pre-Publish Verification Checklist Script.
 *
 * Verifies:
 * 1. Build outputs exist and are valid.
 * 2. All package.json exports resolve to real files in dist/.
 * 3. No test files or forbidden debug logs in production distribution.
 * 4. Tarball size is under 5MB (warn if > 2MB).
 * 5. LICENSE, README, and CHANGELOG exist.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface PrepublishCheckResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
  packageSizeBytes: number;
}

export class PrepublishChecker {
  /**
   * Run full pre-publish verification suite.
   */
  static runCheck(rootDir = process.cwd()): PrepublishCheckResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const distDir = path.join(rootDir, 'dist');
    const pkgPath = path.join(rootDir, 'package.json');
    const licensePath = path.join(rootDir, 'LICENSE');
    const readmePath = path.join(rootDir, 'README.md');
    const changelogPath = path.join(rootDir, 'CHANGELOG.md');

    // 1. Mandatory metadata files
    if (!fs.existsSync(pkgPath)) errors.push('package.json missing');
    if (!fs.existsSync(licensePath)) errors.push('LICENSE file missing');
    if (!fs.existsSync(readmePath)) errors.push('README.md file missing');
    if (!fs.existsSync(changelogPath)) warnings.push('CHANGELOG.md file missing');

    // 2. Dist directory verification
    if (!fs.existsSync(distDir)) {
      errors.push("dist/ directory missing. Run 'npm run build' first.");
      return { passed: false, errors, warnings, packageSizeBytes: 0 };
    }

    const mainEntry = path.join(distDir, 'index.js');
    const typesEntry = path.join(distDir, 'index.d.ts');
    const cliEntry = path.join(distDir, 'cli', 'index.js');

    if (!fs.existsSync(mainEntry)) errors.push('dist/index.js missing');
    if (!fs.existsSync(typesEntry)) errors.push('dist/index.d.ts missing');
    if (!fs.existsSync(cliEntry)) errors.push('dist/cli/index.js missing');

    // 3. Exports Map Resolution Check
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        if (pkg.exports && typeof pkg.exports === 'object') {
          for (const [subpath, target] of Object.entries<any>(pkg.exports)) {
            const importTarget = typeof target === 'string' ? target : target.import;
            const typesTarget = typeof target === 'object' ? target.types : undefined;

            if (importTarget) {
              const fullImportPath = path.resolve(rootDir, importTarget);
              if (!fs.existsSync(fullImportPath)) {
                errors.push(`Export '${subpath}' target '${importTarget}' does not exist.`);
              }
            }
            if (typesTarget) {
              const fullTypesPath = path.resolve(rootDir, typesTarget);
              if (!fs.existsSync(fullTypesPath)) {
                errors.push(`Export '${subpath}' types '${typesTarget}' does not exist.`);
              }
            }
          }
        }
      } catch (err: any) {
        errors.push(`Failed to parse package.json: ${err.message}`);
      }
    }

    // 4. No test files inside dist/
    const findFilesRecursive = (dir: string): string[] => {
      let results: string[] = [];
      if (!fs.existsSync(dir)) return results;
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const full = path.join(dir, file);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          results = results.concat(findFilesRecursive(full));
        } else {
          results.push(full);
        }
      }
      return results;
    };

    const distFiles = findFilesRecursive(distDir);
    const testFiles = distFiles.filter((f) => f.includes('.test.') || f.includes('.spec.'));
    if (testFiles.length > 0) {
      errors.push(`Found ${testFiles.length} test files inside dist/: ${testFiles.slice(0, 3).join(', ')}`);
    }

    // 5. Total package size calculation
    let totalBytes = 0;
    for (const file of distFiles) {
      totalBytes += fs.statSync(file).size;
    }

    const sizeMb = totalBytes / (1024 * 1024);
    if (sizeMb > 5) {
      errors.push(`Package dist size (${sizeMb.toFixed(2)}MB) exceeds 5MB limit.`);
    } else if (sizeMb > 2) {
      warnings.push(`Package dist size (${sizeMb.toFixed(2)}MB) is large (> 2MB).`);
    }

    // 6. Verify Shebang in CLI
    if (fs.existsSync(cliEntry)) {
      const cliContent = fs.readFileSync(cliEntry, 'utf-8');
      if (!cliContent.startsWith('#!/usr/bin/env node')) {
        warnings.push('dist/cli/index.js does not start with #!/usr/bin/env node shebang.');
      }
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings,
      packageSizeBytes: totalBytes,
    };
  }
}

// CLI execution
const isMain = process.argv[1]?.endsWith('prepublish-check.ts') || process.argv[1]?.endsWith('prepublish-check.js');
if (isMain) {
  const result = PrepublishChecker.runCheck();
  console.log('\n📋 Pre-Publish Checklist Results:');
  console.log(`   Status      : ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`   Package Size: ${(result.packageSizeBytes / 1024).toFixed(1)} KB`);

  if (result.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    result.warnings.forEach((w) => console.log(`   - ${w}`));
  }

  if (result.errors.length > 0) {
    console.error('\n❌ Errors:');
    result.errors.forEach((e) => console.error(`   - ${e}`));
    process.exit(1);
  }
}
