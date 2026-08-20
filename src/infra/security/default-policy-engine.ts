// Pattern: 7-layer security perimeter (ref: Claude Code)
/**
 * Default Policy Engine.
 *
 * "Model output is an untrusted proposal."
 * "Every irreversible action is policy-controlled."
 *
 * Implements PolicyEngine with Deny-First Precedence:
 * - If ANY rule evaluates to DENY, the overall decision is DENY.
 * - Else if ANY rule evaluates to REQUIRE_APPROVAL or ESCALATE, decision is REQUIRE_APPROVAL.
 * - Else if ANY rule evaluates to ALLOW_WITH_RESTRICTIONS, decision is ALLOW_WITH_RESTRICTIONS.
 * - Otherwise decision is ALLOW.
 *
 * Security:
 * - Replay Defense: Tracks consumed approval nonces/tokens to prevent replay of destructive approved actions.
 * - Audit Trail: Maintains structured audit logs of all evaluated decisions.
 */
import type { PolicyEngine, PolicyRule } from '../../core/interfaces/policy-engine.js';
import type { PolicyAction, PolicyDecision, PermissionContext } from '../../core/model/policy.js';
import { PolicyDecisionType, DEFAULT_PERMISSION_CONTEXT } from '../../core/model/policy.js';
import { CredentialProtectionRule } from './rules/credential-protection-rule.js';
import { PathRestrictionRule } from './rules/path-restriction-rule.js';
import { CommandRestrictionRule } from './rules/command-restriction-rule.js';
import { NetworkAccessRule } from './rules/network-access-rule.js';
import { ProductionProtectionRule } from './rules/production-protection-rule.js';
import { RiskClassifier } from './risk-classifier.js';

export class DefaultPolicyEngine implements PolicyEngine {
  private readonly rules = new Map<string, PolicyRule>();
  private readonly auditLogs: PolicyDecision[] = [];
  private readonly consumedApprovalNonces = new Set<string>();

  constructor() {
    // Register default security rules
    this.addRule(new CredentialProtectionRule());
    this.addRule(new CommandRestrictionRule());
    this.addRule(new PathRestrictionRule());
    this.addRule(new NetworkAccessRule());
    this.addRule(new ProductionProtectionRule());
  }

  addRule(rule: PolicyRule): void {
    this.rules.set(rule.id, rule);
  }

  removeRule(id: string): boolean {
    return this.rules.delete(id);
  }

  listRules(): ReadonlyArray<PolicyRule> {
    return Array.from(this.rules.values());
  }

  getAuditLogs(): ReadonlyArray<PolicyDecision> {
    return this.auditLogs;
  }

  /**
   * Consume an approval token to prevent replay attacks.
   */
  consumeApprovalToken(token: string): boolean {
    if (this.consumedApprovalNonces.has(token)) {
      return false; // Already consumed
    }
    this.consumedApprovalNonces.add(token);
    return true;
  }

  async evaluate(action: PolicyAction, context?: PermissionContext): Promise<PolicyDecision> {
    const permContext = context ?? DEFAULT_PERMISSION_CONTEXT;
    const now = new Date();

    // 1. Replay Defense Check for Approved Destructive Actions
    const approvalNonce = permContext.metadata?.['approvalNonce'] as string | undefined;
    if (approvalNonce && this.consumedApprovalNonces.has(approvalNonce)) {
      const replayDenial: PolicyDecision = {
        decision: PolicyDecisionType.DENY,
        reason: `Replay attack detected: approval token [${approvalNonce}] has already been consumed.`,
        ruleId: 'rule-replay-defense',
        evaluatedAt: now,
        action,
      };
      this.auditLogs.push(replayDenial);
      return replayDenial;
    }

    // Ensure categories are populated via RiskClassifier
    const categories = action.categories ?? RiskClassifier.classify(action);
    const enrichedAction: PolicyAction = {
      ...action,
      categories,
    };

    let finalDecision: PolicyDecisionType = PolicyDecisionType.ALLOW;
    let finalReason = 'Action permitted by all active policy rules.';
    let matchedRuleId: string | undefined;
    const restrictions: string[] = [];

    // 2. Evaluate all registered rules (Deny-First Precedence)
    for (const rule of this.rules.values()) {
      const decision = await rule.evaluate(enrichedAction, permContext);

      if (decision.decision === PolicyDecisionType.DENY) {
        // Deny-First Precedence: Immediately halt and return DENY
        const denyResult: PolicyDecision = {
          decision: PolicyDecisionType.DENY,
          reason: decision.reason,
          ruleId: rule.id,
          evaluatedAt: now,
          action: enrichedAction,
        };
        this.auditLogs.push(denyResult);
        return denyResult;
      }

      if (
        (decision.decision === PolicyDecisionType.REQUIRE_APPROVAL ||
          decision.decision === PolicyDecisionType.ESCALATE) &&
        !permContext.userApproved
      ) {
        finalDecision = PolicyDecisionType.REQUIRE_APPROVAL;
        finalReason = decision.reason;
        matchedRuleId = rule.id;
      } else if (
        decision.decision === PolicyDecisionType.ALLOW_WITH_RESTRICTIONS &&
        finalDecision !== PolicyDecisionType.REQUIRE_APPROVAL
      ) {
        finalDecision = PolicyDecisionType.ALLOW_WITH_RESTRICTIONS;
        finalReason = decision.reason;
        matchedRuleId = rule.id;
        if (decision.restrictions) {
          restrictions.push(...decision.restrictions);
        }
      }
    }

    // If approved, mark nonce as consumed
    if (permContext.userApproved && approvalNonce) {
      this.consumedApprovalNonces.add(approvalNonce);
    }

    const finalResult: PolicyDecision = {
      decision: finalDecision,
      reason: finalReason,
      ruleId: matchedRuleId,
      evaluatedAt: now,
      action: enrichedAction,
      restrictions: restrictions.length > 0 ? restrictions : undefined,
    };

    this.auditLogs.push(finalResult);
    return finalResult;
  }
}
