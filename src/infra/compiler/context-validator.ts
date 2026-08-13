/**
 * Context Validator.
 *
 * Validates compiled context against model limits, budget constraints,
 * and MUST-PRESERVE invariants.
 */
import type { ContextObject } from '../../core/model/context-object.js';
import type { ModelDescriptor } from '../../core/model/model-io.js';
import type { ContextBudget } from '../../core/model/compiler-types.js';
import { ContextRanker } from './context-ranker.js';
import { HarnessError } from '../../core/errors/base-error.js';
import { ErrorCode, ErrorCategory } from '../../core/errors/error-codes.js';

export interface ValidationReport {
  readonly valid: boolean;
  readonly errors: ReadonlyArray<string>;
  readonly warnings: ReadonlyArray<string>;
}

export class ContextValidator {
  /**
   * Validate compiled context against budget and invariants.
   */
  static validate(
    retainedObjects: ReadonlyArray<ContextObject>,
    allCandidateObjects: ReadonlyArray<ContextObject>,
    modelDescriptor: ModelDescriptor,
    budget: ContextBudget,
    totalTokens: number,
  ): ValidationReport {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Model context limit check
    if (totalTokens > modelDescriptor.capabilities.maxContextTokens) {
      errors.push(
        `Compiled token size (${totalTokens}) exceeds model maxContextTokens (${modelDescriptor.capabilities.maxContextTokens})`,
      );
    }

    // 2. Budget soft limit warning
    if (totalTokens > budget.softLimitTokens) {
      warnings.push(
        `Compiled token size (${totalTokens}) exceeds budget soft limit (${budget.softLimitTokens})`,
      );
    }

    // 3. Invariant check — ensure no MUST-PRESERVE item from candidate pool was omitted
    const retainedIds = new Set(retainedObjects.map((o) => o.id));
    for (const candidate of allCandidateObjects) {
      if (ContextRanker.isMustPreserve(candidate) && !retainedIds.has(candidate.id)) {
        errors.push(
          `Must-preserve object [${candidate.type}] (${candidate.id}) was omitted during compilation`,
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate or throw HarnessError.
   */
  static validateOrThrow(
    retainedObjects: ReadonlyArray<ContextObject>,
    allCandidateObjects: ReadonlyArray<ContextObject>,
    modelDescriptor: ModelDescriptor,
    budget: ContextBudget,
    totalTokens: number,
  ): void {
    const report = this.validate(
      retainedObjects,
      allCandidateObjects,
      modelDescriptor,
      budget,
      totalTokens,
    );

    if (!report.valid) {
      throw new HarnessError({
        code: ErrorCode.CONTEXT_BUDGET_EXCEEDED,
        category: ErrorCategory.CONTEXT,
        message: `Context validation failed: ${report.errors.join('; ')}`,
        context: { errors: report.errors, warnings: report.warnings },
      });
    }
  }
}
