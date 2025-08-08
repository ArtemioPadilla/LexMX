// Provider registry and factory for managing all LLM providers

import type { 
  LLMProvider, 
  ProviderConfig, 
  LLMProviderType,
  LLMCapability,
  CostLevel 
} from '@/types/llm';

// Provider metadata for the UI
export interface ProviderMetadata {
  id: string;
  name: string;
  type: LLMProviderType;
  icon: string;
  description: string;
  costLevel: CostLevel;
  capabilities: LLMCapability[];
  setupComplexity: 'easy' | 'medium' | 'advanced';
  recommendedFor: string[];
  documentation?: string;
  website?: string;
}

// Registry of all supported providers
export const SUPPORTED_PROVIDERS: Record<string, ProviderMetadata> = {
  webllm: {
    id: 'webllm',
    name: 'WebLLM (Browser)',
    type: 'local',
    icon: '/icons/webllm.svg',
    description: 'Run AI models directly in your browser - 100% private, no API costs, works offline',
    costLevel: 'free',
    capabilities: ['privacy', 'offline', 'reasoning', 'analysis'],
    setupComplexity: 'easy',
    recommendedFor: ['Maximum privacy', 'Offline usage', 'No recurring costs', 'Sensitive legal data'],
    documentation: 'https://github.com/mlc-ai/web-llm',
    website: 'https://webllm.mlc.ai'
  },
  
  openai: {
    id: 'openai',
    name: 'OpenAI',
    type: 'cloud',
    icon: '/icons/openai.svg',
    description: 'GPT-4 and GPT-3.5 models - Excellent for complex legal analysis and reasoning',
    costLevel: 'high',
    capabilities: ['reasoning', 'analysis', 'citations', 'multilingual'],
    setupComplexity: 'easy',
    recommendedFor: ['Complex legal analysis', 'Jurisprudence research', 'Legal writing'],
    documentation: 'https://platform.openai.com/docs',
    website: 'https://openai.com'
  },
  
  anthropic: {
    id: 'anthropic',
    name: 'Claude',
    type: 'cloud',
    icon: '/icons/anthropic.svg',
    description: 'Claude 3.5 Sonnet - Superior legal reasoning and ethical considerations',
    costLevel: 'medium',
    capabilities: ['reasoning', 'ethics', 'analysis', 'citations'],
    setupComplexity: 'easy',
    recommendedFor: ['Mexican legal analysis', 'Ethical legal questions', 'Constitutional law'],
    documentation: 'https://docs.anthropic.com',
    website: 'https://anthropic.com'
  },
  
  google: {
    id: 'google',
    name: 'Gemini',
    type: 'cloud',
    icon: '/icons/google.svg',
    description: 'Gemini Pro - Cost-effective option with good multilingual support',
    costLevel: 'low',
    capabilities: ['reasoning', 'multilingual', 'analysis'],
    setupComplexity: 'easy',
    recommendedFor: ['Budget-conscious users', 'Multilingual legal queries', 'General legal questions'],
    documentation: 'https://ai.google.dev/docs',
    website: 'https://deepmind.google/technologies/gemini'
  },
  
  ollama: {
    id: 'ollama',
    name: 'Ollama',
    type: 'local',
    icon: '/icons/ollama.svg',
    description: 'Run models locally - Complete privacy, no API costs, works offline',
    costLevel: 'free',
    capabilities: ['privacy', 'offline', 'customizable'],
    setupComplexity: 'medium',
    recommendedFor: ['Maximum privacy', 'Offline usage', 'No API costs', 'Sensitive legal data'],
    documentation: 'https://ollama.ai/docs',
    website: 'https://ollama.ai'
  },
  
  openai_compatible: {
    id: 'openai-compatible',
    name: 'OpenAI-Compatible API',
    type: 'local',
    icon: '/icons/local-api.svg',
    description: 'Connect to LM Studio, vLLM, or other OpenAI-compatible local APIs',
    costLevel: 'free',
    capabilities: ['privacy', 'customizable', 'offline'],
    setupComplexity: 'advanced',
    recommendedFor: ['Advanced users', 'Custom model setups', 'Local infrastructure', 'Enterprise deployments'],
    documentation: 'https://lmstudio.ai/docs',
    website: 'https://lmstudio.ai'
  },
  
  bedrock: {
    id: 'bedrock',
    name: 'AWS Bedrock',
    type: 'cloud',
    icon: '/icons/aws.svg',
    description: 'Access Claude, Llama, and other models through AWS - Enterprise-grade security and compliance',
    costLevel: 'medium',
    capabilities: ['reasoning', 'analysis', 'multilingual', 'enterprise'],
    setupComplexity: 'moderate',
    recommendedFor: ['Enterprise users', 'AWS ecosystem integration', 'Multiple model access', 'Compliance requirements'],
    documentation: 'https://docs.aws.amazon.com/bedrock/',
    website: 'https://aws.amazon.com/bedrock'
  },
  
  azure: {
    id: 'azure',
    name: 'Azure OpenAI',
    type: 'cloud',
    icon: '/icons/azure.svg',
    description: 'Enterprise OpenAI models with Azure security and compliance',
    costLevel: 'medium',
    capabilities: ['reasoning', 'analysis', 'citations', 'multilingual'],
    setupComplexity: 'medium',
    recommendedFor: ['Enterprise users', 'Azure ecosystem integration', 'Microsoft 365 users', 'Compliance requirements'],
    documentation: 'https://learn.microsoft.com/en-us/azure/cognitive-services/openai/',
    website: 'https://azure.microsoft.com/en-us/products/cognitive-services/openai-service'
  },
  
  vertex: {
    id: 'vertex',
    name: 'Google Cloud Vertex AI',
    type: 'cloud',
    icon: '/icons/gcp.svg',
    description: 'Access Gemini and PaLM models through Google Cloud Platform',
    costLevel: 'medium',
    capabilities: ['reasoning', 'analysis', 'multilingual', 'ethics'],
    setupComplexity: 'medium',
    recommendedFor: ['GCP users', 'Google ecosystem integration', 'Large context window needs', 'Multimodal analysis'],
    documentation: 'https://cloud.google.com/vertex-ai/docs',
    website: 'https://cloud.google.com/vertex-ai'
  }
};

