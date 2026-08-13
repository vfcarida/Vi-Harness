/**
 * Action domain types.
 *
 * "The model proposes; the runtime decides."
 *
 * An ActionProposal is what the model wants to do.
 * An ActionResult is what actually happened after policy + execution.
 */
import type { ActionId, TaskId, IterationId } from '../types/identifiers.js';

// ---------------------------------------------------------------------------
// Action type — broad categories of agent actions
// ---------------------------------------------------------------------------

export enum ActionType {
  FILE_WRITE = 'FILE_WRITE',
  FILE_READ = 'FILE_READ',
  FILE_DELETE = 'FILE_DELETE',
  SHELL_EXECUTE = 'SHELL_EXECUTE',
  SEARCH = 'SEARCH',
  GIT_COMMIT = 'GIT_COMMIT',
  GIT_CHECKOUT = 'GIT_CHECKOUT',
  TEST_RUN = 'TEST_RUN',
  LINT_RUN = 'LINT_RUN',
  BUILD_RUN = 'BUILD_RUN',
  MODEL_CALL = 'MODEL_CALL',
  HUMAN_ASK = 'HUMAN_ASK',
  SUBAGENT_SPAWN = 'SUBAGENT_SPAWN',
  TOOL_CALL = 'TOOL_CALL',
}

// ---------------------------------------------------------------------------
// Action proposal — what the model wants to do
// ---------------------------------------------------------------------------

export interface ActionProposal {
  readonly id: ActionId;
  readonly taskId: TaskId;
  readonly iterationId: IterationId;
  readonly type: ActionType;
  readonly description: string;
  readonly parameters: Readonly<Record<string, unknown>>;
  readonly irreversible: boolean;
  readonly proposedAt: Date;
}

// ---------------------------------------------------------------------------
// Action result status
// ---------------------------------------------------------------------------

export enum ActionResultStatus {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
  DENIED = 'DENIED',
  TIMEOUT = 'TIMEOUT',
  SKIPPED = 'SKIPPED',
}

// ---------------------------------------------------------------------------
// Action result — what actually happened
// ---------------------------------------------------------------------------

export interface ActionResult {
  readonly actionId: ActionId;
  readonly status: ActionResultStatus;
  readonly output: string;
  readonly durationMs: number;
  readonly error?: string;
  readonly executedAt: Date;
  readonly metadata: Readonly<Record<string, unknown>>;
}
