import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EnvConfig } from '../env-config';

describe('EnvConfig', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let originalWindow: any;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    originalWindow = global.window;
    
    // Clear environment variables
    Object.keys(process.env).forEach(key => {
      if (key.includes('API_KEY') || key.includes('CLAUDE') || key.includes('OPENAI') || 
          key.includes('GEMINI') || key.includes('BEDROCK') || key.includes('AZURE')) {
        delete process.env[key];
      }
    });

    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn()
    };
    
    global.localStorage = localStorageMock as any;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    global.window = originalWindow;
    vi.clearAllMocks();
  });

  describe('Provider Detection', () => {
    it('should detect OpenAI provider when API key is set', () => {
      process.env.OPENAI_API_KEY = 'sk-test123';
      const config = new EnvConfig();
      
      expect(config.hasOpenAI()).toBe(true);
      expect(config.getOpenAIKey()).toBe('sk-test123');
      expect(config.getAvailableProviders()).toContain('openai');
    });

    it('should detect Claude provider when API key is set', () => {
      process.env.CLAUDE_API_KEY = 'sk-ant-test123';
      const config = new EnvConfig();
      
      expect(config.hasClaude()).toBe(true);
      expect(config.getClaudeKey()).toBe('sk-ant-test123');
      expect(config.getAvailableProviders()).toContain('claude');
    });

    it('should detect Gemini provider when API key is set', () => {
      process.env.GOOGLE_GEMINI_API_KEY = 'AIza-test123';
      const config = new EnvConfig();
      
      expect(config.hasGemini()).toBe(true);
      expect(config.getGeminiKey()).toBe('AIza-test123');
      expect(config.getAvailableProviders()).toContain('gemini');
    });

    it('should detect AWS Bedrock when credentials are set', () => {
      process.env.AWS_ACCESS_KEY_ID = 'AKIA-test123';
      process.env.AWS_SECRET_ACCESS_KEY = 'secret123';
      process.env.AWS_REGION = 'us-east-1';
      
      const config = new EnvConfig();
      
      expect(config.hasAWSBedrock()).toBe(true);
      expect(config.getAWSCredentials()).toEqual({
        accessKeyId: 'AKIA-test123',
        secretAccessKey: 'secret123',
        region: 'us-east-1'
      });
      expect(config.getAvailableProviders()).toContain('bedrock');
    });

    it('should detect multiple providers when multiple keys are set', () => {
      process.env.OPENAI_API_KEY = 'sk-test123';
      process.env.CLAUDE_API_KEY = 'sk-ant-test123';
      process.env.GOOGLE_GEMINI_API_KEY = 'AIza-test123';
      
      const config = new EnvConfig();
      const providers = config.getAvailableProviders();
      
      expect(providers).toContain('openai');
      expect(providers).toContain('claude');
      expect(providers).toContain('gemini');
      expect(providers.length).toBeGreaterThanOrEqual(3);
    });

    it('should return empty array when no providers are configured', () => {
      const config = new EnvConfig();
      
      expect(config.getAvailableProviders()).toEqual([]);
      expect(config.hasAnyProvider()).toBe(false);
    });
  });

  describe('Provider Priority', () => {
    it('should return providers in priority order', () => {
      process.env.OPENAI_API_KEY = 'sk-test123';
      process.env.CLAUDE_API_KEY = 'sk-ant-test123';
      process.env.GOOGLE_GEMINI_API_KEY = 'AIza-test123';
      
      const config = new EnvConfig();
      const prioritized = config.getProvidersByPriority();
      
      // Claude should be first (best for legal)
      expect(prioritized[0]).toBe('claude');
      expect(prioritized).toContain('openai');
      expect(prioritized).toContain('gemini');
    });

    it('should respect custom priority configuration', () => {
      process.env.LLM_PROVIDER_PRIORITY = 'openai,gemini,claude';
      process.env.OPENAI_API_KEY = 'sk-test123';
      process.env.CLAUDE_API_KEY = 'sk-ant-test123';
      process.env.GOOGLE_GEMINI_API_KEY = 'AIza-test123';
      
      const config = new EnvConfig();
      const prioritized = config.getProvidersByPriority();
      
      expect(prioritized[0]).toBe('openai');
      expect(prioritized[1]).toBe('gemini');
      expect(prioritized[2]).toBe('claude');
    });

    it('should handle partial priority configuration', () => {
      process.env.LLM_PROVIDER_PRIORITY = 'gemini';
      process.env.OPENAI_API_KEY = 'sk-test123';
      process.env.CLAUDE_API_KEY = 'sk-ant-test123';
      process.env.GOOGLE_GEMINI_API_KEY = 'AIza-test123';
      
      const config = new EnvConfig();
      const prioritized = config.getProvidersByPriority();
      
      expect(prioritized[0]).toBe('gemini');
      expect(prioritized).toContain('claude');
      expect(prioritized).toContain('openai');
    });
  });

  describe('Fallback Mechanisms', () => {
    it('should use localStorage fallback when environment variables are not set', () => {
      localStorage.getItem = vi.fn((key) => {
        if (key === 'lexmx_openai_key') return 'sk-localstorage123';
        return null;
      });
      
      const config = new EnvConfig();
      
      expect(config.hasOpenAI()).toBe(true);
      expect(config.getOpenAIKey()).toBe('sk-localstorage123');
    });

    it('should prefer environment variables over localStorage', () => {
      process.env.OPENAI_API_KEY = 'sk-env123';
      localStorage.getItem = vi.fn(() => 'sk-localstorage123');
      
      const config = new EnvConfig();
      
      expect(config.getOpenAIKey()).toBe('sk-env123');
    });

    it('should detect browser environment correctly', () => {
      // Simulate browser environment
      global.window = { location: { href: 'http://localhost:3000' } };
      
      const config = new EnvConfig();
      
      expect(config.isBrowser()).toBe(true);
      expect(config.isNode()).toBe(false);
    });

    it('should detect Node environment correctly', () => {
      // Remove window to simulate Node environment
      delete (global as any).window;
      
      const config = new EnvConfig();
      
      expect(config.isBrowser()).toBe(false);
      expect(config.isNode()).toBe(true);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate OpenAI API key format', () => {
      const config = new EnvConfig();
      
      expect(config.isValidOpenAIKey('sk-proj-abcd1234')).toBe(true);
      expect(config.isValidOpenAIKey('sk-1234')).toBe(true);
      expect(config.isValidOpenAIKey('invalid')).toBe(false);
      expect(config.isValidOpenAIKey('')).toBe(false);
    });

    it('should validate Claude API key format', () => {
      const config = new EnvConfig();
      
      expect(config.isValidClaudeKey('sk-ant-api03-1234')).toBe(true);
      expect(config.isValidClaudeKey('sk-ant-1234')).toBe(true);
      expect(config.isValidClaudeKey('invalid')).toBe(false);
      expect(config.isValidClaudeKey('')).toBe(false);
    });

    it('should validate Gemini API key format', () => {
      const config = new EnvConfig();
      
      expect(config.isValidGeminiKey('AIzaSyAbcd1234')).toBe(true);
      expect(config.isValidGeminiKey('AIza1234')).toBe(true);
      expect(config.isValidGeminiKey('invalid')).toBe(false);
      expect(config.isValidGeminiKey('')).toBe(false);
    });

    it('should validate AWS credentials completeness', () => {
      const config = new EnvConfig();
      
      process.env.AWS_ACCESS_KEY_ID = 'AKIA-test123';
      expect(config.hasAWSBedrock()).toBe(false); // Missing secret key
      
      process.env.AWS_SECRET_ACCESS_KEY = 'secret123';
      expect(config.hasAWSBedrock()).toBe(true); // Region is optional (has default)
      
      process.env.AWS_REGION = 'us-west-2';
      expect(config.hasAWSBedrock()).toBe(true);
    });
  });

  describe('Environment-specific Features', () => {
    it('should return appropriate base URL for API calls', () => {
      const config = new EnvConfig();
      
      // In test environment
      expect(config.getAPIBaseURL()).toMatch(/http/);
      
      // With custom base URL
      process.env.API_BASE_URL = 'https://api.example.com';
      expect(config.getAPIBaseURL()).toBe('https://api.example.com');
    });

    it('should detect development environment', () => {
      process.env.NODE_ENV = 'development';
      const config = new EnvConfig();
      
      expect(config.isDevelopment()).toBe(true);
      expect(config.isProduction()).toBe(false);
    });

    it('should detect production environment', () => {
      process.env.NODE_ENV = 'production';
      const config = new EnvConfig();
      
      expect(config.isDevelopment()).toBe(false);
      expect(config.isProduction()).toBe(true);
    });

    it('should provide debug mode status', () => {
      const config = new EnvConfig();
      
      expect(config.isDebugMode()).toBe(false);
      
      process.env.DEBUG = 'true';
      expect(config.isDebugMode()).toBe(true);
      
      process.env.DEBUG = '1';
      expect(config.isDebugMode()).toBe(true);
    });
  });

  describe('Security Features', () => {
    it('should not expose sensitive keys in logs', () => {
      process.env.OPENAI_API_KEY = 'sk-secret123456789';
      const config = new EnvConfig();
      
      const masked = config.getMaskedKey('openai');
      expect(masked).toBe('sk-sec...789');
      expect(masked).not.toContain('secret123456');
    });

    it('should clear all API keys when requested', () => {
      process.env.OPENAI_API_KEY = 'sk-test123';
      process.env.CLAUDE_API_KEY = 'sk-ant-test123';
      
      const config = new EnvConfig();
      config.clearAllKeys();
      
      expect(config.hasOpenAI()).toBe(false);
      expect(config.hasClaude()).toBe(false);
      expect(config.getAvailableProviders()).toEqual([]);
    });

    it('should validate key ownership before operations', () => {
      const config = new EnvConfig();
      
      // Should not throw for valid operations
      expect(() => config.validateKeyOwnership('openai')).not.toThrow();
      
      // Should handle invalid provider gracefully
      expect(() => config.validateKeyOwnership('invalid')).not.toThrow();
    });
  });

  describe('Cost Optimization', () => {
    it('should suggest cheapest provider for given task', () => {
      process.env.OPENAI_API_KEY = 'sk-test123';
      process.env.CLAUDE_API_KEY = 'sk-ant-test123';
      process.env.GOOGLE_GEMINI_API_KEY = 'AIza-test123';
      
      const config = new EnvConfig();
      
      // For simple queries, Gemini might be cheapest
      expect(config.getCheapestProvider('simple')).toBe('gemini');
      
      // For complex legal queries, Claude might be best value
      expect(config.getCheapestProvider('complex-legal')).toBe('claude');
    });

    it('should estimate costs for different providers', () => {
      const config = new EnvConfig();
      
      const openaiCost = config.estimateCost('openai', 1000, 500);
      const claudeCost = config.estimateCost('claude', 1000, 500);
      const geminiCost = config.estimateCost('gemini', 1000, 500);
      
      expect(openaiCost).toBeGreaterThan(0);
      expect(claudeCost).toBeGreaterThan(0);
      expect(geminiCost).toBeGreaterThan(0);
      
      // Costs should be different for different providers
      expect(openaiCost).not.toBe(claudeCost);
      expect(claudeCost).not.toBe(geminiCost);
    });
  });
});