// Predefined user profiles
export interface UserProfile {
  id: string;
  name: string;
  description: string;
  icon: string;
  providers: string[];
  preferences: {
    privacy: 'maximum' | 'balanced' | 'convenience';
    cost: 'minimize' | 'balanced' | 'quality-first';
    speed: 'fast' | 'balanced' | 'thorough';
  };
  recommended: boolean;
  limits?: {
    dailyCostLimit: number;
    monthlyCostLimit: number;
    requestsPerHour: number;
  };
}

export const USER_PROFILES: Record<string, UserProfile> = {
  privacy_first: {
    id: 'privacy-first',
    name: 'Privacy First',
    description: 'Only local models, maximum privacy, no cloud services',
    icon: '🔒',
    providers: ['webllm', 'ollama'],
    preferences: {
      privacy: 'maximum',
      cost: 'minimize',
      speed: 'balanced'
    },
    recommended: true
  },
  
  balanced_professional: {
    id: 'balanced-professional',
    name: 'Balanced Professional',
    description: 'Mix of local and cloud for optimal value and performance',
    icon: '⚖️',
    providers: ['anthropic', 'ollama', 'google'],
    preferences: {
      privacy: 'balanced',
      cost: 'balanced',
      speed: 'balanced'
    },
    recommended: true
  },
  
  premium_legal: {
    id: 'premium-legal',
    name: 'Premium Legal',
    description: 'Best available models for complex legal work',
    icon: '👔',
    providers: ['anthropic', 'openai'],
    preferences: {
      privacy: 'balanced',
      cost: 'quality-first',
      speed: 'thorough'
    },
    recommended: true
  },
  
  budget_conscious: {
    id: 'budget-conscious',
    name: 'Budget Conscious',
    description: 'Minimize costs while maintaining quality',
    icon: '💰',
    providers: ['google', 'ollama'],
    preferences: {
      privacy: 'balanced',
      cost: 'minimize',
      speed: 'fast'
    },
    recommended: false
  }
};

export class ProviderRegistry {
  private providers: Map<string, LLMProvider> = new Map();
  private configs: Map<string, ProviderConfig> = new Map();

  // Get all supported provider metadata
  getSupportedProviders(): ProviderMetadata[] {
    return Object.values(SUPPORTED_PROVIDERS);
  }

  // Get provider metadata by ID
  getProviderMetadata(id: string): ProviderMetadata | null {
    return SUPPORTED_PROVIDERS[id] || null;
  }

  // Get cloud providers
  getCloudProviders(): ProviderMetadata[] {
    return this.getSupportedProviders().filter(p => p.type === 'cloud');
  }

  // Get local providers
  getLocalProviders(): ProviderMetadata[] {
    return this.getSupportedProviders().filter(p => p.type === 'local');
  }

