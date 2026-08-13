/**
 * ExecutionJournal Interface.
 *
 * Tracks individual action execution states across the canonical lifecycle:
 * PROPOSED -> AUTHORIZED -> STARTED -> (COMPLETED | FAILED | UNKNOWN).
 *
 * Ensures every action has a unique execution ID and prevents silent duplicate executions of destructive actions.
 */
import type { ExecutionId, TaskId } from '../types/identifiers.js';
import type { JournalEntry } from '../model/recovery-types.js';
import type { ActionProposal, ActionResult } from '../model/action.js';

export interface ExecutionJournal {
  /** Log action proposal (PROPOSED state). Returns assigned ExecutionId. */
  logProposal(proposal: ActionProposal, isDestructive?: boolean): Promise<ExecutionId>;

  /** Log transition of action proposal to AUTHORIZED state. */
  logAuthorization(executionId: ExecutionId): Promise<void>;

  /** Log transition of action execution to STARTED state. */
  logStart(executionId: ExecutionId): Promise<void>;

  /** Log successful action execution completion (COMPLETED state). */
  logCompletion(executionId: ExecutionId, result?: ActionResult): Promise<void>;

  /** Log explicit action execution failure (FAILED state). */
  logFailure(executionId: ExecutionId, error: string): Promise<void>;

  /** Log transition of action execution to UNKNOWN state (unverified or interrupted). */
  logUnknown(executionId: ExecutionId, reason: string): Promise<void>;

  /** Fetch journal entry by execution ID. */
  getEntry(executionId: ExecutionId): Promise<JournalEntry | undefined>;

  /** Get all interrupted or uncompleted journal entries for a task. */
  getInterruptedEntries(taskId: TaskId): Promise<ReadonlyArray<JournalEntry>>;

  /** List all journal entries for a task. */
  listForTask(taskId: TaskId): Promise<ReadonlyArray<JournalEntry>>;
}
