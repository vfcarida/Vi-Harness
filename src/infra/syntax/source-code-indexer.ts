/**
 * Source Code Indexer & Symbol Map Generator.
 *
 * Emulates the Aider AST / Tree-Sitter Repo-Map indexer to extract concise
 * signatures, classes, functions, and interfaces across multiple languages
 * (TypeScript, JavaScript, Python, Go, Rust, Java).
 *
 * Compresses large codebases into high-density structural outlines,
 * allowing the ContextCompiler to bring exact signatures rather than raw files.
 */
import * as path from 'path';
import type {
  CodeSymbol,
  FileSymbolMap,
  RepoSymbolMap,
  RepoMapRenderOptions,
} from '../../core/model/symbol-types.js';
import { SymbolKind } from '../../core/model/symbol-types.js';

export class SourceCodeIndexer {
  /**
   * Parse a source code string and extract its symbol map and structural outline.
   */
  static parseFile(filePath: string, content: string): FileSymbolMap {
    const ext = path.extname(filePath).toLowerCase();
    const language = this.detectLanguage(ext);
    const lines = content.split(/\r?\n/);
    const symbols: CodeSymbol[] = [];
    const imports: string[] = [];
    const exports: string[] = [];

    switch (language) {
      case 'typescript':
      case 'javascript':
        this.parseTypeScriptOrJavaScript(filePath, lines, symbols, imports, exports);
        break;
      case 'python':
        this.parsePython(filePath, lines, symbols, imports, exports);
        break;
      case 'go':
        this.parseGo(filePath, lines, symbols, imports, exports);
        break;
      default:
        this.parseGeneric(filePath, lines, symbols, imports, exports);
        break;
    }

    const outline = this.generateOutline(filePath, symbols, imports);

    return {
      filePath,
      language,
      symbols,
      imports,
      exports,
      totalLines: lines.length,
      outline,
    };
  }

  /**
   * Builds a full RepoSymbolMap from a collection of file paths and contents.
   */
  static buildRepoMap(files: Map<string, string>): RepoSymbolMap {
    const fileMaps = new Map<string, FileSymbolMap>();
    let totalSymbols = 0;

    for (const [filePath, content] of files.entries()) {
      const fileMap = this.parseFile(filePath, content);
      fileMaps.set(filePath, fileMap);
      totalSymbols += fileMap.symbols.length;
    }

    return {
      rootPath: '.',
      files: fileMaps,
      totalSymbols,
      totalFiles: fileMaps.size,
      generatedAt: new Date(),
    };
  }

  /**
   * Renders a compact Aider-style Repo-Map formatted string within token constraints.
   */
  static renderRepoMap(
    repoMap: RepoSymbolMap,
    options?: RepoMapRenderOptions,
  ): string {
    const maxTokens = options?.maxTokens ?? 2500;
    const focusFiles = new Set(options?.focusFiles ?? []);
    const sections: string[] = [];
    let estimatedTokens = 0;

    // Prioritize focus files first, then sort remaining alphabetically
    const sortedFiles = Array.from(repoMap.files.values()).sort((a, b) => {
      const aFocus = focusFiles.has(a.filePath) ? 1 : 0;
      const bFocus = focusFiles.has(b.filePath) ? 1 : 0;
      if (aFocus !== bFocus) return bFocus - aFocus;
      return a.filePath.localeCompare(b.filePath);
    });

    for (const fileMap of sortedFiles) {
      if (fileMap.symbols.length === 0 && !focusFiles.has(fileMap.filePath)) {
        continue;
      }

      const fileSection = fileMap.outline;
      const sectionTokens = Math.ceil(fileSection.length / 4);

      if (estimatedTokens + sectionTokens > maxTokens && sections.length > 0) {
        sections.push(`\n# ... [${repoMap.totalFiles - sections.length} more files omitted for token budget]`);
        break;
      }

      sections.push(fileSection);
      estimatedTokens += sectionTokens;
    }

    return sections.join('\n\n');
  }

  // -------------------------------------------------------------------------
  // Language Parsers
  // -------------------------------------------------------------------------

