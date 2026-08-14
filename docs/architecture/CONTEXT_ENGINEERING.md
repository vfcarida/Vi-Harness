# Context Engineering — CONTEXT_ENGINEERING.md

> "Context is compiled, not accumulated."

## Intent

In conversation-accumulation harnesses, context grows linearly with each iteration: every tool output, model response, and error message is appended to the message history. By iteration 30, most of that history is stale, duplicated, or irrelevant — and the model is reasoning over it anyway, because it is all there is.

Vi-Harness takes a different approach: context is constructed fresh each iteration from a structured object store. The compiler selects, scores, deduplicates, compresses, and assembles only the minimum necessary information for the current model call.

This is not an optimization. It is a correctness requirement.

---

## Four-Tier Context Architecture

Context objects are categorized into four tiers by their volatility and access pattern:

| Tier | Enum | Contents | Volatility |
|---|---|---|---|
| **L0 HOT** | `ContextTier.L0_HOT` | Current task · active files · current hypothesis · current failure | Per-iteration |
| **L1 WORKING** | `ContextTier.L1_WORKING` | Active plan · recent decisions · recent evidence · repair history | Per-phase |
| **L2 EPISODIC** | `ContextTier.L2_EPISODIC` | Prior attempts · failed approaches · prior debugging trajectories | Per-task |
| **L3 REPOSITORY** | `ContextTier.L3_REPOSITORY` | Architecture facts · domain constraints · coding standards · permanent decisions | Rarely changes |

Every `ContextObject` carries an explicit tier assignment at creation time. The compiler uses tier as a primary sorting and budgeting dimension.

---

## Context Object Model

Each piece of context is a structured `ContextObject`:

```typescript
interface ContextObject {
  id:           ContextId;
  tier:         ContextTier;          // L0_HOT | L1_WORKING | L2_EPISODIC | L3_REPOSITORY
  type:         ContextObjectType;   // 15 types (see below)
  content:      string;
  source:       string;
  importance:   number;              // 0.0 to 1.0
  confidence:   number;              // 0.0 to 1.0
  scope:        ContextScope;        // GLOBAL | TASK | FILE | SYMBOL | ITERATION
  scopeTarget?: string;              // e.g. file path, symbol name
  dependencies: ReadonlyArray<ContextId>;  // graph edges
  lastUsed:     Date;
  lastVerified: Date | null;
  costTokens:   number;
  tags:         ReadonlyArray<string>;
  version:      number;              // incremented on each update
  active:       boolean;             // false = soft-deleted, preserved in history
  metadata:     Record<string, unknown>;
}
```

### Object types (`ContextObjectType`)

| Type | Description |
|---|---|
| `REQUIREMENT` | Goal requirements and acceptance criteria |
| `DECISION` | Architectural or implementation decisions |
| `CONSTRAINT` | Hard constraints (budget, time, policy) |
| `HYPOTHESIS` | Current working theory about the task |
| `FILE` | File content or summary |
| `CODE_SYMBOL` | Class, function, type definition |
| `TEST` | Test case or test suite |
| `FAILURE` | Error, stack trace, failing assertion |
| `EVIDENCE` | Verification outcome reference |
| `OBSERVATION` | Runtime observation (tool output) |
| `ARTIFACT` | Build artifact or generated file |
| `ARCHITECTURE_FACT` | System architecture constraint |
| `USER_INSTRUCTION` | Direct user directive |
| `SECURITY_RULE` | Security invariant |
| `LEARNED_PATTERN` | Recurring pattern discovered by agent |

---

## ContextStore Interface

**Responsibility:** CRUD operations on `ContextObject` records, typed relational graph, version history, and point-in-time reconstruction.

**Input:** `CreateContextObjectParams`, `ContextQuery`, `ContextId`.

**Output:** `ContextObject`, `ContextRelation`, `ContextGraph`.

