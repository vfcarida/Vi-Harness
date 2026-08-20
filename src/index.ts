/**
 * Vi-Harness — Enterprise-grade, model-agnostic coding-agent harness.
 *
 * Public API surface. Re-exports from core, infrastructure, and DI layers.
 */

// Core (domain layer)
export * from './core/index.js';

// Infrastructure
export * from './infra/index.js';

// Explicit re-exports to resolve barrel overlaps
export { ParallelToolExecutor } from './core/tools/index.js';

// Dependency Injection
export * from './di/index.js';

// Runtime
export * from './runtime/index.js';
