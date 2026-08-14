# Persistence — PERSISTENCE.md

> "Every meaningful milestone is reversible."

## Intent

Persistence in Vi-Harness serves two purposes:

1. **Reversibility**: The agent can undo its own changes cleanly, without corrupting pre-existing user work.
2. **Recoverability**: A crashed or paused execution can be resumed from the last known good state.

These are separate concerns with separate implementations: Git manages workspace reversibility; `CheckpointStore` manages execution state recoverability.

---

## `CheckpointStore` Interface

**Responsibility:** Create, restore, and manage immutable snapshots of `AgentState`. Used before high-risk operations and at meaningful phase transitions.

**Interface:** `src/core/interfaces/checkpoint-store.ts`

**Methods:**
```typescript
create(params: CreateCheckpointParams | AgentState, label?: string): Promise<Checkpoint>
restore(id: CheckpointId): Promise<AgentState>
getCheckpoint(id: CheckpointId): Promise<Checkpoint | undefined>
list(taskId: TaskId): Promise<ReadonlyArray<Checkpoint>>
delete(id: CheckpointId): Promise<boolean>
clear(): Promise<void>
```

**`Checkpoint` record:**
```typescript
{
  id:          CheckpointId;
  taskId:      TaskId;
  label?:      string;       // human-readable label (e.g. 'pre-repair-attempt-3')
  state:       AgentState;
  createdAt:   Date;
  metadata:    Record<string, unknown>;
}
```

**Lifecycle:**
```
Phase IMPLEMENT begins → create checkpoint (label: 'pre-implement')
Phase REPAIR begins   → create checkpoint (label: 'pre-repair-N')
REGRESSION_DETECTED   → restore last known-good checkpoint
DONE                  → final checkpoint (label: 'completed')
```

**Invariants:**
- `restore()` returns the `AgentState` at checkpoint time; it does not automatically apply it to the live `StateMachine`. The caller (runtime) applies the transition.
- Checkpoints are immutable after creation.

**Current implementation:** `DefaultCheckpointStore` — in-memory, volatile. Not persisted across process restarts.

**Known limitation:** Because checkpoints are in-memory, resuming an execution after a crash requires starting from the beginning. Persistent checkpoints (e.g., backed by SQLite or a file store) are planned.

---

## `GitManager` Interface

**Responsibility:** Workspace state management — baseline capture, agent delta tracking, diff generation, rollback, and file ownership classification.

**Interface:** `src/core/interfaces/git-manager.ts`

**Methods:**
```typescript
getStatus(): Promise<WorkspaceState>
createCommit(message: string): Promise<string>        // returns commit SHA
createBranch(branchName: string): Promise<void>
getDiff(targetRef?: string): Promise<string>           // unified diff
checkout(ref: string): Promise<void>
restorePath(path: string, ref?: string): Promise<void>
isDirty(): Promise<boolean>
markFileOwner(path: string, owner: 'agent' | 'user'): void
captureBaseline(): Promise<WorkspaceState>
getAgentDelta(): Promise<ReadonlyArray<string>>
```

**`WorkspaceState`:**
```typescript
{
  currentBranch:  string;
  baselineCommit: string;
  modifiedFiles:  string[];
  untrackedFiles: string[];
  stagedFiles:    string[];
  isDirty:        boolean;
}
```

**Key design decision:** The `GitManager` tracks **file ownership** — which files were modified by the agent vs. which were pre-existing user modifications. This allows rollback to touch only agent-owned files, preserving user work.

---

## `DefaultGitManager` vs `RealGitManager`

Two implementations serve different purposes:

| Implementation | File | Use |
|---|---|---|
| `DefaultGitManager` | `src/infra/git/default-git-manager.ts` | In-memory simulation; used in tests where Git is not needed |
| `RealGitManager` | `src/infra/git/real-git-manager.ts` | Executes real `git` commands; used in integration tests and production |

### `RealGitManager` security hardening

Every `git` command is executed as:
```
git -c core.hooksPath=/dev/null <subcommand>
```

