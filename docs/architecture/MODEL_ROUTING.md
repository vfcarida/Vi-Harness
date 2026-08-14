# Model Routing — MODEL_ROUTING.md

> "The runtime is model-agnostic and must support hot-swapping."

## Intent

The model router decouples what model is used from why it is used. Rather than assigning a fixed model to an agent, the router selects the optimal provider per-iteration based on the task's characteristics, the available budget, provider health, and capability requirements.

This design enables cost-sensitive routing (use cheap models for summarization, expensive models for architecture decisions), health-aware routing (exclude degraded providers), and deterministic test routing (force a specific provider in tests).

---

## `ModelProvider` Interface

**Responsibility:** Execute a single LLM completion. Adapts a specific vendor SDK to the vendor-neutral `ModelRequest` / `ModelResponse` contract.

**Interface:** `src/core/interfaces/model-provider.ts`

**Input:** `ModelRequest`:
```typescript
{
  messages:     ModelMessage[];   // SYSTEM | USER | ASSISTANT | TOOL roles
  tools?:       ToolDefinition[];
  modelId:      string;
  temperature?: number;
  maxTokens?:   number;
  signal?:      AbortSignal;
}
```

**Output:** `ModelResponse`:
```typescript
{
  content:      string;
  toolCalls?:   ToolCall[];
  usage:        TokenUsage;      // inputTokens, outputTokens, totalTokens
  finishReason: FinishReason;    // STOP | MAX_TOKENS | TOOL_CALL | ERROR | CANCELLED
  modelId:      string;
  metadata?:    Record<string, unknown>;
}
```

**Invariants:**
- No vendor SDK type (`OpenAI.ChatCompletion`, `Anthropic.Message`, etc.) crosses the `ModelProvider` boundary.
- Providers must translate vendor-specific finish reasons to `FinishReason` enum values.
- The provider is responsible for mapping vendor tool-call formats to `ToolCall` objects.

**Lifecycle:** Stateless per call. The provider may hold connection pool state, but each `complete()` call is independent.

**Failure modes:**
- Rate limit / transient error → `executeResiliently()` retries with configurable backoff.
- Context length exceeded → `FinishReason.MAX_TOKENS` with `usage` reflecting actual token count.
- Provider unavailable → throws `HarnessError` with `ErrorCode.MODEL_UNAVAILABLE`.

### Implementations

| Provider | File | Description |
|---|---|---|
| `OpenAICompatibleProvider` | `src/infra/model/openai-compatible-provider.ts` | Works with any OpenAI API-compatible endpoint |
| `MockModelProvider` | `src/infra/model/mock-model-provider.ts` | Returns configurable fixed responses; no API calls |
| `ScriptedModelProvider` | `src/infra/model/scripted-model-provider.ts` | Returns predetermined responses from a script array; deterministic for tests |
| `FailingModelProvider` | `src/infra/model/failing-model-provider.ts` | Always fails; used for resilience testing |

**Planned:** Anthropic native provider, Google Gemini provider.

---

## `ModelRouter` Interface

**Responsibility:** Select the optimal `ModelProvider` for a given routing request by evaluating candidates through a policy-driven utility-scoring pipeline.

**Interface:** `src/core/interfaces/model-router.ts`

**Input:** `RoutingRequest`:
```typescript
{
  taskCategory:          TaskCategory;       // EXPLORE | CODE_GEN | BUG_FIX | ... (11 values)
  complexity:            ComplexityLevel;    // LOW | MEDIUM | HIGH | VERY_HIGH
  risk:                  RiskLevel;          // LOW | MEDIUM | HIGH | CRITICAL
  currentState?:         AgentPhase;
  contextTokenCount:     number;
  requiredCapabilities?: ModelCapability[];
  remainingBudgetDollars?: number;
  latencyBudgetMs?:      number;
  isRepetitive?:         boolean;
  iterationCount?:       number;
  preferredProviderId?:  string;
  metadata?:             Record<string, unknown>;
}
```

**Output:** `RoutingDecision`:
```typescript
{
  selectedProvider:  ModelProvider;
  selectedModelId:   string;
  scores:            ModelScore[];    // utility score breakdown for all candidates
  rationale:         string;         // human-readable explanation
  decidedAt:         Date;
  deterministic:     boolean;        // true in test/deterministic mode
}
```

**Methods:**
```typescript
route(request: RoutingRequest): Promise<RoutingDecision>
registerProvider(provider: ModelProvider): void
unregisterProvider(providerId: string): boolean
listProviders(): ReadonlyArray<ModelProvider>
setDeterministicMode(enabled: boolean): void
```

**Failure modes:**
- No providers registered → throws `HarnessError`.
- No providers pass health + capability filter → throws `HarnessError` with `ErrorCode.NO_ELIGIBLE_PROVIDER`.
- Budget-critical mode forces cheapest eligible provider even if quality is suboptimal.

---

## `UtilityModelRouter` — Implementation

