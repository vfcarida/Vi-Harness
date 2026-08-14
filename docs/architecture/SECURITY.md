# Security Architecture — SECURITY.md

> "Model output is an untrusted proposal."

## Design Philosophy

Vi-Harness treats model output as structurally equivalent to user-supplied input from the internet: well-formed but potentially adversarial. This is not a theoretical concern. An agent operating on a repository it has never seen before is executing code from that repository's test suite, reading its configuration files, and taking actions prescribed by its README.

Security in Vi-Harness is layered and independent of model behavior. No layer depends on the model "behaving correctly."

---

## Security Architecture — Four Layers

```
Model Output (untrusted)
         │
         ▼
Layer 1: Application-Level Validation
         │   ActionPlanner strips spoofing keys
         │   PathValidator rejects dangerous paths
         │   Input sanitization (prototype pollution, null bytes)
         │
         ▼
Layer 2: Policy Engine (Deny-First)
         │   DefaultPolicyEngine evaluates every action
         │   5 built-in rules (credential, path, command, network, production)
         │   Nonce tracking prevents approval replay
         │
         ▼
Layer 3: Execution Isolation
         │   RealGitManager: -c core.hooksPath=/dev/null
         │   SubagentManager: permission containment, depth ≤ 3
         │   run_command: CommandSanitizer pre-execution check
         │
         ▼
Layer 4: Output Sanitization
             SecretScrubber: redacts credentials from all tool output
             ContextSanitizer: neutralizes prompt injection in stored content
```

**Explicit limitation:** These four layers are application-level controls. They do not provide kernel-level OS isolation. For deployments running untrusted test suites, wrap the agent process in a container, gVisor, or Firecracker environment.

---

## Layer 1: Application-Level Validation

### `ActionPlanner` — Proposal sanitization

**File:** `src/runtime/action-planner.ts`

When parsing model output into `ActionProposal` objects, the `ActionPlanner` strips the following keys from all proposed tool inputs:

| Stripped key | Attack vector prevented |
|---|---|
| `userApproved` | Model granting itself permission via its own output |
| `permissionContext` | Model injecting a fake permission context |
| `securityOverride` | Model requesting a security bypass |

These keys cannot appear in any `ActionProposal` regardless of what the model outputs.

---

### `PathValidator`

**File:** `src/infra/security/path-validator.ts`

**Responsibility:** Validate all file paths before any filesystem operation.

**Checks performed (in order):**
1. **Null-byte rejection**: Strings containing `\0` are rejected unconditionally.
2. **Windows device name rejection**: `CON`, `NUL`, `COM1`–`COM9`, `LPT1`–`LPT9` rejected on all platforms.
3. **URI-encoded traversal**: `%2e%2e`, `%2f`, `%5c` decoded and re-checked.
4. **Canonical resolution**: `path.resolve()` + `fs.realpathSync()` resolves symlinks.
5. **Workspace boundary check**: Resolved path must begin with the workspace root.
6. **Forbidden path substrings**: `.env`, `.ssh`, `id_rsa`, `id_ed25519`, `.aws`, `credentials`, `secrets`, `/etc/` rejected.

**Return value:** `{ safe: boolean; reason?: string; resolvedPath?: string }`

---

### Input Sanitization in `DefaultToolExecutor`

Before any tool input reaches a `Tool.execute()` call:

1. **Prototype pollution guard**: Keys `__proto__`, `constructor`, `prototype` are stripped from all nested input objects.
2. **Null-byte stripping**: All string values have `\0` characters removed.

---

## Layer 2: Policy Engine

### `PolicyEngine` Interface

**Interface:** `src/core/interfaces/policy-engine.ts`

**Method:** `evaluate(action: PolicyAction, context?: PermissionContext): Promise<PolicyDecision>`

**Deny-First Precedence:**
1. If **any** rule returns `DENY` → result is `DENY`.
2. Else if **any** rule returns `REQUIRE_APPROVAL` or `ESCALATE` → result is `REQUIRE_APPROVAL`.
3. Else if **any** rule returns `ALLOW_WITH_RESTRICTIONS` → result is `ALLOW_WITH_RESTRICTIONS`.
4. Otherwise → `ALLOW`.

