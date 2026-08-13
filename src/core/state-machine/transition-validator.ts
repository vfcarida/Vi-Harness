/**
 * Transition validator — enforces the transition whitelist.
 *
 * INVARIANT: No transition can occur unless it exists in TRANSITION_TABLE.
 * This is the core enforcement mechanism: the LLM proposes events,
 * but only the validator decides whether the transition is legal.
 */
import { AgentPhase, StateEvent, TERMINAL_PHASES, RUNTIME_ONLY_EVENTS } from '../model/state.js';
import { lookupTransition } from './transition-table.js';
import { HarnessError } from '../errors/base-error.js';
import { ErrorCode, ErrorCategory } from '../errors/error-codes.js';

// ---------------------------------------------------------------------------
// Validation result
// ---------------------------------------------------------------------------

export interface TransitionValidationResult {
  readonly valid: boolean;
  readonly from: AgentPhase;
  readonly event: StateEvent;
  readonly to: AgentPhase | null;
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

/**
 * Validate whether a transition from `currentPhase` via `event` is legal.
 *
 * Rules enforced:
 * 1. Terminal states cannot transition.
 * 2. The (from, event) pair must exist in the transition whitelist.
 * 3. Runtime-only events cannot be emitted by the LLM.
 *
 * @param currentPhase - The phase the agent is currently in.
 * @param event - The event being proposed.
 * @param isLlmEmitted - Whether the event was emitted by the LLM (vs. runtime).
 */
export function validateTransition(
  currentPhase: AgentPhase,
  event: StateEvent,
  isLlmEmitted: boolean = false,
): TransitionValidationResult {
  // Rule 1: Terminal states cannot transition
  if (TERMINAL_PHASES.has(currentPhase)) {
    return {
      valid: false,
      from: currentPhase,
      event,
      to: null,
      reason: `Cannot transition from terminal phase ${currentPhase}`,
    };
  }

  // Rule 3: Runtime-only events cannot be LLM-emitted
  if (isLlmEmitted && RUNTIME_ONLY_EVENTS.has(event)) {
    return {
      valid: false,
      from: currentPhase,
      event,
      to: null,
      reason: `Event ${event} can only be emitted by the runtime, not the LLM`,
    };
  }

  // Rule 2: Lookup the transition
  const targetPhase = lookupTransition(currentPhase, event);

  if (targetPhase === undefined) {
    return {
      valid: false,
      from: currentPhase,
      event,
      to: null,
      reason: `No transition defined for ${currentPhase} + ${event}`,
    };
  }

  return {
    valid: true,
    from: currentPhase,
    event,
    to: targetPhase,
    reason: 'Transition is valid',
  };
}

/**
 * Validate and return the target phase, or throw HarnessError.
 * Use this when the caller wants the transition to succeed or fail loudly.
 */
export function validateTransitionOrThrow(
  currentPhase: AgentPhase,
  event: StateEvent,
  isLlmEmitted: boolean = false,
): AgentPhase {
  const result = validateTransition(currentPhase, event, isLlmEmitted);

  if (!result.valid) {
    throw new HarnessError({
      code: ErrorCode.STATE_INVALID_TRANSITION,
      category: ErrorCategory.STATE,
      message: result.reason,
      context: {
        from: currentPhase,
        event,
        isLlmEmitted,
      },
    });
  }

  return result.to!;
}
