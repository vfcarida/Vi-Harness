import { describe, it, expect } from 'vitest';
import {
  MockModelProvider,
  FailingModelProvider,
  executeResiliently,
  mapProviderError,
} from '../../../src/infra/index.js';
import { HarnessError, ErrorCode, ErrorCategory } from '../../../src/core/errors/index.js';
import type { ModelRequest } from '../../../src/core/model/model-io.js';
import { MessageRole } from '../../../src/core/model/model-io.js';

describe('Provider Resilience & Failure Handling', () => {
  const req: ModelRequest = {
    messages: [{ role: MessageRole.USER, content: 'Hello' }],
  };

  it('should automatically retry transient rate limit failures and succeed', async () => {
    const failingProvider = new FailingModelProvider({
      failAttemptsCount: 2, // Fails 2 times, succeeds on 3rd
    });

    const response = await executeResiliently(failingProvider, req, {
      maxRetries: 3,
      initialBackoffMs: 1,
      maxBackoffMs: 10,
    });

    expect(response.content).toBe('Success after retry');
    expect(response.retryMetadata).toBeDefined();
    expect(response.retryMetadata?.attemptCount).toBe(3);
    expect(failingProvider.currentAttemptCount).toBe(3);
  });

  it('should execute fallback provider when primary provider fails permanently', async () => {
    const primaryProvider = new FailingModelProvider({
      failAttemptsCount: 10, // Fails permanently
    });

    const fallbackProvider = new MockModelProvider({
      providerId: 'fallback-provider-b',
      defaultResponseText: 'Response from fallback provider',
    });

    const response = await executeResiliently(primaryProvider, req, {
      maxRetries: 1,
      initialBackoffMs: 1,
      fallbacks: [fallbackProvider],
    });

    expect(response.providerId).toBe('fallback-provider-b');
    expect(response.content).toBe('Response from fallback provider');
  });

  it('should enforce timeout on slow providers', async () => {
    const slowProvider = new MockModelProvider({
      simulatedLatencyMs: 200,
    });

    await expect(
      executeResiliently(slowProvider, req, {
        maxRetries: 0,
        defaultTimeoutMs: 50,
      }),
    ).rejects.toThrow(HarnessError);

    try {
      await executeResiliently(slowProvider, req, {
        maxRetries: 0,
        defaultTimeoutMs: 50,
      });
    } catch (err) {
      const harnessErr = err as HarnessError;
      expect(harnessErr.code).toBe(ErrorCode.MODEL_TIMEOUT);
      expect(harnessErr.category).toBe(ErrorCategory.MODEL);
    }
  });

  it('should cancel execution immediately when AbortSignal is triggered', async () => {
    const slowProvider = new MockModelProvider({
      simulatedLatencyMs: 1000,
    });

    const controller = new AbortController();
    controller.abort(); // Abort immediately

    const cancelReq: ModelRequest = {
      ...req,
      signal: controller.signal,
    };

    await expect(
      executeResiliently(slowProvider, cancelReq, {
        maxRetries: 2,
      }),
    ).rejects.toThrow(HarnessError);
  });

  it('mapProviderError should standardize HTTP and vendor error codes to HarnessError', () => {
    const err429 = new Error('HTTP 429: Too Many Requests');
    const mapped429 = mapProviderError(err429, 'test-prov');
    expect(mapped429.code).toBe(ErrorCode.MODEL_RATE_LIMITED);
    expect(mapped429.category).toBe(ErrorCategory.MODEL);

    const err503 = new Error('503 Service Unavailable');
    const mapped503 = mapProviderError(err503, 'test-prov');
    expect(mapped503.code).toBe(ErrorCode.MODEL_UNAVAILABLE);

    const errTimeout = new Error('Request Timeout');
    const mappedTimeout = mapProviderError(errTimeout, 'test-prov');
    expect(mappedTimeout.code).toBe(ErrorCode.MODEL_TIMEOUT);
  });
});