### `DefaultPolicyEngine`

**File:** `src/infra/security/default-policy-engine.ts`

**Registered rules (by default, in evaluation order):**

| Rule | File | What it protects |
|---|---|---|
| `CredentialProtectionRule` | `rules/credential-protection-rule.ts` | `.env*`, `.ssh*`, `id_rsa*`, `id_ed25519*`, `.aws/`, `credentials*`, `secrets*` |
| `CommandRestrictionRule` | `rules/command-restriction-rule.ts` | Shell injection, privilege escalation, destructive commands |
| `PathRestrictionRule` | `rules/path-restriction-rule.ts` | Workspace boundary, forbidden path patterns |
| `NetworkAccessRule` | `rules/network-access-rule.ts` | Network tools when `networkAccess: false` |
| `ProductionProtectionRule` | `rules/production-protection-rule.ts` | `git push --force`, `rm -rf`, `mkfs`, `chmod 777` |

### Approval Nonce Tracking (Replay Defense)

The `DefaultPolicyEngine` maintains a `consumedApprovalNonces: Set<string>`. When a `REQUIRE_APPROVAL` decision is approved by a human (via `approvalToken` in `PermissionContext`):
1. The token is checked against `consumedApprovalNonces`.
2. If it has been used before → `DENY` (replay rejected).
3. If new → approve the action and add the token to `consumedApprovalNonces`.

This prevents the model from replaying a previously-approved destructive action token across iterations.

### `PermissionContext`

```typescript
{
  allowedPaths:       string[];
  forbiddenPaths:     string[];
  allowedCommands:    string[];
  forbiddenCommands:  string[];
  networkAccess:      boolean;
  userApproved?:      boolean;
  environment:        'DEVELOPMENT' | 'STAGING' | 'PRODUCTION';
  approvalToken?:     string;     // one-time token for REQUIRE_APPROVAL escalation
  metadata?:          Record<string, unknown>;
}
```

**Default production-safe context:** Network access disabled, `git push --force` forbidden, sensitive paths forbidden.

---

## Layer 3: Execution Isolation

### Git Hook Isolation

**File:** `src/infra/git/real-git-manager.ts`

All `git` commands are executed with:
```
git -c core.hooksPath=/dev/null <subcommand>
```

This prevents untrusted repository hooks (`pre-commit`, `post-checkout`, `prepare-commit-msg`, etc.) from executing during agent operations.

### Subagent Permission Containment

**File:** `src/infra/subagent/default-subagent-manager.ts`

When spawning a subagent:
1. **Permission containment**: The subagent's tool set must be a subset of the parent's tool set. A subagent cannot gain capabilities the parent does not have.
2. **Recursion depth limit**: Maximum nesting depth is `MAX_SUBAGENT_DEPTH = 3`. Beyond this, the spawn request is rejected.

### `CommandSanitizer` (pre-execution)

Before any command is executed, `CommandSanitizer.validate()` performs static analysis. See [`TOOL_EXECUTION.md`](TOOL_EXECUTION.md) for the full list of blocked patterns.

---

## Layer 4: Output Sanitization

### `SecretScrubber`

**File:** `src/infra/security/secret-scrubber.ts`

**Responsibility:** Redact credential patterns from tool outputs and compiled context.

**Patterns scrubbed:**

| Pattern | Examples |
|---|---|
| Private key headers | `-----BEGIN RSA PRIVATE KEY-----` |
| OpenAI API keys | `sk-[A-Za-z0-9]{48}` |
| GitHub Personal Access Tokens | `ghp_[A-Za-z0-9]{36}` |
| AWS access keys | `AKIA[0-9A-Z]{16}` |
| Bearer tokens | `Bearer [A-Za-z0-9+/]{20,}` |
| Generic API key assignments | `api_key=...`, `apikey=...`, `api-key=...` |
| Environment variable assignments | `SECRET=`, `TOKEN=`, `PASSWORD=`, `PASS=`, `KEY=` |

Matched content is replaced with `[REDACTED]`.

### `ContextSanitizer`

