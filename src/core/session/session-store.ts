// Pattern: Tree-structured session store (ref: Pi)
/**
 * Session Store (from Pi & DeepSeek Harness).
 *
 * Provides tree-structured session storage, branching, lineage navigation,
 * and persistence.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { SessionId, IdFactory } from '../types/identifiers.js';
import type { Clock } from '../interfaces/clock.js';
import type { Session } from './session.js';
import { DefaultSession } from './session.js';
import type { SessionHeader } from './session-header.js';
import { SessionJsonlPersistence } from './jsonl-persistence.js';
import { recoverInterruptedSession } from './crash-recovery.js';
import { HarnessError } from '../errors/base-error.js';
import { ErrorCode, ErrorCategory } from '../errors/error-codes.js';

export interface CreateSessionOpts {
  readonly cwd?: string;
  readonly parentSession?: SessionId;
  readonly seedLength?: number;
  readonly delegationDepth?: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface SessionStore {
  /** Create a brand new session. */
  create(id?: SessionId, opts?: CreateSessionOpts): Session;

  /** Get an existing session by ID. */
  get(id: SessionId): Session | null;

  /** Fork a session at a specific event boundary. */
  fork(sourceId: SessionId, boundary?: number, childId?: SessionId): Session;

  /** Resume a session, running crash recovery if it was interrupted. */
  resume(id: SessionId): Session;

  /** List all session headers in the store. */
  list(): ReadonlyArray<SessionHeader>;

  /** Find the ancestor lineage from root down to this session. */
  findAncestors(id: SessionId): ReadonlyArray<SessionHeader>;

  /** Find immediate child branches spawned from this session. */
  findChildren(id: SessionId): ReadonlyArray<SessionHeader>;

  /** Find the lowest common ancestor between two sessions. */
  findCommonAncestor(idA: SessionId, idB: SessionId): SessionHeader | null;
}

export interface InMemorySessionStoreOptions {
  readonly idFactory?: IdFactory;
  readonly clock?: Clock;
}

export class InMemorySessionStore implements SessionStore {
  private readonly sessions = new Map<SessionId, Session>();
  private readonly idFactory?: IdFactory;
  private readonly clock?: Clock;

  constructor(options?: InMemorySessionStoreOptions) {
    this.idFactory = options?.idFactory;
    this.clock = options?.clock;
  }

  create(id?: SessionId, opts?: CreateSessionOpts): Session {
    const sessionId =
      id ??
      (this.idFactory
        ? this.idFactory.create<'Session'>()
        : (`ses_${Math.random().toString(36).slice(2, 11)}` as SessionId));

    const now = this.clock ? this.clock.now().getTime() : Date.now();

    const header: SessionHeader = {
      version: 1,
      id: sessionId,
      createdAt: now,
      cwd: opts?.cwd,
      parentSession: opts?.parentSession,
      seedLength: opts?.seedLength,
      delegationDepth: opts?.delegationDepth ?? (opts?.parentSession ? 1 : 0),
      metadata: opts?.metadata,
    };

    const session = new DefaultSession({
      header,
      idFactory: this.idFactory,
      clock: this.clock,
    });

    this.sessions.set(sessionId, session);
    return session;
  }

  get(id: SessionId): Session | null {
    return this.sessions.get(id) ?? null;
  }

  fork(sourceId: SessionId, boundary?: number, childId?: SessionId): Session {
    const parent = this.sessions.get(sourceId);
    if (!parent) {
      throw new HarnessError({
        code: ErrorCode.STATE_NOT_FOUND,
        category: ErrorCategory.STATE,
        message: `Parent session not found for fork: ${sourceId}`,
      });
    }

    const child = parent.fork(boundary, childId);
    this.sessions.set(child.id, child);
    return child;
  }

  resume(id: SessionId): Session {
    const session = this.sessions.get(id);
    if (!session) {
      throw new HarnessError({
        code: ErrorCode.STATE_NOT_FOUND,
        category: ErrorCategory.STATE,
        message: `Session not found to resume: ${id}`,
      });
    }

    // Check for crash recovery
    const recovery = recoverInterruptedSession(
      session.log,
      this.clock ? this.clock.now().getTime() : Date.now(),
    );

    if (recovery.wasInterrupted && recovery.syntheticEvents.length > 0) {
      for (const synth of recovery.syntheticEvents) {
        session.append(synth.type, synth.data, synth.time);
      }
    }

    return session;
  }

  list(): ReadonlyArray<SessionHeader> {
    return Array.from(this.sessions.values()).map((s) => s.header);
  }

  findAncestors(id: SessionId): ReadonlyArray<SessionHeader> {
    const ancestors: SessionHeader[] = [];
    let currentId: SessionId | undefined = id;

    while (currentId) {
      const session = this.sessions.get(currentId);
      if (!session) break;
      ancestors.unshift(session.header);
      currentId = session.header.parentSession;
    }

    return ancestors;
  }

  findChildren(id: SessionId): ReadonlyArray<SessionHeader> {
    const children: SessionHeader[] = [];
    for (const session of this.sessions.values()) {
      if (session.header.parentSession === id) {
        children.push(session.header);
      }
    }
    return children;
  }

