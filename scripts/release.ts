/**
 * Automated Semantic Versioning and Changelog Release Script.
 *
 * Implements Conventional Commits parsing, semantic version bump calculation,
 * CHANGELOG.md generation, package.json update, and Git tagging.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

export type BumpType = 'major' | 'minor' | 'patch' | 'none';

export interface ParsedCommit {
  hash?: string;
  type: string;
  scope?: string;
  subject: string;
  body?: string;
  isBreaking: boolean;
}

export interface ReleaseOptions {
  rootDir?: string;
  dryRun?: boolean;
  commits?: string[];
  forceBump?: BumpType;
  date?: string;
  skipGit?: boolean;
}

export interface ReleaseResult {
  previousVersion: string;
  nextVersion: string;
  bumpType: BumpType;
  parsedCommits: ParsedCommit[];
  changelogExcerpt: string;
  dryRun: boolean;
}

export class SemanticReleaseEngine {
  /**
   * Parse conventional commit messages.
   */
  static parseCommit(message: string, hash?: string): ParsedCommit {
    const lines = message.trim().split('\n');
    const firstLine = lines[0] ?? '';
    const body = lines.slice(1).join('\n').trim();

    // Check for BREAKING CHANGE in body/footer
    const hasBreakingFooter = /BREAKING[ -]CHANGE:/i.test(message);

    // Conventional commit regex: type(scope)!: subject or type!: subject or type(scope): subject
    const match = firstLine.match(/^([a-zA-Z]+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/);
    if (!match) {
      return {
        hash,
        type: 'chore',
        subject: firstLine,
        body: body || undefined,
        isBreaking: hasBreakingFooter,
      };
    }

    const [, type, scope, exclamation, subject] = match;
    const isBreaking = Boolean(exclamation) || hasBreakingFooter;

    return {
      hash,
      type: type?.toLowerCase() ?? 'chore',
      scope: scope ? scope.trim() : undefined,
      subject: subject?.trim() ?? '',
      body: body || undefined,
      isBreaking,
    };
  }

  /**
   * Determine version bump type based on parsed commits.
   */
  static determineBumpType(commits: ParsedCommit[]): BumpType {
    let hasMajor = false;
    let hasMinor = false;
    let hasPatch = false;

    for (const c of commits) {
      if (c.isBreaking) {
        hasMajor = true;
      } else if (c.type === 'feat') {
        hasMinor = true;
      } else if (['fix', 'perf', 'refactor', 'revert'].includes(c.type)) {
        hasPatch = true;
      }
    }

    if (hasMajor) return 'major';
    if (hasMinor) return 'minor';
    if (hasPatch) return 'patch';
    return 'patch'; // Default to patch if any changes present
  }

  /**
   * Calculate next semver version string.
   */
  static calculateNextVersion(currentVersion: string, bumpType: BumpType): string {
    const clean = currentVersion.replace(/^v/, '');
    const parts = clean.split('.').map(Number);
    let major = parts[0] ?? 0;
    let minor = parts[1] ?? 1;
    let patch = parts[2] ?? 0;

    switch (bumpType) {
      case 'major':
        major += 1;
        minor = 0;
        patch = 0;
        break;
      case 'minor':
        minor += 1;
        patch = 0;
        break;
      case 'patch':
        patch += 1;
        break;
      case 'none':
        break;
    }

    return `${major}.${minor}.${patch}`;
  }

  /**
   * Format changelog section in Markdown.
   */
  static formatChangelogSection(version: string, commits: ParsedCommit[], date = new Date().toISOString().slice(0, 10)): string {
    const breaking = commits.filter((c) => c.isBreaking);
    const features = commits.filter((c) => !c.isBreaking && c.type === 'feat');
    const fixes = commits.filter((c) => !c.isBreaking && c.type === 'fix');
    const performance = commits.filter((c) => !c.isBreaking && c.type === 'perf');
    const refactors = commits.filter((c) => !c.isBreaking && (c.type === 'refactor' || c.type === 'revert'));
    const others = commits.filter(
      (c) => !c.isBreaking && !['feat', 'fix', 'perf', 'refactor', 'revert'].includes(c.type),
    );

    let md = `## [${version}] - ${date}\n\n`;

    if (breaking.length > 0) {
      md += `### ⚠️ Breaking Changes\n`;
      for (const c of breaking) {
        md += `- **${c.scope ? c.scope + ': ' : ''}**${c.subject}\n`;
      }
      md += `\n`;
    }

    if (features.length > 0) {
      md += `### 🚀 Features\n`;
      for (const c of features) {
        md += `- ${c.scope ? `**${c.scope}**: ` : ''}${c.subject}\n`;
      }
      md += `\n`;
    }

    if (fixes.length > 0) {
      md += `### 🐛 Bug Fixes\n`;
      for (const c of fixes) {
        md += `- ${c.scope ? `**${c.scope}**: ` : ''}${c.subject}\n`;
      }
      md += `\n`;
    }

    if (performance.length > 0) {
      md += `### ⚡ Performance Improvements\n`;
      for (const c of performance) {
        md += `- ${c.scope ? `**${c.scope}**: ` : ''}${c.subject}\n`;
      }
      md += `\n`;
    }

    if (refactors.length > 0) {
      md += `### 🔄 Refactoring & Maintenance\n`;
      for (const c of refactors) {
        md += `- ${c.scope ? `**${c.scope}**: ` : ''}${c.subject}\n`;
      }
      md += `\n`;
    }

    if (others.length > 0) {
      md += `### 📦 Documentation & Tooling\n`;
      for (const c of others) {
        md += `- ${c.scope ? `**${c.scope}**: ` : ''}${c.subject}\n`;
      }
      md += `\n`;
    }

    return md;
  }

  /**
   * Run semantic release workflow.
   */
  static runRelease(options: ReleaseOptions = {}): ReleaseResult {
    const rootDir = options.rootDir ?? process.cwd();
    const dryRun = options.dryRun ?? false;
    const pkgPath = path.join(rootDir, 'package.json');
    const changelogPath = path.join(rootDir, 'CHANGELOG.md');

    if (!fs.existsSync(pkgPath)) {
      throw new Error(`package.json not found at ${pkgPath}`);
    }

    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const previousVersion = pkg.version ?? '0.1.0';

    // 1. Gather raw commits
    let rawCommitMessages: string[] = [];
    if (options.commits && options.commits.length > 0) {
      rawCommitMessages = options.commits;
    } else {
      try {
        const gitLog = execSync('git log -n 50 --pretty=format:"%h||%s||%b---END---"', {
          cwd: rootDir,
          encoding: 'utf-8',
        });
        rawCommitMessages = gitLog
          .split('---END---')
          .map((s) => s.trim())
          .filter(Boolean);
      } catch {
        rawCommitMessages = ['feat(core): initial release of vi-harness engine'];
      }
    }

    const parsedCommits: ParsedCommit[] = rawCommitMessages.map((msg) => {
      if (msg.includes('||')) {
        const [h, s, b] = msg.split('||');
        return SemanticReleaseEngine.parseCommit(`${s}\n${b ?? ''}`, h);
      }
      return SemanticReleaseEngine.parseCommit(msg);
    });

    // 2. Determine bump and next version
    const bumpType = options.forceBump ?? SemanticReleaseEngine.determineBumpType(parsedCommits);
    const nextVersion = SemanticReleaseEngine.calculateNextVersion(previousVersion, bumpType);

    // 3. Format changelog excerpt
    const changelogExcerpt = SemanticReleaseEngine.formatChangelogSection(nextVersion, parsedCommits, options.date);

    if (!dryRun) {
      // 4. Update package.json
      pkg.version = nextVersion;
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');

      // 5. Update CHANGELOG.md
      let currentChangelog = '';
      if (fs.existsSync(changelogPath)) {
        currentChangelog = fs.readFileSync(changelogPath, 'utf-8');
      } else {
        currentChangelog = '# Changelog\n\nAll notable changes to Vi-Harness are documented here.\n\n';
      }

      const headerIdx = currentChangelog.indexOf('\n\n## ');
      let updatedChangelog = '';
      if (headerIdx >= 0) {
        const header = currentChangelog.substring(0, headerIdx + 2);
        const rest = currentChangelog.substring(headerIdx + 2);
        updatedChangelog = `${header}${changelogExcerpt}${rest}`;
      } else {
        updatedChangelog = `${currentChangelog}\n${changelogExcerpt}`;
      }

      fs.writeFileSync(changelogPath, updatedChangelog, 'utf-8');

      // 6. Git commit & tag
      if (!options.skipGit) {
        try {
          execSync(`git add package.json CHANGELOG.md`, { cwd: rootDir });
          execSync(`git commit -m "chore(release): v${nextVersion}"`, { cwd: rootDir });
          execSync(`git tag v${nextVersion}`, { cwd: rootDir });
        } catch {
          // Ignore Git errors in environments without Git configured
        }
      }
    }

    return {
      previousVersion,
      nextVersion,
      bumpType,
      parsedCommits,
      changelogExcerpt,
      dryRun,
    };
  }
}

// CLI execution
const isMain = process.argv[1]?.endsWith('release.ts') || process.argv[1]?.endsWith('release.js');
if (isMain) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  try {
    const result = SemanticReleaseEngine.runRelease({ dryRun });
    console.log(`\n🎉 Semantic Release (${dryRun ? 'DRY RUN' : 'EXECUTED'}):`);
    console.log(`   Previous Version: v${result.previousVersion}`);
    console.log(`   Next Version    : v${result.nextVersion} (${result.bumpType} bump)`);
    console.log(`\n${result.changelogExcerpt}`);
  } catch (err: any) {
    console.error('❌ Release failed:', err.message);
    process.exit(1);
  }
}