**Key operations:**
```typescript
addObject(params): Promise<ContextObject>
updateObject(id, updates): Promise<ContextObject>     // creates version N+1
getObject(id, version?): Promise<ContextObject | undefined>
getObjectHistory(id): Promise<ReadonlyArray<ContextObject>>
query(query): Promise<ReadonlyArray<ContextObject>>
deactivate(id): Promise<boolean>                      // soft delete
reconstructHistoryAt(timestamp): Promise<ReadonlyArray<ContextObject>>
addRelation(params): Promise<ContextRelation>
getRelations(nodeId, direction?, type?): Promise<ReadonlyArray<ContextRelation>>
```

**Relation types (`ContextRelationType`):** `DEPENDS_ON`, `DERIVED_FROM`, `CONTRADICTS`, `VALIDATES`, `INVALIDATES`, `IMPLEMENTS`, `AFFECTS`, `RELATED_TO`.

**Invariants:**
- Deactivation is a soft delete. Objects are never hard-deleted from history.
- `updateObject()` preserves version history — all prior versions remain accessible via `getObjectHistory()`.
- `getObject()` without a version argument returns the latest active version.

**Current implementation:** In-memory. Not persisted across process restarts.

**Known limitation:** `ContextStore` interface imports from `infra/context/context-graph.ts` — a dependency inversion violation. The `ContextGraph` type should move to `core/`. Tracked for correction.

---

## Compiler Interface

**Responsibility:** Assemble a token-bounded `CompiledContext` from the `ContextStore` for a specific model call.

**Input:** `ContextCompilationRequest`:
```typescript
{
  goal:                  Goal;
  task:                  Task;
  currentState:          AgentState;
  currentFiles?:         string[];
  activeHypothesis?:     Hypothesis | null;
  recentEvidence?:       Evidence[];
  relevantObjects?:      ContextObject[];
  targetModelDescriptor: ModelDescriptor;  // for token budget adjustment
  budget:                ContextBudget;
  dryRun?:               boolean;          // returns explanation without compiling
  weights?:              Partial<CompilerScoringWeights>;
}
```

**Output:** `ContextCompilationResult`:
```typescript
{
  compiledContext:   CompiledContext;
  retainedObjects:   ContextObject[];
  explanation?:      CompilationExplanation;  // only if dryRun: true
  metrics:           CompilationMetrics;
}
```

**`CompilationMetrics` (emitted on every call):**
```typescript
{
  inputObjectCount:        number;
  tokensBefore:            number;
  tokensAfter:             number;
  compressionRatio:        number;  // (before - after) / before
  retainedCount:           number;
  omittedCount:            number;
  mandatoryRetainedCount:  number;
  durationMs:              number;
}
```

---

## The 6-Stage Compilation Pipeline

Implementation: `src/infra/compiler/default-context-compiler.ts`

### Stage 1 — Retrieval

Queries `ContextStore` using the current state, active hypothesis, recent evidence, and provided `relevantObjects`. Resolves dependencies (objects referenced by retrieved objects are also fetched).

### Stage 2 — Deduplication (`ContextDeduplicator`)

Removes exact-duplicate content (same `content` string, regardless of `id`). Preserves the highest-version copy. Merges tags.

**Current implementation:** Content hash comparison. Does not perform semantic deduplication (near-duplicate detection is future work).

### Stage 3 — Ranking (`ContextRanker`)

Assigns a composite score to each object using a weighted formula:

| Weight | Factor | Source |
|---|---|---|
| 30% | `importance` | Declared on the object (0–1) |
| 25% | Dependency coverage | How many of the object's dependencies are also in the candidate set |
| 20% | Verification relevance | Whether the object type relates to the current verification state |
| 15% | Failure relevance | Whether the object is associated with a failing check |
| 10% | Recency | `lastUsed` relative to now |
| 5% | Token cost penalty | Penalizes large objects when budget is tight |

Weights are configurable via `ContextCompilationRequest.weights`.

### Stage 4 — Progressive Compression (`ContextCompressor`)

If the ranked set exceeds the token budget, objects are progressively compressed:
1. Objects below the soft token limit → **RETAINED** as-is.
2. Objects between soft and hard limit → **SUMMARIZED** (content truncated to a token-bounded summary).
3. Objects above hard limit → **OMITTED**, unless they are mandatory.

