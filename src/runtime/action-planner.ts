/**
 * Action Planner.
 *
 * "The model proposes; the runtime decides."
 *
 * Parses vendor-neutral ModelResponse content and tool calls into
 * explicit ActionProposal domain objects.
 */
import type { IdFactory } from '../core/types/identifiers.js';
import type { TaskId, IterationId } from '../core/types/identifiers.js';
import type { ModelResponse } from '../core/model/model-io.js';
import type { ActionProposal } from '../core/model/action.js';
import { ActionType } from '../core/model/action.js';

export class ActionPlanner {
  /**
   * Parse a ModelResponse into structured ActionProposals.
   */
  static parseProposals(
    response: ModelResponse,
    taskId: TaskId,
    iterationId: IterationId,
    idFactory: IdFactory,
  ): ReadonlyArray<ActionProposal> {
    const proposals: ActionProposal[] = [];
    const now = new Date();

    // 1. Tool Call Proposals
    if (response.toolCalls && response.toolCalls.length > 0) {
      for (const tc of response.toolCalls) {
        const actionType = mapToolNameToActionType(tc.name);
        const irreversible = isIrreversibleAction(actionType, tc.input);

        proposals.push({
          id: idFactory.create<'Action'>(),
          taskId,
          iterationId,
          type: actionType,
          description: `Execute tool [${tc.name}]`,
          parameters: tc.input,
          irreversible,
          proposedAt: now,
        });
      }
    } else if (response.content && response.content.trim().length > 0) {
      // 2. Text response / reasoning action proposal
      proposals.push({
        id: idFactory.create<'Action'>(),
        taskId,
        iterationId,
        type: ActionType.MODEL_CALL,
        description: 'Text completion / reasoning response',
        parameters: { text: response.content.slice(0, 200) },
        irreversible: false,
        proposedAt: now,
      });
    }

    return proposals;
  }
}

function mapToolNameToActionType(toolName: string): ActionType {
  const lower = toolName.toLowerCase();
  if (lower.includes('write') || lower.includes('create') || lower.includes('edit')) {
    return ActionType.FILE_WRITE;
  }
  if (lower.includes('read') || lower.includes('view') || lower.includes('cat')) {
    return ActionType.FILE_READ;
  }
  if (lower.includes('delete') || lower.includes('remove') || lower.includes('rm')) {
    return ActionType.FILE_DELETE;
  }
  if (lower.includes('shell') || lower.includes('exec') || lower.includes('run')) {
    return ActionType.SHELL_EXECUTE;
  }
  if (lower.includes('test')) {
    return ActionType.TEST_RUN;
  }
  if (lower.includes('lint')) {
    return ActionType.LINT_RUN;
  }
  if (lower.includes('build')) {
    return ActionType.BUILD_RUN;
  }
  if (lower.includes('git')) {
    return lower.includes('commit') ? ActionType.GIT_COMMIT : ActionType.GIT_CHECKOUT;
  }
  if (lower.includes('ask') || lower.includes('human') || lower.includes('escalate')) {
    return ActionType.HUMAN_ASK;
  }
  return ActionType.MODEL_CALL;
}

function isIrreversibleAction(type: ActionType, params: Record<string, unknown>): boolean {
  if (type === ActionType.FILE_DELETE || type === ActionType.GIT_COMMIT) {
    return true;
  }
  if (type === ActionType.SHELL_EXECUTE) {
    const cmd = String(params['cmd'] ?? params['command'] ?? '').toLowerCase();
    if (cmd.includes('rm ') || cmd.includes('push') || cmd.includes('deploy')) {
      return true;
    }
  }
  return false;
}
