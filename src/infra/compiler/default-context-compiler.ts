/**
 * Default Model-Aware Context Compiler.
 *
 * Implements ContextCompiler interface.
 *
 * "Context is compiled, not accumulated."
 *
 * Assembles minimal high-signal context for model calls by executing the 6-stage pipeline:
 * Retrieval -> Deduplication -> Ranking -> Progressive Compression -> Validation -> Assembly
 *
 * Features:
 * - Model-Aware: Adjusts token budgets dynamically based on targetModelDescriptor.
 * - Invariant Enforcement: Never automatically discards user instructions, security rules,
 *   architecture facts, approved constraints, regressions, or human decisions.
 * - Dry-Run Mode: Generates detailed explanation report (retained, omitted, rationale, risk).
 * - Enterprise Observability: Emits CompilationMetrics (compression ratio, tokens before/after).
 * - Read-Only: Does NOT modify underlying ContextStore state.
 */
import type { ContextCompiler } from '../../core/interfaces/context-compiler.js';
import type { Clock } from '../../core/interfaces/clock.js';
import type { IdFactory } from '../../core/types/identifiers.js';
import type {
  ContextCompilationRequest,
  ContextCompilationResult,
  CompilationMetrics,
  CompilationExplanation,
} from '../../core/model/compiler-types.js';
import { DEFAULT_SCORING_WEIGHTS } from '../../core/model/compiler-types.js';
import type { ContextObject } from '../../core/model/context-object.js';
import { ContextObjectType, ContextScope } from '../../core/model/context-object.js';
import { ContextTier } from '../../core/model/context.js';
import type { CompiledContext, ContextEntry } from '../../core/model/context.js';

import { ContextDeduplicator } from './context-deduplicator.js';
import { ContextRanker } from './context-ranker.js';
import { ContextCompressor } from './context-compressor.js';
import { ContextValidator } from './context-validator.js';

export interface DefaultContextCompilerOptions {
  readonly idFactory: IdFactory;
  readonly clock: Clock;
}

export class DefaultContextCompiler implements ContextCompiler {
  private readonly idFactory: IdFactory;
  private readonly clock: Clock;

  constructor(options: DefaultContextCompilerOptions) {
    this.idFactory = options.idFactory;
    this.clock = options.clock;
  }

  async compile(request: ContextCompilationRequest): Promise<ContextCompilationResult> {
    const startTime = Date.now();
    const now = this.clock.now();

    // 1. Candidate Assembly (Read-Only)
    const candidates = this.assembleCandidateObjects(request, now);

    // Calculate tokens before compilation
    const tokensBefore = candidates.reduce((acc, obj) => acc + obj.costTokens, 0);

    // 2. Stage 1: Deduplication
    const dedupeResult = ContextDeduplicator.deduplicate(candidates);
    const uniqueCandidates = dedupeResult.uniqueObjects;

    // 3. Stage 2: Ranking & Retention Scoring
    const scoringWeights = {
      ...DEFAULT_SCORING_WEIGHTS,
      ...request.weights,
    };
    const scoredObjects = uniqueCandidates.map((obj) =>
      ContextRanker.scoreObject(obj, now.getTime(), scoringWeights),
    );

    // 4. Stage 3: Model-Aware Budget Adjustment
    const modelMaxContext = request.targetModelDescriptor.capabilities.maxContextTokens;
    const effectiveMaxTokens = Math.min(request.budget.maxTokens, modelMaxContext);

    // 5. Stage 4: Progressive Compression
    const compressionResult = ContextCompressor.compress(
      scoredObjects,
      effectiveMaxTokens,
      now.getTime(),
    );

    const retainedObjects = compressionResult.retained;

    // 6. Stage 5: Validation
    ContextValidator.validateOrThrow(
      retainedObjects,
      candidates,
      request.targetModelDescriptor,
      request.budget,
      compressionResult.totalTokens,
    );

    // 7. Stage 6: Context Assembly
    const compiledEntries: ContextEntry[] = retainedObjects.map((obj) => ({
      id: this.idFactory.create<'Context'>(),
      tier: obj.tier,
      content: `[${obj.type}] ${obj.content}`,
      metadata: {
        originalId: obj.id,
        source: obj.source,
        version: obj.version,
        importance: obj.importance,
        confidence: obj.confidence,
        tags: obj.tags,
      },
      createdAt: obj.timestamp,
      tokenEstimate: obj.costTokens,
    }));

    const compiledContext: CompiledContext = {
      entries: compiledEntries,
      totalTokenEstimate: compressionResult.totalTokens,
      compiledAt: now,
    };

    // 8. Calculate Metrics
    const durationMs = Date.now() - startTime;
    const tokensAfter = compressionResult.totalTokens;
    const compressionRatio =
      tokensBefore > 0 ? (tokensBefore - tokensAfter) / tokensBefore : 0;

    const mandatoryRetainedCount = retainedObjects.filter((o) => ContextRanker.isMustPreserve(o)).length;

    const metrics: CompilationMetrics = {
      inputObjectCount: candidates.length,
      tokensBefore,
      tokensAfter,
      compressionRatio,
      retainedCount: retainedObjects.length,
      omittedCount: compressionResult.omitted.length + dedupeResult.deduplicatedCount,
      mandatoryRetainedCount,
      durationMs,
    };

    // 9. Generate Dry-Run Explanation if requested
    let explanation: CompilationExplanation | undefined;
    if (request.dryRun) {
      let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
      if (compressionRatio > 0.7) riskLevel = 'MEDIUM';
      if (compressionRatio > 0.9) riskLevel = 'HIGH';

      explanation = {
        items: compressionResult.explanations,
        riskLevel,
        summary:
          `Compiled ${retainedObjects.length} objects (${tokensAfter} tokens) from ${candidates.length} candidates (${tokensBefore} tokens). ` +
          `Compression ratio: ${(compressionRatio * 100).toFixed(1)}%. Risk: ${riskLevel}.`,
      };
    }

    return {
      compiledContext,
      retainedObjects,
      explanation,
      metrics,
    };
  }

