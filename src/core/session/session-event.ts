/**
 * Session Event.
 *
 * Represents an immutable, strictly ordered entry in the session's append-only log.
 */
import type { SessionEventMap } from './event-map.js';

export interface SessionEvent<K extends keyof SessionEventMap = keyof SessionEventMap> {
  readonly type: K;
  readonly data: SessionEventMap[K];
  readonly seq: number; // monotonic position in log (0, 1, 2, ...)
  readonly time: number; // epoch ms
}
