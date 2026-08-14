# ADR-006: Deny-First Policy Engine with Untrusted Model Output

**Status:** Accepted  
**Date:** 2026-08-01  
**Decision Makers:** Architecture team

## Context

The agent runtime executes arbitrary LLM outputs as tool calls. This creates a fundamental security boundary question: who authorizes tool execution?

Three design options were considered:

1. **Trust the model**: Execute whatever the model proposes. Security comes from careful prompt engineering.
2. **Allowlist-only**: Maintain an explicit allowlist of permitted tool calls; reject everything else.
3. **Policy engine**: Evaluate each proposed action through a configurable rule set using deny-first precedence.

## Decision

**Treat all model output as untrusted.** Implement a deny-first `PolicyEngine` that evaluates every proposed action before execution.

Deny-first means: if any rule in the engine returns `DENY`, the overall decision is `DENY`, regardless of other rules.

## Rationale

1. **Prompt engineering is not a security boundary.** A model running on a repository it has never seen before is exposed to arbitrary repository content — README files, source code comments, configuration values — all of which may contain adversarial text designed to manipulate the model's behavior.

2. **The model cannot grant itself permissions.** In a trust-the-model design, a model that generates `{ userApproved: true, action: "rm -rf /" }` would execute the action. In the policy engine design, the `ActionPlanner` strips `userApproved` from proposals, and the policy engine evaluates the action independently.

3. **Rules are composable and testable.** Each `PolicyRule` is an independent unit that can be tested in isolation. New rules can be added without modifying the core engine.

4. **Audit trail is automatic.** Every evaluated decision is logged to `auditLogs`, providing a complete record of what was allowed, denied, and why.

## The Deny-First Precedence Chain

```
DENY (any rule) > REQUIRE_APPROVAL > ALLOW_WITH_RESTRICTIONS > ALLOW
```

An unclassified action (no rule matches) defaults to `ALLOW` — but only after all rules have been evaluated. This is not a silent pass; it is an explicit decision that no registered rule had a concern.

## Consequences

- `DefaultPolicyEngine` ships with 5 built-in rules covering credentials, paths, commands, network, and production protection.
- Additional rules can be added via `addRule()`.
- Rules can be removed via `removeRule()` for specific test scenarios.
- Single-use approval nonces prevent replay attacks.
- The policy engine operates independently of model behavior — a compromised or manipulated model cannot bypass it.

## Alternatives Considered

| Option | Why Rejected |
|---|---|
| Trust the model | Vulnerable to prompt injection; no audit trail |
| Allowlist-only | Too rigid; blocks legitimate novel tool combinations |
| Capability-based (per-session grants) | Complex to implement; still vulnerable to capability escalation |
