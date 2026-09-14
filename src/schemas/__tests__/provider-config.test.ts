import { describe, expect, it } from 'vitest';
import { BedrockSchema, CloudKeySchema, LocalEndpointSchema, defaultValuesFor, schemaFor, toProviderConfig } from '../provider-config';
import type { ProviderConfig } from '@/types/llm';

const base: ProviderConfig = { id: 'openai', name: 'OpenAI', type: 'cloud', enabled: false, priority: 1, createdAt: 0 };

describe('provider config schemas', () => {
  it('requires an API key for cloud providers', () => {
    expect(CloudKeySchema.safeParse({ apiKey: 'sk-1234567890' }).success).toBe(true);
    const bad = CloudKeySchema.safeParse({ apiKey: 'sk' });
    expect(bad.success).toBe(false);
    expect(bad.success ? '' : bad.error.issues[0]?.message).toBe('setup.validation.invalidKey');
  });

  it('accepts either an API key or IAM credentials for Bedrock', () => {
    expect(BedrockSchema.safeParse({ apiKey: 'k', region: 'us-east-1' }).success).toBe(true);
    expect(BedrockSchema.safeParse({ accessKeyId: 'a', secretAccessKey: 's', region: 'us-east-1' }).success).toBe(true);
    expect(BedrockSchema.safeParse({ region: 'us-east-1' }).success).toBe(false);
  });

  it('validates local endpoints as http(s) URLs', () => {
    expect(LocalEndpointSchema.safeParse({ endpoint: 'http://localhost:11434' }).success).toBe(true);
    expect(LocalEndpointSchema.safeParse({ endpoint: 'localhost' }).success).toBe(false);
    expect(LocalEndpointSchema.safeParse({ endpoint: 'ftp://x' }).success).toBe(false);
  });

  it('maps provider ids to schemas and defaults', () => {
    expect(schemaFor('webllm').safeParse(defaultValuesFor('webllm')).success).toBe(true);
    expect(schemaFor('ollama').safeParse(defaultValuesFor('ollama')).success).toBe(true);
    expect(schemaFor('anthropic')).toBe(CloudKeySchema);
    expect(schemaFor('openai-compatible')).toBe(LocalEndpointSchema);
  });

  it('merges form values into the stored config, dropping empty fields', () => {
    const cfg = toProviderConfig(base, { apiKey: 'sk-abc', model: '', endpoint: undefined });
    expect(cfg.apiKey).toBe('sk-abc');
    expect('model' in cfg).toBe(false);
    expect(cfg.enabled).toBe(true);
    expect(cfg.createdAt).toBeGreaterThan(0);
  });
});
