// Main provider manager that orchestrates all LLM providers

import type { 
  LLMProvider, 
  ProviderConfig, 
  LLMRequest, 
  LLMResponse, 
  QueryContext,
  UserProfile
} from '../../types/llm';

import { providerRegistry } from './provider-registry';
import { secureStorage } from '../security/secure-storage';
import { ProviderFactory } from './providers';
import { intelligentSelector } from './intelligent-selector';

export class ProviderManager {
  private providers: Map<string, LLMProvider> = new Map();
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize secure storage
      await secureStorage.initialize();

      // Load saved provider configurations
      await this.loadProviderConfigs();

      // Ensure WebLLM is always available as a default option
      await this.ensureWebLLMAvailable();

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize ProviderManager:', error);
      throw error;
    }
  }

  private async ensureWebLLMAvailable(): Promise<void> {
    // Check if WebLLM is already configured
    const webllmConfig = await secureStorage.getProviderConfig('webllm');
    
    if (!webllmConfig) {
      // Create default WebLLM configuration
      const defaultWebLLMConfig: ProviderConfig = {
        id: 'webllm',
        name: 'WebLLM (Local)',
        type: 'local',
        enabled: true,
        priority: 100, // High priority as it's free and private
        model: '', // No model selected by default
        // No API key needed for WebLLM
      };
      
      // Store the default configuration
      await secureStorage.storeProviderConfig(defaultWebLLMConfig);
      
      // Initialize the WebLLM provider
      await this.initializeProvider(defaultWebLLMConfig);
      
      console.log('WebLLM provider added as default option');
    }
  }

  // Provider configuration management
  async configureProvider(config: ProviderConfig): Promise<void> {
    try {
      // Validate configuration
      const validation = providerRegistry.validateConfig(config);
      if (!validation.valid) {
        throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
      }

      // Store configuration securely
      await secureStorage.storeProviderConfig(config);

      // Initialize provider instance
      await this.initializeProvider(config);

      console.log(`Provider ${config.name} configured successfully`);
    } catch (error) {
      console.error(`Failed to configure provider ${config.id}:`, error);
      throw error;
    }
  }

  async removeProvider(providerId: string): Promise<void> {
    // Remove from storage
    await secureStorage.removeProviderConfig(providerId);

    // Remove from memory
    this.providers.delete(providerId);

    // Remove from registry
    providerRegistry.removeProvider(providerId);

    console.log(`Provider ${providerId} removed`);
  }

  // Provider selection and routing
  async selectOptimalProvider(context: QueryContext): Promise<LLMProvider | null> {
    const availableProviders = Array.from(this.providers.values())
      .filter(p => p.status === 'connected');

    if (availableProviders.length === 0) {
      return null;
    }

    // Score providers based on context
    const scoredProviders = await Promise.all(
      availableProviders.map(async provider => ({
        provider,
        score: await this.scoreProvider(provider, context)
      }))
    );

    // Sort by score (descending)
    scoredProviders.sort((a, b) => b.score - a.score);

    return scoredProviders[0]?.provider || null;
  }

  private async scoreProvider(provider: LLMProvider, context: QueryContext): Promise<number> {
    let score = 0;

    // Privacy considerations
    if (context.privacyRequired && provider.type === 'local') {
      score += 50;
    } else if (context.privacyRequired && provider.type === 'cloud') {
      score -= 30;
    }

    // Offline mode
    if (context.offlineMode) {
      if (provider.type === 'local') {
        score += 100; // Strongly prefer local when offline
      } else {
        score -= 100; // Can't use cloud providers offline
      }
    }

    // Budget considerations
    const config = await secureStorage.getProviderConfig(provider.id);
    if (config?.costLimit) {
      const metrics = provider.getMetrics();
      const remainingBudget = context.userBudget - metrics.totalCost;
      
      if (remainingBudget <= 0) {
        score -= 100; // Exclude if over budget
      } else {
        // Prefer providers with lower cost per token
        const metadata = providerRegistry.getProviderMetadata(provider.id);
        if (metadata) {
          const costMultiplier = {
            'free': 4,
            'low': 3,
            'medium': 2,
            'high': 1
          }[metadata.costLevel];
          score += costMultiplier * 10;
        }
      }
    }

    // Complexity matching
    if (context.complexity > 0.8) {
      // High complexity queries prefer reasoning-capable models
      const metadata = providerRegistry.getProviderMetadata(provider.id);
      if (metadata?.capabilities.includes('reasoning')) {
        score += 30;
      }
      if (metadata?.capabilities.includes('analysis')) {
        score += 20;
      }
    }

    // Urgency considerations
    if (context.urgency === 'high') {
      const metrics = provider.getMetrics();
      // Prefer faster providers for urgent queries
      const latencyScore = Math.max(0, 20 - (metrics.averageLatency / 100));
      score += latencyScore;
    }

    // Legal area specialization
    if (context.legalArea) {
      const metadata = providerRegistry.getProviderMetadata(provider.id);
      if (metadata?.recommendedFor.some(area => 
        area.toLowerCase().includes(context.legalArea!.toLowerCase())
      )) {
        score += 25;
      }
    }

    // Success rate
    const metrics = provider.getMetrics();
    score += metrics.successRate * 20;

    // Provider priority from config
    if (config) {
      score += config.priority * 5;
    }

    return Math.max(0, score);
  }

  // Request processing with streaming support
  async processStreamingRequest(
    request: LLMRequest, 
    context: QueryContext,
    onChunk: (chunk: string) => void
  ): Promise<LLMResponse> {
    const provider = await this.selectOptimalProvider(context);
    
    if (!provider) {
      throw new Error('No available LLM providers configured');
    }

    // Check if provider supports streaming
    if (!provider.stream) {
      throw new Error(`Provider ${provider.name} does not support streaming`);
    }

    try {
      // Process streaming request
      const response = await provider.stream(request, onChunk);
      
      // Log successful usage
      await this.logUsage(provider.id, request, response, true);
      
      return response;
    } catch (error) {
      // Log failed usage
      await this.logUsage(provider.id, request, null, false);
      
      // For streaming, we don't fallback as it would restart the stream
      throw error;
    }
  }

  // Request processing with fallback
  async processRequest(request: LLMRequest, context: QueryContext): Promise<LLMResponse> {
    const provider = await this.selectOptimalProvider(context);
    
    if (!provider) {
      throw new Error('No available LLM providers configured');
    }

    try {
      // Process request with selected provider
      const response = await provider.generateResponse(request);
      
      // Log successful usage
      await this.logUsage(provider.id, request, response, true);
      
      return response;
    } catch (error) {
      // Log failed usage
      await this.logUsage(provider.id, request, null, false);
      
      // Try fallback provider
      const fallbackProvider = await this.selectFallbackProvider(provider, context);
      
      if (fallbackProvider) {
        try {
          const response = await fallbackProvider.generateResponse(request);
          response.metadata = { ...response.metadata, fallback: true };
          
          await this.logUsage(fallbackProvider.id, request, response, true);
          return response;
        } catch (fallbackError) {
          await this.logUsage(fallbackProvider.id, request, null, false);
        }
      }
      
      // If all fails, throw the original error
      throw error;
    }
  }

  private async selectFallbackProvider(
    failedProvider: LLMProvider, 
    context: QueryContext
  ): Promise<LLMProvider | null> {
    // Get all providers except the failed one
    const candidates = Array.from(this.providers.values())
      .filter(p => p.id !== failedProvider.id && p.status === 'connected');

    if (candidates.length === 0) return null;

    // For fallback, prefer different types (local vs cloud)
    const differentType = candidates.find(p => p.type !== failedProvider.type);
    if (differentType) return differentType;

    // Otherwise, just return the highest scoring remaining provider
    const scoredCandidates = await Promise.all(
      candidates.map(async provider => ({
        provider,
        score: await this.scoreProvider(provider, context)
      }))
    );

    scoredCandidates.sort((a, b) => b.score - a.score);
    return scoredCandidates[0]?.provider || null;
  }

  // Provider status management
  async checkProvidersHealth(): Promise<void> {
    const providers = Array.from(this.providers.values());
    
    await Promise.all(providers.map(async provider => {
      try {
        const isAvailable = await provider.isAvailable();
        provider.status = isAvailable ? 'connected' : 'disconnected';
      } catch (error) {
        provider.status = 'error';
        console.error(`Health check failed for ${provider.name}:`, error);
      }
    }));
  }

  // Get provider information
  getConfiguredProviders(): LLMProvider[] {
    return Array.from(this.providers.values());
  }

  getAvailableProviders(): LLMProvider[] {
    return Array.from(this.providers.values())
      .filter(p => p.status === 'connected');
  }

  async getProviderConfig(providerId: string): Promise<ProviderConfig | null> {
    return await secureStorage.getProviderConfig(providerId);
  }

  // Check if any providers are configured
  async hasConfiguredProviders(): Promise<boolean> {
    // Ensure we're initialized
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Check both memory and storage
    const memoryProviders = this.providers.size > 0;
    const configs = await secureStorage.getAllProviderConfigs();
    const storageProviders = configs.length > 0 && configs.some(config => 
      config.enabled && (
        config.id === 'webllm' || // WebLLM doesn't need API key
        config.id === 'ollama' || // Ollama just needs endpoint
        (config.apiKey && config.apiKey.trim() !== '')
      )
    );
    
    return memoryProviders || storageProviders;
  }

  // Intelligent provider selection
  async selectProviderIntelligently(query: string): Promise<{ provider: LLMProvider; model: string; reasoning: string[] } | null> {
    const selection = await intelligentSelector.selectProvider(
      intelligentSelector.analyzeQuery(query)
    );

    if (!selection) {
      return null;
    }

    const provider = this.providers.get(selection.providerId);
    if (!provider) {
      return null;
    }

    return {
      provider,
      model: selection.model,
      reasoning: selection.reasoning
    };
  }

  // Get provider recommendations
  async getProviderRecommendations(query: string): Promise<Array<{
    providerId: string;
    model: string;
    score: number;
    estimatedCost: number;
    reasoning: string[];
    available: boolean;
  }>> {
    const recommendations = await intelligentSelector.getRecommendations(query, 3);
    
    return Promise.all(recommendations.map(async rec => ({
      ...rec,
      available: this.providers.has(rec.providerId) && 
                 this.providers.get(rec.providerId)?.status === 'connected'
    })));
  }

  // Get provider for a specific model
  getProvider(providerId: string): LLMProvider | undefined {
    return this.providers.get(providerId);
  }

  // User profile management
  async applyUserProfile(profile: UserProfile): Promise<void> {
    // Remove existing providers not in profile
    const existingProviders = await secureStorage.getAllProviderConfigs();
    for (const config of existingProviders) {
      if (!profile.providers.includes(config.id)) {
        await this.removeProvider(config.id);
      }
    }

    // Configure profile providers
    for (const providerId of profile.providers) {
      const existingConfig = await secureStorage.getProviderConfig(providerId);
      if (!existingConfig) {
        // Create default config for new providers
        const defaultConfig = providerRegistry.createDefaultConfig(providerId);
        if (defaultConfig) {
          // Apply profile preferences
          defaultConfig.priority = profile.providers.indexOf(providerId) + 1;
          // Don't auto-configure - user still needs to provide API keys
        }
      }
    }
  }

  // Private methods
  private async loadProviderConfigs(): Promise<void> {
    try {
      const configs = await secureStorage.getAllProviderConfigs();
      
      for (const config of configs) {
        if (config.enabled) {
          await this.initializeProvider(config);
        }
      }
      
      console.log(`Loaded ${configs.length} provider configurations`);
    } catch (error) {
      console.error('Failed to load provider configurations:', error);
    }
  }

  private async initializeProvider(config: ProviderConfig): Promise<void> {
    console.log(`[ProviderManager] Initializing provider: ${config.id}`);
    
    try {
      // Create provider instance using factory
      let provider: LLMProvider;
      
      if (config.id === 'webllm') {
        // Handle WebLLM special initialization with progress callback
        const webllmConfig = {
          ...config,
          initProgressCallback: this.webllmProgressCallback
        };
        console.log('[ProviderManager] Creating WebLLM provider with special config');
        provider = ProviderFactory.createProvider(webllmConfig);
      } else {
        provider = ProviderFactory.createProvider(config);
      }
      
      console.log(`[ProviderManager] Provider instance created: ${provider.id}`);
      
      // Store provider instance
      this.providers.set(config.id, provider);
      
      // Test connection for all providers
      const isAvailable = await provider.testConnection();
      
      console.log(`Provider ${config.id} initialized (connected: ${isAvailable})`);
    } catch (error) {
      console.error(`Failed to initialize provider ${config.id}:`, error);
    }
  }

  private webllmProgressCallback?: (progress: number, message: string) => void;

  // Set WebLLM progress callback for UI updates
  setWebLLMProgressCallback(callback: (progress: number, message: string) => void): void {
    this.webllmProgressCallback = callback;
  }


  private async logUsage(
    providerId: string,
    request: LLMRequest,
    response: LLMResponse | null,
    success: boolean
  ): Promise<void> {
    // Log usage for analytics and billing
    const usage = {
      timestamp: Date.now(),
      providerId,
      model: request.model,
      success,
      tokens: response?.usage?.totalTokens || response?.totalTokens || 0,
      cost: response?.cost || 0,
      latency: response?.latency || response?.processingTime || 0
    };

    // Store in secure storage if analytics enabled
    const privacySettings = secureStorage.getPrivacySettings();
    if (privacySettings.analytics !== 'none') {
      // Store anonymized usage data
    }
  }

  // Get all enabled providers
  async getEnabledProviders(): Promise<ProviderConfig[]> {
    const configs: ProviderConfig[] = [];
    const allConfigs = await secureStorage.getAllProviderConfigs();
    
    for (const config of allConfigs) {
      if (config.enabled) {
        configs.push(config);
      }
    }
    
    return configs;
  }

  // Get current provider (based on last used or preference)
  async getCurrentProvider(): Promise<ProviderConfig | null> {
    // First check if there's a preferred provider in storage
    const preferred = await secureStorage.getPreferredProvider();
    if (preferred) {
      const config = await this.getProviderConfig(preferred);
      if (config && config.enabled) {
        return config;
      }
    }
    
    // Otherwise return the first enabled provider
    const enabledProviders = await this.getEnabledProviders();
    return enabledProviders.length > 0 ? enabledProviders[0] : null;
  }

  // Set preferred provider
  async setPreferredProvider(providerId: string, model?: string): Promise<void> {
    await secureStorage.setPreferredProvider(providerId);
    
    // If model is specified, update the provider config
    if (model) {
      const config = await this.getProviderConfig(providerId);
      if (config) {
        config.model = model;
        await secureStorage.storeProviderConfig(config);
        
        // Reinitialize the provider with new model
        const provider = this.providers.get(providerId);
        if (provider && provider.id === 'webllm') {
          // For WebLLM, we need to reinitialize with the new model
          await this.initializeProvider(config);
        }
      }
    }
  }
}

// Global provider manager instance
export const providerManager = new ProviderManager();