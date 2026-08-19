/**
 * Session Domain Entity (from DeepSeek Harness & Pi).
 *
 * An append-only event log session representing an agent interaction tree branch.
 */
import type { SessionId, IdFactory } from '../types/identifiers.js';
import type { Clock } from '../interfaces/clock.js';
import type { SessionHeader } from './session-header.js';
import type { SessionEvent } from './session-event.js';
import type { SessionEventMap } from './event-map.js';
import type { ModelMessage } from '../model/model-io.js';
import { deriveMessages, type DeriveMessagesOptions } from './derive-messages.js';
import { HarnessError } from '../errors/base-error.js';
import { ErrorCode, ErrorCategory } from '../errors/error-codes.js';

export interface Session {
  readonly id: SessionId;
  readonly header: SessionHeader;
  readonly log: ReadonlyArray<SessionEvent>;
  readonly firstLiveSeq: number;

  append<K extends keyof SessionEventMap>(
    type: K,
    data: SessionEventMap[K],
    timestamp?: number,
  ): SessionEvent<K>;

  deriveMessages(options?: DeriveMessagesOptions): ModelMessage[];

  fork(boundary?: number, childId?: SessionId): Session;
}

export interface DefaultSessionOptions {
  readonly header: SessionHeader;
  readonly initialLog?: ReadonlyArray<SessionEvent>;
  readonly idFactory?: IdFactory;
  readonly clock?: Clock;
}

export class DefaultSession implements Session {
  private readonly _header: SessionHeader;
  private readonly _events: SessionEvent[] = [];
  private readonly idFactory?: IdFactory;
  private readonly clock?: Clock;

  constructor(options: DefaultSessionOptions) {
    this._header = options.header;
    this.idFactory = options.idFactory;
    this.clock = options.clock;

    if (options.initialLog) {
      for (const ev of options.initialLog) {
        this._events.push(ev);
      }
    }
  }

  get id(): SessionId {
    return this._header.id;
  }

  get header(): SessionHeader {
    return this._header;
  }

  get log(): ReadonlyArray<SessionEvent> {
    return this._events;
  }

  get firstLiveSeq(): number {
    return this._header.seedLength ?? 0;
  }

  append<K extends keyof SessionEventMap>(
    type: K,
    data: SessionEventMap[K],
    timestamp?: number,
  ): SessionEvent<K> {
    const seq = this._events.length;
    const time = timestamp ?? (this.clock ? this.clock.now().getTime() : Date.now());

    const event: SessionEvent<K> = {
      type,
      data,
      seq,
      time,
    };

    this._events.push(event as SessionEvent);
    return event;
  }

  deriveMessages(options?: DeriveMessagesOptions): ModelMessage[] {
    return deriveMessages(this._events, options);
  }

  fork(boundary?: number, childId?: SessionId): Session {
    const maxBoundary = this._events.length - 1;
    const targetBoundary = boundary !== undefined ? boundary : maxBoundary;

    if (targetBoundary < -1 || targetBoundary > maxBoundary) {
      throw new HarnessError({
        code: ErrorCode.STATE_INVALID_TRANSITION,
        category: ErrorCategory.STATE,
        message: `Invalid fork boundary ${targetBoundary}. Valid range: [-1, ${maxBoundary}].`,
      });
    }

    const seedLength = targetBoundary + 1;
    const seededEvents = this._events.slice(0, seedLength);

    const now = this.clock ? this.clock.now().getTime() : Date.now();
    const newId =
      childId ??
      (this.idFactory
        ? this.idFactory.create<'Session'>()
        : (`ses_${Math.random().toString(36).slice(2, 11)}` as SessionId));

    const childHeader: SessionHeader = {
      version: this._header.version,
      id: newId,
      createdAt: now,
      cwd: this._header.cwd,
      parentSession: this._header.id,
      seedLength,
      delegationDepth: (this._header.delegationDepth ?? 0) + 1,
      metadata: {
        ...this._header.metadata,
        forkedFromSession: this._header.id,
        forkedFromSeq: targetBoundary,
      },
    };

    return new DefaultSession({
      header: childHeader,
      initialLog: seededEvents,
      idFactory: this.idFactory,
      clock: this.clock,
    });
  }
}
