import { useState, useEffect } from 'react';
import { useTranslation } from '../i18n';
import { providerManager } from '../lib/llm/provider-manager';
import { SUPPORTED_PROVIDERS } from '../lib/llm/provider-registry';
import WebLLMProgress from './WebLLMProgress';
import WebLLMModelGrid from './providers/WebLLMModelGrid';
import ProviderModelGrid from './providers/ProviderModelGrid';
import TestConnectionStatus from './providers/TestConnectionStatus';
import ProviderConfigForm from './providers/ProviderConfigForm';
import type { ProviderConfig, LLMModel } from '../types/llm';
// Import provider classes to get their models
import { OpenAIProvider } from '../lib/llm/providers/openai-provider';
import { ClaudeProvider } from '../lib/llm/providers/claude-provider';
import { GeminiProvider } from '../lib/llm/providers/gemini-provider';
import { AzureProvider } from '../lib/llm/providers/azure-provider';
import { VertexProvider } from '../lib/llm/providers/vertex-provider';
import { BedrockProvider } from '../lib/llm/providers/bedrock-provider';

interface ModelSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProvider?: string;
  currentModel?: string;
  onModelSelect: (provider: string, model?: string) => void;
}

interface Model {
  id: string;
  name: string;
  size: string;
  family: string;
  descriptionKey: string;
  recommended?: boolean;
}

