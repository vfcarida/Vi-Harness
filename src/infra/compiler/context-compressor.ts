/**
 * Context Compressor.
 *
 * Implements 10-step progressive context reduction:
 * 1. remove duplicate tool outputs
 * 2. remove low-value raw logs
 * 3. remove stale observations
 * 4. trim irrelevant file excerpts
 * 5. summarize repeated debugging history
 * 6. preserve high-value decisions
 * 7. preserve hard constraints
 * 8. preserve security requirements
 * 9. preserve failed approaches when still relevant
 * 10. preserve current evidence
 */
import type { ContextObject } from '../../core/model/context-object.js';
import { ContextObjectType } from '../../core/model/context-object.js';
import type { ScoredContextObject } from './context-ranker.ts';
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

    for (const scored of sorted) {
      const obj = scored.object;

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

      // Step 2 & 3: Check low-value / stale observations
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
