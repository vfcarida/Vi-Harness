# Contributing to Vi-Harness

Thank you for considering a contribution. This document explains how to set up the development environment, the conventions we follow, and the process for getting a change merged.

---

## Table of Contents

- [Development Setup](#development-setup)
- [Repository Structure](#repository-structure)
- [Architecture Contract](#architecture-contract)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)
- [Reporting Security Issues](#reporting-security-issues)

---

## Development Setup

**Requirements:** Node.js ≥ 20 (22 recommended), Git.

```bash
# 1. Fork and clone
git clone https://github.com/<your-fork>/Vi-Harness.git
cd Vi-Harness

# 2. Install dependencies (exact lockfile)
npm ci

# 3. Verify the baseline
npm run typecheck
npm run lint
npm test
```

All CI checks must pass on your branch before a PR is reviewed.

---

## Repository Structure

```
src/
├── core/          # Domain layer — ZERO external dependencies
├── infra/         # Infrastructure — implements core interfaces
├── di/            # Dependency injection wiring
├── runtime/       # Agent execution loop
└── index.ts       # Public API

tests/
├── unit/          # Pure unit tests — no secrets, no network
└── integration/   # Integration tests — mocked model calls, real Git
```

**Strict dependency rule:** arrows flow inward only — `runtime → infra → core`. The `core/` package must never import from `infra/` or `runtime/`.

---

## Architecture Contract

Before making structural changes, read [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md) and the relevant ADRs in [`docs/architecture/adr/`](docs/architecture/adr/).

Key invariants:

1. **Core has zero external dependencies.** `core/` imports only from Node.js built-ins and the project's own `core/` subtrees.
2. **All interfaces live in `core/interfaces/`.** Infrastructure provides implementations; nothing binds directly to implementations.
3. **Unit tests require no secrets or network access.** If your test needs an API key to pass it belongs in `tests/live/` and is opt-in only.
4. **Security mitigations must be tested.** Every change to `src/infra/security/` must include or update a test in `tests/unit/security/`.

---

## Making Changes

1. **Open an issue first** for non-trivial changes so the approach can be agreed on before you invest time writing code.
2. Create a feature branch from `main`:
   ```bash
   git checkout -b feat/my-feature
   ```
3. Keep each commit focused. Mixing refactors with features makes review harder.
4. Run the full check suite before pushing:
   ```bash
   npm run typecheck
   npm run lint
   npm test
   npm run build
   ```

---

## Testing

| Test suite | Command | Notes |
|---|---|---|
| Unit | `npx vitest run tests/unit` | No secrets, no network |
| Integration | `npx vitest run tests/integration` | Mocked models, real Git |
| Live providers | `npx vitest run tests/live` | Requires secrets — opt-in only |
| Coverage | `npm run test:coverage` | Reports in `coverage/` |

Tests in `tests/unit/` and `tests/integration/` must pass on CI with **no environment secrets**. If a test requires a real API key it must live in `tests/live/` and must check for the `LIVE_PROVIDER_TESTS=true` environment variable before running.

---

## Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>): <short summary>

<optional body>

<optional footer>
```

Common types: `feat`, `fix`, `test`, `refactor`, `docs`, `chore`, `security`.

Examples:
```
feat(context-compiler): add L0_HOT invariant pinning for security rules
fix(path-validator): reject null-byte sequences in URI-encoded paths
security(command-sanitizer): block printenv and env exfiltration commands
test(red-team-suite): add regression tests for approval spoofing vector
```

---

## Pull Request Process

1. All CI checks must pass (typecheck, lint, unit tests, build).
2. For changes to `src/core/`, `src/infra/security/`, `.github/workflows/`, or `package.json`, a review from a CODEOWNER is required before merge.
3. Keep the PR description concise: **what changed, why, and what you tested**.
4. PRs that add functionality must include tests. PRs that fix bugs must include a regression test.
5. Squash-merge is preferred for feature branches. Merge commits are used for release branches.

---

## Reporting Security Issues

**Do not open a public issue for security vulnerabilities.**

See [SECURITY.md](SECURITY.md) for the responsible disclosure process.
