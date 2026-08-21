import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { JsonlEventStore } from '../../../src/infra/persistence/jsonl-event-store.js';
import { UuidV7IdFactory } from '../../../src/infra/id/uuid-id-factory.js';
import { AgentPhase, StateEvent } from '../../../src/core/model/state.js';
import type { TaskId } from '../../../src/core/types/identifiers.js';

describe('JsonlEventStore', () => {
  const idFactory = new UuidV7IdFactory();
  let tempDir: string;
  let store: JsonlEventStore;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vi-harness-jsonl-events-'));
    store = new JsonlEventStore({
      storageDir: tempDir,
      idFactory,
    });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('appends and retrieves sequential event records to durable JSONL files', async () => {
    const taskId = 'task-jsonl-001' as TaskId;

    const event1 = await store.append({
      taskId,
      fromPhase: AgentPhase.INIT,
      toPhase: AgentPhase.EXPLORE,
      event: StateEvent.START,
      timestamp: new Date(),
      isLlmEmitted: false,
    });

    const event2 = await store.append({
      taskId,
      fromPhase: AgentPhase.EXPLORE,
      toPhase: AgentPhase.PLAN,
      event: StateEvent.EXPLORE_COMPLETE,
      timestamp: new Date(),
      isLlmEmitted: false,
    });

    expect(event1.sequenceNumber).toBe(1);
    expect(event2.sequenceNumber).toBe(2);

    const retrieved = await store.getEvents(taskId);
    expect(retrieved).toHaveLength(2);
    expect(retrieved[0]?.fromPhase).toBe(AgentPhase.INIT);
    expect(retrieved[1]?.toPhase).toBe(AgentPhase.PLAN);

    const lastEvent = await store.getLastEvent(taskId);
    expect(lastEvent?.id).toBe(event2.id);
  });
});
