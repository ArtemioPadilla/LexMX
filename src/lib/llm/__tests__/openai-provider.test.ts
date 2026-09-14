import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAIProvider } from '../providers/openai-provider';
import type { LLMRequest, ProviderConfig } from '../../../types/llm';

function makeConfig(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    id: 'openai',
    name: 'OpenAI',
    type: 'cloud',
    enabled: true,
    priority: 1,
    apiKey: 'sk-test-key',
    createdAt: Date.now(),
    ...overrides
  };
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: async () => body
  } as Response;
}

describe('OpenAIProvider (HTTP request shape)', () => {
  const originalFetch = global.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('POSTs to the chat/completions endpoint with a Bearer-authorized, OpenAI-shaped body', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        model: 'gpt-3.5-turbo',
        choices: [{ message: { role: 'assistant', content: 'Hola, ¿en qué puedo ayudarte?' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 }
      })
    );

    const provider = new OpenAIProvider(makeConfig());
    const request: LLMRequest = {
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: '¿Qué es un amparo?' }],
      temperature: 0.5,
      maxTokens: 256
    };

    const response = await provider.generateResponse(request);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: 'Bearer sk-test-key'
    });

    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      model: 'gpt-3.5-turbo',
      messages: request.messages,
      temperature: 0.5,
      max_tokens: 256,
      stream: false
    });

    expect(response.content).toBe('Hola, ¿en qué puedo ayudarte?');
    expect(response.provider).toBe('openai');
    expect(response.usage).toEqual({ promptTokens: 12, completionTokens: 8, totalTokens: 20 });
  });

  it('sends the configured API key when testing the connection', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [] }));

    const provider = new OpenAIProvider(makeConfig({ apiKey: 'sk-other-key' }));
    const ok = await provider.testConnection();

    expect(ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/models');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer sk-other-key' });
  });

  it('surfaces the API error message when the request fails', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: { message: 'Invalid API key provided' } }, false, 401)
    );

    const provider = new OpenAIProvider(makeConfig());
    const request: LLMRequest = {
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'test' }]
    };

    await expect(provider.generateResponse(request)).rejects.toThrow('Invalid API key provided');
  });
});
