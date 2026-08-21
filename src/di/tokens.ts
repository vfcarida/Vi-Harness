/**
 * Injection tokens.
 *
 * Each token is a unique Symbol that identifies a service in the container.
 * Using Symbol.for() ensures tokens are consistent across module boundaries.
 */

export const TOKENS = {
  // Cross-cutting
  Logger: Symbol.for('vi-harness.Logger'),
  Clock: Symbol.for('vi-harness.Clock'),
  Configuration: Symbol.for('vi-harness.Configuration'),
  IdFactory: Symbol.for('vi-harness.IdFactory'),

  // Model
  ModelProvider: Symbol.for('vi-harness.ModelProvider'),
  ModelRouter: Symbol.for('vi-harness.ModelRouter'),

  // Context
  ContextStore: Symbol.for('vi-harness.ContextStore'),
  MemoryStore: Symbol.for('vi-harness.MemoryStore'),
  ContextCompiler: Symbol.for('vi-harness.ContextCompiler'),

  // Tools
  ToolExecutor: Symbol.for('vi-harness.ToolExecutor'),

  // Policy
  PolicyEngine: Symbol.for('vi-harness.PolicyEngine'),

  // Verification
  VerificationEngine: Symbol.for('vi-harness.VerificationEngine'),

  // Evidence
  EvidenceStore: Symbol.for('vi-harness.EvidenceStore'),

  // Checkpoint
  CheckpointStore: Symbol.for('vi-harness.CheckpointStore'),

  // State
  StateStore: Symbol.for('vi-harness.StateStore'),

  // Runtime & Architecture
  AgentRuntime: Symbol.for('vi-harness.AgentRuntime'),
  ArchitectMode: Symbol.for('vi-harness.ArchitectMode'),

  // Model Providers & Exporters
  AnthropicProvider: Symbol.for('vi-harness.AnthropicProvider'),
  GeminiProvider: Symbol.for('vi-harness.GeminiProvider'),
  OtlpExporter: Symbol.for('vi-harness.OtlpExporter'),

  // Synthesis Modules & Subsystems
  Compaction: Symbol.for('vi-harness.Compaction'),
  CacheCompaction: Symbol.for('vi-harness.CacheCompaction'),
  RepoMap: Symbol.for('vi-harness.RepoMap'),
  GitManager: Symbol.for('vi-harness.GitManager'),
  GoalBudgets: Symbol.for('vi-harness.GoalBudgets'),
  MemoryManager: Symbol.for('vi-harness.MemoryManager'),
  SessionStore: Symbol.for('vi-harness.SessionStore'),
  ExperienceStore: Symbol.for('vi-harness.ExperienceStore'),
  McpTransport: Symbol.for('vi-harness.McpTransport'),
  Storage: Symbol.for('vi-harness.Storage'),
  MetricsSink: Symbol.for('vi-harness.MetricsSink'),
} as const;
