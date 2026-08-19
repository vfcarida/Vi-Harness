# In-Memory LRU Cache with TTL Eviction

Implement the `LruCache` class in `lru-cache.js`.

## API:
- `constructor(capacity = 3, ttlMs = 0)`
- `set(key: string, value: any): void`
- `get(key: string): any | undefined` (updates usage recency, returns undefined if expired or missing)
- `size(): number`
- `clear(): void`

## Requirements:
1. When capacity is exceeded on `set()`, the least recently used key is evicted.
2. If `ttlMs > 0`, entries accessed after TTL milliseconds from their last set time return `undefined` and are pruned.
3. Accessing a key via `get()` marks it as most recently used.