**File:** `src/infra/router/utility-model-router.ts`

### Routing Pipeline

```
RoutingRequest
       │
       ▼
1. HealthRegistry.filter()           → exclude degraded providers
       │
       ▼
2. CapabilityMatcher.filter()        → exclude providers missing required capabilities
       │
       ▼
3. CostPolicy.apply()                → if budget critical, restrict to cheapest eligible
       │
       ▼
4. PolicyRules.apply()               → apply 7 routing policy rules
       │
       ▼
5. UtilityScorer.score()             → compute per-candidate ModelScore
       │
       ▼
6. Select highest scoring candidate
       │
       ▼
RoutingDecision
```

### 7 Routing Policy Rules (`ModelPolicyRule`)

| Rule | Trigger | Effect |
|---|---|---|
| `LOW_COMPLEXITY_CHEAP` | `complexity = LOW`, `taskCategory` is `SUMMARIZATION` or `CLASSIFICATION` | Prefer lowest-cost capable model |
| `HIGH_COMPLEXITY_REASONING` | `complexity = VERY_HIGH` or `taskCategory` is `ARCHITECTURE` or `SECURITY_REVIEW` | Require `REASONING` capability |
| `HIGH_RISK_APPROVED` | `risk = CRITICAL` | Require explicit approval token in `PermissionContext` |
| `REPETITIVE_SMALL` | `isRepetitive = true` and `iterationCount > N` | Downgrade to cheaper model |
| `LONG_CONTEXT_REQUIRED` | `contextTokenCount` exceeds 75% of model limit | Require `LONG_CONTEXT` capability |
| `UNHEALTHY_EXCLUDED` | Provider error rate elevated in `HealthRegistry` | Exclude from candidates |
| `BUDGET_CRITICAL_LOW_COST` | `remainingBudgetDollars < threshold` | Force cheapest eligible provider |

### Utility Score (`ModelScore`)

```typescript
{
  providerId:           string;
  modelId:              string;
  totalUtility:         number;       // composite score
  successProbability:   number;       // capability match
  estimatedCostDollars: number;
  estimatedLatencyMs:   number;
  riskPenalty:          number;       // deduction for high-risk tasks
  scoreBreakdown:       Record<string, number>;  // per-factor scores
}
```

### Deterministic Mode

Calling `setDeterministicMode(true)` forces the router to always select the first registered provider. Used in tests to eliminate routing variability.

### Health Registry (`HealthRegistry`)

Tracks provider health state. Providers are excluded from routing when:
- Error rate (rolling window) exceeds a threshold.
- Response latency (p95) exceeds the configured maximum.
- A provider explicitly reports itself as unavailable.

**Current implementation:** In-memory, per-process. Health state is not persisted across restarts.

---

## Provider Resilience (`executeResiliently`)

**File:** `src/infra/model/provider-resilience.ts`

The `executeResiliently()` wrapper adds retry and fallback behavior around `ModelProvider.complete()`:

- **Retry**: Configurable max retries with exponential backoff.
- **Fallback**: If all retries fail, optionally fall back to an alternate provider.
- **Cancellation**: Respects `AbortSignal` for early termination.
- **Metrics**: Records per-call latency and failure reasons.

---

## Task Category Taxonomy

| `TaskCategory` | Description | Typical routing |
|---|---|---|
| `EXPLORE` | Reading files, understanding structure | Low cost |
| `CODE_GEN` | Generating new code | Medium cost |
| `BUG_FIX` | Diagnosing and fixing bugs | Medium–high cost |
| `REFACTOR` | Restructuring existing code | Medium cost |
| `SUMMARIZATION` | Summarizing documents or diffs | Low cost |
| `CLASSIFICATION` | Categorizing content | Low cost |
| `TEST_GEN` | Generating test cases | Medium cost |
| `TEST_REPAIR` | Fixing failing tests | Medium cost |
| `ARCHITECTURE` | Architectural decisions | High cost, reasoning required |
| `SECURITY_REVIEW` | Security analysis | High cost, reasoning required |
| `FINAL_REVIEW` | Pre-completion review | High cost |

---

## Known Limitations

| Limitation | Impact |
|---|---|
| Health state is in-memory | Health resets on restart; degraded providers re-enter the pool |
| Utility scoring weights are hard-coded | Cannot tune routing behavior without code changes |
| No provider load balancing | All requests go to the highest-scoring provider; no round-robin |
| `HIGH_RISK_APPROVED` rule requires approval token | Currently no UI to generate tokens |

---

## Future Design

- **Configurable scoring weights**: Expose `ScoringWeights` through `EnvConfiguration`.
- **Persistent health registry**: Track provider health across restarts via a persistent store.
- **Load balancing**: Round-robin among equally-scored providers to distribute cost.
- **Latency-based routing**: Prefer fastest provider when latency budget is tight.
- **Model capability registry**: Declarative capability declarations fetched from provider endpoints.
