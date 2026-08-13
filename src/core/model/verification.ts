/**
 * Verification Domain Types.
 *
 * Verification produces structured results that become evidence.
 * "The agent does not self-assess — it verifies through external signals."
 *
 * Defines VerificationProfiles (FAST, STANDARD, FULL, SECURITY, PRE_RELEASE),
 * status types, check definitions, suites, and structured verification results.
 */
import type { EvidenceId, TaskId } from '../types/identifiers.js';

// ---------------------------------------------------------------------------
// Verification Profiles & Statuses
// ---------------------------------------------------------------------------

export enum VerificationProfile {
  FAST = 'FAST',
  STANDARD = 'STANDARD',
  FULL = 'FULL',
  SECURITY = 'SECURITY',
  PRE_RELEASE = 'PRE_RELEASE',
}

export enum VerificationStatus {
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  WARNING = 'WARNING',
  INCONCLUSIVE = 'INCONCLUSIVE',
  SKIPPED = 'SKIPPED',
  ERROR = 'ERROR',
}

// ---------------------------------------------------------------------------
// Verification Check & Suite Definitions
// ---------------------------------------------------------------------------

export interface VerificationCheck {
  readonly checkId: string;
  readonly name: string;
  readonly command: string;
  readonly category:
    | 'unit-test'
    | 'integration-test'
    | 'typecheck'
    | 'linter'
    | 'static-analysis'
    | 'security-scan'
    | 'coverage'
    | 'performance';
  readonly scope: 'file' | 'module' | 'repository';
  readonly affectedFiles?: ReadonlyArray<string>;
}

export interface VerificationSuite {
  readonly id: string;
  readonly name: string;
  readonly profile: VerificationProfile;
  readonly checks: ReadonlyArray<VerificationCheck>;
}

// ---------------------------------------------------------------------------
// Verification Result Structure
// ---------------------------------------------------------------------------

export interface VerificationResult {
  readonly status: VerificationStatus;
  readonly summary: string;
  readonly evidenceIds: ReadonlyArray<EvidenceId>;
  readonly taskId: TaskId;
  readonly verifiedAt: Date;
  readonly checkId?: string;
  readonly suiteId?: string;
  readonly durationMs: number;
  readonly confidence: number;
  readonly scope: string;
  readonly affectedFiles: ReadonlyArray<string>;
  readonly structuredOutput?: Readonly<Record<string, unknown>>;
  readonly rawArtifactRef?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}
