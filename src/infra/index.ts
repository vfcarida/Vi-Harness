/**
 * Infrastructure layer barrel export.
 */

// ID
export { UuidV7IdFactory } from './id/uuid-id-factory.js';

// Logging
export { ConsoleLogger } from './logging/console-logger.js';

// Time
export { SystemClock } from './time/system-clock.js';
export { TestClock } from './time/test-clock.js';

// Config
export { EnvConfiguration } from './config/env-configuration.js';
export type { EnvConfigurationOptions } from './config/env-configuration.js';

// Model Providers & Resilience
export { MockModelProvider } from './model/mock-model-provider.js';
export type { MockModelProviderOptions } from './model/mock-model-provider.js';

export { FailingModelProvider } from './model/failing-model-provider.js';
export type { FailingModelProviderOptions } from './model/failing-model-provider.js';

export { OpenAICompatibleProvider } from './model/openai-compatible-provider.js';
export type { OpenAICompatibleProviderOptions } from './model/openai-compatible-provider.js';

export {
  executeResiliently,
  mapProviderError,
  DEFAULT_RESILIENCE_OPTIONS,
} from './model/provider-resilience.js';
export type { ResilientExecutionOptions } from './model/provider-resilience.js';
export { ScriptedModelProvider } from './model/scripted-model-provider.js';
export type { ScriptedStep, ScriptStepHandler, ScriptedModelProviderOptions } from './model/scripted-model-provider.js';

// Metrics
export { InMemoryMetricsCollector } from './metrics/in-memory-metrics-collector.js';

// Router
export { CapabilityMatcher } from './router/capability-matcher.js';
export { ModelHealthRegistry } from './router/health-registry.js';
export { CostPolicy } from './router/cost-policy.js';
export { UtilityModelRouter } from './router/utility-model-router.js';
export type { UtilityModelRouterOptions } from './router/utility-model-router.js';

// Context Store & Graph
export { ContextGraph } from './context/context-graph.js';
export { InMemoryContextStore } from './context/in-memory-context-store.js';
export type { InMemoryContextStoreOptions } from './context/in-memory-context-store.js';

// Context Compiler
export { ContextDeduplicator } from './compiler/context-deduplicator.js';
export { ContextRanker } from './compiler/context-ranker.js';
export { ContextCompressor } from './compiler/context-compressor.js';
export { ContextValidator } from './compiler/context-validator.js';
export { DefaultContextCompiler } from './compiler/default-context-compiler.js';
export type { DefaultContextCompilerOptions } from './compiler/default-context-compiler.js';

// Memory Subsystem
export { MemoryScorer } from './memory/memory-scorer.js';
export { MemoryLifecycle } from './memory/memory-lifecycle.js';
export { MemoryRetriever } from './memory/memory-retriever.js';
export { InMemoryMemoryProvider } from './memory/in-memory-memory-provider.js';
export { InMemoryMemoryStore } from './memory/in-memory-memory-store.js';
export type { InMemoryMemoryStoreOptions } from './memory/in-memory-memory-store.js';

// Tool Execution Layer
export { CommandSanitizer } from './tools/command-sanitizer.js';
export { DefaultToolRegistry } from './tools/default-tool-registry.js';
export { ReadFileTool } from './tools/builtin/read-file-tool.js';
export { WriteFileTool } from './tools/builtin/write-file-tool.js';
export { ListDirectoryTool } from './tools/builtin/list-directory-tool.js';
export { RunCommandTool } from './tools/builtin/run-command-tool.js';
export { DefaultToolExecutor } from './tools/default-tool-executor.js';
export type { DefaultToolExecutorOptions } from './tools/default-tool-executor.js';

