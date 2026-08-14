/**
 * Multi-Tier Progressive Context Compressor (Claude Code & Aider inspired).
 *
 * Implements the 4-Stage Progressive Compaction Pipeline:
 *
 * 1. SNIP: Pruning ephemeral noise, low-value diagnostic logs, and trivial chatter.
 * 2. MICRO-COMPACT: Compacting repetitive tool execution outputs and command stdout.
 * 3. COLLAPSE: Merging and consolidating stale historical episodic trajectories.
 * 4. AUTO-COMPACT: Final model-aware adaptive compaction against strict token limits.
 *
 * INVARIANT RULE: Critical user requirements, architectural decisions, approved constraints,
 * and empirical failure/verification evidence are NEVER trimmed or degraded.
 */
import type { ContextObject } from '../../core/model/context-object.js';
import { ContextObjectType } from '../../core/model/context-object.js';
import { ContextTier } from '../../core/model/context.js';
import type { ScoredContextObject } from './context-ranker.js';
import type { CompilationItemExplanation } from '../../core/model/compiler-types.js';

export interface MultiTierCompressorOptions {
  readonly modelContextTokens?: number;
  readonly aggressiveThreshold?: number; // 0.0 - 1.0 threshold
}

export interface CompressionResult {
  readonly retained: ReadonlyArray<ContextObject>;
  readonly omitted: ReadonlyArray<ContextObject>;
  readonly explanations: ReadonlyArray<CompilationItemExplanation>;
  readonly totalTokens: number;
  readonly pipelineStagesRun: ReadonlyArray<string>;
}

