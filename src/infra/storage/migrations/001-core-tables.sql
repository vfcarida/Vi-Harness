-- Migration 001: Core SQLite Tables for Vi-Harness Persistent Storage
-- Reference: Pi (sessions & tree branching) + Hermes (memory curator) + Meta-Harness (experiences)

-- 1. Generic Key-Value table for namespaces and TTL
CREATE TABLE IF NOT EXISTS kv_store (
  namespace TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at INTEGER,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (namespace, key)
);
CREATE INDEX IF NOT EXISTS idx_kv_expires ON kv_store(expires_at);

-- 2. Sessions table for state and tree-structured branching
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  branch_point INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  metadata TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_parent ON sessions(parent_id);

-- 3. Messages table for derived linear & tree conversation history
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  tokens_in INTEGER,
  tokens_out INTEGER,
  model TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE(session_id, sequence)
);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, sequence);

-- 4. Experiences table for Meta-Harness execution trace accumulation
CREATE TABLE IF NOT EXISTS experiences (
  id TEXT PRIMARY KEY,
  task_hash TEXT NOT NULL,
  outcome TEXT NOT NULL,
  trace TEXT NOT NULL,
  score REAL,
  created_at INTEGER NOT NULL,
  accessed_at INTEGER NOT NULL,
  access_count INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_experiences_task ON experiences(task_hash);
CREATE INDEX IF NOT EXISTS idx_experiences_outcome ON experiences(outcome, score);

-- 5. Metrics table for token budgets, latency, and cost telemetry
CREATE TABLE IF NOT EXISTS metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_metrics_session ON metrics(session_id, created_at);

-- 6. Memory table for Hermes-inspired scoped curator lifecycle (active/stale/archived)
CREATE TABLE IF NOT EXISTS memory (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  accessed_at INTEGER NOT NULL,
  UNIQUE(scope, key)
);
CREATE INDEX IF NOT EXISTS idx_memory_scope ON memory(scope, status);
