/**
 * ExecutionJournal Interface.
 *
 * Tracks individual action execution states (PROPOSED, RUNNING, COMPLETED, FAILED, INTERRUPTED).
 * Ensures every action has a unique execution ID and prevents silent duplicate executions.
 */
import type { ExecutionId, TaskId } from '../types/identifiers.js';
import type { JournalEntry } from '../model/recovery-types.js';
import type { ActionProposal, ActionResult } from '../model/action.js';

export interface ExecutionJournal {
  /** Log action proposal. Returns assigned ExecutionId. */
  logProposal(proposal: ActionProposal, isDestructive?: boolean): Promise<ExecutionId>;

  /** Log transition of action execution to RUNNING state. */
  logStart(executionId: ExecutionId): Promise<void>;

  /** Log successful action execution completion. */
  logCompletion(executionId: ExecutionId, result: ActionResult): Promise<void>;

  /** Log explicit action execution failure. */
  logFailure(executionId: ExecutionId, error: string): Promise<void>;

  /** Fetch journal entry by execution ID. */
  getEntry(executionId: ExecutionId): Promise<JournalEntry | undefined>;

  /** Get all interrupted or uncompleted journal entries for a task. */
  getInterruptedEntries(taskId: TaskId): Promise<ReadonlyArray<JournalEntry>>;

  /** List all journal entries for a task. */
  listForTask(taskId: TaskId): Promise<ReadonlyArray<JournalEntry>>;
}
