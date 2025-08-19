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
import { getEnvironmentConfig, hasValidApiKey, isProviderEnabled, createProviderConfigFromEnv } from '../utils/env-config';

export class ProviderManager {
  private providers: Map<string, LLMProvider> = new Map();
  private initialized = false;
  private loadedWebLLMModels = new Set<string>();

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Check if we're in a browser environment
      if (typeof window === 'undefined') {
        console.warn('ProviderManager: Not in browser environment, skipping initialization');
        return;
      }

      // Initialize secure storage
      await secureStorage.initialize();

      // Load saved provider configurations
      await this.loadProviderConfigs();

      // Auto-configure providers from environment variables
      await this.autoConfigureFromEnvironment();

      // Ensure WebLLM is always available as a default option
      await this.ensureWebLLMAvailable();
      
      // Ensure mock provider is available as ultimate fallback
      await this.ensureMockProviderAvailable();
      
      // Load cached model tracking
      this.loadCachedModels();

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize ProviderManager:', error);
      // Don't throw in test environments
      if (process.env.NODE_ENV !== 'test') {
        throw error;
      }
      this.initialized = true; // Mark as initialized anyway to prevent blocking
    }
  }
  
  private loadCachedModels(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const cached = localStorage.getItem('webllm_loaded_models');
        if (cached) {
          const models = JSON.parse(cached);
          this.loadedWebLLMModels = new Set(models);
        }
      }
    } catch (error) {
      console.error('Failed to load cached models list:', error);
    }
  }
  
  isWebLLMModelCached(modelId: string): boolean {
    return this.loadedWebLLMModels.has(modelId);
  }
  
  markWebLLMModelAsCached(modelId: string): void {
    this.loadedWebLLMModels.add(modelId);
    try {
      localStorage.setItem('webllm_loaded_models', JSON.stringify([...this.loadedWebLLMModels]));
    } catch (error) {
      console.error('Failed to save cached models list:', error);
    }
  }
  
  async removeWebLLMModelFromCache(modelId: string): Promise<boolean> {
    try {
      // Try to clear from browser cache
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        for (const cacheName of cacheNames) {
          if (cacheName.includes('webllm') || cacheName.includes(modelId)) {
            await caches.delete(cacheName);
          }
        }
      }
      
      // Remove from tracking
      this.loadedWebLLMModels.delete(modelId);
      localStorage.setItem('webllm_loaded_models', JSON.stringify([...this.loadedWebLLMModels]));
      
      // Clear IndexedDB entries related to this model
      if ('indexedDB' in window) {
        try {
          const databases = await indexedDB.databases();
          for (const db of databases) {
            if (db.name?.includes('webllm') || db.name?.includes(modelId)) {
              await indexedDB.deleteDatabase(db.name);
            }
          }
        } catch (e) {
          console.warn('Could not clear IndexedDB:', e);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Failed to remove model from cache:', error);
      return false;
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
        createdAt: Date.now(),
        // No API key needed for WebLLM
      };
      
      // Store the default configuration
      await secureStorage.storeProviderConfig(defaultWebLLMConfig);
      
      // Initialize the WebLLM provider
      await this.initializeProvider(defaultWebLLMConfig);
      
      // WebLLM provider added as default option
    }
  }

  private async ensureMockProviderAvailable(): Promise<void> {
    // Check if mock provider is already configured
    const mockConfig = await secureStorage.getProviderConfig('mock');
    
    if (!mockConfig) {
      // Create default mock configuration
      const defaultMockConfig: ProviderConfig = {
        id: 'mock',
        name: 'Sistema de Demostración',
        type: 'local',
        enabled: true,
        priority: 0, // Lowest priority - only as fallback
        model: 'mock-legal-assistant',
        createdAt: Date.now(),
        // No API key needed for mock
      };
      
      // Store the default configuration
      await secureStorage.storeProviderConfig(defaultMockConfig);
      
      // Initialize the mock provider
      await this.initializeProvider(defaultMockConfig);
      
      console.log('[ProviderManager] Mock provider initialized as fallback');
    }
  }

  private async autoConfigureFromEnvironment(): Promise<void> {
    console.log('[ProviderManager] Auto-configuring providers from environment variables');
    
    const providersToCheck = ['openai', 'anthropic', 'google', 'ollama', 'bedrock', 'azure', 'vertex'];
    
    for (const providerId of providersToCheck) {
      try {
        // Skip if already configured by user
        const existingConfig = await secureStorage.getProviderConfig(providerId);
        if (existingConfig) {
          console.log(`[ProviderManager] ${providerId} already configured, skipping auto-config`);
          continue;
        }
        
        // Check if environment variables are available for this provider
        if (!isProviderEnabled(providerId) || !hasValidApiKey(providerId)) {
          console.log(`[ProviderManager] ${providerId} not enabled or missing API key, skipping`);
          continue;
        }
        
        // Create configuration from environment
        const envConfig = createProviderConfigFromEnv(providerId);
        if (envConfig) {
          console.log(`[ProviderManager] Auto-configuring ${providerId} from environment`);
          
          const fullConfig: ProviderConfig = {
            ...envConfig as ProviderConfig,
            costLimit: {
              daily: 50, // Default limits
              monthly: 500
            }
          };
          
          // Store the configuration
          await secureStorage.storeProviderConfig(fullConfig);
          
          // Initialize the provider
          await this.initializeProvider(fullConfig);
          
          console.log(`[ProviderManager] ${providerId} auto-configured and initialized`);
        }
      } catch (error) {
        console.warn(`[ProviderManager] Failed to auto-configure ${providerId}:`, error);
      }
    }
    
    const envConfig = getEnvironmentConfig();
    if (envConfig.debug) {
      console.log('[ProviderManager] Auto-configuration complete');
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

      // Provider configured successfully
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

    // Provider removed
  }

  // Provider selection and routing
  async selectOptimalProvider(context: QueryContext): Promise<LLMProvider | null> {
    let availableProviders = Array.from(this.providers.values())
      .filter(p => p.status === 'connected');

    // If no providers are available, ensure we have at least the mock provider
    if (availableProviders.length === 0) {
      console.warn('[ProviderManager] No providers available, ensuring mock provider is initialized');
      await this.ensureMockProviderAvailable();
      availableProviders = Array.from(this.providers.values())
        .filter(p => p.status === 'connected');
    }

    if (availableProviders.length === 0) {
      console.error('[ProviderManager] Still no providers available after mock initialization');
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

    const selectedProvider = scoredProviders[0]?.provider || null;
    
    if (selectedProvider?.id === 'mock') {
      console.log('[ProviderManager] Using mock provider - configure real providers for full functionality');
    }

    return selectedProvider;
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
      // Process streaming request with abort signal
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
      // Create a temporary mock provider as last resort
      console.warn('[ProviderManager] No provider available, creating temporary mock provider');
      const mockProvider = ProviderFactory.createMockProvider();
      await mockProvider.testConnection();
      return await mockProvider.generateResponse(request);
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
        } catch (_fallbackError) {
          void _fallbackError;
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
      
      // Loaded provider configurations
    } catch (error) {
      console.error('Failed to load provider configurations:', error);
    }
  }

  private async initializeProvider(config: ProviderConfig): Promise<void> {
    // Initializing provider
    
    try {
      // Create provider instance using factory
      let provider: LLMProvider;
      
      if (config.id === 'webllm') {
        // Handle WebLLM special initialization with progress callback
        const webllmConfig = {
          ...config,
          initProgressCallback: (progress: number, message: string) => {
            this.notifyProgressListeners(progress, message);
            // Mark as cached when loading is complete
            if (progress === 100 && config.model) {
              this.markWebLLMModelAsCached(config.model);
            }
          }
        };
        // Creating WebLLM provider with special config
        provider = ProviderFactory.createProvider(webllmConfig);
      } else {
        provider = ProviderFactory.createProvider(config);
      }
      
      // Provider instance created
      
      // Store provider instance
      this.providers.set(config.id, provider);
      
      // Test connection for all providers
      const _isAvailable = await provider.testConnection();
      
      // Provider initialized
    } catch (error) {
      console.error(`Failed to initialize provider ${config.id}:`, error);
    }
  }

  private webllmProgressListeners: Set<(progress: number, message: string) => void> = new Set();

  // Add WebLLM progress listener for UI updates (supports multiple listeners)
  addWebLLMProgressListener(callback: (progress: number, message: string) => void): void {
    this.webllmProgressListeners.add(callback);
  }

  // Remove WebLLM progress listener
  removeWebLLMProgressListener(callback: (progress: number, message: string) => void): void {
    this.webllmProgressListeners.delete(callback);
  }

  // Legacy method for backward compatibility
  setWebLLMProgressCallback(callback: (progress: number, message: string) => void): void {
    // Clear previous listeners and add new one for backward compatibility
    this.webllmProgressListeners.clear();
    this.webllmProgressListeners.add(callback);
  }

  // Notify all progress listeners
  private notifyProgressListeners(progress: number, message: string): void {
    this.webllmProgressListeners.forEach(listener => {
      try {
        listener(progress, message);
      } catch (error) {
        console.error('Error in progress listener:', error);
      }
    });
  }


  private async logUsage(
    providerId: string,
    request: LLMRequest,
    response: LLMResponse | null,
    success: boolean
  ): Promise<void> {
    // Log usage for analytics and billing
    const _usage = {
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

  // Initialize WebLLM model immediately (triggers download)
  async initializeWebLLMModel(modelId: string): Promise<void> {
    // Initializing WebLLM model
    
    // Get or create WebLLM config
    let config = await this.getProviderConfig('webllm');
    
    if (!config) {
      // Create default WebLLM config
      config = {
        id: 'webllm',
        name: 'WebLLM',
        type: 'local',
        enabled: true,
        priority: 100,
        model: modelId,
        createdAt: Date.now()
      };
      await secureStorage.storeProviderConfig(config);
    } else {
      // Update model in existing config
      config.model = modelId;
      await secureStorage.storeProviderConfig(config);
    }
    
    // Initialize the provider which will trigger the download
    await this.initializeProvider(config);
    
    // Get the provider and trigger initialization
    const provider = this.providers.get('webllm');
    if (provider && 'initialize' in provider) {
      // Triggering WebLLM initialization/download
      await (provider as any).initialize();
    }
  }
}

// Global provider manager instance
export const providerManager = new ProviderManager();