**File:** `src/infra/security/context-sanitizer.ts`

**Responsibility:** Neutralize prompt injection patterns in content before it is stored in `ContextStore` or compiled into a model call.

**Patterns neutralized:**
- ChatML control tokens: `<|im_start|>`, `<|im_end|>`, `<|endoftext|>`
- Instruction tags: `[INST]`, `[/INST]`, `<<SYS>>`, `<</SYS>>`
- Structural delimiters: `### System`, `### Human`, `### Assistant`
- Jailbreak phrases: `ignore previous instructions`, `you are now`, `DAN mode`, `developer mode enabled`
- HTML comment directives: `<!-- SYSTEM: ... -->`

Content from untrusted sources (repository files, README content) is wrapped in `<untrusted_content>…</untrusted_content>` isolation tags.

---

## The 16 Hardened Attack Vectors

The red-team regression suite (`tests/unit/security/red-team-suite.test.ts`) covers 16 attack vectors, all passing:

| # | Vector | Layer | Mitigation |
|---|---|---|---|
| 1 | Prompt injection via source code | L1 + L4 | `ContextSanitizer` neutralization + `<untrusted_content>` wrapping |
| 2 | Prompt injection via README | L1 + L4 | HTML directive neutralization + jailbreak phrase stripping |
| 3 | Malicious tool arguments | L1 | Prototype pollution guard + null-byte stripping |
| 4 | Shell injection | L2 + L3 | `CommandRestrictionRule` + `CommandSanitizer` |
| 5 | Path traversal | L1 + L2 | `PathValidator` (canonical resolution + boundary check) |
| 6 | Symlink attacks | L1 | `PathValidator` (`realpathSync` target resolution) |
| 7 | Secret access | L1 + L2 | `PathValidator` forbidden substrings + `CredentialProtectionRule` |
| 8 | Environment variable exfiltration | L2 + L3 | `CommandRestrictionRule` blocks `printenv`, `env`; `SecretScrubber` redacts output |
| 9 | Network exfiltration | L2 + L3 | `NetworkAccessRule` + `CommandSanitizer` blocks `curl`, `wget`, `nc` |
| 10 | Malicious memory | L4 | `InMemoryMemoryStore` sanitizes content on `createRecord()` |
| 11 | Malicious context | L1 + L4 | Context invariant pinning; `SECURITY_RULE` objects not auto-evicted |
| 12 | Policy bypass | L2 | Tool names canonicalized; unclassified actions default to `DENY` |
| 13 | Approval spoofing | L1 | `ActionPlanner` strips `userApproved`, `permissionContext`, `securityOverride` |
| 14 | Replay of destructive actions | L2 | Single-use nonce tracking in `DefaultPolicyEngine` |
| 15 | Unsafe rollback (malicious git hooks) | L3 | `git -c core.hooksPath=/dev/null` in `RealGitManager` |
| 16 | Malicious subagent | L3 | Permission containment + recursion depth cap |

---

## Threat Model Document

See [`threat_model.md`](../../threat_model.md) (in the artifacts directory) for the full structured threat model with trust boundaries, asset inventory, and residual risk assessment.

---

## Known Limitations

| Limitation | Description |
|---|---|
| No OS-level sandbox | Commands execute in the agent's process environment |
| `ContextSanitizer` is regex-based | Sophisticated multi-step injection may bypass pattern matching |
| `SecretScrubber` has false negatives | Novel credential formats not matching known patterns are not redacted |
| Nonce tracking is in-memory | Nonces reset on restart; long-running agents with restarts are vulnerable to replay |
| `CommandSanitizer` is static analysis | Encoded or obfuscated commands may bypass detection |

---

## Future Design

- **OS-level isolation**: Container-based execution sandbox for `run_command`.
- **Semantic injection detection**: ML-based classifier for prompt injection beyond regex patterns.
- **Persistent nonce store**: Nonces stored in `CheckpointStore` to survive restarts.
- **Secret scanning integration**: Integrate with `gitleaks` or `trufflehog` for output scanning.
- **Policy-as-code**: Declarative YAML/JSON policy rules loaded from configuration.