export default function ModelSelectorModal({
  isOpen,
  onClose,
  currentProvider = 'webllm',
  currentModel = '',
  onModelSelect
}: ModelSelectorModalProps) {
  const { t } = useTranslation();
  const [selectedProvider, setSelectedProvider] = useState(currentProvider);
  const [selectedModel, setSelectedModel] = useState(currentModel);
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [activeTab, setActiveTab] = useState<'models' | 'config'>('models');
  const [downloadProgress, setDownloadProgress] = useState<{ progress: number; message: string } | null>(null);
  
  // Provider configuration states
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<Record<string, 'untested' | 'testing' | 'success' | 'error'>>({});
  const [selectedProviderModels, setSelectedProviderModels] = useState<Record<string, string>>({});
  
  // Configuration states for WebLLM
  const [temperature, setTemperature] = useState(0.7);
  const [topP, setTopP] = useState(0.9);
  const [maxTokens, setMaxTokens] = useState(4000);
  const [contextWindow, setContextWindow] = useState(4096);
  const [presencePenalty, setPresencePenalty] = useState(0);
  const [frequencyPenalty, setFrequencyPenalty] = useState(0);

  useEffect(() => {
    if (isOpen) {
      loadProviders();
      
      // Add ESC key handler
      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };
      
      document.addEventListener('keydown', handleEsc);
      
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
      
      return () => {
        document.removeEventListener('keydown', handleEsc);
        document.body.style.overflow = '';
      };
    } else {
      // Modal is closing - clear download progress if any
      if (downloadProgress) {
        setDownloadProgress(null);
      }
    }
  }, [isOpen, onClose, downloadProgress]);

  const loadProviders = async () => {
    try {
      await providerManager.initialize();
      const configs = await providerManager.getEnabledProviders();
      setProviders(configs);
    } catch (error) {
      console.error('Error loading providers:', error);
    }
  };

  
  // Get models for a specific provider
  const getProviderModels = (providerId: string): LLMModel[] => {
    // Create a temporary instance to get the models
    const dummyConfig: ProviderConfig = { 
      id: providerId, 
      name: providerId, 
      type: SUPPORTED_PROVIDERS[providerId]?.type || 'cloud',
      enabled: true,
      priority: 1,
      createdAt: Date.now()
    };
    
    switch (providerId) {
      case 'openai':
        return new OpenAIProvider(dummyConfig).models;
      case 'anthropic':
        return new ClaudeProvider(dummyConfig).models;
      case 'google':
        return new GeminiProvider(dummyConfig).models;
      case 'azure':
        return new AzureProvider(dummyConfig).models;
      case 'vertex':
        return new VertexProvider(dummyConfig).models;
      case 'bedrock':
        return new BedrockProvider(dummyConfig).models;
      default:
        return [];
    }
  };
  
  const confirmDownload = async (model: Model) => {
    setDownloadProgress({ progress: 0, message: 'Iniciando descarga...' });
    
    // Update selection to show which model is being downloaded
    setSelectedModel(model.id);
    
    // Create progress listener for this modal
    const progressListener = (progress: number, message: string) => {
      setDownloadProgress({ progress, message });
      
      if (progress === 100) {
        // Download complete - update selection and close modal after short delay
        setTimeout(() => {
          setDownloadProgress(null);
          // Notify parent component that model is ready
          onModelSelect(selectedProvider, model.id);
          // Remove this listener
          providerManager.removeWebLLMProgressListener(progressListener);
          // Close the modal
          onClose();
        }, 2000);
      }
    };
    
    // Register the progress listener
    providerManager.addWebLLMProgressListener(progressListener);
    
    // Trigger WebLLM initialization immediately to start download
    try {
      await providerManager.initializeWebLLMModel(model.id);
    } catch (error) {
      console.error('Failed to initialize WebLLM model:', error);
      setDownloadProgress(null);
      // Remove listener on error
      providerManager.removeWebLLMProgressListener(progressListener);
      // Show error to user - could add error state here
    }
  };

  const handleProviderChange = (providerId: string) => {
    setSelectedProvider(providerId);
    setSelectedModel('');
  };
  
  const testProviderConnection = async (providerId: string) => {
    setTestingConnection(true);
    setConnectionStatus(prev => ({ ...prev, [providerId]: 'testing' }));
    
    try {
      const provider = providerManager.getProvider(providerId);
      if (provider && provider.testConnection) {
        const success = await provider.testConnection();
        setConnectionStatus(prev => ({ ...prev, [providerId]: success ? 'success' : 'error' }));
      } else {
        setConnectionStatus(prev => ({ ...prev, [providerId]: 'error' }));
      }
    } catch (error) {
      console.error(`Failed to test connection for ${providerId}:`, error);
      setConnectionStatus(prev => ({ ...prev, [providerId]: 'error' }));
    } finally {
      setTestingConnection(false);
    }
  };
  
  const saveProviderConfig = async (config: ProviderConfig) => {
    try {
      await providerManager.configureProvider(config);
      
      // Reload providers
      await loadProviders();
      
      // Test connection after saving
      await testProviderConnection(config.id);
    } catch (error) {
      console.error(`Failed to save provider config for ${config.id}:`, error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-fadeIn">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative h-full flex items-center justify-center p-0 md:p-4">
        <div className="relative bg-gray-900 md:rounded-2xl shadow-2xl w-full md:max-w-6xl h-full md:h-[90vh] md:max-h-[800px] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
            <h2 className="text-xl font-semibold text-gray-100">
              {t('provider.selectProvider')}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              aria-label={t('common.close')}
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Mobile Tab Bar */}
          <div className="md:hidden border-b border-gray-800">
            <div className="flex">
              <button
                onClick={() => setActiveTab('models')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'models' 
                    ? 'text-gray-100 border-b-2 border-legal-500' 
                    : 'text-gray-400'
                }`}
              >
                Modelos
              </button>
              {selectedProvider === 'webllm' && (
                <button
                  onClick={() => setActiveTab('config')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'config' 
                      ? 'text-gray-100 border-b-2 border-legal-500' 
                      : 'text-gray-400'
                  }`}
                >
                  Configuración
                </button>
              )}
            </div>
          </div>
          
          {/* Content */}
          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar - Desktop only */}
            <div className="w-64 border-r border-gray-800 p-4 hidden md:block">
              <nav className="space-y-2">
                <button
                  onClick={() => setActiveTab('models')}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center space-x-3 ${
                    activeTab === 'models' 
                      ? 'bg-gray-800 text-gray-100' 
                      : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-100'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                  </svg>
                  <span>{t('providers.webllm.selectModel')}</span>
                </button>
                
                {selectedProvider === 'webllm' && (
                  <button
                    onClick={() => setActiveTab('config')}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center space-x-3 ${
                      activeTab === 'config' 
                        ? 'bg-gray-800 text-gray-100' 
                        : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-100'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>Configuración</span>
                  </button>
                )}
              </nav>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              {activeTab === 'models' ? (
                <div className="space-y-6">
                  {/* Provider Selector */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Tipo de Proveedor
                    </label>
                    <select
                      value={selectedProvider}
                      onChange={(e) => handleProviderChange(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-legal-500"
                    >
                      {/* Show all supported providers */}
                      {Object.values(SUPPORTED_PROVIDERS).map(provider => {
                        // Check if provider is configured
                        const isConfigured = providers.some(p => p.id === provider.id);
                        return (
                          <option key={provider.id} value={provider.id}>
                            {provider.name} {!isConfigured && provider.id !== 'webllm' ? '(No configurado)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* WebLLM Model Grid */}
                  {selectedProvider === 'webllm' && (
                    <div>
                      {/* Download Progress */}
                      {downloadProgress && (
                        <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                          <WebLLMProgress
                            progress={downloadProgress.progress}
                            message={downloadProgress.message}
                            variant="inline"
                          />
                        </div>
                      )}
                      
                      <h3 className="text-lg font-medium text-gray-100 mb-4">
                        Modelos Disponibles
                      </h3>
                      
                      <WebLLMModelGrid
                        selectedModelId={selectedModel}
                        onModelSelect={(modelId) => {
                          // Check if model is cached - if yes, select and close
                          if (providerManager.isWebLLMModelCached(modelId)) {
                            setSelectedModel(modelId);
                            onModelSelect(selectedProvider, modelId);
                            onClose();
                          } else {
                            // Model needs download - just update selection, don't close
                            setSelectedModel(modelId);
                          }
                        }}
                        onDownloadConfirm={confirmDownload}
                        showDataWarning={false}
                      />
                    </div>
                  )}

                  {/* Other Providers */}
                  {selectedProvider !== 'webllm' && (
                    <div>
                      {(() => {
                        const providerMeta = SUPPORTED_PROVIDERS[selectedProvider];
                        const isConfigured = providers.some(p => p.id === selectedProvider);
                        const providerModels = getProviderModels(selectedProvider);
                        
                        if (!isConfigured) {
                          // Show inline configuration using ProviderConfigForm
                          return (
                            <div className="max-w-3xl mx-auto py-8">
                              <div className="text-center mb-6">
                                <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                                  <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                  </svg>
                                </div>
                                <h3 className="text-lg font-medium text-gray-100 mb-2">
                                  Configurar {providerMeta?.name || selectedProvider}
                                </h3>
                                <p className="text-sm text-gray-400 mb-6">
                                  {providerMeta?.description}
                                </p>
                              </div>
                              
                              <ProviderConfigForm
                                provider={providerMeta || { 
                                  id: selectedProvider, 
                                  name: selectedProvider,
                                  type: 'cloud',
                                  icon: '',
                                  description: '',
                                  costLevel: 'medium',
                                  capabilities: [],
                                  setupComplexity: 'medium',
                                  recommendedFor: []
                                }}
                                models={providerModels}
                                onSave={saveProviderConfig}
                                showModelSelection={false}
                                inline={true}
                              />
                              
                              {connectionStatus[selectedProvider] && (
                                <div className={`mt-4 p-3 rounded-lg text-sm ${
                                  connectionStatus[selectedProvider] === 'success' 
                                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                    : connectionStatus[selectedProvider] === 'error'
                                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                    : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                }`}>
                                  {connectionStatus[selectedProvider] === 'testing' && 'Probando conexión...'}
                                  {connectionStatus[selectedProvider] === 'success' && '✓ Conexión exitosa'}
                                  {connectionStatus[selectedProvider] === 'error' && '✗ Error de conexión'}
                                </div>
                              )}
                            </div>
                          );
                        }
                        
                        // Provider is configured - show model selection
                        return (
                          <div>
                            <div className="mb-4 flex items-center justify-between">
                              <h3 className="text-lg font-medium text-gray-100">
                                Modelos de {providerMeta?.name || selectedProvider}
                              </h3>
                              <TestConnectionStatus
                                status={connectionStatus[selectedProvider] || 'untested'}
                                onTest={() => testProviderConnection(selectedProvider)}
                                disabled={testingConnection}
                              />
                            </div>
                            
                            <ProviderModelGrid
                              models={providerModels}
                              selectedModelId={selectedProviderModels[selectedProvider]}
                              onModelSelect={(modelId) => {
                                setSelectedProviderModels(prev => ({ ...prev, [selectedProvider]: modelId }));
                                onModelSelect(selectedProvider, modelId);
                                onClose();
                              }}
                              showCost={true}
                              columns={2}
                            />
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              ) : (
                /* Configuration Tab */
                <div className="space-y-4 md:space-y-6 max-w-2xl mx-auto">
                  <h3 className="text-lg font-medium text-gray-100">
                    Configuración del Modelo
                  </h3>
                  
                  {/* Context Window */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Context Window Length
                    </label>
                    <select
                      value={contextWindow}
                      onChange={(e) => setContextWindow(Number(e.target.value))}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100"
                    >
                      <option value={2048}>2K</option>
                      <option value={4096}>4K</option>
                      <option value={8192}>8K</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      The maximum number of tokens for the context window
                    </p>
                  </div>

                  {/* Temperature */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Temperatura: {temperature.toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={temperature}
                      onChange={(e) => setTemperature(Number(e.target.value))}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Un valor mayor genera una salida más aleatoria
                    </p>
                  </div>

                  {/* Top P */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Top P: {topP.toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={topP}
                      onChange={(e) => setTopP(Number(e.target.value))}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Do not alter this value together with temperature
                    </p>
                  </div>

                  {/* Max Tokens */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Máximo de tokens
                    </label>
                    <input
                      type="number"
                      value={maxTokens}
                      onChange={(e) => setMaxTokens(Number(e.target.value))}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Longitud máxima de tokens de entrada y tokens generados
                    </p>
                  </div>

                  {/* Presence Penalty */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Penalización de presencia: {presencePenalty.toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min="-2"
                      max="2"
                      step="0.01"
                      value={presencePenalty}
                      onChange={(e) => setPresencePenalty(Number(e.target.value))}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Un valor mayor aumenta la probabilidad de hablar sobre nuevos temas
                    </p>
                  </div>

                  {/* Frequency Penalty */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Penalización de frecuencia: {frequencyPenalty.toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min="-2"
                      max="2"
                      step="0.01"
                      value={frequencyPenalty}
                      onChange={(e) => setFrequencyPenalty(Number(e.target.value))}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Un valor mayor disminuye la probabilidad de repetir la misma línea
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
    </div>
  );
}