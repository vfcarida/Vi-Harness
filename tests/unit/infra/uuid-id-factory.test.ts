/**
 * Tests for UuidV7IdFactory.
 *
 * Proves:
 *   - Factory implements the IdFactory interface
 *   - Generated IDs are valid UUIDs
 *   - Generated IDs are unique
 *   - Generated IDs are time-ordered (UUIDv7 property)
 */
import { describe, it, expect } from 'vitest';
import { UuidV7IdFactory } from '../../../src/infra/id/uuid-id-factory.js';
import type { IdFactory, TaskId } from '../../../src/core/types/identifiers.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('UuidV7IdFactory', () => {
  const factory: IdFactory = new UuidV7IdFactory();

  it('should be instantiable as IdFactory', () => {
    expect(factory).toBeDefined();
    expect(typeof factory.create).toBe('function');
  });

  it('should generate valid UUIDv7 strings', () => {
    const id = factory.create();

    expect(typeof id).toBe('string');
    expect(id).toMatch(UUID_REGEX);
  });

  it('should generate unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      ids.add(factory.create());
    }
    expect(ids.size).toBe(1000);
  });

  it('should generate time-ordered IDs', () => {
    const ids: string[] = [];
    for (let i = 0; i < 100; i++) {
      ids.push(factory.create());
    }

    // UUIDv7 encodes timestamp in the first 48 bits,
    // so string sorting should preserve creation order
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
  });

  it('should return branded types usable as specific ID types', () => {
    const taskId = factory.create<'Task'>() satisfies TaskId;
    expect(typeof taskId).toBe('string');
    expect(taskId).toMatch(UUID_REGEX);
  });
});
