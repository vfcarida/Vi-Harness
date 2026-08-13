/**
 * Budget domain type.
 *
 * Budgets track resource consumption across multiple dimensions.
 * When any dimension is exhausted, the loop terminates.
 */

// ---------------------------------------------------------------------------
// Budget dimension
// ---------------------------------------------------------------------------

export enum BudgetDimension {
  ITERATIONS = 'ITERATIONS',
  COST_DOLLARS = 'COST_DOLLARS',
  DURATION_MS = 'DURATION_MS',
  INPUT_TOKENS = 'INPUT_TOKENS',
  OUTPUT_TOKENS = 'OUTPUT_TOKENS',
}

// ---------------------------------------------------------------------------
// Budget entry — tracks consumption for one dimension
// ---------------------------------------------------------------------------

export interface BudgetEntry {
  readonly dimension: BudgetDimension;
  readonly limit: number;
  readonly consumed: number;
  readonly remaining: number;
  readonly exhausted: boolean;
}

// ---------------------------------------------------------------------------
// Budget — aggregate tracker across all dimensions
// ---------------------------------------------------------------------------

export interface Budget {
  readonly entries: ReadonlyArray<BudgetEntry>;
  readonly anyExhausted: boolean;
  readonly updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

export function createBudgetEntry(
  dimension: BudgetDimension,
  limit: number,
  consumed: number = 0,
): BudgetEntry {
  const remaining = Math.max(0, limit - consumed);
  return {
    dimension,
    limit,
    consumed,
    remaining,
    exhausted: remaining <= 0,
  };
}

export function createBudget(entries: ReadonlyArray<BudgetEntry>): Budget {
  return {
    entries,
    anyExhausted: entries.some((e) => e.exhausted),
    updatedAt: new Date(),
  };
}