Mandatory object types (never automatically omitted):
- `USER_INSTRUCTION`
- `SECURITY_RULE`
- `ARCHITECTURE_FACT`
- Objects tagged as approved constraints
- Objects with `REGRESSION` evidence association

### Stage 5 — Validation (`ContextValidator`)

Verifies the compiled context satisfies invariants:
- At least one `USER_INSTRUCTION` or `REQUIREMENT` object is present.
- Total tokens do not exceed the hard limit.
- No `SECURITY_RULE` objects were omitted.
- Security invariants from `L0_HOT` tier are preserved.

Emits `CompilationExplanation` (in dry-run mode) describing each object's action, score, token cost, and reason.

### Stage 6 — Assembly

Serializes retained `ContextObject` records into `ContextEntry` objects within a `CompiledContext`, ordered by tier (L0 → L1 → L2 → L3) and then by score descending within each tier.

Security: All content passes through `ContextSanitizer` (injection neutralization) and `SecretScrubber` (credential redaction) before assembly.

---

## Memory Subsystem

Memory is separate from context. The `MemoryStore` holds durable records that persist across iterations and can be selectively retrieved.

**Interface:** `src/core/interfaces/memory-store.ts`

### Memory Tiers (`MemoryTier`)

| Tier | Contents |
|---|---|
| `SHORT_TERM` | Recent observations, transient hypotheses |
| `EPISODIC` | Task-specific experiences, prior attempt outcomes |
| `SEMANTIC` | Domain facts, architectural knowledge |
| `PROCEDURAL` | Learned workflows, patterns, successful strategies |

### Memory Types (`MemoryType`)

`FACT`, `EXPERIENCE`, `PATTERN`, `SKILL`, `FAILURE_AVOIDANCE`, `DECISION`, `WORKFLOW`.

### Memory Lifecycle (`MemoryStatus`)

```
CANDIDATE → ACTIVE → STALE → INVALIDATED → ARCHIVED
                ↓
           PROMOTED (to higher tier)
                ↓
           EXPIRED (TTL elapsed)
```

**Key operations:**
- `createRecord()` — creates a new `MemoryRecord`, sanitizes content against injection and credentials.
- `retrieve(query)` — returns ranked `ScoredMemoryRecord[]` with relevance scores.
- `promote(id)` — advances a record to a higher tier (e.g., `EPISODIC` → `SEMANTIC`).
- `markStale(id)` — flags outdated records (e.g., when architecture changes).
- `resolveConflict(conflictId, winningRecordId)` — keeps winning record, invalidates loser.

**Current implementation:** `InMemoryMemoryStore` — volatile, not persisted.

**Known limitation:** Memory is not currently integrated into the `IterationExecutor` context compilation flow. The `ContextCompiler` uses `ContextStore` objects, not `MemoryStore` records. Integration is planned.

---

## Known Limitations

| Limitation | Impact |
|---|---|
| `ContextStore` and `MemoryStore` are in-memory | All context lost on process restart |
| Semantic deduplication not implemented | Near-duplicate tool outputs may survive into compiled context |
| Memory not wired into context compilation | `MemoryStore` records do not influence model calls |
| No automatic tier promotion | Objects do not age from L0 to L2 automatically |
| `ContextStore` interface dependency inversion | `core/` imports from `infra/context/` |

---

## Future Design

- **Persistent stores**: SQLite backend for `ContextStore` and `MemoryStore`.
- **Semantic deduplication**: Embedding-based near-duplicate detection in Stage 2.
- **Memory integration**: `ContextCompiler` queries `MemoryStore` and merges relevant records into the compiled context as `L2_EPISODIC` entries.
- **Automatic tier aging**: Objects transition from `L0_HOT` → `L1_WORKING` → `L2_EPISODIC` based on `lastUsed` recency.
- **Context graph visualization**: Export `ContextGraph` as a DOT or JSON graph for debugging.
