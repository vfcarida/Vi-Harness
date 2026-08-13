# Changelog

All notable changes to Vi-Harness are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

- **Red-Team Security Hardening across 16 attack vectors**
  - `SecretScrubber` — automatic redaction of API keys, bearer tokens, private keys, and env secrets from all tool outputs and compiled context
  - `PathValidator` — canonical path resolution, workspace boundary enforcement, symlink escape detection, null-byte rejection, and Windows reserved device name blocking
  - Enhanced `ContextSanitizer` — structural delimiter neutralisation (ChatML tags, `[INST]`, `<<SYS>>`), untrusted content wrapping in `<untrusted_content>` isolation tags, and comprehensive jailbreak phrase neutralisation
  - Enhanced `CommandSanitizer` — environment variable exfiltration blocking (`printenv`, `env`, `export -p`, `Get-ChildItem env:`), network exfiltration tool blocking (`curl`, `wget`, `nc`, `Invoke-WebRequest`), and descriptive error codes per violation class
  - `DefaultPolicyEngine` — single-use approval nonce tracking to prevent replay of approved destructive actions
  - `ActionPlanner` — strips model-injected approval spoofing keys (`userApproved`, `permissionContext`, `securityOverride`) from all LLM proposals
  - `DefaultToolExecutor` — deep input sanitisation (prototype pollution guard, null-byte stripping), and output secret scrubbing
  - `DefaultSubagentManager` — permission containment enforcement (Subagent tools ⊆ Parent tools) and maximum recursion depth cap (`MAX_SUBAGENT_DEPTH = 3`)
  - `InMemoryMemoryStore` — sanitises prompt injection and scrubs secrets on memory record creation
  - `DefaultContextCompiler` — sanitises and scrubs all compiled context entries
  - `RealGitManager` — passes `-c core.hooksPath=/dev/null` on all git commands to isolate untrusted hooks
  - `PermissionContext` — added `approvalToken` and `metadata` fields for one-time approval token support
  - 16-test Red-Team regression suite (`tests/unit/security/red-team-suite.test.ts`)
  - Formal Threat Model document

- **Genuine Coding-Agent Iteration Loop (10 explicit phases)**
  - `IterationExecutor` refactored into `Observation → Context → ModelDecision → ActionProposals → PolicyDecisions → ToolExecutions → VerificationResults → Evidence → StateTransition → TerminationDecision`
  - Multi-tool-call support within a single iteration turn
  - Results-derived state machine: state transitions are computed from actual tool outcomes and evidence, not iteration completion
  - Structured error payloads (`UNKNOWN_TOOL`, `POLICY_DENIED`, `TOOL_EXECUTION_FAILED`) returned as first-class `ToolResult` objects

- **Context-Efficiency & Bloat Elimination Benchmark**
  - Benchmark framework comparing Naive Accumulation vs Pi-style Compaction vs Vi-Harness Compiler
  - Synthetic long-horizon coding tasks (10 / 25 / 50 / 100 iteration trajectories)
  - Metrics: context tokens, cumulative tokens, peak context, compression ratio, critical memory retention
  - CLI runner (`src/cli/context-benchmark-cli.ts`) outputting JSON and Markdown reports

- **GitHub Open-Source Workflow**
  - `ci.yml` — install, typecheck, lint, unit tests, coverage, build, dependency audit
  - `integration.yml` — integration tests on push to `main` and non-draft PRs
  - `live-providers.yml` — strictly opt-in manual dispatch, never runs without explicit credentials
  - `CODEOWNERS` for `core/`, `infra/security/`, `.github/`, and `package.json`
  - `CONTRIBUTING.md`, `SECURITY.md`, and issue templates

- **Pi-Harness Compatibility Adapter** (`src/adapters/pi-harness-adapter.ts`)
  - Translates Benchmark Task → Vi Goal → Vi Execution → Vi Result → Benchmark Result
  - Exposes: `success`, `finalState`, `changedFiles`, `finalDiff`, `tests`, `iterations`, `modelCalls`, `tokens`, `estimatedCost`, `duration`, `terminationReason`

- **Benchmark Runner** (`src/eval/`)
  - `BenchmarkTask`, `BenchmarkEnvironment`, `BenchmarkRun`, `BenchmarkResult`, `BenchmarkRunner`, `HarnessAdapter`
  - Repeated run support with mean, median, p95, success rate, cost distribution, and iteration distribution

### Changed

- `ReadFileTool`, `WriteFileTool`, `ListDirectoryTool` — now validate all paths through `PathValidator` before filesystem access
- `RunCommandTool` — scrubs secret patterns from command output
- `src/infra/index.ts` — exports `SecretScrubber`, `PathValidator`

---

## [0.1.0] — 2026-08-01

### Added

- Initial architecture: Core domain layer, Infrastructure layer, DI container
- `UUIDv7IdFactory`, `SystemClock`, `TestClock`, `ConsoleLogger`, `EnvConfiguration`
- `MockModelProvider`, `FailingModelProvider`, `OpenAICompatibleProvider`
- `DefaultToolRegistry`, `DefaultToolExecutor`, `ReadFileTool`, `WriteFileTool`, `ListDirectoryTool`, `RunCommandTool`
- `DefaultPolicyEngine` with five built-in rules: `CredentialProtectionRule`, `PathRestrictionRule`, `CommandRestrictionRule`, `NetworkAccessRule`, `ProductionProtectionRule`
- `CommandSanitizer`, `ContextSanitizer`, `LocalDevelopmentSandbox`, `RiskClassifier`
- `DefaultContextCompiler` — 6-stage pipeline (Retrieval → Deduplication → Ranking → Compression → Validation → Assembly)
- Four-tier context model (`L0_HOT`, `L1_WORKING`, `L2_EPISODIC`, `L3_REPOSITORY`)
- `InMemoryMemoryStore` with Candidate → Active → Stale lifecycle and conflict detection
- `DefaultEvidenceStore`, `DefaultEvidenceAggregator`, `ContradictoryEvidenceResolver`
- `DefaultCheckpointStore`, `DefaultGitManager`, `RealGitManager`, `DefaultRollbackManager`
- `DefaultSubagentManager` with sequential, parallel, and DAG execution
- Architecture Decision Records (ADR-001 through ADR-005)

[Unreleased]: https://github.com/vfcarida/Vi-Harness/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/vfcarida/Vi-Harness/releases/tag/v0.1.0
