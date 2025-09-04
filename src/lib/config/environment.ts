/**
 * Environment configuration and feature management
 * Provides unified environment detection and feature toggle system
 */

import React from 'react';

export type Environment = 'development' | 'production' | 'test';

export interface EnvironmentConfig {
  // Core environment
  env: Environment;
  isDev: boolean;
  isProd: boolean;
  isTest: boolean;
  
  // URLs and paths
  baseUrl: string;
  apiUrl: string;
  assetUrl: string;
  
  // Features
  features: {
    // Core features
    enableCaching: boolean;
    enableAnalytics: boolean;
    enableErrorReporting: boolean;
    
    // Legal features
    enableRAG: boolean;
    enableEmbeddings: boolean;
    enableQualityTesting: boolean;
    
    // Development features
    enableDevDashboard: boolean;
    enableMockData: boolean;
    enableDebugMode: boolean;
    enablePerformanceMetrics: boolean;
    
    // Experimental features
    enableExperimentalFeatures: boolean;
    enableBetaFeatures: boolean;
  };
  
  // API and service configuration
  services: {
    corsProxy: {
      enabled: boolean;
      url: string;
      timeout: number;
    };
    
    embeddings: {
      provider: 'transformers' | 'openai' | 'local';
      modelName: string;
      batchSize: number;
    };
    
    storage: {
      preferredType: 'indexeddb' | 'localstorage' | 'memory';
      cacheTimeout: number;
      maxStorageSize: number;
    };
    
    llm: {
      defaultProvider: string;
      enableFallback: boolean;
      timeout: number;
    };
  };
  
  // UI configuration
  ui: {
    theme: 'light' | 'dark' | 'auto';
    language: 'es' | 'en';
    enableAnimations: boolean;
    compactMode: boolean;
  };
}

/**
 * Detect current environment
 */
export function detectEnvironment(): Environment {
  // Check for test environment first
  if (typeof window !== 'undefined' && window.location.hostname === 'test.localhost') {
    return 'test';
  }
  
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
    return 'test';
  }
  
  // Check for development environment
  if (import.meta.env.DEV) {
    return 'development';
  }
  
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname.includes('localhost') || hostname.includes('127.0.0.1') || hostname.includes('0.0.0.0')) {
      return 'development';
    }
  }
  
  // Default to production
  return 'production';
}

/**
 * Get base configuration for environment
 */