  findCommonAncestor(idA: SessionId, idB: SessionId): SessionHeader | null {
    const ancestorsA = this.findAncestors(idA);
    const ancestorsB = this.findAncestors(idB);

    const setB = new Set(ancestorsB.map((h) => h.id));
    // Walk from latest ancestor of A down to root
    for (let i = ancestorsA.length - 1; i >= 0; i--) {
      const headerA = ancestorsA[i]!;
      if (setB.has(headerA.id)) {
        return headerA;
      }
    }

    return null;
  }
}

export interface JsonlSessionStoreOptions {
  readonly storageDir: string;
  readonly idFactory?: IdFactory;
  readonly clock?: Clock;
}

export class JsonlSessionStore implements SessionStore {
  private readonly storageDir: string;
  private readonly inMemoryStore: InMemorySessionStore;
  private readonly idFactory?: IdFactory;
  private readonly clock?: Clock;

  constructor(options: JsonlSessionStoreOptions) {
    this.storageDir = options.storageDir;
    this.idFactory = options.idFactory;
    this.clock = options.clock;
    this.inMemoryStore = new InMemorySessionStore({
      idFactory: this.idFactory,
      clock: this.clock,
    });

    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  private getFilePath(id: SessionId): string {
    return path.join(this.storageDir, `${id}.jsonl`);
  }

  create(id?: SessionId, opts?: CreateSessionOpts): Session {
    const session = this.inMemoryStore.create(id, opts);
    const filePath = this.getFilePath(session.id);
    SessionJsonlPersistence.writeSessionToFileSync(session, filePath);
    return session;
  }

  get(id: SessionId): Session | null {
    const inMem = this.inMemoryStore.get(id);
    if (inMem) return inMem;

    const filePath = this.getFilePath(id);
    if (fs.existsSync(filePath)) {
      const loaded = SessionJsonlPersistence.deserializeSession(
        fs.readFileSync(filePath, 'utf-8'),
        { idFactory: this.idFactory, clock: this.clock },
      );
      return loaded;
    }

    return null;
  }

  fork(sourceId: SessionId, boundary?: number, childId?: SessionId): Session {
    // Ensure parent is loaded into inMemoryStore
    const parent = this.get(sourceId);
    if (!parent) {
      throw new HarnessError({
        code: ErrorCode.STATE_NOT_FOUND,
        category: ErrorCategory.STATE,
        message: `Parent session not found for fork: ${sourceId}`,
      });
    }

    if (!this.inMemoryStore.get(sourceId)) {
      // Seed parent in memory store if loaded from disk
      (this.inMemoryStore as any).sessions.set(sourceId, parent);
    }

    const child = this.inMemoryStore.fork(sourceId, boundary, childId);
    const filePath = this.getFilePath(child.id);
    SessionJsonlPersistence.writeSessionToFileSync(child, filePath);
    return child;
  }

  resume(id: SessionId): Session {
    const filePath = this.getFilePath(id);
    if (!fs.existsSync(filePath)) {
      throw new HarnessError({
        code: ErrorCode.STATE_NOT_FOUND,
        category: ErrorCategory.STATE,
        message: `Session file not found to resume: ${id}`,
      });
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const session = SessionJsonlPersistence.deserializeSession(content, {
      idFactory: this.idFactory,
      clock: this.clock,
      autoRecoverCrash: true,
    });

    // Write back recovered session if any synthetic repair occurred
    SessionJsonlPersistence.writeSessionToFileSync(session, filePath);
    return session;
  }

  list(): ReadonlyArray<SessionHeader> {
    const headers: SessionHeader[] = [];
    if (!fs.existsSync(this.storageDir)) return headers;

    const files = fs.readdirSync(this.storageDir).filter((f) => f.endsWith('.jsonl'));
    for (const file of files) {
      try {
        const filePath = path.join(this.storageDir, file);
        const firstLine = fs.readFileSync(filePath, 'utf-8').split('\n')[0];
        if (firstLine) {
          const parsed = JSON.parse(firstLine);
          if (parsed.type === 'header' && parsed.data) {
            headers.push(parsed.data);
          }
        }
      } catch {
        // Skip unreadable files
      }
    }

    return headers;
  }

  findAncestors(id: SessionId): ReadonlyArray<SessionHeader> {
    const ancestors: SessionHeader[] = [];
    let currentId: SessionId | undefined = id;

    while (currentId) {
      const session = this.get(currentId);
      if (!session) break;
      ancestors.unshift(session.header);
      currentId = session.header.parentSession;
    }

    return ancestors;
  }

  findChildren(id: SessionId): ReadonlyArray<SessionHeader> {
    const all = this.list();
    return all.filter((h) => h.parentSession === id);
  }

  findCommonAncestor(idA: SessionId, idB: SessionId): SessionHeader | null {
    const ancestorsA = this.findAncestors(idA);
    const ancestorsB = this.findAncestors(idB);

    const setB = new Set(ancestorsB.map((h) => h.id));
    for (let i = ancestorsA.length - 1; i >= 0; i--) {
      const headerA = ancestorsA[i]!;
      if (setB.has(headerA.id)) {
        return headerA;
      }
    }

    return null;
  }
}
