// Pattern: Tool Output Spill Policy (ref: DeepSeek Harness)
/**
 * Spill Policy and Preview Formatting.
 *
 * Prevents context window explosion by replacing oversized tool outputs (> 10K chars)
 * with bounded head/tail previews and disk-backed retrieval locators.
 */
export interface SpillPolicy {
  /** Maximum inline character count before output is spilled to disk (default: 10000). */
  readonly maxInlineChars: number;
  /** Number of leading characters retained in the preview (default: 2000). */
  readonly previewHeadChars: number;
  /** Number of trailing characters retained in the preview (default: 2000). */
  readonly previewTailChars: number;
  /** Custom root directory for spill files. */
  readonly spillDir?: string;
}

export const DEFAULT_SPILL_POLICY: SpillPolicy = {
  maxInlineChars: 10000,
  previewHeadChars: 2000,
  previewTailChars: 2000,
};

export interface SpillLocatorSummary {
  readonly id: string;
  readonly totalChars: number;
  readonly totalLines: number;
}

/**
 * Format a human-readable bounded preview for the model when output is spilled.
 */
export function createSpillPreview(
  content: string,
  locator: SpillLocatorSummary,
  policy: SpillPolicy = DEFAULT_SPILL_POLICY,
): string {
  const head = content.slice(0, policy.previewHeadChars);
  const tail = content.slice(-policy.previewTailChars);

  return [
    head,
    '',
    `[... ${locator.totalLines} lines, ${locator.totalChars} chars total ...]`,
    `[Full output saved to: ${locator.id}]`,
    `[Use retrieve_output tool to read specific line ranges]`,
    '',
    tail,
  ].join('\n');
}
