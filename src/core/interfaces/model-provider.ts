/**
 * ModelProvider interface.
 *
 * "Model-agnostic by contract, not by adapter."
 *
 * Each LLM provider (OpenAI, Anthropic, Google, local, vLLM, etc.) implements
 * this interface. No vendor SDK types cross this boundary.
 */
import type {
  ModelRequest,
  ModelResponse,
  ModelStreamChunk,
  ModelDescriptor,
  ModelHealth,
} from '../model/model-io.js';

export interface ModelProvider {
  /** Unique identifier for this provider instance (e.g. 'openai-primary', 'local-vllm'). */
  readonly providerId: string;

  /** Metadata and capabilities for models supported by this provider. */
  readonly descriptor: ModelDescriptor;

  /** Send a completion request and receive a vendor-neutral response. */
  complete(request: ModelRequest): Promise<ModelResponse>;

  /** Send a streaming completion request and receive async chunks. */
  stream(request: ModelRequest): AsyncIterable<ModelStreamChunk>;

  /** Check current health and availability of this provider. */
  getHealth(): Promise<ModelHealth>;
}