  private static parseTypeScriptOrJavaScript(
    filePath: string,
    lines: string[],
    symbols: CodeSymbol[],
    imports: string[],
    exports: string[],
  ): void {
    let currentClass: string | undefined = undefined;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!.trim();
      const lineNum = i + 1;

      // Imports
      if (line.startsWith('import ') || line.startsWith('import type ')) {
        imports.push(line);
        continue;
      }

      // Class declaration
      const classMatch = line.match(/^(export\s+)?(abstract\s+)?class\s+([A-Za-z0-9_]+)/);
      if (classMatch && classMatch[3]) {
        const isExported = !!classMatch[1];
        const name = classMatch[3];
        currentClass = name;
        if (isExported) exports.push(name);
        symbols.push({
          name,
          kind: SymbolKind.CLASS,
          signature: line.replace(/\{.*$/, '').trim(),
          filePath,
          startLine: lineNum,
          endLine: lineNum,
          isExported,
        });
        continue;
      }

      // Interface declaration
      const interfaceMatch = line.match(/^(export\s+)?interface\s+([A-Za-z0-9_]+)/);
      if (interfaceMatch && interfaceMatch[2]) {
        const isExported = !!interfaceMatch[1];
        const name = interfaceMatch[2];
        if (isExported) exports.push(name);
        symbols.push({
          name,
          kind: SymbolKind.INTERFACE,
          signature: line.replace(/\{.*$/, '').trim(),
          filePath,
          startLine: lineNum,
          endLine: lineNum,
          isExported,
        });
        continue;
      }

      // Type alias
      const typeMatch = line.match(/^(export\s+)?type\s+([A-Za-z0-9_]+)/);
      if (typeMatch && typeMatch[2]) {
        const isExported = !!typeMatch[1];
        const name = typeMatch[2];
        if (isExported) exports.push(name);
        symbols.push({
          name,
          kind: SymbolKind.TYPE_ALIAS,
          signature: line.trim(),
          filePath,
          startLine: lineNum,
          endLine: lineNum,
          isExported,
        });
        continue;
      }

      // Enum declaration
      const enumMatch = line.match(/^(export\s+)?enum\s+([A-Za-z0-9_]+)/);
      if (enumMatch && enumMatch[2]) {
        const isExported = !!enumMatch[1];
        const name = enumMatch[2];
        if (isExported) exports.push(name);
        symbols.push({
          name,
          kind: SymbolKind.ENUM,
          signature: line.replace(/\{.*$/, '').trim(),
          filePath,
          startLine: lineNum,
          endLine: lineNum,
          isExported,
        });
        continue;
      }

      // Function declaration
      const funcMatch = line.match(/^(export\s+)?(async\s+)?function\s+([A-Za-z0-9_]+)/);
      if (funcMatch && funcMatch[3]) {
        const isExported = !!funcMatch[1];
        const name = funcMatch[3];
        if (isExported) exports.push(name);
        symbols.push({
          name,
          kind: SymbolKind.FUNCTION,
          signature: line.replace(/\{.*$/, '').trim(),
          filePath,
          startLine: lineNum,
          endLine: lineNum,
          isExported,
        });
        continue;
      }

      // Methods inside class
      if (currentClass && line.match(/^(public\s+|private\s+|protected\s+|static\s+|async\s+)*[A-Za-z0-9_]+\s*\([^)]*\)/)) {
        const methodMatch = line.match(/([A-Za-z0-9_]+)\s*\([^)]*\)/);
        if (methodMatch && methodMatch[1] && methodMatch[1] !== 'if' && methodMatch[1] !== 'for' && methodMatch[1] !== 'while') {
          const name = methodMatch[1];
          symbols.push({
            name,
            kind: SymbolKind.METHOD,
            signature: line.replace(/\{.*$/, '').trim(),
            filePath,
            startLine: lineNum,
            endLine: lineNum,
            isExported: false,
            parentSymbolName: currentClass,
          });
        }
      }

      if (line === '}') {
        currentClass = undefined;
      }
    }
  }

  private static parsePython(
    filePath: string,
    lines: string[],
    symbols: CodeSymbol[],
    imports: string[],
    _exports: string[],
  ): void {
    let currentClass: string | undefined = undefined;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const trimmed = line.trim();
      const lineNum = i + 1;

      if (trimmed.startsWith('import ') || trimmed.startsWith('from ')) {
        imports.push(trimmed);
        continue;
      }

      const classMatch = trimmed.match(/^class\s+([A-Za-z0-9_]+)/);
      if (classMatch && classMatch[1]) {
        const name = classMatch[1];
        currentClass = name;
        symbols.push({
          name,
          kind: SymbolKind.CLASS,
          signature: trimmed.replace(/:.*$/, '').trim(),
          filePath,
          startLine: lineNum,
          endLine: lineNum,
          isExported: true,
        });
        continue;
      }

      const funcMatch = trimmed.match(/^def\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/);
      if (funcMatch && funcMatch[1]) {
        const name = funcMatch[1];
        const isMethod = line.startsWith('    ') || line.startsWith('\t');
        symbols.push({
          name,
          kind: isMethod ? SymbolKind.METHOD : SymbolKind.FUNCTION,
          signature: trimmed.replace(/:.*$/, '').trim(),
          filePath,
          startLine: lineNum,
          endLine: lineNum,
          isExported: !name.startsWith('_'),
          parentSymbolName: isMethod ? currentClass : undefined,
        });
      }
    }
  }

  private static parseGo(
    filePath: string,
    lines: string[],
    symbols: CodeSymbol[],
    imports: string[],
    exports: string[],
  ): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!.trim();
      const lineNum = i + 1;

      if (line.startsWith('import ')) {
        imports.push(line);
      }

      const structMatch = line.match(/^type\s+([A-Z][A-Za-z0-9_]*)\s+struct/);
      if (structMatch && structMatch[1]) {
        const name = structMatch[1];
        exports.push(name);
        symbols.push({
          name,
          kind: SymbolKind.CLASS,
          signature: line.replace(/\{.*$/, '').trim(),
          filePath,
          startLine: lineNum,
          endLine: lineNum,
          isExported: true,
        });
        continue;
      }

      const funcMatch = line.match(/^func\s+(\([^)]+\)\s+)?([A-Za-z0-9_]+)\s*\(/);
      if (funcMatch && funcMatch[2]) {
        const isMethod = !!funcMatch[1];
        const name = funcMatch[2];
        const isExported = /^[A-Z]/.test(name);
        if (isExported) exports.push(name);
        symbols.push({
          name,
          kind: isMethod ? SymbolKind.METHOD : SymbolKind.FUNCTION,
          signature: line.replace(/\{.*$/, '').trim(),
          filePath,
          startLine: lineNum,
          endLine: lineNum,
          isExported,
        });
      }
    }
  }

  private static parseGeneric(
    filePath: string,
    lines: string[],
    symbols: CodeSymbol[],
    _imports: string[],
    _exports: string[],
  ): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!.trim();
      const lineNum = i + 1;
      const fnMatch = line.match(/(function|class|def|fn)\s+([A-Za-z0-9_]+)/);
      if (fnMatch && fnMatch[2]) {
        symbols.push({
          name: fnMatch[2],
          kind: fnMatch[1] === 'class' ? SymbolKind.CLASS : SymbolKind.FUNCTION,
          signature: line,
          filePath,
          startLine: lineNum,
          endLine: lineNum,
          isExported: true,
        });
      }
    }
  }

  private static generateOutline(
    filePath: string,
    symbols: CodeSymbol[],
    imports: string[],
  ): string {
    const lines: string[] = [`File: ${filePath}`];

    if (imports.length > 0) {
      lines.push(`  // Imports (${imports.length}):`);
      for (const imp of imports.slice(0, 3)) {
        lines.push(`  ${imp}`);
      }
      if (imports.length > 3) {
        lines.push(`  // ... [${imports.length - 3} more imports]`);
      }
    }

    if (symbols.length > 0) {
      lines.push('  // Symbols:');
      for (const sym of symbols) {
        const indent = sym.parentSymbolName ? '    ' : '  ';
        lines.push(`${indent}${sym.signature}`);
      }
    } else {
      lines.push('  // (No top-level exported symbols detected)');
    }

    return lines.join('\n');
  }

  private static detectLanguage(ext: string): string {
    switch (ext) {
      case '.ts':
      case '.tsx':
        return 'typescript';
      case '.js':
      case '.jsx':
      case '.mjs':
      case '.cjs':
        return 'javascript';
      case '.py':
        return 'python';
      case '.go':
        return 'go';
      case '.rs':
        return 'rust';
      case '.java':
        return 'java';
      default:
        return 'unknown';
    }
  }
}
