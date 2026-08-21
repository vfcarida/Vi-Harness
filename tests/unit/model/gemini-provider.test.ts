import { describe, it, expect, vi } from 'vitest';
import { GeminiModelProvider } from '../../../src/infra/model/gemini-provider.js';
import { MessageRole, FinishReason } from '../../../src/core/model/model-io.js';

describe('GeminiModelProvider', () => {
  it('translates messages, function declarations, and parses responses with function calls', async () => {
    let capturedUrl = '';
    let capturedBody: any = null;

    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedBody = JSON.parse(init?.body as string);

      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                role: 'model',
                parts: [
                  { text: 'I am executing the tool now.' },
                  {
                    functionCall: {
                      name: 'run_command',
                      args: { commandLine: 'npm test' },
                    },
                  },
                ],
              },
              finishReason: 'STOP',
            },
          ],
          usageMetadata: {
            promptTokenCount: 350,
            candidatesTokenCount: 45,
            totalTokenCount: 395,
          },
        }),
      } as unknown as Response;
    });

    const provider = new GeminiModelProvider({
      apiKey: 'test-gemini-key',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      customFetch: mockFetch,
    });

    const response = await provider.complete({
      messages: [
        { role: MessageRole.SYSTEM, content: 'You are Gemini coding agent.' },
        { role: MessageRole.USER, content: 'Run test suite' },
      ],
      tools: [
        {
          name: 'run_command',
          description: 'Run shell command',
          parameters: {
            type: 'object',
            properties: { commandLine: { type: 'string' } },
            required: ['commandLine'],
          },
        },
      ],
    });

    expect(capturedUrl).toContain('/models/gemini-2.5-pro:generateContent?key=test-gemini-key');
    expect(capturedBody.systemInstruction.parts[0].text).toBe('You are Gemini coding agent.');
    expect(capturedBody.contents[0].parts[0].text).toBe('Run test suite');
    expect(capturedBody.tools[0].functionDeclarations[0].name).toBe('run_command');

    expect(response.content).toBe('I am executing the tool now.');
    expect(response.toolCalls).toHaveLength(1);
    expect(response.toolCalls?.[0]?.name).toBe('run_command');
    expect(response.toolCalls?.[0]?.input).toEqual({ commandLine: 'npm test' });
    expect(response.finishReason).toBe(FinishReason.STOP);
    expect(response.usage.inputTokens).toBe(350);
    expect(response.usage.outputTokens).toBe(45);
  });

  it('handles rate limits (429) correctly', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: 'Resource exhausted' } }),
    } as unknown as Response);

    const provider = new GeminiModelProvider({
      apiKey: 'test-key',
      customFetch: mockFetch,
    });

    await expect(
      provider.complete({
        messages: [{ role: MessageRole.USER, content: 'Hello' }],
      }),
    ).rejects.toThrow();
  });
});
