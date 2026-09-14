/**
 * Zod schemas for provider configuration (plan Fase 4: /setup on Form +
 * react-hook-form + zod). One schema per credential shape; the wizard picks
 * the schema by provider id and `toProviderConfig` maps the values onto the
 * `ProviderConfig` the manager persists (encrypted, client-side).
 */
import { z } from 'zod';
import type { ProviderConfig } from '@/types/llm';

const apiKey = z.string().trim().min(8, 'setup.validation.invalidKey');
const url = z
  .string()
  .trim()
  .min(1, 'setup.validation.required')
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'setup.validation.invalidUrl');

export const CloudKeySchema = z.object({
  apiKey,
  model: z.string().optional(),
});

export const BedrockSchema = z
  .object({
    apiKey: z.string().trim().optional(),
    accessKeyId: z.string().trim().optional(),
    secretAccessKey: z.string().trim().optional(),
    region: z.string().trim().min(1, 'setup.validation.required').default('us-east-1'),
    model: z.string().optional(),
  })
  .refine((v) => Boolean(v.apiKey) || Boolean(v.accessKeyId && v.secretAccessKey), {
    message: 'setup.validation.keyOrCredentials',
    path: ['apiKey'],
  });

export const AzureSchema = z
  .object({
    azureResourceName: z.string().trim().min(1, 'setup.validation.required'),
    azureDeploymentName: z.string().trim().optional(),
    azureApiVersion: z.string().trim().default('2024-02-01'),
    apiKey: z.string().trim().optional(),
    azureTenantId: z.string().trim().optional(),
    azureClientId: z.string().trim().optional(),
    azureClientSecret: z.string().trim().optional(),
    model: z.string().optional(),
  })
  .refine((v) => Boolean(v.apiKey) || Boolean(v.azureTenantId && v.azureClientId && v.azureClientSecret), {
    message: 'setup.validation.keyOrCredentials',
    path: ['apiKey'],
  });

export const VertexSchema = z
  .object({
    gcpProjectId: z.string().trim().min(1, 'setup.validation.required'),
    gcpLocation: z.string().trim().default('us-central1'),
    apiKey: z.string().trim().optional(),
    gcpServiceAccountKey: z.string().trim().optional(),
    model: z.string().optional(),
  })
  .refine((v) => Boolean(v.apiKey) || Boolean(v.gcpServiceAccountKey), {
    message: 'setup.validation.keyOrCredentials',
    path: ['apiKey'],
  });

export const LocalEndpointSchema = z.object({
  endpoint: url,
  apiKey: z.string().trim().optional(),
  model: z.string().optional(),
});

export const WebLLMSchema = z.object({
  model: z.string().min(1, 'setup.validation.required'),
});

export type ProviderFormValues =
  | z.infer<typeof CloudKeySchema>
  | z.infer<typeof BedrockSchema>
  | z.infer<typeof AzureSchema>
  | z.infer<typeof VertexSchema>
  | z.infer<typeof LocalEndpointSchema>
  | z.infer<typeof WebLLMSchema>;

export const DEFAULT_WEBLLM_MODEL = 'Llama-3.2-3B-Instruct-q4f16_1-MLC';

export function schemaFor(providerId: string): z.ZodTypeAny {
  switch (providerId) {
    case 'webllm':
      return WebLLMSchema;
    case 'bedrock':
      return BedrockSchema;
    case 'azure':
      return AzureSchema;
    case 'vertex':
      return VertexSchema;
    case 'ollama':
    case 'openai-compatible':
      return LocalEndpointSchema;
    default:
      return CloudKeySchema;
  }
}

export function defaultValuesFor(providerId: string): Record<string, string> {
  switch (providerId) {
    case 'webllm':
      return { model: DEFAULT_WEBLLM_MODEL };
    case 'bedrock':
      return { apiKey: '', accessKeyId: '', secretAccessKey: '', region: 'us-east-1', model: '' };
    case 'azure':
      return { azureResourceName: '', azureDeploymentName: '', azureApiVersion: '2024-02-01', apiKey: '', azureTenantId: '', azureClientId: '', azureClientSecret: '', model: '' };
    case 'vertex':
      return { gcpProjectId: '', gcpLocation: 'us-central1', apiKey: '', gcpServiceAccountKey: '', model: '' };
    case 'ollama':
      return { endpoint: 'http://localhost:11434', apiKey: '', model: '' };
    case 'openai-compatible':
      return { endpoint: 'http://localhost:1234/v1', apiKey: '', model: '' };
    default:
      return { apiKey: '', model: '' };
  }
}

/** Merges validated form values into the manager's ProviderConfig. Empty strings become undefined. */
export function toProviderConfig(base: ProviderConfig, values: Record<string, unknown>): ProviderConfig {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) {
    if (v === '' || v === undefined || v === null) continue;
    clean[k] = v;
  }
  return { ...base, ...clean, enabled: true, createdAt: base.createdAt || Date.now() } as ProviderConfig;
}
