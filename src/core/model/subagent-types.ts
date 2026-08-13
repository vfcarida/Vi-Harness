/**
 * Subagent Manager Domain Types.
 *
 * "Subagents return artifacts and evidence, not entire transcripts."
 *
 * Defines subagent roles (EXPLORE, CODER, TESTER, REVIEWER, SECURITY_REVIEWER, DOCUMENTATION_REVIEWER),
 * working scope, artifacts, execution specs, and aggregated results.
 */
import type { SubagentId } from '../types/identifiers.js';
import type { Evidence } from './evidence.js';

// ---------------------------------------------------------------------------
// Subagent Roles
// ---------------------------------------------------------------------------

export enum SubagentRole {
  EXPLORE = 'EXPLORE',
  CODER = 'CODER',
  TESTER = 'TESTER',
  REVIEWER = 'REVIEWER',
  SECURITY_REVIEWER = 'SECURITY_REVIEWER',
  DOCUMENTATION_REVIEWER = 'DOCUMENTATION_REVIEWER',
}

// ---------------------------------------------------------------------------
// Subagent Working Scope & Artifact
// ---------------------------------------------------------------------------

export interface SubagentScope {
  readonly workingDirectory?: string;
  readonly filePaths?: ReadonlyArray<string>;
  readonly readOnly?: boolean;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface SubagentArtifact {
  readonly id: string;
  readonly type: 'code-patch' | 'report' | 'test-suite' | 'diff' | 'document' | string;
  readonly path?: string;
  readonly content: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Subagent Execution Spec
// ---------------------------------------------------------------------------

export interface SubagentSpec {
  readonly id?: SubagentId;
  readonly role: SubagentRole;
  readonly description: string;
  readonly scope: SubagentScope;
  readonly allowedTools: ReadonlyArray<string>;
  readonly maxContextTokens: number;
  readonly maxIterations: number;
  readonly timeoutMs: number;
  readonly modelCategory?: string;
  readonly dependencies?: ReadonlyArray<SubagentId>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Subagent Execution Result (No full transcripts returned to parent!)
// ---------------------------------------------------------------------------

export interface SubagentResult {
  readonly subagentId: SubagentId;
  readonly role: SubagentRole;
  readonly success: boolean;
  readonly summary: string;
  readonly artifacts: ReadonlyArray<SubagentArtifact>;
  readonly evidence: ReadonlyArray<Evidence>;
  readonly decisions: ReadonlyArray<string>;
  readonly unresolvedIssues: ReadonlyArray<string>;
  readonly iterationCount: number;
  readonly durationMs: number;
  readonly error?: string;
}
