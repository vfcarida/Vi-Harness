/**
 * Tool-Result Pruning & Budget Reduction Test Suite (Prompt P001).
 *
 * Validates:
 * - Budget Reduction (Stage 0): Caps oversized tool results with `[... truncated from {original} to {max} tokens ...]`
 * - Tool-Result Pruning (Stage 0.5): Deterministic Unicode head/middle/tail pruning without LLM calls
 * - Preserves head and tail structure while discarding fat middle
 * - Unicode code point counting (accurate across multi-byte UTF-16 surrogate pairs and emojis)
 * - Session-wide batch pruning and telemetry report
 */
import { describe, it, expect } from 'vitest';
import {
  DefaultToolResultPruner,
  ContextCompressor,
  ContextRanker,
  UuidV7IdFactory,
  TestClock,
} from '../../../src/infra/index.js';
import {
  ContextObjectType,
  ContextTier,
  ContextScope,
  type ContextObject,
  DEFAULT_SCORING_WEIGHTS,
} from '../../../src/core/index.js';

describe('Tool-Result Pruning & Budget Reduction (Stages 0 & 0.5)', () => {
  const idFactory = new UuidV7IdFactory();
  const clock = new TestClock(new Date('2026-01-01T00:00:00Z'));
  const now = clock.now();
  const nowMs = now.getTime();

  it('1. Unicode Code Point Measurement: Accurately counts multi-byte code points & emojis', () => {
    const pruner = new DefaultToolResultPruner();

    // "Hello 🚀 World 👨‍👩‍👧‍👦" contains standard ASCII + astral symbols + ZWJ sequence
    const asciiText = 'Hello World'; // 11 code points
    const emojiText = '🚀'; // 1 code point (2 UTF-16 code units)
    const compositeText = 'A🚀B'; // 3 code points (4 UTF-16 code units)

    expect(pruner.measureContent([{ type: 'text', text: asciiText }])).toBe(11);
    expect(pruner.measureContent([{ type: 'text', text: emojiText }])).toBe(1);
    expect(pruner.measureContent([{ type: 'text', text: compositeText }])).toBe(3);
    expect(pruner.measureString(compositeText)).toBe(3);
  });

  it('2. Head/Middle/Tail Pruning: Removes the fat middle of large output while retaining head & tail', () => {
    const pruner = new DefaultToolResultPruner(100);

    const headSection = 'HEAD_START: Initial log stream configuration initialized correctly. ';
    const middleNoise = 'NOISE_'.repeat(200); // 1200 chars of noise
    const tailSection = ' TAIL_END: Final exit code 0 received with success status.';
    const largeText = `${headSection}${middleNoise}${tailSection}`;

    const { text: pruned, pruned: wasPruned, charsRemoved } = pruner.pruneText(largeText, 100);

    expect(wasPruned).toBe(true);
    expect(charsRemoved).toBeGreaterThan(500);

    // Head is preserved
    expect(pruned.startsWith('HEAD_START:')).toBe(true);
    // Tail is preserved
    expect(pruned.endsWith('success status.')).toBe(true);
    // Boundary marker inserted in middle
    expect(pruned).toContain('[... pruned ');
    expect(pruned).toContain(' characters ...]');
  });

  it('3. Under-Budget Content: Returns unpruned content when within budget', () => {
    const pruner = new DefaultToolResultPruner(500);
    const shortText = 'Compact output: test passed in 12ms.';

    const result = pruner.pruneText(shortText, 500);
    expect(result.pruned).toBe(false);
    expect(result.text).toBe(shortText);
    expect(result.charsRemoved).toBe(0);

    const blockResult = pruner.pruneContent([{ type: 'text', text: shortText }], 500);
    expect(blockResult).toBeNull();
  });

  it('4. Batch Session Pruning: Prunes all over-budget tool results in a single pass', () => {
    const pruner = new DefaultToolResultPruner(80);

    const sessionItems = [
      {
        id: 'msg-1',
        content: 'Small output within budget',
      },
      {
        id: 'msg-2',
        content: 'START_2: ' + 'DATABASE_DUMP_ROW_'.repeat(50) + ' :END_2',
      },
      {
        id: 'msg-3',
        toolResult: {
          output: 'START_3: ' + 'VERBOSE_STACK_TRACE_LINE_'.repeat(60) + ' :END_3',
        },
      },
    ];

    const result = pruner.pruneSession(sessionItems);

    expect(result.pruned.length).toBe(2);
    expect(result.charsRemoved).toBeGreaterThan(1000);
    expect(sessionItems[1]!.content).toContain('[... pruned ');
    expect(sessionItems[2]!.toolResult.output).toContain('[... pruned ');
  });

  it('5. ContextCompressor Stage 0 (Budget Reduction): Caps tool results exceeding maxToolResultTokens', () => {
    const hugeToolOutput: ContextObject = {
      id: idFactory.create<'Context'>(),
      tier: ContextTier.L0_HOT,
      type: ContextObjectType.OBSERVATION,
      content: 'STDOUT: ' + 'x'.repeat(40000), // ~10,000 tokens
      source: 'tool_executor',
      timestamp: now,
      importance: 0.6,
      confidence: 1.0,
      scope: ContextScope.TASK,
      dependencies: [],
      lastUsed: now,
      lastVerified: now,
      costTokens: 10000,
      tags: ['tool_output'],
      version: 1,
      active: true,
      metadata: {},
    };

    const scored = [ContextRanker.scoreObject(hugeToolOutput, nowMs, DEFAULT_SCORING_WEIGHTS)];

    // Configure maxToolResultTokens = 2000
    const result = ContextCompressor.compress(scored, 5000, nowMs, {
      modelContextTokens: 32000,
      maxToolResultTokens: 2000,
    });

    expect(result.pipelineStagesRun).toContain('BUDGET_REDUCTION');
    const trimmedExplanation = result.explanations.find((e) => e.action === 'TRIMMED');
    expect(trimmedExplanation).toBeDefined();
    expect(trimmedExplanation?.reason).toContain('Budget Reduction');
    expect(trimmedExplanation?.tokenCost).toBeLessThanOrEqual(2000);

    const retainedTool = result.retained.find((o) => o.id === hugeToolOutput.id);
    expect(retainedTool).toBeDefined();
    expect(retainedTool!.content).toContain('[... truncated from 10000 to 2000 tokens ...]');
  });
});
