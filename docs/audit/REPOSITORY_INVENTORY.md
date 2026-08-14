# Vi-Harness: Comprehensive Repository Inventory

## 1. Directory Tree & Module Hierarchy

```
Vi-Harness/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   └── feature_request.md
│   ├── workflows/
│   │   ├── ci.yml
│   │   ├── integration.yml
│   │   └── live-providers.yml
│   └── CODEOWNERS
├── docs/
│   ├── architecture/
│   │   ├── adr/
│   │   │   ├── 001-typescript-choice.md
│   │   │   ├── 002-dependency-injection.md
│   │   │   ├── 003-error-model.md
│   │   │   ├── 004-context-tiers.md
│   │   │   ├── 005-interface-first-design.md
│   │   │   ├── 006-security-model.md
│   │   │   └── 007-iteration-phases.md
│   │   ├── AGENT_LOOP.md
│   │   ├── ARCHITECTURE.md
│   │   ├── BENCHMARKING.md
│   │   ├── CONTEXT_ENGINEERING.md
│   │   ├── CURRENT_ARCHITECTURE.md
│   │   ├── DEPENDENCY_RULES.md
│   │   ├── MODEL_ROUTING.md
│   │   ├── MODULE_MAP.md
│   │   ├── PERSISTENCE.md
│   │   ├── SECURITY.md
│   │   ├── TARGET_ARCHITECTURE.md
│   │   ├── TOOL_EXECUTION.md
│   │   └── VERIFICATION.md
│   ├── audit/
│   │   ├── ANALYSIS_COVERAGE.md
│   │   ├── BASELINE_REPORT.md
│   │   ├── REPOSITORY_AUDIT.md
│   │   ├── REPOSITORY_INVENTORY.md
│   │   ├── TRACEABILITY_MATRIX.md
│   │   └── VERIFICATION_REPORT.md
│   ├── experiments/
│   │   └── PI_VS_VI.md
│   ├── implementation/
│   │   └── IMPLEMENTATION_PLAN.md
│   ├── research/
│   │   ├── CLAUDE_CODE.md
│   │   ├── HERMES.md
│   │   ├── PI.md
│   │   ├── PRIME_AGENT.md
│   │   ├── REFERENCE_MATRIX.md
│   │   ├── RELATED_PROJECTS.md
│   │   └── RESEARCH_REPORT.md
│   ├── security/
│   │   └── THREAT_MODEL.md
│   └── testing/
│       └── TEST_STRATEGY.md
├── src/
│   ├── cli/
│   │   ├── benchmark-cli.ts
│   │   └── context-benchmark-cli.ts
│   ├── core/
│   │   ├── errors/
│   │   │   └── index.ts
│   │   ├── interfaces/
│   │   │   └── [14 domain interfaces]
│   │   ├── model/
│   │   │   └── [action, context, evidence, memory, model-io, policy, state, trace-types, caching-types, etc.]
│   │   ├── state-machine/
│   │   ├── types/
│   │   └── index.ts
│   ├── di/
│   │   ├── container.ts
│   │   ├── default-module.ts
│   │   ├── types.ts
│   │   └── index.ts
│   ├── infra/
│   │   ├── adapter/
│   │   ├── compiler/
│   │   ├── config/
│   │   ├── context/
│   │   ├── cost/
│   │   ├── escalation/
│   │   ├── eval/
│   │   ├── evidence/
│   │   ├── git/
│   │   ├── id/
│   │   ├── logging/
│   │   ├── memory/
│   │   ├── metrics/
│   │   ├── model/
│   │   ├── optimization/
│   │   ├── persistence/
│   │   ├── resilience/
│   │   ├── router/
│   │   ├── security/
│   │   ├── subagent/
│   │   ├── syntax/
│   │   ├── telemetry/
│   │   ├── time/
│   │   ├── tools/
│   │   ├── verification/
│   │   └── index.ts
│   ├── runtime/
│   │   ├── action-planner.ts
│   │   ├── agent-observer.ts
│   │   ├── default-agent-runtime.ts
│   │   ├── iteration-executor.ts
│   │   ├── loop-fingerprinter.ts
│   │   ├── termination-controller.ts
│   │   ├── tool-call-validator.ts
│   │   └── index.ts
│   └── index.ts
├── tests/
│   ├── fixtures/
│   ├── integration/
│   └── unit/
├── CHANGELOG.md
├── CONTRIBUTING.md
├── LICENSE
├── package.json
├── README.md
├── SECURITY.md
├── tsconfig.json
└── vitest.config.ts
```
