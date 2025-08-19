// Environment Configuration Utility
// Manages API keys and provider configuration across browser and Node environments

export class EnvConfig {
  private env: NodeJS.ProcessEnv;
  private isClient: boolean;

  constructor() {
    this.env = typeof process !== 'undefined' ? process.env : {};
    this.isClient = typeof window !== 'undefined';
  }

  // Provider Detection Methods

  hasOpenAI(): boolean {
    return !!this.getOpenAIKey();
  }

  hasClaude(): boolean {
    return !!this.getClaudeKey();
  }

  hasGemini(): boolean {
    return !!this.getGeminiKey();
  }

  hasAWSBedrock(): boolean {
    const creds = this.getAWSCredentials();
    return !!(creds.accessKeyId && creds.secretAccessKey);
  }

  hasAnyProvider(): boolean {
    return this.hasOpenAI() || this.hasClaude() || this.hasGemini() || this.hasAWSBedrock();
  }

  // Key Retrieval Methods

  getOpenAIKey(): string {
    // Check environment variable first
    if (this.env.OPENAI_API_KEY) {
      return this.env.OPENAI_API_KEY;
    }
    
    // Fallback to localStorage in browser
    if (this.isClient && typeof localStorage !== 'undefined') {
      try {
        return localStorage.getItem('lexmx_openai_key') || '';
      } catch {
        return '';
      }
    }
    
    return '';
  }

  getClaudeKey(): string {
    if (this.env.CLAUDE_API_KEY) {
      return this.env.CLAUDE_API_KEY;
    }
    
    if (this.isClient && typeof localStorage !== 'undefined') {
      try {
        return localStorage.getItem('lexmx_claude_key') || '';
      } catch {
        return '';
      }
    }
    
    return '';
  }

  getGeminiKey(): string {
    // Check multiple possible env var names
    const key = this.env.GOOGLE_GEMINI_API_KEY || 
                this.env.GEMINI_API_KEY || 
                this.env.GOOGLE_API_KEY;
    
    if (key) return key;
    
    if (this.isClient && typeof localStorage !== 'undefined') {
      try {
        return localStorage.getItem('lexmx_gemini_key') || '';
      } catch {
        return '';
      }
    }
    
    return '';
  }

  getAWSCredentials(): { accessKeyId: string; secretAccessKey: string; region: string } {
    return {
      accessKeyId: this.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: this.env.AWS_SECRET_ACCESS_KEY || '',
      region: this.env.AWS_REGION || 'us-east-1'
    };
  }

  // Provider List Methods

  getAvailableProviders(): string[] {
    const providers: string[] = [];
    
    if (this.hasOpenAI()) providers.push('openai');
    if (this.hasClaude()) providers.push('claude');
    if (this.hasGemini()) providers.push('gemini');
    if (this.hasAWSBedrock()) providers.push('bedrock');
    
    return providers;
  }

  getProvidersByPriority(): string[] {
    const available = this.getAvailableProviders();
    
    // Check for custom priority
    const customPriority = this.env.LLM_PROVIDER_PRIORITY;
    if (customPriority) {
      const priorityList = customPriority.split(',').map(p => p.trim());
      const prioritized: string[] = [];
      
      // Add providers in custom order
      for (const provider of priorityList) {
        if (available.includes(provider)) {
          prioritized.push(provider);
        }
      }
      
      // Add remaining providers
      for (const provider of available) {
        if (!prioritized.includes(provider)) {
          prioritized.push(provider);
        }
      }
      
      return prioritized;
    }
    
    // Default priority: Claude > OpenAI > Gemini > Bedrock
    const defaultPriority = ['claude', 'openai', 'gemini', 'bedrock'];
    return defaultPriority.filter(p => available.includes(p));
  }

  // Validation Methods

  isValidOpenAIKey(key: string): boolean {
    if (!key) return false;
    return key.startsWith('sk-') && key.length > 10;
  }

  isValidClaudeKey(key: string): boolean {
    if (!key) return false;
    return key.startsWith('sk-ant-') && key.length > 10;
  }

  isValidGeminiKey(key: string): boolean {
    if (!key) return false;
    return (key.startsWith('AIza') || key.startsWith('AIzaSy')) && key.length > 10;
  }

  // Environment Detection

  isBrowser(): boolean {
    return this.isClient;
  }

  isNode(): boolean {
    return !this.isClient;
  }

  isDevelopment(): boolean {
    return this.env.NODE_ENV === 'development';
  }

  isProduction(): boolean {
    return this.env.NODE_ENV === 'production';
  }

  isDebugMode(): boolean {
    return this.env.DEBUG === 'true' || this.env.DEBUG === '1';
  }

  // API Configuration

  getAPIBaseURL(): string {
    if (this.env.API_BASE_URL) {
      return this.env.API_BASE_URL;
    }
    
    // Default based on environment
    if (this.isProduction()) {
      return 'https://api.lexmx.ai';
    }
    
    return 'http://localhost:3000';
  }

  // Security Methods

  getMaskedKey(provider: string): string {
    let key = '';
    
    switch (provider) {
      case 'openai':
        key = this.getOpenAIKey();
        break;
      case 'claude':
        key = this.getClaudeKey();
        break;
      case 'gemini':
        key = this.getGeminiKey();
        break;
      default:
        return '';
    }
    
    if (!key || key.length < 10) return '';
    
    // Show first 6 and last 3 characters
    return `${key.substring(0, 6)}...${key.substring(key.length - 3)}`;
  }

