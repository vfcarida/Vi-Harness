/**
 * ContextCompiler interface.
 *
 * "Context is compiled, not accumulated."
 *
 * Assembles the minimum necessary context for a model call by
 * progressively retrieving, deduplicating, ranking, compressing,
 * and validating context objects while respecting token budgets.
 */
import type {
  ContextCompilationRequest,
  ContextCompilationResult,
} from '../model/compiler-types.js';

export interface ContextCompiler {
  /** Compile context for a model invocation, respecting token budget constraints. */
  compile(request: ContextCompilationRequest): Promise<ContextCompilationResult>;
}
