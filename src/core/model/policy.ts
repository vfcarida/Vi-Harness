/**
 * Policy & Security Domain Types.
 *
 * "Model output is an untrusted proposal."
 * "Every irreversible action is policy-controlled."
 *
 * Defines policy decisions (ALLOW, DENY, REQUIRE_APPROVAL, ALLOW_WITH_RESTRICTIONS, ESCALATE),
 * risk classification categories, permission context, and policy decision audit objects.
 */

// ---------------------------------------------------------------------------
// Policy Decision Types
// ---------------------------------------------------------------------------

export enum PolicyDecisionType {
  ALLOW = 'ALLOW',
  DENY = 'DENY',
  REQUIRE_APPROVAL = 'REQUIRE_APPROVAL',
  ALLOW_WITH_RESTRICTIONS = 'ALLOW_WITH_RESTRICTIONS',
  ESCALATE = 'ESCALATE',
}

// ---------------------------------------------------------------------------
// Action Risk Categories
// ---------------------------------------------------------------------------

export enum ActionRiskCategory {
  READ = 'READ',
  WRITE = 'WRITE',
  EXECUTE = 'EXECUTE',
  NETWORK = 'NETWORK',
  CREDENTIALS = 'CREDENTIALS',
  PACKAGE_INSTALLATION = 'PACKAGE_INSTALLATION',
  PRODUCTION_IMPACTING = 'PRODUCTION_IMPACTING',
  DESTRUCTIVE = 'DESTRUCTIVE',
}

// ---------------------------------------------------------------------------
// Permission Context
// ---------------------------------------------------------------------------

export interface PermissionContext {
  readonly allowedPaths: ReadonlyArray<string>;
  readonly forbiddenPaths: ReadonlyArray<string>;
  readonly allowedCommands: ReadonlyArray<string>;
  readonly forbiddenCommands: ReadonlyArray<string>;
  readonly networkAccess: boolean;
  readonly userApproved?: boolean;
  readonly environment: 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION';
}

export const DEFAULT_PERMISSION_CONTEXT: Readonly<PermissionContext> = {
  allowedPaths: ['./', 'src/', 'tests/', 'dist/'],
  forbiddenPaths: [
    '**/.env*',
    '**/*.pem',
    '**/*.key',
    '**/id_rsa*',
    '**/id_ed25519*',
    '**/.aws/**',
    '**/credentials*',
    '**/secrets*',
    '/etc/**',
    'C:/Windows/**',
  ],
  allowedCommands: ['npm test', 'npm run build', 'tsc', 'git status', 'git diff'],
  forbiddenCommands: [
    'sudo',
    'su',
    'rm -rf /',
    'rm -rf *',
    'git push --force',
    'git push -f',
    'mkfs',
    'dd if=',
    'chmod 777',
  ],
  networkAccess: false,
  userApproved: false,
  environment: 'DEVELOPMENT',
};

// ---------------------------------------------------------------------------
// Policy Action & Decision
// ---------------------------------------------------------------------------

export interface PolicyAction {
  /** Action type (e.g. 'READ', 'WRITE', 'EXECUTE', 'NETWORK'). */
  readonly type: string;

  /** Resource being acted upon (e.g. file path, command string, URL). */
  readonly resource: string;

  /** Structured metadata about the action. */
  readonly metadata: Readonly<Record<string, unknown>>;

  /** Whether this action is irreversible. */
  readonly irreversible: boolean;

  /** Risk categories assigned by RiskClassifier. */
  readonly categories?: ReadonlyArray<ActionRiskCategory>;
}

export interface PolicyDecision {
  readonly decision: PolicyDecisionType;
  readonly reason: string;
  readonly ruleId?: string;
  readonly evaluatedAt: Date;
  readonly action: PolicyAction;
  readonly restrictions?: ReadonlyArray<string>;
}