  clearAllKeys(): void {
    // Clear environment variables
    delete this.env.OPENAI_API_KEY;
    delete this.env.CLAUDE_API_KEY;
    delete this.env.GOOGLE_GEMINI_API_KEY;
    delete this.env.GEMINI_API_KEY;
    delete this.env.GOOGLE_API_KEY;
    delete this.env.AWS_ACCESS_KEY_ID;
    delete this.env.AWS_SECRET_ACCESS_KEY;
    
    // Clear localStorage if in browser
    if (this.isClient && typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem('lexmx_openai_key');
        localStorage.removeItem('lexmx_claude_key');
        localStorage.removeItem('lexmx_gemini_key');
      } catch {
        // Ignore errors
      }
    }
  }

  validateKeyOwnership(provider: string): void {
    // This is a placeholder for key ownership validation
    // In a real implementation, this might check against a backend service
    // For now, we just validate that it's a known provider
    const validProviders = ['openai', 'claude', 'gemini', 'bedrock'];
    if (!validProviders.includes(provider)) {
      console.warn(`Unknown provider: ${provider}`);
    }
  }

  // Cost Optimization Methods

  getCheapestProvider(taskType: string): string {
    const available = this.getAvailableProviders();
    if (available.length === 0) return '';
    
    // Simple cost heuristic based on task type
    if (taskType === 'simple' || taskType === 'translation') {
      // Gemini is typically cheapest for simple tasks
      if (available.includes('gemini')) return 'gemini';
      if (available.includes('openai')) return 'openai';
    }
    
    if (taskType === 'complex-legal' || taskType === 'reasoning') {
      // Claude is best value for complex legal reasoning
      if (available.includes('claude')) return 'claude';
      if (available.includes('openai')) return 'openai';
    }
    
    // Default to first available
    return available[0];
  }

  estimateCost(provider: string, inputTokens: number, outputTokens: number): number {
    // Rough cost estimates per 1K tokens (in cents)
    const costPerThousand: Record<string, { input: number; output: number }> = {
      openai: { input: 0.3, output: 0.6 },     // GPT-4 Turbo pricing
      claude: { input: 0.8, output: 2.4 },     // Claude 3 Sonnet pricing
      gemini: { input: 0.125, output: 0.375 }, // Gemini Pro pricing
      bedrock: { input: 0.8, output: 2.4 }     // Varies by model
    };
    
    const costs = costPerThousand[provider];
    if (!costs) return 0;
    
    const inputCost = (inputTokens / 1000) * costs.input;
    const outputCost = (outputTokens / 1000) * costs.output;
    
    return inputCost + outputCost;
  }
}

// Singleton instance
let instance: EnvConfig | null = null;

export function getEnvConfig(): EnvConfig {
  if (!instance) {
    instance = new EnvConfig();
  }
  return instance;
}

// Re-export the existing utility functions for backward compatibility
export function getEnvironmentConfig() {
  const config = getEnvConfig();
  return {
    hasOpenAI: config.hasOpenAI(),
    hasClaude: config.hasClaude(),
    hasGemini: config.hasGemini(),
    hasAWSBedrock: config.hasAWSBedrock(),
    openAIKey: config.getOpenAIKey(),
    claudeKey: config.getClaudeKey(),
    geminiKey: config.getGeminiKey(),
    awsCredentials: config.getAWSCredentials(),
    availableProviders: config.getAvailableProviders(),
    isProduction: config.isProduction(),
    isDevelopment: config.isDevelopment()
  };
}

export function hasValidApiKey(provider: string): boolean {
  const config = getEnvConfig();
  switch (provider) {
    case 'openai':
      return config.hasOpenAI();
    case 'claude':
      return config.hasClaude();
    case 'gemini':
      return config.hasGemini();
    case 'bedrock':
      return config.hasAWSBedrock();
    default:
      return false;
  }
}

export function getApiKey(provider: string): string | undefined {
  const config = getEnvConfig();
  switch (provider) {
    case 'openai':
      return config.getOpenAIKey() || undefined;
    case 'claude':
      return config.getClaudeKey() || undefined;
    case 'gemini':
      return config.getGeminiKey() || undefined;
    default:
      return undefined;
  }
}

/**
 * Check if a provider is enabled (has valid configuration)
 */
export function isProviderEnabled(provider: string): boolean {
  const config = getEnvConfig();
  switch (provider) {
    case 'openai':
      return config.hasOpenAI();
    case 'claude':
      return config.hasClaude();
    case 'gemini':
      return config.hasGemini();
    case 'bedrock':
    case 'aws-bedrock':
      return config.hasAWSBedrock();
    case 'webllm':
      return true; // WebLLM is always available (runs in browser)
    case 'mock':
      return true; // Mock provider is always available
    default:
      return false;
  }
}

/**
 * Create provider configuration from environment
 */
export function createProviderConfigFromEnv(provider: string): any {
  const config = getEnvConfig();
  const apiKey = getApiKey(provider);
  
  return {
    id: provider,
    name: provider.charAt(0).toUpperCase() + provider.slice(1),
    apiKey: apiKey,
    enabled: isProviderEnabled(provider),
    priority: getProviderPriority(provider),
    // Add provider-specific configuration
    ...(provider === 'bedrock' && {
      credentials: config.getAWSCredentials()
    })
  };
}

/**
 * Get provider priority for selection
 */
function getProviderPriority(provider: string): number {
  const priorities: Record<string, number> = {
    'claude': 1,
    'openai': 2,
    'gemini': 3,
    'webllm': 4,
    'bedrock': 5,
    'mock': 99
  };
  return priorities[provider] || 50;
}