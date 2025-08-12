// Mock WebLLM implementation for testing
// This provides instant responses without actual model loading

export interface MockWebLLMConfig {
  modelId?: string;
  temperature?: number;
  maxTokens?: number;
}

export class MockMLCEngine {
  private modelId: string;
  private isInitialized: boolean = false;
  
  constructor(modelId: string = 'Llama-3.2-3B-Instruct-q4f16_1-MLC') {
    this.modelId = modelId;
  }
  
  async reload(modelId: string, config?: any): Promise<void> {
    // Simulate instant model loading
    this.modelId = modelId;
    this.isInitialized = true;
    return Promise.resolve();
  }
  
  async chat(messages: any[], config?: any): Promise<{ choices: any[] }> {
    // Return mock response instantly
    return Promise.resolve({
      choices: [{
        message: {
          content: 'Mock WebLLM response for testing purposes.',
          role: 'assistant'
        }
      }]
    });
  }
  
  async generate(prompt: string, config?: any): Promise<string> {
    return Promise.resolve('Mock WebLLM response for testing purposes.');
  }
  
  async unload(): Promise<void> {
    this.isInitialized = false;
    return Promise.resolve();
  }
  
  async resetChat(): Promise<void> {
    return Promise.resolve();
  }
}

export class MockChatModule {
  private engine: MockMLCEngine | null = null;
  
  async reload(modelId: string, config?: any, progressCallback?: (progress: any) => void): Promise<MockMLCEngine> {
    // Simulate progress events
    if (progressCallback) {
      progressCallback({ progress: 0.1, text: 'Initializing mock model...' });
      progressCallback({ progress: 0.5, text: 'Loading mock weights...' });
      progressCallback({ progress: 1.0, text: 'Mock model ready!' });
    }
    
    this.engine = new MockMLCEngine(modelId);
    await this.engine.reload(modelId, config);
    return this.engine;
  }
  
  getEngine(): MockMLCEngine | null {
    return this.engine;
  }
}

export function createMockWebLLM() {
  const mockWebLLM = {
    ChatModule: MockChatModule,
    MLCEngine: MockMLCEngine,
    prebuiltAppConfig: {
      model_list: [
        {
          model_id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
          model_name: 'Llama 3.2 3B',
          model_lib: 'mock-lib',
          vram_required_MB: 2048,
        },
        {
          model_id: 'Gemma-2-2b-it-q4f16_1-MLC',
          model_name: 'Gemma 2 2B',
          model_lib: 'mock-lib',
          vram_required_MB: 1536,
        },
        {
          model_id: 'Phi-3.5-mini-instruct-q4f16_1-MLC',
          model_name: 'Phi 3.5 Mini',
          model_lib: 'mock-lib',
          vram_required_MB: 2048,
        }
      ]
    },
    // Mock initialization status
    isWebGPUAvailable: () => true,
    hasModelInCache: (modelId: string) => false,
    deleteModelFromCache: async (modelId: string) => {},
    // Mock progress callback registry
    progressCallbacks: new Set<(progress: any) => void>(),
    registerProgressCallback: function(callback: (progress: any) => void) {
      this.progressCallbacks.add(callback);
    },
    unregisterProgressCallback: function(callback: (progress: any) => void) {
      this.progressCallbacks.delete(callback);
    }
  };
  
  return mockWebLLM;
}

// Helper to inject mock into page context
export async function injectWebLLMMock(page: any): Promise<void> {
  await page.evaluate(() => {
    // Create mock WebLLM in window context
    (window as any).webllm = {
      ChatModule: class {
        private engine: any = null;
        
        async reload(modelId: string, config?: any, progressCallback?: any): Promise<any> {
          if (progressCallback) {
            progressCallback({ progress: 0.1, text: 'Initializing...' });
            progressCallback({ progress: 1.0, text: 'Ready!' });
          }
          
          this.engine = {
            chat: async (messages: any[]) => ({
              choices: [{
                message: {
                  content: 'Mock response',
                  role: 'assistant'
                }
              }]
            }),
            generate: async (prompt: string) => 'Mock response',
            resetChat: async () => {},
            unload: async () => {}
          };
          
          return this.engine;
        }
        
        getEngine() {
          return this.engine;
        }
      },
      
      MLCEngine: class {
        async reload() { return this; }
        async chat() { return { choices: [{ message: { content: 'Mock', role: 'assistant' } }] }; }
        async generate() { return 'Mock'; }
        async resetChat() {}
        async unload() {}
      },
      
      prebuiltAppConfig: {
        model_list: [
          {
            model_id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
            model_name: 'Llama 3.2 3B',
            vram_required_MB: 2048,
          }
        ]
      },
      
      isWebGPUAvailable: () => true,
      hasModelInCache: () => false,
      deleteModelFromCache: async () => {}
    };
    
    // Also set a flag to indicate mock is loaded
    (window as any).__webllmMockLoaded = true;
  });
}