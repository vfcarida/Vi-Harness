import { describe, it, expect, vi } from 'vitest';
import { AnthropicModelProvider } from '../../../src/infra/model/anthropic-provider.js';
import { MessageRole, FinishReason } from '../../../src/core/model/model-io.js';

describe('AnthropicModelProvider', () => {
  it('translates messages, prompt caching tags, and parses text/tool responses correctly', async () => {
    let capturedUrl = '';
    let capturedHeaders: Record<string, string> = {};
    let capturedBody: any = null;

    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedHeaders = (init?.headers as Record<string, string>) ?? {};
      capturedBody = JSON.parse(init?.body as string);

      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 'msg-123',
          type: 'message',
          role: 'assistant',
          model: 'claude-3-7-sonnet-20250219',
          content: [
            { type: 'text', text: 'I have evaluated the repository.' },
            {
              type: 'tool_use',
              id: 'toolu_01',
              name: 'write_to_file',
              input: { targetFile: 'src/main.ts', content: 'console.log("hello");' },
            },
          ],
          stop_reason: 'tool_use',
          usage: {
            input_tokens: 1500,
            output_tokens: 80,
            cache_creation_input_tokens: 1000,
            cache_read_input_tokens: 500,
          },
        }),
      } as unknown as Response;
    });

    const provider = new AnthropicModelProvider({
      apiKey: 'test-anthropic-key',
      baseUrl: 'https://api.anthropic.com/v1',
      customFetch: mockFetch,
    });

    const response = await provider.complete({
      messages: [
        {
          role: MessageRole.SYSTEM,
          content: 'You are an autonomous coding assistant.',
          metadata: { segmentType: 'STATIC', cacheControl: { type: 'ephemeral' } },
        },
        {
          role: MessageRole.USER,
          content: 'Implement the feature.',
        },
      ],
      tools: [
        {
          name: 'write_to_file',
          description: 'Write file content',
          parameters: {
            type: 'object',
            properties: {
              targetFile: { type: 'string' },
              content: { type: 'string' },
            },
            required: ['targetFile', 'content'],
          },
        },
      ],
    });

    // Verify request
    expect(capturedUrl).toBe('https://api.anthropic.com/v1/messages');
    expect(capturedHeaders['x-api-key']).toBe('test-anthropic-key');
    expect(capturedHeaders['anthropic-version']).toBe('2023-06-01');
    expect(capturedBody.system).toEqual([
      {
        type: 'text',
        text: 'You are an autonomous coding assistant.',
        cache_control: { type: 'ephemeral' },
      },
    ]);
    expect(capturedBody.tools).toHaveLength(1);

    // Verify response
    expect(response.content).toBe('I have evaluated the repository.');
    expect(response.toolCalls).toHaveLength(1);
    expect(response.toolCalls?.[0]?.name).toBe('write_to_file');
    expect(response.toolCalls?.[0]?.input).toEqual({
      targetFile: 'src/main.ts',
      content: 'console.log("hello");',
    });
    expect(response.finishReason).toBe(FinishReason.TOOL_CALL);
    expect(response.usage.inputTokens).toBe(1500);
    expect(response.usage.cacheReadTokens).toBe(500);
  });

  it('handles authentication error correctly', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Invalid API key' } }),
    } as unknown as Response);

    const provider = new AnthropicModelProvider({
      apiKey: 'invalid-key',
      customFetch: mockFetch,
    });

    await expect(
      provider.complete({
        messages: [{ role: MessageRole.USER, content: 'Hello' }],
      }),
    ).rejects.toThrow();
  });
});
