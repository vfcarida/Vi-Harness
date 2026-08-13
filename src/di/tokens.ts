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

  // Runtime
  AgentRuntime: Symbol.for('vi-harness.AgentRuntime'),
} as const;
