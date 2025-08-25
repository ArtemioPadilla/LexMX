import { Page } from '@playwright/test';

/**
 * Universal mock system for ALL providers and external dependencies
 * Ensures zero network delays and instant test execution
 */

export interface MockConfig {
  providers?: boolean;
  network?: boolean;
  webgpu?: boolean;
  storage?: boolean;
  delays?: boolean;
}

/**
 * Mock all external network requests
 */
export async function mockAllNetworkRequests(page: Page): Promise<void> {
  // Intercept and mock all external requests
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    
    // Allow localhost requests (our app)
    if (url.includes('localhost:4321')) {
      return route.continue();
    }
    
    // Mock CDN requests
    if (url.includes('cdn') || url.includes('unpkg') || url.includes('jsdelivr')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: '// Mocked CDN content'
      });
    }
    
    // Mock API requests
    if (url.includes('/api/')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: {} })
      });
    }
    
    // Mock WebLLM model files
    if (url.includes('.wasm') || url.includes('.bin') || url.includes('model')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/octet-stream',
        body: Buffer.from('mock-model-data')
      });
    }
    
    // Mock everything else
    return route.fulfill({
      status: 200,
      body: 'mocked'
    });
  });
}

/**
 * Mock all providers with instant responses
 */
export async function mockAllProviders(page: Page): Promise<void> {
  await page.evaluate(() => {
    // Mock provider configurations
    const mockProviders = {
      webllm: {
        id: 'webllm',
        name: 'WebLLM (Mock)',
        type: 'local',
        enabled: true,
        status: 'connected',
        model: 'mock-model',
        mockMode: true
      },
      ollama: {
        id: 'ollama',
        name: 'Ollama (Mock)',
        type: 'local',
        enabled: true,
        status: 'connected',
        baseUrl: 'http://localhost:11434',
        model: 'llama2',
        mockMode: true
      },
      openai: {
        id: 'openai',
        name: 'OpenAI (Mock)',
        type: 'cloud',
        enabled: true,
        status: 'connected',
        apiKey: 'mock-key',
        model: 'gpt-4',
        mockMode: true
      },
      anthropic: {
        id: 'anthropic',
        name: 'Claude (Mock)',
        type: 'cloud',
        enabled: true,
        status: 'connected',
        apiKey: 'mock-key',
        model: 'claude-3',
        mockMode: true
      },
      gemini: {
        id: 'gemini',
        name: 'Gemini (Mock)',
        type: 'cloud',
        enabled: true,
        status: 'connected',
        apiKey: 'mock-key',
        model: 'gemini-pro',
        mockMode: true
      }
    };
    
    // Store in localStorage with correct lexmx_ prefix
    Object.entries(mockProviders).forEach(([id, config]) => {
      localStorage.setItem(`lexmx_provider_${id}`, JSON.stringify({
        encrypted: false,
        data: config,
        timestamp: Date.now(),
        version: 1
      }));
    });
    
    // Set default provider with correct format
    localStorage.setItem('lexmx_preferred_provider', JSON.stringify({
      encrypted: false,
      data: 'webllm',
      timestamp: Date.now(),
      version: 1
    }));
    
    // Mock provider factory
    (window as any).ProviderFactory = {
      create: (id: string) => ({
        id,
        name: mockProviders[id]?.name || 'Mock Provider',
        chat: async (messages: any[]) => ({
          content: 'Mock response for: ' + messages[messages.length - 1]?.content,
          usage: { tokens: 10 }
        }),
        testConnection: async () => true,
        isAvailable: () => true,
        getModels: async () => ['model-1', 'model-2']
      })
    };
    
    // Flag that we're in mock mode
    (window as any).__MOCK_MODE = true;
  });
}

/**
 * Mock WebGPU for WebLLM tests
 */
export async function mockWebGPU(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (!navigator.gpu) {
      (navigator as any).gpu = {
        requestAdapter: async () => ({
          requestDevice: async () => ({
            features: new Set(['shader-f16']),
            limits: {
              maxBufferSize: 1073741824,
              maxStorageBufferBindingSize: 1073741824
            },
            queue: {
              writeBuffer: () => {},
              submit: () => {},
              onSubmittedWorkDone: () => Promise.resolve()
            },
            createBuffer: () => ({ destroy: () => {} }),
            createBindGroup: () => ({}),
            createBindGroupLayout: () => ({}),
            createComputePipeline: () => ({}),
            createPipelineLayout: () => ({}),
            createShaderModule: () => ({})
          })
        })
      };
    }
  });
}

/**
 * Mock storage with pre-configured data
 */
