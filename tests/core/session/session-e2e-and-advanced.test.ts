/**
 * Session E2E, Multi-Turn, Compaction & Advanced Tree Tests (P008).
 *
 * Validates:
 * 1. Multi-turn conversation flows with tool use and streaming.
 * 2. Time-travel and tree checkout emulations.
 * 3. Multi-stage compaction shadow projection.
 * 4. Complex crash recovery and recovery idempotency.
 */
import { describe, it, expect } from 'vitest';
import {
  DefaultSession,
  InMemorySessionStore,
  assertModelHistoryReconstructable,
  recoverInterruptedSession,
} from '../../../src/core/session/index.js';
import { MessageRole, type ModelMessage } from '../../../src/core/model/model-io.js';
import { UuidV7IdFactory } from '../../../src/infra/id/uuid-id-factory.js';
import { TestClock } from '../../../src/infra/time/test-clock.js';

describe('Session E2E & Advanced Scenarios (DSH & Pi) — P008', () => {
  const clock = new TestClock(new Date('2026-01-01T00:00:00.000Z'));
  const idFactory = new UuidV7IdFactory();

  it('1. should project a realistic 3-turn interactive conversation with tool use', () => {
    const session = new DefaultSession({
      header: { version: 1, id: idFactory.create<'Session'>(), createdAt: clock.now().getTime() },
      idFactory,
      clock,
    });

    // Turn 1: User asks for file check, Assistant checks file
    session.append('turn/start', { turn: 1 });
    session.append('user/message', { content: 'Check if index.ts exists.' });
    session.append('step/start', { turn: 1, step: 1 });
    session.append('tool/call', {
      turn: 1,
      step: 1,
      callId: 'call_1',
      name: 'file_exists',
      arguments: JSON.stringify({ path: 'src/index.ts' }),
    });
    session.append('tool/result', {
      turn: 1,
      step: 1,
      message: { toolCallId: 'call_1', name: 'file_exists', output: 'true' },
    });
    session.append('step/end', { turn: 1, step: 1 });
    session.append('assistant/message', {
      turn: 1,
      step: 2,
      message: { content: 'Yes, src/index.ts exists.' },
    });
    session.append('turn/end', { turn: 1, reason: { kind: 'complete' } });

    // Turn 2: User asks to read it, Assistant reads file
    session.append('turn/start', { turn: 2 });
    session.append('user/message', { content: 'What are its contents?' });
    session.append('step/start', { turn: 2, step: 1 });
    session.append('tool/call', {
      turn: 2,
      step: 1,
      callId: 'call_2',
      name: 'read_file',
      arguments: JSON.stringify({ path: 'src/index.ts' }),
    });
    session.append('tool/result', {
      turn: 2,
      step: 1,
      message: { toolCallId: 'call_2', name: 'read_file', output: 'export * from "./core";' },
    });
    session.append('step/end', { turn: 2, step: 1 });
    session.append('assistant/message', {
      turn: 2,
      step: 2,
      message: { content: 'It exports all modules from ./core.' },
    });
    session.append('turn/end', { turn: 2, reason: { kind: 'complete' } });

    const messages = session.deriveMessages();
    expect(messages).toHaveLength(8);

    // Turn 1 messages
    expect(messages[0]?.role).toBe(MessageRole.USER);
    expect(messages[1]?.role).toBe(MessageRole.ASSISTANT);
    expect(messages[1]?.toolCalls?.[0]?.name).toBe('file_exists');
    expect(messages[2]?.role).toBe(MessageRole.TOOL);
    expect(messages[3]?.role).toBe(MessageRole.ASSISTANT);
    expect(messages[3]?.content).toBe('Yes, src/index.ts exists.');

    // Turn 2 messages
    expect(messages[4]?.role).toBe(MessageRole.USER);
    expect(messages[5]?.role).toBe(MessageRole.ASSISTANT);
    expect(messages[5]?.toolCalls?.[0]?.name).toBe('read_file');
    expect(messages[6]?.role).toBe(MessageRole.TOOL);
    expect(messages[7]?.role).toBe(MessageRole.ASSISTANT);
    expect(messages[7]?.content).toBe('It exports all modules from ./core.');

    // Invariant check
    expect(() => assertModelHistoryReconstructable(session.log, messages)).not.toThrow();
  });

  it('2. should support time-travel by forking from an earlier sequence and resuming a new branch', () => {
    const store = new InMemorySessionStore({ idFactory, clock });
    const mainSession = store.create();

    mainSession.append('turn/start', { turn: 1 });
    mainSession.append('user/message', { content: 'Write quicksort algorithm.' }); // seq 1
    mainSession.append('assistant/message', {
      turn: 1,
      step: 1,
      message: { content: 'Here is quicksort in Python...' },
    }); // seq 2
    mainSession.append('turn/end', { turn: 1, reason: { kind: 'complete' } }); // seq 3

    mainSession.append('turn/start', { turn: 2 });
    mainSession.append('user/message', { content: 'Now convert it to Java.' }); // seq 5
    mainSession.append('assistant/message', {
      turn: 2,
      step: 1,
      message: { content: 'Here is quicksort in Java...' },
    }); // seq 6
    mainSession.append('turn/end', { turn: 2, reason: { kind: 'complete' } }); // seq 7

    // Time travel: fork back to after Turn 1 (seq 3) and ask for TypeScript instead
    const tsBranch = store.fork(mainSession.id, 3);
    tsBranch.append('turn/start', { turn: 2 });
    tsBranch.append('user/message', { content: 'Now convert it to TypeScript instead.' });
    tsBranch.append('assistant/message', {
      turn: 2,
      step: 1,
      message: { content: 'Here is quicksort in TypeScript...' },
    });
    tsBranch.append('turn/end', { turn: 2, reason: { kind: 'complete' } });

    // Main session has Java
    const mainMessages = mainSession.deriveMessages();
    expect(mainMessages[3]?.content).toContain('Java');

    // TS Branch has TypeScript
    const tsMessages = tsBranch.deriveMessages();
    expect(tsMessages).toHaveLength(4);
    expect(tsMessages[0]?.content).toBe('Write quicksort algorithm.');
    expect(tsMessages[1]?.content).toContain('Python');
    expect(tsMessages[2]?.content).toBe('Now convert it to TypeScript instead.');
    expect(tsMessages[3]?.content).toContain('TypeScript');
  });

  it('3. should handle multi-stage compaction without losing projection consistency', () => {
    const session = new DefaultSession({
      header: { version: 1, id: idFactory.create<'Session'>(), createdAt: clock.now().getTime() },
      idFactory,
      clock,
    });

    // Turns 1-5
    for (let t = 1; t <= 5; t++) {
      session.append('turn/start', { turn: t });
      session.append('user/message', { content: `Question ${t}` });
      session.append('assistant/message', {
        turn: t,
        step: 1,
        message: { content: `Answer ${t}` },
      });
      session.append('turn/end', { turn: t, reason: { kind: 'complete' } });
    }

    // Total events so far: 5 turns * 4 events = 20 events (seq 0 .. 19)
    expect(session.log).toHaveLength(20);

    // Compact Turns 1-3 (seq 0 .. 11)
    session.append('compaction/summary', {
      fromSeq: 0,
      toSeq: 11,
      summary: 'Summary of questions and answers 1 through 3',
    }); // seq 20

    // Turn 6
    session.append('turn/start', { turn: 6 });
    session.append('user/message', { content: 'Question 6' });
    session.append('assistant/message', {
      turn: 6,
      step: 1,
      message: { content: 'Answer 6' },
    });
    session.append('turn/end', { turn: 6, reason: { kind: 'complete' } });

    const messages = session.deriveMessages();
    // Expected messages:
    // 0: Compaction summary (system)
    // 1: Question 4 (user)
    // 2: Answer 4 (assistant)
    // 3: Question 5 (user)
    // 4: Answer 5 (assistant)
    // 5: Question 6 (user)
    // 6: Answer 6 (assistant)
    expect(messages).toHaveLength(7);
    expect(messages[0]?.role).toBe(MessageRole.SYSTEM);
    expect(messages[0]?.content).toContain('Summary of questions');
    expect(messages[1]?.content).toBe('Question 4');
    expect(messages[5]?.content).toBe('Question 6');
  });

  it('4. should be idempotent when running crash recovery multiple times', () => {
    const rawEvents = [
      { type: 'turn/start', data: { turn: 1 }, seq: 0, time: 1000 },
      { type: 'user/message', data: { content: 'Interrupted turn' }, seq: 1, time: 1010 },
    ];

    const recovery1 = recoverInterruptedSession(rawEvents as any, 2000);
    expect(recovery1.wasInterrupted).toBe(true);
    expect(recovery1.recoveredLog).toHaveLength(3);

    // Running recovery on already recovered log produces no new synthetic events
    const recovery2 = recoverInterruptedSession(recovery1.recoveredLog, 3000);
    expect(recovery2.wasInterrupted).toBe(false);
    expect(recovery2.recoveredLog).toHaveLength(3);
  });

  it('5. should correctly recover when middle turns are complete but final turn is interrupted', () => {
    const rawEvents = [
      // Turn 1 complete
      { type: 'turn/start', data: { turn: 1 }, seq: 0, time: 1000 },
      { type: 'user/message', data: { content: 'Task 1' }, seq: 1, time: 1010 },
      { type: 'turn/end', data: { turn: 1, reason: { kind: 'complete' } }, seq: 2, time: 1020 },
      // Turn 2 complete
      { type: 'turn/start', data: { turn: 2 }, seq: 3, time: 2000 },
      { type: 'user/message', data: { content: 'Task 2' }, seq: 4, time: 2010 },
      { type: 'turn/end', data: { turn: 2, reason: { kind: 'complete' } }, seq: 5, time: 2020 },
      // Turn 3 interrupted
      { type: 'turn/start', data: { turn: 3 }, seq: 6, time: 3000 },
      { type: 'user/message', data: { content: 'Task 3 crashed' }, seq: 7, time: 3010 },
    ];

    const result = recoverInterruptedSession(rawEvents as any, 4000);
    expect(result.wasInterrupted).toBe(true);
    expect(result.unclosedTurnNumber).toBe(3);
    expect(result.recoveredLog).toHaveLength(9);
    expect(result.recoveredLog[8]?.type).toBe('turn/end');
    expect((result.recoveredLog[8]?.data as any).turn).toBe(3);
    expect((result.recoveredLog[8]?.data as any).reason.kind).toBe('interrupted');
  });

  it('6. should construct a deep 5-tier branching tree with accurate lineage tracking', () => {
    const store = new InMemorySessionStore({ idFactory, clock });

    const s0 = store.create(); // depth 0
    s0.append('user/message', { content: 'L0' });

    const s1 = store.fork(s0.id); // depth 1
    s1.append('user/message', { content: 'L1' });

    const s2 = store.fork(s1.id); // depth 2
    s2.append('user/message', { content: 'L2' });

    const s3 = store.fork(s2.id); // depth 3
    s3.append('user/message', { content: 'L3' });

    const s4 = store.fork(s3.id); // depth 4
    s4.append('user/message', { content: 'L4' });

    expect(s4.header.delegationDepth).toBe(4);
    const ancestors = store.findAncestors(s4.id);
    expect(ancestors).toHaveLength(5);
    expect(ancestors.map((a) => a.id)).toEqual([s0.id, s1.id, s2.id, s3.id, s4.id]);

    const lca04 = store.findCommonAncestor(s0.id, s4.id);
    expect(lca04?.id).toBe(s0.id);
  });
});
