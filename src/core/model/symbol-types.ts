/**
 * Source Code Symbol & Syntax Map Types.
 *
 * Defines canonical data models for AST-based code indexing,
 * symbol map generation, and dynamic context manipulation (Aider-style).
 */

export enum SymbolKind {
  CLASS = 'CLASS',
  INTERFACE = 'INTERFACE',
  FUNCTION = 'FUNCTION',
  METHOD = 'METHOD',
  TYPE_ALIAS = 'TYPE_ALIAS',
  ENUM = 'ENUM',
  VARIABLE = 'VARIABLE',
  IMPORT = 'IMPORT',
}

export interface CodeSymbol {
  readonly name: string;
  readonly kind: SymbolKind;
  readonly signature: string;
  readonly filePath: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly isExported: boolean;
  readonly docstring?: string;
  readonly parentSymbolName?: string;
}

export interface FileSymbolMap {
  readonly filePath: string;
  readonly language: string;
  readonly symbols: ReadonlyArray<CodeSymbol>;
  readonly imports: ReadonlyArray<string>;
  readonly exports: ReadonlyArray<string>;
  readonly totalLines: number;
  readonly outline: string;
}

export interface RepoSymbolMap {
  readonly rootPath: string;
  readonly files: ReadonlyMap<string, FileSymbolMap>;
  readonly totalSymbols: number;
  readonly totalFiles: number;
  readonly generatedAt: Date;
}

export interface SymbolIndexOptions {
  readonly maxDepth?: number;
  readonly includeExtensions?: ReadonlyArray<string>;
  readonly excludePatterns?: ReadonlyArray<string>;
  readonly maxFileSizeBytes?: number;
}

export interface RepoMapRenderOptions {
  readonly maxTokens?: number;
  readonly focusFiles?: ReadonlyArray<string>;
  readonly verbose?: boolean;
}

export type DynamicContextAction = 'ADD' | 'DROP' | 'FOCUS' | 'RESET';

export interface DynamicContextCommand {
  readonly action: DynamicContextAction;
  readonly targetPath?: string;
  readonly rawCommand: string;
}