function getBaseConfig(env: Environment): Partial<EnvironmentConfig> {
  const baseUrl = import.meta.env.BASE_URL || '/';
  
  switch (env) {
    case 'development':
      return {
        env,
        isDev: true,
        isProd: false,
        isTest: false,
        baseUrl,
        apiUrl: `http://localhost:4321${baseUrl}api`,
        assetUrl: `http://localhost:4321${baseUrl}`,
        features: {
          enableCaching: true,
          enableAnalytics: false,
          enableErrorReporting: false,
          enableRAG: true,
          enableEmbeddings: true,
          enableQualityTesting: true,
          enableDevDashboard: true,
          enableMockData: true,
          enableDebugMode: true,
          enablePerformanceMetrics: true,
          enableExperimentalFeatures: true,
          enableBetaFeatures: true,
        },
        services: {
          corsProxy: {
            enabled: true,
            url: 'http://localhost:3001',
            timeout: 30000
          },
          embeddings: {
            provider: 'transformers',
            modelName: 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
            batchSize: 32
          },
          storage: {
            preferredType: 'indexeddb',
            cacheTimeout: 300000, // 5 minutes in dev
            maxStorageSize: 100 * 1024 * 1024 // 100MB
          },
          llm: {
            defaultProvider: 'openai',
            enableFallback: true,
            timeout: 30000
          }
        }
      };
      
    case 'production':
      return {
        env,
        isDev: false,
        isProd: true,
        isTest: false,
        baseUrl,
        apiUrl: `${window?.location?.origin || 'https://artemiopadilla.github.io'}${baseUrl}api`,
        assetUrl: `${window?.location?.origin || 'https://artemiopadilla.github.io'}${baseUrl}`,
        features: {
          enableCaching: true,
          enableAnalytics: true,
          enableErrorReporting: true,
          enableRAG: true,
          enableEmbeddings: true,
          enableQualityTesting: false,
          enableDevDashboard: false,
          enableMockData: false,
          enableDebugMode: false,
          enablePerformanceMetrics: false,
          enableExperimentalFeatures: false,
          enableBetaFeatures: false,
        },
        services: {
          corsProxy: {
            enabled: false,
            url: '',
            timeout: 10000
          },
          embeddings: {
            provider: 'transformers',
            modelName: 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
            batchSize: 16
          },
          storage: {
            preferredType: 'indexeddb',
            cacheTimeout: 3600000, // 1 hour in production
            maxStorageSize: 50 * 1024 * 1024 // 50MB
          },
          llm: {
            defaultProvider: 'claude',
            enableFallback: true,
            timeout: 15000
          }
        }
      };
      
    case 'test':
      return {
        env,
        isDev: false,
        isProd: false,
        isTest: true,
        baseUrl: '/',
        apiUrl: '/api',
        assetUrl: '/',
        features: {
          enableCaching: false,
          enableAnalytics: false,
          enableErrorReporting: false,
          enableRAG: true,
          enableEmbeddings: false, // Use mocks in tests
          enableQualityTesting: true,
          enableDevDashboard: false,
          enableMockData: true,
          enableDebugMode: true,
          enablePerformanceMetrics: false,
          enableExperimentalFeatures: true,
          enableBetaFeatures: true,
        },
        services: {
          corsProxy: {
            enabled: false,
            url: '',
            timeout: 5000
          },
          embeddings: {
            provider: 'local',
            modelName: 'mock-embeddings',
            batchSize: 8
          },
          storage: {
            preferredType: 'memory',
            cacheTimeout: 60000, // 1 minute in tests
            maxStorageSize: 10 * 1024 * 1024 // 10MB
          },
          llm: {
            defaultProvider: 'mock',
            enableFallback: false,
            timeout: 5000
          }
        }
      };
      
    default:
      throw new Error(`Unknown environment: ${env}`);
  }
}

/**
 * Load user preferences from localStorage
 */
function loadUserPreferences(): Partial<EnvironmentConfig> {
  if (typeof window === 'undefined') {
    return {};
  }
  
  try {
    const saved = localStorage.getItem('lexmx_user_preferences');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.warn('Failed to load user preferences:', error);
  }
  
  return {};
}

/**
 * Save user preferences to localStorage
 */
export function saveUserPreferences(preferences: Partial<EnvironmentConfig>): void {
  if (typeof window === 'undefined') {
    return;
  }
  
  try {
    const current = loadUserPreferences();
    const merged = { ...current, ...preferences };
    localStorage.setItem('lexmx_user_preferences', JSON.stringify(merged));
    
    // Trigger update event
    window.dispatchEvent(new CustomEvent('userPreferencesChanged', {
      detail: merged
    }));
  } catch (error) {
    console.warn('Failed to save user preferences:', error);
  }
}

/**
 * Environment configuration singleton
 */
class EnvironmentManager {
  private config: EnvironmentConfig;
  private listeners: Set<(config: EnvironmentConfig) => void> = new Set();
  
  constructor() {
    const env = detectEnvironment();
    const baseConfig = getBaseConfig(env);
    const userPreferences = loadUserPreferences();
    
    // Deep merge configuration
    this.config = this.deepMerge(
      this.getDefaultConfig(),
      baseConfig,
      userPreferences
    ) as EnvironmentConfig;
    
    // Listen for user preference changes
    if (typeof window !== 'undefined') {
      window.addEventListener('userPreferencesChanged', (event: CustomEvent) => {
        this.updateConfig(event.detail);
      });
    }
  }
  
  private getDefaultConfig(): EnvironmentConfig {
    return {
      env: 'production',
      isDev: false,
      isProd: true,
      isTest: false,
      baseUrl: '/',
      apiUrl: '/api',
      assetUrl: '/',
      features: {
        enableCaching: true,
        enableAnalytics: false,
        enableErrorReporting: false,
        enableRAG: true,
        enableEmbeddings: true,
        enableQualityTesting: false,
        enableDevDashboard: false,
        enableMockData: false,
        enableDebugMode: false,
        enablePerformanceMetrics: false,
        enableExperimentalFeatures: false,
        enableBetaFeatures: false,
      },
      services: {
        corsProxy: { enabled: false, url: '', timeout: 10000 },
        embeddings: { provider: 'transformers', modelName: '', batchSize: 16 },
        storage: { preferredType: 'indexeddb', cacheTimeout: 3600000, maxStorageSize: 50 * 1024 * 1024 },
        llm: { defaultProvider: 'claude', enableFallback: true, timeout: 15000 }
      },
      ui: {
        theme: 'auto',
        language: 'es',
        enableAnimations: true,
        compactMode: false
      }
    };
  }
  
