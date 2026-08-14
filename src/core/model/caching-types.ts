/**
 * Prompt & Prefix Caching Domain Types.
 *
 * Defines canonical data models for separating static prompt context
 * (system instructions, tool definitions, repo map) from dynamic context
 * (task state, latest error, recent evidence) to maximize LLM API prefix caching.
 */
import type { MessageRole, ModelMessage } from './model-io.js';

export type CacheSegmentType = 'STATIC' | 'DYNAMIC';

export interface PromptCacheSegment {
  readonly segmentType: CacheSegmentType;
  readonly role: MessageRole;
  readonly content: string;
  readonly estimatedTokens: number;
  readonly cacheControl?: { readonly type: 'ephemeral' };
  readonly tag?: string;
}

export interface PrefixCachingPayload {
  readonly segments: ReadonlyArray<PromptCacheSegment>;
  readonly formattedMessages: ReadonlyArray<ModelMessage>;
  readonly totalStaticTokens: number;
  readonly totalDynamicTokens: number;
  readonly staticTokenRatio: number; // static / (static + dynamic)
  readonly compiledAt: Date;
}
