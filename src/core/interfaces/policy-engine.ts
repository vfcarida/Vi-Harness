/**
 * PolicyEngine interface.
 *
 * "Model output is an untrusted proposal."
 * "Every irreversible action is policy-controlled."
 *
 * Evaluates proposed actions against registered rules using deny-first semantics.
 */
import type { PolicyAction, PolicyDecision, PermissionContext } from '../model/policy.js';

export interface PolicyRule {
  /** Unique rule identifier. */
  readonly id: string;

  /** Human-readable rule name. */
  readonly name: string;

  /** Description of what this policy rule protects or enforces. */
  readonly description: string;

  /** Evaluate a single action against this rule in context. */
  evaluate(action: PolicyAction, context?: PermissionContext): Promise<PolicyDecision>;
}

export interface PolicyEngine {
  /** Evaluate an action against all registered policy rules using deny-first precedence. */
  evaluate(action: PolicyAction, context?: PermissionContext): Promise<PolicyDecision>;

  /** Add a policy rule. */
  addRule(rule: PolicyRule): void;

  /** Remove a policy rule by id/name. Returns true if it existed. */
  removeRule(id: string): boolean;

  /** List all registered policy rules. */
  listRules(): ReadonlyArray<PolicyRule>;
}
