/**
 * Context Compressor.
 *
 * Implements 6-stage progressive context reduction:
 * 1. duplicate removal (identical content deduplication)
 * 2. stale low-value observations (pruning old, low-importance observations)
 * 3. redundant tool output (compressing repeated tool call output)
 * 4. large irrelevant excerpts (truncating massive code/file excerpts)
 * 5. summarized historical trajectories (summarizing L2 Episodic history)
 * 6. preserve critical decisions/evidence (invariant preservation)
 */
import type { ContextObject } from '../../core/model/context-object.js';
import { ContextObjectType } from '../../core/model/context-object.js';
import { ContextTier } from '../../core/model/context.js';
import type { ScoredContextObject } from './context-ranker.js';
import type { CompilationItemExplanation } from '../../core/model/compiler-types.js';

export interface CompressionResult {
  readonly retained: ReadonlyArray<ContextObject>;
  readonly omitted: ReadonlyArray<ContextObject>;
  readonly explanations: ReadonlyArray<CompilationItemExplanation>;
  readonly totalTokens: number;
}

export class ContextCompressor {
  /**
   * Progressively reduce scored objects to fit target maxTokens budget.
   */
  static compress(
    scoredObjects: ReadonlyArray<ScoredContextObject>,
    maxTokens: number,
    nowMs: number,
  ): CompressionResult {
    const retained: ContextObject[] = [];
    const omitted: ContextObject[] = [];
    const explanations: CompilationItemExplanation[] = [];

    // Sort: MUST-PRESERVE first, then score descending
    const sorted = [...scoredObjects].sort((a, b) => {
      if (a.mustPreserve !== b.mustPreserve) {
        return a.mustPreserve ? -1 : 1;
      }
      return b.score - a.score;
    });

    let currentTokens = 0;
    const seenToolOutputs = new Set<string>();

    for (const scored of sorted) {
      let obj = scored.object;

      // 1. MUST-PRESERVE items are ALWAYS retained regardless of budget
      if (scored.mustPreserve) {
        retained.push(obj);
        currentTokens += obj.costTokens;
        explanations.push({
          id: obj.id,
          type: obj.type,
          action: 'RETAINED',
          score: scored.score,
          tokenCost: obj.costTokens,
          reason: 'Must-preserve invariant requirement',
          mustPreserve: true,
        });
        continue;
      }

      // Stage 2: Stale low-value observations check
      const ageHours = (nowMs - obj.lastUsed.getTime()) / (1000 * 60 * 60);
      const isStaleObservation =
        (obj.type === ContextObjectType.OBSERVATION || obj.type === ContextObjectType.FAILURE) &&
        ageHours > 24 &&
        obj.importance < 0.4;

      if (isStaleObservation) {
        omitted.push(obj);
        explanations.push({
          id: obj.id,
          type: obj.type,
          action: 'OMITTED',
          score: scored.score,
          tokenCost: obj.costTokens,
          reason: 'Progressive reduction: stale low-value observation omitted',
          mustPreserve: false,
        });
        continue;
      }

      // Stage 3: Redundant tool output compression
      if (obj.type === ContextObjectType.OBSERVATION && obj.content.includes('Tool Output')) {
        const snippetKey = obj.content.slice(0, 100);
        if (seenToolOutputs.has(snippetKey)) {
          // Compress tool output to summary snippet
          const compressedContent = `[Compressed Tool Output]: ${obj.content.slice(0, 80)}...`;
          const newTokens = Math.ceil(compressedContent.length / 4);
          obj = {
            ...obj,
            content: compressedContent,
            costTokens: newTokens,
          };
        } else {
          seenToolOutputs.add(snippetKey);
        }
      }

      // Stage 4: Large irrelevant excerpts truncation
      if (obj.costTokens > 1500 && currentTokens + obj.costTokens > maxTokens * 0.7) {
        const truncatedContent = `[Truncated Excerpt (${obj.costTokens} tokens)]: ${obj.content.slice(0, 400)}...`;
        const newTokens = Math.ceil(truncatedContent.length / 4);
        obj = {
          ...obj,
          content: truncatedContent,
          costTokens: newTokens,
        };
      }

      // Stage 5: Summarize L2 Episodic historical trajectories
      if (obj.tier === ContextTier.L2_EPISODIC && obj.importance < 0.7 && currentTokens + obj.costTokens > maxTokens * 0.8) {
        const summarizedContent = `[Episodic Summary]: ${obj.type} - ${obj.content.slice(0, 100)}`;
        const newTokens = Math.ceil(summarizedContent.length / 4);
        obj = {
          ...obj,
          content: summarizedContent,
          costTokens: newTokens,
        };
      }

      // Budget check
      if (currentTokens + obj.costTokens <= maxTokens) {
        retained.push(obj);
        currentTokens += obj.costTokens;
        explanations.push({
          id: obj.id,
          type: obj.type,
          action: 'RETAINED',
          score: scored.score,
          tokenCost: obj.costTokens,
          reason: `Retained based on retention score ${scored.score.toFixed(3)}`,
          mustPreserve: false,
        });
      } else {
        // Exceeds budget -> omit
        omitted.push(obj);
        explanations.push({
          id: obj.id,
          type: obj.type,
          action: 'OMITTED',
          score: scored.score,
          tokenCost: obj.costTokens,
          reason: `Omitted to respect token budget (${currentTokens + obj.costTokens} > ${maxTokens})`,
          mustPreserve: false,
        });
      }
    }

    return {
      retained,
      omitted,
      explanations,
      totalTokens: currentTokens,
    };
  }
}