  private deepMerge(target: any, ...sources: any[]): any {
    if (!sources.length) return target;
    const source = sources.shift();
    
    if (this.isObject(target) && this.isObject(source)) {
      for (const key in source) {
        if (this.isObject(source[key])) {
          if (!target[key]) Object.assign(target, { [key]: {} });
          this.deepMerge(target[key], source[key]);
        } else {
          Object.assign(target, { [key]: source[key] });
        }
      }
    }
    
    return this.deepMerge(target, ...sources);
  }
  
  private isObject(item: any): boolean {
    return item && typeof item === 'object' && !Array.isArray(item);
  }
  
  private updateConfig(updates: Partial<EnvironmentConfig>): void {
    this.config = this.deepMerge({ ...this.config }, updates);
    this.notifyListeners();
  }
  
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.config);
      } catch (error) {
        console.error('Error in environment config listener:', error);
      }
    });
  }
  
  /**
   * Get current configuration
   */
  getConfig(): EnvironmentConfig {
    return { ...this.config };
  }
  
  /**
   * Check if a feature is enabled
   */
  isFeatureEnabled(feature: keyof EnvironmentConfig['features']): boolean {
    return this.config.features[feature];
  }
  
  /**
   * Toggle a feature
   */
  toggleFeature(feature: keyof EnvironmentConfig['features'], enabled?: boolean): void {
    const newValue = enabled ?? !this.config.features[feature];
    this.updateConfig({
      features: {
        ...this.config.features,
        [feature]: newValue
      }
    });
    
    // Save to user preferences
    saveUserPreferences({
      features: {
        ...this.config.features,
        [feature]: newValue
      }
    });
  }
  
  /**
   * Update UI preferences
   */
  updateUIPreferences(ui: Partial<EnvironmentConfig['ui']>): void {
    this.updateConfig({
      ui: {
        ...this.config.ui,
        ...ui
      }
    });
    
    saveUserPreferences({
      ui: {
        ...this.config.ui,
        ...ui
      }
    });
  }
  
  /**
   * Subscribe to configuration changes
   */
  onChange(listener: (config: EnvironmentConfig) => void): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }
  
  /**
   * Reset to default configuration
   */
  reset(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('lexmx_user_preferences');
    }
    
    const env = detectEnvironment();
    const baseConfig = getBaseConfig(env);
    this.config = this.deepMerge(this.getDefaultConfig(), baseConfig) as EnvironmentConfig;
    this.notifyListeners();
  }
}

// Export singleton instance
export const environmentManager = new EnvironmentManager();

// Export convenience functions
export const config = {
  get: () => environmentManager.getConfig(),
  isFeatureEnabled: (feature: keyof EnvironmentConfig['features']) => 
    environmentManager.isFeatureEnabled(feature),
  toggleFeature: (feature: keyof EnvironmentConfig['features'], enabled?: boolean) => 
    environmentManager.toggleFeature(feature, enabled),
  updateUI: (ui: Partial<EnvironmentConfig['ui']>) => 
    environmentManager.updateUIPreferences(ui),
  onChange: (listener: (config: EnvironmentConfig) => void) => 
    environmentManager.onChange(listener),
  reset: () => environmentManager.reset()
};

// Export React hook for configuration
export function useEnvironmentConfig() {
  const [envConfig, setEnvConfig] = React.useState(() => environmentManager.getConfig());
  
  React.useEffect(() => {
    return environmentManager.onChange(setEnvConfig);
  }, []);
  
  return envConfig;
}

// Export type guards
export const is = {
  development: () => environmentManager.getConfig().isDev,
  production: () => environmentManager.getConfig().isProd,
  test: () => environmentManager.getConfig().isTest
};