export class ContextCompressor {
  /**
   * Execute 4-Stage Progressive Multi-Tier Compaction.
   */
  static compress(
    scoredObjects: ReadonlyArray<ScoredContextObject>,
    maxTokens: number,
    nowMs: number,
    options?: MultiTierCompressorOptions,
  ): CompressionResult {
    const retained: ContextObject[] = [];
    const omitted: ContextObject[] = [];
    const explanations: CompilationItemExplanation[] = [];
    const pipelineStagesRun: string[] = ['SNIP', 'MICRO_COMPACT', 'COLLAPSE', 'AUTO_COMPACT'];

    const modelMax = options?.modelContextTokens ?? 128000;
    // Model-aware thresholds: Small-window models compact much earlier than large-window models
    const isSmallWindow = modelMax <= 32000;
    const snipThreshold = isSmallWindow ? 0.40 : 0.75;
    const microCompactThreshold = isSmallWindow ? 0.50 : 0.80;
    const collapseThreshold = isSmallWindow ? 0.60 : 0.85;

    // Step 0: Initial Sorting — Invariant MUST-PRESERVE items first, then score descending
    const sorted = [...scoredObjects].sort((a, b) => {
      if (a.mustPreserve !== b.mustPreserve) {
        return a.mustPreserve ? -1 : 1;
      }
      return b.score - a.score;
    });

    let currentTokens = 0;
    const seenToolSignatures = new Map<string, number>();

    for (const scored of sorted) {
      let obj = scored.object;

      // ---------------------------------------------------------------------
      // INVARIANT ENFORCEMENT: MUST-PRESERVE items are ALWAYS retained
      // ---------------------------------------------------------------------
      if (scored.mustPreserve) {
        retained.push(obj);
        currentTokens += obj.costTokens;
        explanations.push({
          id: obj.id,
          type: obj.type,
          action: 'RETAINED',
          score: scored.score,
          tokenCost: obj.costTokens,
          reason: 'Invariant preservation: User instruction, security rule, or core decision',
          mustPreserve: true,
        });
        continue;
      }

      // ---------------------------------------------------------------------
      // STAGE 1: SNIP (Prune ephemeral low-value diagnostic noise)
      // ---------------------------------------------------------------------
      const ageHours = (nowMs - obj.lastUsed.getTime()) / (1000 * 60 * 60);
      const isEphemeralNoise =
        obj.type === ContextObjectType.OBSERVATION &&
        obj.importance < 0.45 &&
        (obj.content.includes('[DEBUG]') ||
          obj.content.includes('stdout:') ||
          obj.tags.includes('ephemeral') ||
          ageHours > 12);

      if (
        isEphemeralNoise &&
        (currentTokens + obj.costTokens > maxTokens * snipThreshold || ageHours > 24 || obj.tags.includes('log'))
      ) {
        omitted.push(obj);
        explanations.push({
          id: obj.id,
          type: obj.type,
          action: 'OMITTED',
          score: scored.score,
          tokenCost: obj.costTokens,
          reason: 'SNIP Stage: Ephemeral diagnostic log pruned to conserve token budget',
          mustPreserve: false,
        });
        continue;
      }

      // ---------------------------------------------------------------------
      // STAGE 2: MICRO-COMPACT (Repeated tool outputs and redundant executions)
      // ---------------------------------------------------------------------
      if (obj.type === ContextObjectType.OBSERVATION || obj.tags.includes('tool_output')) {
        const signature = this.computeToolOutputSignature(obj.content);
        const occurrences = seenToolSignatures.get(signature) ?? 0;
        seenToolSignatures.set(signature, occurrences + 1);

        if (occurrences > 0 || currentTokens > maxTokens * microCompactThreshold) {
          const summaryText = `[Micro-Compacted Tool Output (${occurrences + 1}x)]: ${obj.content.slice(0, 120)}...`;
          const newTokens = Math.ceil(summaryText.length / 4);
          obj = {
            ...obj,
            content: summaryText,
            costTokens: newTokens,
          };
          explanations.push({
            id: obj.id,
            type: obj.type,
            action: 'SUMMARIZED',
            score: scored.score,
            tokenCost: newTokens,
            reason: `MICRO-COMPACT Stage: Repetitive tool output compressed (occurrence #${occurrences + 1})`,
            mustPreserve: false,
          });
        }
      }

      // ---------------------------------------------------------------------
      // STAGE 3: COLLAPSE (Consolidate stale L2 episodic trajectories)
      // ---------------------------------------------------------------------
      if (
        obj.tier === ContextTier.L2_EPISODIC &&
        obj.importance < 0.75 &&
        currentTokens > maxTokens * collapseThreshold
      ) {
        const collapsedSummary = `[Collapsed Trajectory Milestone]: ${obj.type} [${obj.id.slice(0, 8)}] - ${obj.content.slice(0, 100)}...`;
        const newTokens = Math.ceil(collapsedSummary.length / 4);
        obj = {
          ...obj,
          content: collapsedSummary,
          costTokens: newTokens,
        };
        explanations.push({
          id: obj.id,
          type: obj.type,
          action: 'COLLAPSED' as any,
          score: scored.score,
          tokenCost: newTokens,
          reason: 'COLLAPSE Stage: Older episodic trajectory merged into condensed milestone',
          mustPreserve: false,
        });
      }

      // ---------------------------------------------------------------------
      // STAGE 4: AUTO-COMPACT (Budget boundary check & final assembly)
      // ---------------------------------------------------------------------
      if (currentTokens + obj.costTokens <= maxTokens) {
        retained.push(obj);
        currentTokens += obj.costTokens;
        if (!explanations.some((e) => e.id === obj.id)) {
          explanations.push({
            id: obj.id,
            type: obj.type,
            action: 'RETAINED',
            score: scored.score,
            tokenCost: obj.costTokens,
            reason: `AUTO-COMPACT: Retained with retention score ${scored.score.toFixed(3)} within budget`,
            mustPreserve: false,
          });
        }
      } else {
        // Exceeds budget -> safely omit
        omitted.push(obj);
        explanations.push({
          id: obj.id,
          type: obj.type,
          action: 'OMITTED',
          score: scored.score,
          tokenCost: obj.costTokens,
          reason: `AUTO-COMPACT: Omitted to respect token budget (${currentTokens + obj.costTokens} > ${maxTokens})`,
          mustPreserve: false,
        });
      }
    }

    return {
      retained,
      omitted,
      explanations,
      totalTokens: currentTokens,
      pipelineStagesRun,
    };
  }

  private static computeToolOutputSignature(content: string): string {
    // Generate normalized signature ignoring timestamps and variable IDs
    const normalized = content
      .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g, '<TIMESTAMP>')
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<UUID>')
      .replace(/\s+/g, ' ')
      .trim();
    return normalized.slice(0, 80);
  }
}
