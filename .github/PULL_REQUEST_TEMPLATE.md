## Pull Request Description

### Summary of Changes
<!-- Provide a clear, concise summary of the proposed changes, including rationale and affected components. -->

### Related Issues
<!-- Link related issues (e.g. Closes #123, Fixes #456) -->

---

## Architectural Checklist

- [ ] **Zero-Bloat Dependency Rule**: No new runtime dependencies added without prior maintainer approval (strictly maintaining 3 prod dependencies: `better-sqlite3`, `uuid`, `zod`).
- [ ] **Evidence-Gated Safety**: Any changes to state transitions preserve the Evidence-Gated `DONE` rule.
- [ ] **Type Safety**: Passes `npm run typecheck` with zero errors under strict TypeScript compiler settings.
- [ ] **Automated Tests**: Unit and/or integration tests added for all new functionality (`npm test`).
- [ ] **Code Formatting**: Formatted cleanly with Prettier (`npm run format:check`).
- [ ] **Documentation**: Updated relevant documentation in `docs/` or `README.md` if public API surface or configuration changed.

---

## Verification Results
<!-- Paste summary of local test output (e.g. vitest run results, typecheck results) -->
```text
npm run typecheck -> 0 errors
npm test -> All suites passed
```
