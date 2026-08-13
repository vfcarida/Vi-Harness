/**
 * Branded type utility.
 *
 * Creates a nominal type by intersecting a base type with a unique phantom brand.
 * This prevents accidental interchange of structurally-identical types at compile time.
 *
 * @example
 * type UserId = Brand<string, 'UserId'>;
 * type TaskId = Brand<string, 'TaskId'>;
 *
 * // These are incompatible even though both are strings:
 * const userId: UserId = createId() as UserId;
 * const taskId: TaskId = userId; // TS error!
 */
declare const __brand: unique symbol;

export type Brand<T, B extends string> = T & { readonly [__brand]: B };
