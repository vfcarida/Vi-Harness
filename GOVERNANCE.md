# Project Governance & Release Process

## 1. Overview & Philosophy

Vi-Harness is an open-source, model-agnostic coding-agent harness developed under the MIT License. The project adheres to strict architectural principles:
- **Zero-Bloat Minimal Dependency Footprint**: Strictly constrained to essential core libraries (`better-sqlite3`, `uuid`, `zod`). Native LLM adapters, MCP transports, and OTLP exporters leverage Node.js built-ins.
- **Evidence-Gated Safety**: The model proposes actions, but the deterministic runtime validates transitions and verifies completion.
- **Pluggability & Extensibility**: All components are decoupled via clean interfaces and Dependency Injection tokens.

---

## 2. Roles and Responsibilities

### Maintainers
Maintainers are responsible for:
- Reviewing and approving Pull Requests.
- Overseeing architectural evolution and Architectural Decision Records (ADRs).
- Managing release lifecycles and security vulnerability responses.
- Ensuring test coverage, type safety, and zero-bloat standards.

### Contributors
Contributors are community members who submit bug reports, feature proposals, documentation improvements, and code changes.

---

## 3. Decision-Making Process

- **Minor Changes & Bug Fixes**: Reviewed and merged by any maintainer following green CI checks (`npm test`, `npm run typecheck`, `npm run format:check`).
- **Major Architectural Changes / New Features**: Require an Architectural Decision Record (ADR) submitted to `docs/architecture/adr/` and approval from core maintainers.

---

## 4. Release Process & Semantic Versioning

Vi-Harness follows [Semantic Versioning 2.0.0 (SemVer)](https://semver.org/):
- **MAJOR** (`X.0.0`): Breaking changes to public interfaces or state-machine contracts.
- **MINOR** (`0.X.0`): New backward-compatible capabilities, providers, compilers, or tools.
- **PATCH** (`0.0.X`): Backward-compatible bug fixes, performance improvements, and documentation updates.

### Release Workflow:
1. **Validation**: Run full test suite and clean builds (`npm run clean && npm run build && npm test && npm run typecheck`).
2. **Changelog Update**: Document all changes in `CHANGELOG.md` following the [Keep a Changelog](https://keepachangelog.com/) format.
3. **Version Bump**: Bump version in `package.json` and tag release in Git (`git tag v0.X.Y`).
4. **CI Release**: GitHub Actions workflow automatically builds and publishes artifacts to npm with provenance.