// Security & Execution Policy Layer
export { ContextSanitizer } from './security/context-sanitizer.js';
export { RiskClassifier } from './security/risk-classifier.js';
export { CredentialProtectionRule } from './security/rules/credential-protection-rule.js';
export { PathRestrictionRule } from './security/rules/path-restriction-rule.js';
export { CommandRestrictionRule } from './security/rules/command-restriction-rule.js';
export { NetworkAccessRule } from './security/rules/network-access-rule.js';
export { ProductionProtectionRule } from './security/rules/production-protection-rule.js';
export { DefaultPolicyEngine } from './security/default-policy-engine.js';
export { LocalDevelopmentSandbox } from './security/local-development-sandbox.js';
export type { LocalDevelopmentSandboxOptions } from './security/local-development-sandbox.js';

// Verification & Evidence Layers
export { DefaultEvidenceStore } from './evidence/default-evidence-store.js';
export { DefaultEvidenceAggregator } from './evidence/default-evidence-aggregator.js';
export { ContradictoryEvidenceResolver } from './evidence/contradictory-evidence-resolver.js';
export { DefaultVerificationEngine } from './verification/default-verification-engine.js';
export type { DefaultVerificationEngineOptions } from './verification/default-verification-engine.js';

// Repository State Management & Checkpoints
export { DefaultCheckpointStore } from './checkpoint/default-checkpoint-store.js';
export type { DefaultCheckpointStoreOptions } from './checkpoint/default-checkpoint-store.js';
export { DefaultGitManager } from './git/default-git-manager.js';
export type { DefaultGitManagerOptions } from './git/default-git-manager.js';
export { RealGitManager } from './git/real-git-manager.js';
export type { RealGitManagerOptions } from './git/real-git-manager.js';
export { DefaultRollbackManager } from './git/default-rollback-manager.js';

// Subagent Subsystem
export { DefaultSubagentManager } from './subagent/default-subagent-manager.js';
export type { DefaultSubagentManagerOptions } from './subagent/default-subagent-manager.js';

// Human Escalation Subsystem
export { DefaultEscalationManager } from './escalation/default-escalation-manager.js';
export type { DefaultEscalationManagerOptions } from './escalation/default-escalation-manager.js';

// Observability, Telemetry & Cost Subsystem
export { DefaultCostTracker } from './cost/default-cost-tracker.js';
export { DefaultBudgetTracker } from './cost/default-budget-tracker.js';
export { DefaultTelemetryCollector } from './telemetry/default-telemetry-collector.js';
export type { DefaultTelemetryCollectorOptions } from './telemetry/default-telemetry-collector.js';

// Persistence & Crash Recovery Subsystem
export { DefaultStateStore } from './persistence/default-state-store.js';
export type { DefaultStateStoreOptions } from './persistence/default-state-store.js';
export { DefaultEventStore } from './persistence/default-event-store.js';
export type { DefaultEventStoreOptions } from './persistence/default-event-store.js';
export { DefaultExecutionJournal } from './persistence/default-execution-journal.js';
export type { DefaultExecutionJournalOptions } from './persistence/default-execution-journal.js';
export { DefaultRecoveryManager } from './persistence/default-recovery-manager.js';
export { DefaultResumeManager } from './persistence/default-resume-manager.js';
export type { DefaultResumeManagerOptions } from './persistence/default-resume-manager.js';
export { StateCorruptionValidator } from './persistence/state-corruption-validator.js';

// Evaluation & Resilience
export { FaultInjector, FaultMode } from './resilience/fault-injector.js';
export { BASELINE_SCENARIOS, CANONICAL_BASELINE_SUITE } from './eval/baseline-scenarios.js';
export { DefaultBenchmarkRunner } from './eval/default-benchmark-runner.js';
export type { DefaultBenchmarkRunnerOptions } from './eval/default-benchmark-runner.js';

// Performance Optimization Subsystem
export { PerformanceProfiler, TelemetryCategory } from './optimization/performance-profiler.js';
export { AdaptiveContextBudget } from './optimization/adaptive-context-budget.js';
export { EvidenceCache } from './optimization/evidence-cache.js';
export { ParallelToolExecutor } from './tools/parallel-tool-executor.js';
