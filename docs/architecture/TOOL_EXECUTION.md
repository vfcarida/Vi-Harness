# Tool Execution — TOOL_EXECUTION.md

> "Tools are registered capabilities, not arbitrary shell access."

## Intent

The tool execution layer is the boundary between the agent's intentions and the external world. It enforces three guarantees:

1. **Only registered tools can be executed.** An unregistered tool name returns a structured error, not a hallucinated response.
2. **All tool inputs are validated and sanitized before execution.** Prototype pollution, null-byte injection, and path traversal are blocked at the executor level.
3. **All tool outputs are scrubbed before reaching the model.** Secrets, tokens, and credentials are redacted from every tool result.

---

## `Tool` Interface

**Responsibility:** Define a tool's metadata and execute a single invocation.

**Interface:** `src/core/interfaces/tool.ts`

**Methods:**
```typescript
readonly definition: ToolDefinition;
execute(input: ToolInput, context?: ToolExecutionContext): Promise<ToolResult>;
```

### `ToolDefinition` fields

```typescript
{
  name:               string;          // unique identifier (e.g. 'read_file')
  version:            string;          // semantic version
  description:        string;          // model-facing description
  category:           ToolCategory;    // READ | WRITE | EXECUTE | DESTRUCTIVE
  riskLevel:          ToolRiskLevel;   // LOW | MEDIUM | HIGH | CRITICAL
  mutating:           boolean;         // modifies persistent state
  irreversible?:      boolean;         // cannot be undone
  requiresNetwork?:   boolean;
  filesystemScope?:   FilesystemScope; // 'workspace' | 'read-only' | 'system' | 'none'
  idempotent:         boolean;
  defaultTimeoutMs:   number;
  requiredPermissions: string[];
  inputSchema:        Record<string, unknown>;  // JSON Schema
  outputSchema?:      Record<string, unknown>;
}
```

### `ToolResult` fields

```typescript
{
  toolCallId:  ToolCallId;
  name:        string;
  output:      string;       // always a string (may be JSON-stringified)
  success:     boolean;
  durationMs:  number;
  error?:      string;
  metadata?:   Record<string, unknown>;
}
```

---

## `ToolExecutor` Interface

**Responsibility:** Registry + execution gateway. Routes tool calls to registered `Tool` implementations, enforces timeouts, and sanitizes inputs and outputs.

**Interface:** `src/core/interfaces/tool-executor.ts`

**Methods:**
```typescript
execute(request: ToolExecutionRequest): Promise<ToolResult>
register(tool: Tool): void
getTool(name: string): Tool | undefined
listTools(category?: ToolCategory): ReadonlyArray<Tool>
```

**`ToolExecutionRequest`:**
```typescript
{
  toolName?:       string;
  tool?:           Tool;
  input:           ToolInput;
  context?:        Partial<ToolExecutionContext>;
  requiresPolicy?: boolean;
}
```

**`ToolExecutionContext`:**
```typescript
{
  correlationId:     string;
  taskId?:           TaskId;
  iterationId?:      IterationId;
  signal?:           AbortSignal;       // for cancellation
  timeoutMs?:        number;
  workingDirectory?: string;
  environment?:      Record<string, string>;
}
```

---

## `DefaultToolExecutor` — Implementation

**File:** `src/infra/tools/default-tool-executor.ts`

### Execution sequence

```
ToolExecutionRequest
       │
       ▼
1. Input sanitization
   ├── prototype pollution guard (__proto__, constructor stripped)
   └── null-byte stripping (\0 in string values)
       │
       ▼
2. Registry lookup
   └── unknown name → return UNKNOWN_TOOL error (no throw)
       │
       ▼
3. Timeout wrapper (defaultTimeoutMs or context.timeoutMs)
       │
       ▼
4. Tool.execute(sanitizedInput, context)
       │
       ▼
5. Output scrubbing (SecretScrubber.scrub(result.output))
       │
       ▼
ToolResult
```

**Error codes returned as structured `ToolResult` (never thrown to caller):**

| Error | `errorCode` |
|---|---|
| Tool not in registry | `UNKNOWN_TOOL` |
| Policy denied (from caller) | `POLICY_DENIED` |
| Execution timed out | `TOOL_TIMEOUT` |
| Tool threw an exception | `TOOL_EXECUTION_FAILED` |

### Parallel execution (`ParallelToolExecutor`)

**File:** `src/infra/tools/parallel-tool-executor.ts`

In Phase 6 of the iteration loop, `READ` category tools are executed concurrently:
```typescript
const results = await Promise.allSettled(readProposals.map(p => executor.execute(p)));
```

`WRITE` and `EXECUTE` category tools are executed serially to preserve ordering and prevent races.

---

## Built-in Tools

Four tools are registered by default. All are implemented in `src/infra/tools/builtin/`.

### `read_file`