This prevents any repository hook from executing during agent operations. A malicious `pre-commit` or `prepare-commit-msg` hook cannot run when the agent commits changes.

### Baseline capture workflow

```
Agent execution begins
         │
         ▼
RealGitManager.captureBaseline()
   └─ Records current commit SHA and modified file state
         │
         ▼
... agent makes changes ...
         │
         ▼
RealGitManager.getAgentDelta()
   └─ Returns files modified by the agent since baseline
         │
         ▼
RealGitManager.getDiff(baselineCommit)
   └─ Returns unified diff of all agent changes
```

### Rollback safety

`restorePath(path, ref)` reverts a single file to its state at `ref`. Combined with `getAgentDelta()`, the runtime can revert only agent-owned files:

```typescript
const agentFiles = await gitManager.getAgentDelta();
for (const file of agentFiles) {
  if (gitManager.getFileOwner(file) === 'agent') {
    await gitManager.restorePath(file, baselineCommit);
  }
}
```

User-modified files are never reverted even if they are in the working tree.

---

## `RollbackManager`

**Interface:** `src/core/interfaces/rollback-manager.ts`
**Implementation:** `src/infra/git/default-rollback-manager.ts`

**Responsibility:** Orchestrate safe rollback to a checkpoint, reverting only agent-owned file changes.

**When triggered:**
- `REGRESSION_DETECTED` phase entered.
- Manual rollback request from the runtime.

**Rollback sequence:**
1. Identify last good checkpoint via `CheckpointStore.list()`.
2. Restore `AgentState` from checkpoint.
3. Compute agent-owned file delta via `GitManager.getAgentDelta()`.
4. Restore each agent-owned file to its baseline state via `GitManager.restorePath()`.
5. Apply the restored `AgentState` to the `StateMachine`.

**Invariant:** Pre-existing user files are never touched by rollback.

---

## Persistence Strategy — Current vs Planned

| Subsystem | Current | Planned |
|---|---|---|
| `CheckpointStore` | In-memory (volatile) | SQLite / filesystem |
| `ContextStore` | In-memory (volatile) | SQLite / Redis |
| `MemoryStore` | In-memory (volatile) | SQLite / Redis |
| `EvidenceStore` | In-memory (volatile) | SQLite |
| Workspace | Real Git (durable) | ✅ Already durable |

All in-memory stores implement the same interface contracts. Replacing them with persistent backends requires only changing the DI registration in `DefaultModule` — no changes to `core/` or `runtime/`.

---

## Resume Manager

**Interface:** `src/core/interfaces/resume-manager.ts`

**Responsibility:** Look up an active or paused execution by `ExecutionId` and restore it for continuation.

**Current status:** Interface defined. `DefaultAgentRuntime.resume()` is partially implemented — it accepts a `checkpointId` but does not fully reconstruct the in-memory state of `ContextStore`, `EvidenceStore`, and `MemoryStore` from a persisted checkpoint. Full resume requires persistent stores.

---

## Known Limitations

| Limitation | Impact |
|---|---|
| All stores are volatile | Crash or restart requires starting over |
| `resume()` is partially implemented | Cannot reliably resume mid-execution across restarts |
| Checkpoint compression not implemented | Large `AgentState` objects are stored uncompressed in memory |
| No checkpoint retention policy | Memory grows indefinitely during long executions |
| `DefaultGitManager` does not execute real git commands | Integration tests that use it do not test real Git behavior |

---

## Future Design

- **SQLite-backed stores**: Replace all in-memory stores with SQLite implementations, swapped in via DI.
- **Full resume support**: Reconstruct all in-memory state from persisted checkpoints on startup.
- **Checkpoint compression**: Serialize and compress `AgentState` snapshots using a compact binary format.
- **Checkpoint retention policy**: Automatically prune checkpoints older than N iterations or smaller than N bytes.
- **Distributed checkpoint store**: Shared Redis-backed checkpoint store for multi-process agent deployments.
