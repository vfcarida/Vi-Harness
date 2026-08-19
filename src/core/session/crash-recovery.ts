/**
 * Crash Recovery (from DeepSeek Harness).
 *
 * Detects interrupted turns when loading/resuming a session, synthesizing
 * a `turn/end` with `{ kind: 'interrupted' }` reason to close the turn
 * without truncating or discarding intermediate turn events.
 */
import type { SessionEvent } from './session-event.js';
import type { TurnEndReason } from './event-map.js';

export interface CrashRecoveryResult {
  readonly recoveredLog: ReadonlyArray<SessionEvent>;
  readonly wasInterrupted: boolean;
  readonly unclosedTurnNumber?: number;
  readonly syntheticEvents: ReadonlyArray<SessionEvent>;
}

/**
 * Validates and repairs an event log from an interrupted session.
 */
export function recoverInterruptedSession(
  events: ReadonlyArray<SessionEvent>,
  recoveryTimeMs: number = Date.now(),
): CrashRecoveryResult {
  const recovered: SessionEvent[] = [...events];
  const syntheticEvents: SessionEvent[] = [];

  let openTurn: number | null = null;
  let openStep: { turn: number; step: number } | null = null;

  for (const ev of events) {
    if (ev.type === 'turn/start') {
      const data = ev.data as { turn: number };
      openTurn = data.turn;
    } else if (ev.type === 'turn/end') {
      openTurn = null;
    } else if (ev.type === 'step/start') {
      const data = ev.data as { turn: number; step: number };
      openStep = { turn: data.turn, step: data.step };
    } else if (ev.type === 'step/end') {
      openStep = null;
    }
  }

  // If a step was left open, close it first
  if (openStep !== null && openTurn !== null) {
    const syntheticStepEnd: SessionEvent<'step/end'> = {
      type: 'step/end',
      data: { turn: openStep.turn, step: openStep.step },
      seq: recovered.length,
      time: recoveryTimeMs,
    };
    recovered.push(syntheticStepEnd as SessionEvent);
    syntheticEvents.push(syntheticStepEnd as SessionEvent);
  }

  // If a turn was left open (e.g. process crashed during model response or tool execution)
  if (openTurn !== null) {
    const syntheticTurnEnd: SessionEvent<'turn/end'> = {
      type: 'turn/end',
      data: {
        turn: openTurn,
        reason: { kind: 'interrupted' } as TurnEndReason,
      },
      seq: recovered.length,
      time: recoveryTimeMs,
    };
    recovered.push(syntheticTurnEnd as SessionEvent);
    syntheticEvents.push(syntheticTurnEnd as SessionEvent);

    return {
      recoveredLog: recovered,
      wasInterrupted: true,
      unclosedTurnNumber: openTurn,
      syntheticEvents,
    };
  }

  return {
    recoveredLog: recovered,
    wasInterrupted: false,
    syntheticEvents: [],
  };
}
