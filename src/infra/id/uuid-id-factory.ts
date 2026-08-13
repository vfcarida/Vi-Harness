/**
 * UUIDv7 IdFactory implementation.
 *
 * Produces time-ordered, globally-unique identifiers using UUIDv7.
 * Time-ordering ensures IDs are naturally sortable by creation time,
 * which is valuable for event ordering and pagination.
 *
 * This implementation is behind the IdFactory interface so it can
 * be replaced (e.g. with ULID, nanoid, etc.) without changing domain models.
 */
import { v7 as uuidv7 } from 'uuid';
import type { Id, IdFactory } from '../../core/types/identifiers.js';

export class UuidV7IdFactory implements IdFactory {
  create<T extends string = string>(): Id<T> {
    return uuidv7() as Id<T>;
  }
}
