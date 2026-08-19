/**
 * Session Events & Log Unit Tests (P008).
 *
 * Validates:
 * 1. Monotonic seq assignment and non-decreasing timestamps.
 * 2. Typed event vocabulary covering all SessionEventMap keys.
 * 3. All TurnEndReason variants (complete, aborted, budget, interrupted, error).
 * 4. Declaration merging extensibility.
 */
import { describe, it, expect } from 'vitest';
import {
  DefaultSession,
  type SessionEventMap,
  type TurnEndReason,
  type EpochHeader,
  type StreamChunk,
} from '../../../src/core/session/index.js';
import { TestClock } from '../../../src/infra/time/test-clock.js';
import { UuidV7IdFactory } from '../../../src/infra/id/uuid-id-factory.js';
import type { SessionId } from '../../../src/core/types/identifiers.js';

describe('Session Events & Log (DSH & Pi) — P008', () => {
  const clock = new TestClock(new Date('2026-01-01T00:00:00.000Z'));
  const idFactory = new UuidV7IdFactory();

  it('1. should assign strictly monotonic sequence numbers starting from 0', () => {
    const session = new DefaultSession({
      header: {
        version: 1,
        id: idFactory.create<'Session'>(),
        createdAt: clock.now().getTime(),
      },
      clock,
    });

    expect(session.log).toHaveLength(0);

    const ev0 = session.append('turn/start', { turn: 1 });
    const ev1 = session.append('user/message', { content: 'Hello agent' });
    const ev2 = session.append('turn/end', { turn: 1, reason: { kind: 'complete' } });

    expect(ev0.seq).toBe(0);
    expect(ev1.seq).toBe(1);
    expect(ev2.seq).toBe(2);

    expect(session.log[0]?.seq).toBe(0);
    expect(session.log[1]?.seq).toBe(1);
    expect(session.log[2]?.seq).toBe(2);
  });

  it('2. should record non-decreasing timestamps across appended events', () => {
    const session = new DefaultSession({
      header: {
        version: 1,
        id: idFactory.create<'Session'>(),
        createdAt: clock.now().getTime(),
      },
      clock,
    });

    const e0 = session.append('turn/start', { turn: 1 });
    clock.advance(100);
    const e1 = session.append('step/start', { turn: 1, step: 1 });
    clock.advance(250);
    const e2 = session.append('step/end', { turn: 1, step: 1 });

    expect(e0.time).toBeLessThanOrEqual(e1.time);
    expect(e1.time).toBeLessThanOrEqual(e2.time);
    expect(e2.time - e0.time).toBe(350);
  });

  it('3. should support request/header epoch events with all reasons', () => {
    const session = new DefaultSession({
      header: {
        version: 1,
        id: idFactory.create<'Session'>(),
        createdAt: clock.now().getTime(),
      },
    });

    const header: EpochHeader = {
      epoch: 1,
      model: 'claude-3-7-sonnet',
      provider: 'anthropic',
      systemPromptHash: 'sha256:abc1234',
    };

    const evInit = session.append('request/header', { header, reason: 'initial' });
    const evResume = session.append('request/header', { header, reason: 'resume' });
    const evChange = session.append('request/header', { header, reason: 'change' });

    expect(evInit.data.reason).toBe('initial');
    expect(evResume.data.reason).toBe('resume');
    expect(evChange.data.reason).toBe('change');
  });

  it('4. should log assistant/chunk streaming events without corrupting sequence', () => {
    const session = new DefaultSession({
      header: {
        version: 1,
        id: idFactory.create<'Session'>(),
        createdAt: clock.now().getTime(),
      },
    });

    session.append('turn/start', { turn: 1 });
    session.append('step/start', { turn: 1, step: 1 });

    const chunk1: StreamChunk = { text: 'Thinking' };
    const chunk2: StreamChunk = { text: ' through problem...' };
    const chunk3: StreamChunk = {
      toolCallChunk: { id: 'call_1', name: 'read_file', argumentsDelta: '{"path":' },
    };

    session.append('assistant/chunk', { turn: 1, step: 1, chunk: chunk1 });
    session.append('assistant/chunk', { turn: 1, step: 1, chunk: chunk2 });
    session.append('assistant/chunk', { turn: 1, step: 1, chunk: chunk3 });

    expect(session.log).toHaveLength(5);
    expect((session.log[2]?.data as any).chunk.text).toBe('Thinking');
    expect((session.log[4]?.data as any).chunk.toolCallChunk.name).toBe('read_file');
  });

  it('5. should record tool/call and tool/result with error details and metadata', () => {
    const session = new DefaultSession({
      header: {
        version: 1,
        id: idFactory.create<'Session'>(),
        createdAt: clock.now().getTime(),
      },
    });

    session.append('tool/call', {
      turn: 1,
      step: 1,
      callId: 'call_bash_99',
      name: 'run_command',
      arguments: JSON.stringify({ command: 'npm test' }),
    });

    session.append('tool/result', {
      turn: 1,
      step: 1,
      message: {
        toolCallId: 'call_bash_99',
        name: 'run_command',
        output: 'Tests failed: 1 failure',
        isError: true,
      },
      error: { name: 'ProcessError', code: 'EXIT_NON_ZERO' },
      meta: { exitCode: 1, executionDurationMs: 450 },
    });

    expect(session.log).toHaveLength(2);
    const resultEvent = session.log[1]!;
    expect(resultEvent.type).toBe('tool/result');
    expect((resultEvent.data as any).message.isError).toBe(true);
    expect((resultEvent.data as any).error?.code).toBe('EXIT_NON_ZERO');
    expect((resultEvent.data as any).meta?.exitCode).toBe(1);
  });

  it('6. should record compaction lifecycle events', () => {
    const session = new DefaultSession({
      header: {
        version: 1,
        id: idFactory.create<'Session'>(),
        createdAt: clock.now().getTime(),
      },
    });

    session.append('compaction/start', { turn: 5 });
    session.append('compaction/summary', {
      fromSeq: 0,
      toSeq: 12,
      summary: 'Explored workspace and identified bug in auth handler',
      tokensSaved: 4500,
      compactedAt: clock.now().getTime(),
    });
    session.append('compaction/end', { turn: 5 });

    expect(session.log).toHaveLength(3);
    expect((session.log[1]?.data as any).summary).toContain('Explored workspace');
    expect((session.log[1]?.data as any).tokensSaved).toBe(4500);
  });

  it('7. should record goal/change lifecycle events', () => {
    const session = new DefaultSession({
      header: {
        version: 1,
        id: idFactory.create<'Session'>(),
        createdAt: clock.now().getTime(),
      },
    });

    session.append('goal/change', {
      goalId: 'goal_xyz',
      revision: 2,
      phase: 'blocked',
      blockerCode: 'budget-exhausted',
      description: 'Goal blocked due to round budget ceiling',
    });

    expect(session.log[0]?.type).toBe('goal/change');
    expect((session.log[0]?.data as any).blockerCode).toBe('budget-exhausted');
  });

  it('8. should support all TurnEndReason variants (complete, aborted, budget, interrupted, error)', () => {
    const reasons: TurnEndReason[] = [
      { kind: 'complete' },
      { kind: 'aborted', cause: 'User clicked cancel' },
      { kind: 'budget' },
      { kind: 'interrupted' },
      { kind: 'error', message: 'Connection reset by peer' },
    ];

    for (let i = 0; i < reasons.length; i++) {
      const session = new DefaultSession({
        header: {
          version: 1,
          id: `ses_${i}` as SessionId,
          createdAt: Date.now(),
        },
      });

      const endEvent = session.append('turn/end', { turn: 1, reason: reasons[i]! });
      expect(endEvent.data.reason.kind).toBe(reasons[i]!.kind);
    }
  });

  it('9. should correctly expose firstLiveSeq based on seedLength header property', () => {
    const freshSession = new DefaultSession({
      header: {
        version: 1,
        id: idFactory.create<'Session'>(),
        createdAt: clock.now().getTime(),
      },
    });
    expect(freshSession.firstLiveSeq).toBe(0);

    const forkedSession = new DefaultSession({
      header: {
        version: 1,
        id: idFactory.create<'Session'>(),
        createdAt: clock.now().getTime(),
        seedLength: 14,
      },
    });
    expect(forkedSession.firstLiveSeq).toBe(14);
  });

  it('10. should allow explicit timestamp override when appending events', () => {
    const session = new DefaultSession({
      header: {
        version: 1,
        id: idFactory.create<'Session'>(),
        createdAt: 1000,
      },
      clock,
    });

    const explicitTime = 999999;
    const ev = session.append('turn/start', { turn: 1 }, explicitTime);
    expect(ev.time).toBe(explicitTime);
  });
});