export async function mockStorage(page: Page): Promise<void> {
  await page.evaluate(() => {
    // Pre-populate with test data
    const testData = {
      'lexmx_theme': 'light',
      'lexmx_language': 'es',
      'lexmx_corpus': JSON.stringify(['cpeum', 'lft']),
      'lexmx_chat_history': JSON.stringify([]),
      'lexmx_cases': JSON.stringify([]),
      'setup_completed': 'true'
    };
    
    Object.entries(testData).forEach(([key, value]) => {
      localStorage.setItem(key, value);
    });
    
    // Set privacy settings to use localStorage (not sessionStorage)
    localStorage.setItem('lexmx_privacy_settings', JSON.stringify({
      encryptTokens: true,
      encryptQueries: false,
      encryptResponses: false,
      clearDataOnExit: false,
      sessionOnly: false, // Use localStorage, not sessionStorage
      analytics: 'none'
    }));
    
    // Mock IndexedDB
    (window as any).indexedDB = {
      open: () => ({
        onsuccess: () => {},
        onerror: () => {},
        result: {
          objectStoreNames: [],
          createObjectStore: () => ({})
        }
      }),
      databases: async () => []
    };
  });
}

/**
 * Remove all artificial delays from the application
 */
export async function removeAllDelays(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // Override setTimeout to execute immediately in test mode
    const originalSetTimeout = window.setTimeout;
    (window as any).setTimeout = (fn: Function, delay?: number) => {
      if (delay && delay > 100) {
        // Execute immediately for long delays
        return originalSetTimeout(fn, 0);
      }
      return originalSetTimeout(fn, delay);
    };
    
    // Mock animations to complete instantly
    if (typeof Element !== 'undefined' && Element.prototype.animate) {
      const originalAnimate = Element.prototype.animate;
      Element.prototype.animate = function(...args) {
        const animation = originalAnimate.apply(this, args);
        animation.finish();
        return animation;
      };
    }
  });
}

/**
 * Setup complete mock environment for fastest possible tests
 */
export async function setupCompleteMockEnvironment(
  page: Page,
  config: MockConfig = {}
): Promise<void> {
  const {
    providers = true,
    network = true,
    webgpu = true,
    storage = true,
    delays = true
  } = config;
  
  // Apply mocks in parallel for speed
  const promises: Promise<void>[] = [];
  
  if (network) promises.push(mockAllNetworkRequests(page));
  if (webgpu) promises.push(mockWebGPU(page));
  if (delays) promises.push(removeAllDelays(page));
  
  await Promise.all(promises);
  
  // These need to run after page navigation
  if (storage) await mockStorage(page);
  if (providers) await mockAllProviders(page);
  
  // Mark page as fully mocked
  await page.evaluate(() => {
    (window as any).__FULL_MOCK_MODE = true;
    console.log('[Mock] Complete mock environment initialized');
  });
}

/**
 * Check if running in mock mode
 */
export async function isMockMode(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    return !!(window as any).__MOCK_MODE || !!(window as any).__FULL_MOCK_MODE;
  });
}

/**
 * Quick setup for specific provider
 * Fixed to match secureStorage key format expected by providerManager
 */
export async function quickSetupProvider(
  page: Page,
  providerId: string = 'webllm'
): Promise<void> {
  await page.evaluate((id) => {
    const config = {
      id,
      name: `${id} (Quick Mock)`,
      type: id === 'webllm' || id === 'ollama' ? 'local' : 'cloud',
      enabled: true,
      status: 'connected',
      model: 'mock-model',
      isConfigured: true,
      mockMode: true,
      priority: 100, // High priority for WebLLM
      createdAt: Date.now(),
      apiKey: id !== 'webllm' && id !== 'ollama' ? 'mock-api-key' : undefined
    };
    
    // Store with correct lexmx_ prefix that secureStorage expects
    localStorage.setItem(`lexmx_provider_${id}`, JSON.stringify({
      encrypted: false,
      data: config,
      timestamp: Date.now(),
      version: 1
    }));
    
    // Store preferred provider
    localStorage.setItem('lexmx_preferred_provider', JSON.stringify({
      encrypted: false,
      data: id,
      timestamp: Date.now(),
      version: 1
    }));
    
    // Mark setup as completed
    localStorage.setItem('setup_completed', 'true');
    
    // Set privacy settings to use localStorage (not sessionStorage)
    localStorage.setItem('lexmx_privacy_settings', JSON.stringify({
      encryptTokens: true,
      encryptQueries: false,
      encryptResponses: false,
      clearDataOnExit: false,
      sessionOnly: false, // Use localStorage, not sessionStorage
      analytics: 'none'
    }));
  }, providerId);
}