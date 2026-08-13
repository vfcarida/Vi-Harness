/**
 * Task domain type.
 *
 * A Task is a decomposed unit of work derived from a Goal.
 * The agent loop operates at the Task level.
 */
import type { TaskId, GoalId } from '../types/identifiers.js';

// ---------------------------------------------------------------------------
// Task status
// ---------------------------------------------------------------------------

export enum TaskStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  BLOCKED = 'BLOCKED',
}

// ---------------------------------------------------------------------------
// Task
// ---------------------------------------------------------------------------

export interface Task {
  readonly id: TaskId;
  readonly goalId: GoalId;
  readonly description: string;
  readonly status: TaskStatus;
  readonly priority: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly metadata: Readonly<Record<string, unknown>>;
}
