/**
 * Reconstructability Invariant (from DeepSeek Harness).
 *
 * "Model-visible means logged."
 * Enforces the runtime invariant that every message sent to an LLM is
 * 100% reconstructable from the session's append-only event log.
 */
import type { SessionEvent } from './session-event.js';
import type { ModelMessage } from '../model/model-io.js';
import { deriveMessages } from './derive-messages.js';
import { HarnessError } from '../errors/base-error.js';
import { ErrorCode, ErrorCategory } from '../errors/error-codes.js';

/**
 * Validates that the model-visible messages match exactly what is derived from the session log.
 */
export function assertModelHistoryReconstructable(
  sessionLog: ReadonlyArray<SessionEvent>,
  actualMessagesBeingSent: ReadonlyArray<ModelMessage>,
): void {
  const derived = deriveMessages(sessionLog);

  if (derived.length !== actualMessagesBeingSent.length) {
    throw new HarnessError({
      code: ErrorCode.STATE_CORRUPTED,
      category: ErrorCategory.STATE,
      message: `Reconstructability invariant violated: message length mismatch. Derived ${derived.length} messages, but sending ${actualMessagesBeingSent.length} messages.`,
      context: {
        derivedCount: derived.length,
        actualCount: actualMessagesBeingSent.length,
        logEventCount: sessionLog.length,
      },
    });
  }

  for (let i = 0; i < derived.length; i++) {
    const d = derived[i]!;
    const a = actualMessagesBeingSent[i]!;

    if (d.role !== a.role) {
      throw new HarnessError({
        code: ErrorCode.STATE_CORRUPTED,
        category: ErrorCategory.STATE,
        message: `Reconstructability invariant violated at message[${i}]: role mismatch. Expected '${d.role}', received '${a.role}'.`,
      });
    }

    if (d.content !== a.content) {
      throw new HarnessError({
        code: ErrorCode.STATE_CORRUPTED,
        category: ErrorCategory.STATE,
        message: `Reconstructability invariant violated at message[${i}]: content mismatch.`,
        context: {
          derivedContent: d.content,
          actualContent: a.content,
        },
      });
    }

    if (d.toolCallId !== a.toolCallId) {
      throw new HarnessError({
        code: ErrorCode.STATE_CORRUPTED,
        category: ErrorCategory.STATE,
        message: `Reconstructability invariant violated at message[${i}]: toolCallId mismatch. Expected '${d.toolCallId}', received '${a.toolCallId}'.`,
      });
    }
  }
}