  // Get providers by capability
  getProvidersByCapability(capability: LLMCapability): ProviderMetadata[] {
    return this.getSupportedProviders().filter(p => 
      p.capabilities.includes(capability)
    );
  }

  // Get providers by cost level
  getProvidersByCost(costLevel: CostLevel): ProviderMetadata[] {
    return this.getSupportedProviders().filter(p => p.costLevel === costLevel);
  }

  // Register a provider instance
  registerProvider(provider: LLMProvider): void {
    this.providers.set(provider.id, provider);
  }

  // Get registered provider
  getProvider(id: string): LLMProvider | null {
    return this.providers.get(id) || null;
  }

  // Get all registered providers
  getRegisteredProviders(): LLMProvider[] {
    return Array.from(this.providers.values());
  }

  // Store provider configuration
  storeConfig(config: ProviderConfig): void {
    this.configs.set(config.id, config);
  }

  // Get provider configuration
  getConfig(id: string): ProviderConfig | null {
    return this.configs.get(id) || null;
  }

  // Get all configurations
  getAllConfigs(): ProviderConfig[] {
    return Array.from(this.configs.values());
  }

  // Remove provider and config
  removeProvider(id: string): void {
    this.providers.delete(id);
    this.configs.delete(id);
  }

  // Get user profiles
  getUserProfiles(): UserProfile[] {
    return Object.values(USER_PROFILES);
  }

  // Get recommended profiles
  getRecommendedProfiles(): UserProfile[] {
    return this.getUserProfiles().filter(p => p.recommended);
  }

  // Get profile by ID
  getUserProfile(id: string): UserProfile | null {
    return USER_PROFILES[id] || null;
  }

  // Validate provider configuration
  validateConfig(config: ProviderConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const metadata = this.getProviderMetadata(config.id);

    if (!metadata) {
      errors.push(`Unknown provider: ${config.id}`);
      return { valid: false, errors };
    }

    // Validate cloud provider requirements
    if (metadata.type === 'cloud') {
      // Special validation for AWS Bedrock
      if (config.id === 'bedrock') {
        if (!config.apiKey && (!config.accessKeyId || !config.secretAccessKey)) {
          errors.push(`API key or IAM credentials required for ${metadata.name}`);
        }
      }
      // Special validation for Azure
      else if (config.id === 'azure') {
        if (!config.apiKey && (!config.azureTenantId || !config.azureClientId || !config.azureClientSecret)) {
          errors.push(`API key or Azure AD credentials required for ${metadata.name}`);
        }
        if (!config.azureResourceName) {
          errors.push(`Azure resource name is required for ${metadata.name}`);
        }
      }
      // Special validation for Vertex AI
      else if (config.id === 'vertex') {
        if (!config.apiKey && !config.gcpServiceAccountKey) {
          errors.push(`API key or service account key required for ${metadata.name}`);
        }
        if (!config.gcpProjectId) {
          errors.push(`GCP project ID is required for ${metadata.name}`);
        }
      }
      // Standard validation for other cloud providers
      else if (!config.apiKey) {
        errors.push(`API key is required for ${metadata.name}`);
      }
    }

    // Validate local provider requirements
    if (metadata.type === 'local') {
      // WebLLM doesn't need endpoint or API key
      if (config.id === 'webllm') {
        // No validation needed for WebLLM
      } else if (!config.endpoint) {
        errors.push(`Endpoint is required for ${metadata.name}`);
      } else {
        try {
          new URL(config.endpoint);
        } catch {
          errors.push(`Invalid endpoint URL for ${metadata.name}`);
        }
      }
    }

    // Validate cost limits
    if (config.costLimit) {
      if (config.costLimit.daily < 0 || config.costLimit.monthly < 0) {
        errors.push('Cost limits must be positive numbers');
      }
      if (config.costLimit.daily > config.costLimit.monthly) {
        errors.push('Daily cost limit cannot exceed monthly limit');
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // Create default configuration for a provider
  createDefaultConfig(providerId: string): ProviderConfig | null {
    const metadata = this.getProviderMetadata(providerId);
    if (!metadata) return null;

    return {
      id: providerId,
      name: metadata.name,
      type: metadata.type,
      enabled: true,
      priority: 1,
      temperature: 0.1, // Conservative for legal queries
      maxTokens: 4000,
      costLimit: {
        daily: metadata.costLevel === 'free' ? 0 : 10,
        monthly: metadata.costLevel === 'free' ? 0 : 200
      },
      createdAt: Date.now()
    };
  }
}

// Global registry instance
export const providerRegistry = new ProviderRegistry();