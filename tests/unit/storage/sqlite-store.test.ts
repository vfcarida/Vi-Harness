/**
 * SQLite Storage Engine Unit Tests (P013).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { SqliteStore } from '../../../src/infra/storage/sqlite-store.js';

describe('SQLite Storage Engine — P013', () => {
  let tempDir: string;
  let dbPath: string;
  let store: SqliteStore;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vi-storage-test-'));
    dbPath = path.join(tempDir, 'test.db');
    store = new SqliteStore(dbPath);
    await store.open();
  });

  afterEach(async () => {
    if (store && store.isOpened) {
      await store.close();
    }
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore temporary Windows file unlock latency
    }
  });

  it('1. should open database, enable WAL mode, and run initial migrations', async () => {
    expect(store.isOpened).toBe(true);

    const pragmaRow = store.db.pragma('journal_mode') as Array<{ journal_mode: string }>;
    expect(pragmaRow[0]?.journal_mode.toLowerCase()).toBe('wal');

    const migrationRow = store.db
      .prepare('SELECT version, name FROM schema_migrations WHERE version = 1')
      .get() as any;
    expect(migrationRow.version).toBe(1);
    expect(migrationRow.name).toBe('001-core-tables');
  });

  it('2. should set, get, and overwrite generic key-value items', async () => {
    await store.set('config', 'model', { provider: 'openai', modelId: 'gpt-4o' });

    const retrieved = await store.get<{ provider: string; modelId: string }>('config', 'model');
    expect(retrieved).toEqual({ provider: 'openai', modelId: 'gpt-4o' });

    await store.set('config', 'model', { provider: 'anthropic', modelId: 'claude-3-5' });
    const updated = await store.get<{ provider: string; modelId: string }>('config', 'model');
    expect(updated?.modelId).toBe('claude-3-5');
  });

  it('3. should support string and raw values in get/set', async () => {
    await store.set('settings', 'theme', 'dark');
    const theme = await store.get<string>('settings', 'theme');
    expect(theme).toBe('dark');
  });

  it('4. should delete keys and return null for deleted keys', async () => {
    await store.set('cache', 'key1', 'val1');
    expect(await store.get('cache', 'key1')).toBe('val1');

    await store.delete('cache', 'key1');
    expect(await store.get('cache', 'key1')).toBeNull();
  });

  it('5. should expire keys with TTL', async () => {
    await store.set('short_lived', 'temp_key', 'hello', 50); // 50ms TTL

    expect(await store.get('short_lived', 'temp_key')).toBe('hello');

    // Wait for TTL expiration
    await new Promise((r) => setTimeout(r, 70));

    expect(await store.get('short_lived', 'temp_key')).toBeNull();
  });

  it('6. should list keys in a namespace with optional prefix', async () => {
    await store.set('plugins', 'git_diff', true);
    await store.set('plugins', 'git_commit', true);
    await store.set('plugins', 'docker_build', true);

    const allKeys = await store.list('plugins');
    expect(allKeys).toEqual(['docker_build', 'git_commit', 'git_diff']);

    const gitKeys = await store.list('plugins', 'git_');
    expect(gitKeys).toEqual(['git_commit', 'git_diff']);
  });

  it('7. should execute batch operations in a single atomic transaction', async () => {
    await store.batch([
      { type: 'set', namespace: 'batch', key: 'a', value: 1 },
      { type: 'set', namespace: 'batch', key: 'b', value: 2 },
      { type: 'set', namespace: 'batch', key: 'c', value: 3 },
    ]);

    expect(await store.get('batch', 'a')).toBe(1);
    expect(await store.get('batch', 'b')).toBe(2);
    expect(await store.get('batch', 'c')).toBe(3);

    await store.batch([
      { type: 'delete', namespace: 'batch', key: 'a' },
      { type: 'set', namespace: 'batch', key: 'd', value: 4 },
    ]);

    expect(await store.get('batch', 'a')).toBeNull();
    expect(await store.get('batch', 'd')).toBe(4);
  });

  it('8. should support in-memory :memory: databases', async () => {
    const memStore = new SqliteStore(':memory:');
    await memStore.open();

    await memStore.set('mem', 'k', 'v');
    expect(await memStore.get('mem', 'k')).toBe('v');

    await memStore.close();
  });

  it('9. should handle reopening an existing database without re-running migrations destructively', async () => {
    await store.set('ns', 'persisted_key', 'persisted_val');
    await store.close();

    const reopened = new SqliteStore(dbPath);
    await reopened.open();

    expect(await reopened.get('ns', 'persisted_key')).toBe('persisted_val');
    await reopened.close();
  });

  it('10. should recover gracefully when database file is corrupted', async () => {
    await store.close();

    // Corrupt database file with garbage bytes
    fs.writeFileSync(dbPath, 'CORRUPTED_NON_SQLITE_GARBAGE_HEADER_DATA_12345');

    const freshStore = new SqliteStore(dbPath);
    await freshStore.open();

    expect(freshStore.isOpened).toBe(true);
    await freshStore.set('recovered', 'key', 'ok');
    expect(await freshStore.get('recovered', 'key')).toBe('ok');

    await freshStore.close();
  });

  it('11. should handle empty batch operations without error', async () => {
    await expect(store.batch([])).resolves.not.toThrow();
  });

  it('12. should handle deleting non-existent key silently', async () => {
    await expect(store.delete('ns', 'missing_key_99')).resolves.not.toThrow();
  });

  it('13. should resolve default database path when none is specified', () => {
    const defaultStore = new SqliteStore();
    expect(defaultStore.resolvedDbPath).toContain('.vi-harness');
  });
});
