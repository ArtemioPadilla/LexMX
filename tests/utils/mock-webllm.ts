import { Page } from '@playwright/test';

/**
 * Mock WebLLM implementation for fast E2E testing
 * Simulates WebLLM functionality without downloading actual models
 */

const mockWebLLMImplementation = `
export const CreateMLCEngine = async (modelId, config) => {
  // Simulate quick initialization without model download
  if (config?.initProgressCallback) {
    // Simulate fast progress
    setTimeout(() => config.initProgressCallback({ progress: 0.5, text: 'Mock: Loading model...' }), 10);
    setTimeout(() => config.initProgressCallback({ progress: 1.0, text: 'Mock: Model ready!' }), 20);
  }
  
  return {
    chat: {
      completions: {
        create: async (params) => {
          // Simulate processing delay
          await new Promise(resolve => setTimeout(resolve, 100));
          
          if (params.stream) {
            // Return async generator for streaming
            return (async function* () {
              const response = getMockResponse(params.messages);
              const chunks = response.split(' ');
              for (const chunk of chunks) {
                yield {
                  choices: [{
                    delta: { content: chunk + ' ' }
                  }]
                };
              }
            })();
          }
          
          return {
            choices: [{
              message: {
                content: getMockResponse(params.messages)
              },
              finish_reason: 'stop'
            }],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 20,
              total_tokens: 30
            }
          };
        }
      }
    },
    
    // Add model info
    model: modelId,
    
    // Add cleanup method
    unload: async () => {
      console.log('[MockWebLLM] Model unloaded');
    }
  };
};

// Helper to generate contextual mock responses
function getMockResponse(messages) {
  const lastMessage = messages[messages.length - 1]?.content || '';
  
  // Legal context responses
  if (lastMessage.toLowerCase().includes('amparo')) {
    return 'Para presentar un amparo directo se requiere: 1) Sentencia definitiva, 2) Agotamiento de recursos ordinarios, 3) Plazo de 15 días hábiles según el artículo 17 de la Ley de Amparo.';
  }
  
  if (lastMessage.toLowerCase().includes('laboral') || lastMessage.toLowerCase().includes('trabajo')) {
    return 'De acuerdo con la Ley Federal del Trabajo, el trabajador tiene derecho a: vacaciones, aguinaldo, prima vacacional y demás prestaciones establecidas en el artículo 87 de la LFT.';
  }
  
  if (lastMessage.toLowerCase().includes('divorcio')) {
    return 'El divorcio en México puede ser voluntario o necesario. El divorcio voluntario procede cuando ambos cónyuges están de acuerdo, según el artículo 266 del Código Civil Federal.';
  }
  
  // Default response
  return 'De acuerdo con la legislación mexicana aplicable, ' + lastMessage + '. Es importante consultar con un abogado para casos específicos.';
}

export const MLCEngine = {};
export const prebuiltAppConfig = {
  model_list: [
    {
      model_id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
      model_display_name: 'Llama 3.2 3B (Mock)',
      model_size: '1.5GB',
      model_type: 'chat'
    },
    {
      model_id: 'Phi-3.5-mini-instruct-q4f16_1-MLC', 
      model_display_name: 'Phi 3.5 Mini (Mock)',
      model_size: '1.2GB',
      model_type: 'chat'
    }
  ]
};
`;

const mockGPUImplementation = `{
  requestAdapter: async () => ({
    requestDevice: async () => ({
      features: new Set(['shader-f16']),
      limits: {
        maxBufferSize: 1073741824,
        maxStorageBufferBindingSize: 1073741824,
        maxComputeWorkgroupStorageSize: 16384
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
}`;

/**
 * Setup mock WebLLM for testing
 */
export async function mockWebLLM(page: Page): Promise<void> {
  // Intercept WebLLM module requests
  await page.route('**/@mlc-ai/web-llm**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: mockWebLLMImplementation
    });
  });
  
  // Also intercept potential CDN requests
  await page.route('**/dist/mlc-llm*.wasm', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/wasm',
      body: Buffer.from([0x00, 0x61, 0x73, 0x6d]) // Minimal WASM header
    });
  });
  
  // Mock model downloads
  await page.route('**/model/**/*.bin', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/octet-stream',
      body: Buffer.from('mock-model-data')
    });
  });
  
  // Mock WebGPU if not available
  await page.addInitScript(({ gpu }) => {
    if (!navigator.gpu) {
      (navigator as any).gpu = eval(gpu);
    }
    
    // Add flag to indicate mock mode
    (window as any).__WEBLLM_MOCK_MODE = true;
  }, { gpu: mockGPUImplementation });
}

/**
 * Setup mock WebLLM provider configuration
 */
export async function setupMockWebLLMProvider(page: Page): Promise<void> {
  // First mock the WebLLM module
  await mockWebLLM(page);
  
  // Then setup provider configuration
  await page.evaluate(() => {
    const config = {
      id: 'webllm',
      name: 'WebLLM (Mock)',
      type: 'local',
      enabled: true,
      apiKey: '',
      baseUrl: '',
      model: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
      models: ['Llama-3.2-3B-Instruct-q4f16_1-MLC', 'Phi-3.5-mini-instruct-q4f16_1-MLC'],
      isConfigured: true,
      status: 'connected',
      isLocalProvider: true,
      mockMode: true,
      priority: 1
    };
    
    // Set in multiple storage locations for compatibility
    localStorage.setItem('provider_webllm', JSON.stringify(config));
    localStorage.setItem('selectedProvider', 'webllm');
    localStorage.setItem('lexmx_providers', JSON.stringify([config]));
    
    // Also set in session storage
    sessionStorage.setItem('webllm_initialized', 'true');
    
    console.log('[MockWebLLM] Provider configured in mock mode');
  });
}

/**
 * Check if WebLLM is in mock mode
 */
export async function isWebLLMMockMode(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    return !!(window as any).__WEBLLM_MOCK_MODE;
  });
}

/**
 * Simulate WebLLM model download progress
 */
export async function simulateModelDownload(
  page: Page,
  duration: number = 1000
): Promise<void> {
  await page.evaluate((dur) => {
    const steps = 10;
    const interval = dur / steps;
    let progress = 0;
    
    const timer = setInterval(() => {
      progress += 10;
      
      // Dispatch custom event for progress
      window.dispatchEvent(new CustomEvent('webllm:progress', {
        detail: {
          progress: progress / 100,
          text: `Downloading model... ${progress}%`
        }
      }));
      
      if (progress >= 100) {
        clearInterval(timer);
        window.dispatchEvent(new CustomEvent('webllm:ready', {
          detail: { model: 'Llama-3.2-3B-Instruct-q4f16_1-MLC' }
        }));
      }
    }, interval);
  }, duration);
}