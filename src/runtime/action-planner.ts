/**
 * Action Planner.
 *
 * "The model proposes; the runtime decides."
 *
 * Parses vendor-neutral ModelResponse content and tool calls into
 * explicit ActionProposal domain objects.
 * Tool identity comes strictly from registered tool definitions — no heuristic string mapping.
 */
import type { IdFactory } from '../core/types/identifiers.js';
import type { TaskId, IterationId } from '../core/types/identifiers.js';
import type { ModelResponse } from '../core/model/model-io.js';
import type { ActionProposal } from '../core/model/action.js';
import { ActionType } from '../core/model/action.js';
import type { ToolRegistry } from '../core/interfaces/tool-registry.js';
import { ToolCategory } from '../core/model/tool-types.js';

export class ActionPlanner {
  /**
   * Parse a ModelResponse into structured ActionProposals.
   * Derives action type and risk strictly from the tool registry definition.
   */
  static parseProposals(
    response: ModelResponse,
    taskId: TaskId,
    iterationId: IterationId,
    idFactory: IdFactory,
    toolRegistry?: ToolRegistry,
  ): ReadonlyArray<ActionProposal> {
    const proposals: ActionProposal[] = [];
    const now = new Date();

    // 1. Tool Call Proposals
    if (response.toolCalls && response.toolCalls.length > 0) {
      for (const tc of response.toolCalls) {
        const tool = toolRegistry?.getTool(tc.name);
        const actionType = tool ? mapCategoryToActionType(tool.definition.category) : ActionType.TOOL_CALL;
        const irreversible = tool
          ? tool.definition.mutating || tool.definition.riskLevel === 'HIGH' || tool.definition.riskLevel === 'CRITICAL'
          : false;

        proposals.push({
          id: idFactory.create<'Action'>(),
          taskId,
          iterationId,
          type: actionType,
          description: `Execute tool [${tc.name}]`,
          parameters: {
            ...tc.input,
            toolName: tc.name,
            toolCallId: tc.id,
          },
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

function mapCategoryToActionType(category: ToolCategory): ActionType {
  switch (category) {
    case ToolCategory.READ:
      return ActionType.FILE_READ;
    case ToolCategory.WRITE:
      return ActionType.FILE_WRITE;
    case ToolCategory.DESTRUCTIVE:
      return ActionType.FILE_DELETE;
    case ToolCategory.EXECUTE:
      return ActionType.SHELL_EXECUTE;
    default:
      return ActionType.MODEL_CALL;
  }
}
