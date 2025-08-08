// Provider exports and factory
import { OpenAIProvider } from './openai-provider';
import { ClaudeProvider } from './claude-provider';
import { GeminiProvider } from './gemini-provider';
import { OllamaProvider } from './ollama-provider';
import { WebLLMProvider } from './webllm-provider';
import { BedrockProvider } from './bedrock-provider';
import { AzureProvider } from './azure-provider';
import { VertexProvider } from './vertex-provider';
import type { LLMProvider, ProviderConfig } from '../../../types/llm';

export { OpenAIProvider, ClaudeProvider, GeminiProvider, OllamaProvider, WebLLMProvider, BedrockProvider, AzureProvider, VertexProvider };

export class ProviderFactory {
  static createProvider(config: ProviderConfig): LLMProvider {
    console.log(`[ProviderFactory] Creating provider for: ${config.id}`);
    
    switch (config.id) {
      case 'openai':
        return new OpenAIProvider(config);
      case 'anthropic':
      case 'claude':
        return new ClaudeProvider(config);
      case 'google':
      case 'gemini':
        return new GeminiProvider(config);
      case 'ollama':
        return new OllamaProvider(config);
      case 'webllm':
        console.log('[ProviderFactory] Creating WebLLMProvider instance');
        return new WebLLMProvider({
          ...config,
          modelId: config.model || 'Llama-3.2-3B-Instruct-q4f16_1-MLC'
        });
      case 'bedrock':
        return new BedrockProvider(config);
      case 'azure':
        return new AzureProvider(config);
      case 'vertex':
        return new VertexProvider(config);
      default:
        console.error(`[ProviderFactory] Unknown provider: ${config.id}`);
        throw new Error(`Unknown provider: ${config.id}`);
    }
  }

  static isProviderSupported(providerId: string): boolean {
    return ['openai', 'anthropic', 'claude', 'google', 'gemini', 'ollama', 'webllm', 'bedrock', 'azure', 'vertex'].includes(providerId);
  }
}