**Category:** `READ` | **Risk:** `LOW` | **Mutating:** false

**Input:**
```typescript
{ path: string; encoding?: 'utf-8' | 'base64' }
```

**Output:** File contents as a string.

**Security:** All paths validated through `PathValidator` before read:
- Resolves to canonical path via `realpathSync`.
- Rejects paths outside the workspace root.
- Rejects null-byte sequences.
- Rejects Windows reserved device names (`CON`, `NUL`, `COM1`, …).

**Failure modes:**
- File not found → `success: false`, descriptive error string.
- Path validation rejected → `success: false`, `FORBIDDEN_PATH` error.

---

### `write_file`

**Category:** `WRITE` | **Risk:** `MEDIUM` | **Mutating:** true

**Input:**
```typescript
{ path: string; content: string; createDirectories?: boolean }
```

**Output:** Confirmation message with bytes written.

**Security:**
- Path validated through `PathValidator` before write.
- Cannot write to forbidden paths (`.env*`, `.ssh*`, credential files).
- Parent directory creation is optional (`createDirectories`).

**Failure modes:**
- Permission denied → `success: false`.
- Path validation rejected → `success: false`, `FORBIDDEN_PATH` error.

---

### `list_directory`

**Category:** `READ` | **Risk:** `LOW` | **Mutating:** false

**Input:**
```typescript
{ path: string; recursive?: boolean; includeHidden?: boolean }
```

**Output:** JSON-formatted directory listing.

**Security:** Path validated through `PathValidator`. Symlink targets are checked to ensure they resolve within the workspace.

---

### `run_command`

**Category:** `EXECUTE` | **Risk:** `HIGH` | **Mutating:** true

**Input:**
```typescript
{ command: string; workingDirectory?: string; timeoutMs?: number; env?: Record<string, string> }
```

**Output:** Combined stdout + stderr, exit code.

**Security — `CommandSanitizer` blocks:**

| Category | Examples |
|---|---|
| Shell injection operators | `&&`, `;`, `|`, `$(...)`, `` ` `` |
| Privilege escalation | `sudo`, `su`, `chmod 777` |
| Destructive commands | `rm -rf /`, `mkfs`, `dd if=` |
| Environment exfiltration | `printenv`, `env`, `export -p`, `Get-ChildItem env:` |
| Network exfiltration | `curl`, `wget`, `nc`, `Invoke-WebRequest` (when `networkAccess: false`) |

Output passes through `SecretScrubber` before being returned.

**Failure modes:**
- Command blocked by `CommandSanitizer` → `success: false`, `BLOCKED_COMMAND` error code.
- Exit code ≠ 0 → `success: false`, output included in error field.
- Timeout → `success: false`, `TOOL_TIMEOUT` error.

---

## `CommandSanitizer`

**File:** `src/infra/tools/command-sanitizer.ts`

**Responsibility:** Pre-execution static analysis of command strings. Does not execute the command; returns a structured validation result.

**Checks performed:**
1. Shell injection metacharacter detection.
2. Privilege escalation command detection.
3. Destructive command pattern matching.
4. Environment variable exfiltration command detection (14 patterns including PowerShell equivalents).
5. Network tool detection (gated by `PermissionContext.networkAccess`).

**Return value:**
```typescript
{
  safe:      boolean;
  reason?:   string;      // explanation if not safe
  errorCode?: string;
}
```

---

## Execution Concurrency Model

| Tool category | Execution mode |
|---|---|
| `READ` | Parallel (`Promise.allSettled`) |
| `WRITE` | Serial (ordered) |
| `EXECUTE` | Serial (ordered) |
| `DESTRUCTIVE` | Serial + checkpoint before execution |

This model prevents race conditions on file writes while maximizing throughput for read-only operations.

---

## Known Limitations

| Limitation | Impact |
|---|---|
| `run_command` is not sandboxed at the OS level | Shell commands execute in the agent's process environment |
| No resource limits on `run_command` (CPU, memory) | A runaway process can consume unbounded resources |
| `CommandSanitizer` is static analysis only | A sufficiently obfuscated command string may bypass detection |
| No tool versioning enforcement | A tool registered with version "2.0.0" replaces "1.0.0" silently |
| Tool output is always a string | Binary output (images, archives) is not currently supported |

---

## Future Design

- **Process isolation for `run_command`**: Execute commands in a subprocess with `--max-old-space-size` limits and a separate UID.
- **Filesystem snapshots before writes**: Capture a Git stash or diff before `WRITE` tool execution to enable per-file rollback.
- **Tool capability declarations**: Tools declare which permissions they require; the `ToolExecutor` verifies these against `PermissionContext` before calling `execute()`.
- **Plugin tool registry**: Load tools from external packages without modifying the harness.
- **Binary output support**: Return base64-encoded output for tools that produce non-text artifacts.
