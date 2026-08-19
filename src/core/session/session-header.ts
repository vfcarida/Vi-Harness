/**
 * Session Header.
 *
 * Defines metadata, provenance, and tree-branching lineage for a session.
 */
import type { SessionId } from '../types/identifiers.js';

export interface SessionHeader {
  readonly version: number;
  readonly id: SessionId;
  readonly createdAt: number;
  readonly cwd?: string;
  readonly parentSession?: SessionId;
  readonly parentId?: SessionId;
  readonly seedLength?: number;
  readonly branchPoint?: number;
  readonly delegationDepth?: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
