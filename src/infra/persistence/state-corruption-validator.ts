/**
 * State Corruption Validator & Safeguard.
 *
 * Validates deserialized state snapshots and checkpoint records before state transitions
 * to prevent corrupted or tampered state execution.
 */
import type { AgentState } from '../../core/model/state.js';
import { AgentPhase } from '../../core/model/state.js';
import { HarnessError } from '../../core/errors/base-error.js';
import { ErrorCode, ErrorCategory } from '../../core/errors/error-codes.js';

export class StateCorruptionValidator {
  /**
   * Validate state snapshot integrity. Throws HarnessError if corruption is detected.
   */
  static validateOrThrow(state: AgentState): void {
    if (!state) {
      throw new HarnessError({
        code: ErrorCode.STATE_CORRUPTED,
        category: ErrorCategory.STATE,
        message: 'State object is null or undefined',
      });
    }

    if (!state.id || !state.taskId || !state.iterationId) {
      throw new HarnessError({
        code: ErrorCode.STATE_CORRUPTED,
        category: ErrorCategory.STATE,
        message: 'State snapshot is missing mandatory identifiers (id, taskId, or iterationId)',
        context: { state },
      });
    }

    if (!Object.values(AgentPhase).includes(state.phase)) {
      throw new HarnessError({
        code: ErrorCode.STATE_CORRUPTED,
        category: ErrorCategory.STATE,
        message: `Corrupted state phase detected: [${String(state.phase)}]`,
        context: { state },
      });
    }

    if (state.iterationCount < 0 || state.repairCount < 0) {
      throw new HarnessError({
        code: ErrorCode.STATE_CORRUPTED,
        category: ErrorCategory.STATE,
        message: `Corrupted iteration or repair counter: iterationCount=${state.iterationCount}, repairCount=${state.repairCount}`,
        context: { state },
      });
    }
  }
}