  private assembleCandidateObjects(
    request: ContextCompilationRequest,
    now: Date,
  ): ContextObject[] {
    const candidates: ContextObject[] = [];

    // Explicit objects passed in request
    if (request.relevantObjects) {
      candidates.push(...request.relevantObjects);
    }

    // Goal & User Instructions (L3 Repository / Invariant)
    candidates.push({
      id: this.idFactory.create<'Context'>(),
      tier: ContextTier.L3_REPOSITORY,
      type: ContextObjectType.USER_INSTRUCTION,
      content: `Goal: ${request.goal.description}`,
      source: 'user',
      timestamp: now,
      importance: 1.0,
      confidence: 1.0,
      scope: ContextScope.GLOBAL,
      dependencies: [],
      lastUsed: now,
      lastVerified: now,
      costTokens: Math.ceil(request.goal.description.length / 4),
      tags: ['goal', 'must_preserve'],
      version: 1,
      active: true,
      metadata: {},
    });

    // Task (L0 Hot Context)
    candidates.push({
      id: this.idFactory.create<'Context'>(),
      tier: ContextTier.L0_HOT,
      type: ContextObjectType.REQUIREMENT,
      content: `Current Task: ${request.task.description}`,
      source: 'task_manager',
      timestamp: now,
      importance: 0.95,
      confidence: 1.0,
      scope: ContextScope.TASK,
      dependencies: [],
      lastUsed: now,
      lastVerified: now,
      costTokens: Math.ceil(request.task.description.length / 4),
      tags: ['task', 'must_preserve'],
      version: 1,
      active: true,
      metadata: {},
    });

    // Active Hypothesis (L0 Hot Context)
    if (request.activeHypothesis) {
      candidates.push({
        id: this.idFactory.create<'Context'>(),
        tier: ContextTier.L0_HOT,
        type: ContextObjectType.HYPOTHESIS,
        content: `Active Hypothesis: ${request.activeHypothesis.description}`,
        source: 'agent',
        timestamp: now,
        importance: 0.9,
        confidence: 0.8,
        scope: ContextScope.TASK,
        dependencies: [],
        lastUsed: now,
        lastVerified: null,
        costTokens: Math.ceil(request.activeHypothesis.description.length / 4),
        tags: ['hypothesis'],
        version: 1,
        active: true,
        metadata: {},
      });
    }

    // Recent Evidence (L1 Working Memory)
    if (request.recentEvidence) {
      for (const ev of request.recentEvidence) {
        candidates.push({
          id: this.idFactory.create<'Context'>(),
          tier: ContextTier.L1_WORKING,
          type: ev.pass ? ContextObjectType.EVIDENCE : ContextObjectType.FAILURE,
          content: `Evidence [${ev.type}] (${ev.pass ? 'PASS' : 'FAIL'}): ${ev.summary}`,
          source: 'verification_engine',
          timestamp: ev.createdAt,
          importance: ev.pass ? 0.8 : 0.95, // Failures have high importance
          confidence: 1.0,
          scope: ContextScope.TASK,
          dependencies: [],
          lastUsed: now,
          lastVerified: ev.createdAt,
          costTokens: Math.ceil(ev.summary.length / 4),
          tags: ev.pass ? ['evidence', 'pass'] : ['evidence', 'fail', 'must_preserve'],
          version: 1,
          active: true,
          metadata: ev.data,
        });
      }
    }

    return candidates;
  }
}
