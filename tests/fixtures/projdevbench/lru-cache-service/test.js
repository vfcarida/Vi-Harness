import assert from 'node:assert';
import { LruCache } from './lru-cache.js';

// Test 1: Basic Get and Set
const cache = new LruCache(3);
cache.set('a', 1);
cache.set('b', 2);
cache.set('c', 3);

assert.strictEqual(cache.get('a'), 1);
assert.strictEqual(cache.get('b'), 2);
assert.strictEqual(cache.size(), 3);

// Test 2: Eviction of LRU item
cache.set('d', 4); // 'c' was least recently used since 'a' and 'b' were accessed
assert.strictEqual(cache.get('c'), undefined, 'c should have been evicted');
assert.strictEqual(cache.get('d'), 4);
assert.strictEqual(cache.size(), 3);

// Test 3: Clear
cache.clear();
assert.strictEqual(cache.size(), 0);
assert.strictEqual(cache.get('a'), undefined);

console.log('ALL LRU_CACHE_SERVICE TESTS PASSED (AC)');
