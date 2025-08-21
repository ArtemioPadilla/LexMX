// Provider setup wizard component

import { useState, useEffect } from 'react';
import type { ProviderConfig, CostLevel, LLMModel } from '../types/llm';
import { providerRegistry } from '../lib/llm/provider-registry';
import type { ProviderMetadata, UserProfile } from '../lib/llm/provider-registry';
import { secureStorage } from '../lib/security/secure-storage';
import { providerManager } from '../lib/llm/provider-manager';
import WebLLMModelGrid from '../components/providers/WebLLMModelGrid';
import ProviderModelGrid from '../components/providers/ProviderModelGrid';
import TestConnectionStatus from '../components/providers/TestConnectionStatus';
import ProviderConfigForm from '../components/providers/ProviderConfigForm';
import { TEST_IDS } from '../utils/test-ids';
import { HydrationBoundary as _HydrationBoundary, LoadingStates as _LoadingStates } from '../components/HydrationBoundary';
import { useTranslation } from '../i18n/index';
import { getUrl } from '../utils/urls';
// Import provider classes to get their models
import { OpenAIProvider } from '../lib/llm/providers/openai-provider';
import { ClaudeProvider } from '../lib/llm/providers/claude-provider';
import { GeminiProvider } from '../lib/llm/providers/gemini-provider';
import { BedrockProvider } from '../lib/llm/providers/bedrock-provider';

interface ProviderSetupProps {
  onComplete?: (configs: ProviderConfig[]) => void;
}

type SetupStep = 'welcome' | 'profile' | 'providers' | 'configure' | 'test' | 'complete';

export default function ProviderSetup({ onComplete }: ProviderSetupProps) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [step, setStep] = useState<SetupStep>('welcome');
  const [_selectedProfile, _setSelectedProfile] = useState<UserProfile | null>(null);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [providerConfigs, setProviderConfigs] = useState<Map<string, ProviderConfig>>(new Map());
  const [currentProvider, setCurrentProvider] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [webllmProgress, setWebllmProgress] = useState<{ progress: number; message: string } | null>(null);
  const [_isPreloading, _setIsPreloading] = useState(false);
  const [_preloadProgress, _setPreloadProgress] = useState<{ progress: number; message: string } | null>(null);
  const [showPreloadConfirm, setShowPreloadConfirm] = useState(false);
  const [_connectionStatus, _setConnectionStatus] = useState<Record<string, 'untested' | 'testing' | 'success' | 'error'>>({});
  const [_testingConnection, _setTestingConnection] = useState(false);
  const { t } = useTranslation();

  // Handle hydration
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const supportedProviders = providerRegistry.getSupportedProviders();
  const userProfiles = providerRegistry.getRecommendedProfiles();
  
  // Get models for a specific provider
  const getProviderModels = (providerId: string): LLMModel[] => {
    const dummyConfig: ProviderConfig = { 
      id: providerId, 
      name: providerId, 
      type: providerId === 'webllm' || providerId === 'ollama' || providerId === 'openai-compatible' ? 'local' : 'cloud',
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
      case 'bedrock':
        return new BedrockProvider(dummyConfig).models;
      default:
        return [];
    }
  };

  const handleProfileSelect = (profile: UserProfile) => {
    setSelectedProfile(profile);
    setSelectedProviders(profile.providers);
    setStep('providers');
  };

  const handleProviderToggle = (providerId: string) => {
    setSelectedProviders(prev => 
      prev.includes(providerId) 
        ? prev.filter(id => id !== providerId)
        : [...prev, providerId]
    );
  };

  const _handleConfigureProvider = (providerId: string) => {
    setCurrentProvider(providerId);
    setStep('configure');
  };

  const handleProviderConfigSave = async (config: ProviderConfig) => {
    try {
      setIsLoading(true);
      
      // Validate and save configuration
      const validation = providerRegistry.validateConfig(config);
      if (!validation.valid) {
        throw new Error(validation.errors.join(', '));
      }

      await secureStorage.storeProviderConfig(config);
      
      // For WebLLM, set up progress callback before initialization
      if (config.id === 'webllm') {
        providerManager.setWebLLMProgressCallback((progress, message) => {
          console.warn(`[WebLLM] ${message}`);
          setWebllmProgress({ progress, message });
        });
      }
      
      // Initialize provider manager to load the new config
      await providerManager.initialize();
      
      setProviderConfigs(prev => new Map(prev).set(config.id, config));
      
      // Move to next unconfigured provider or test step
      const nextProvider = selectedProviders.find(id => 
        !providerConfigs.has(id) && id !== config.id
      );
      
      if (nextProvider) {
        setCurrentProvider(nextProvider);
      } else {
        setStep('test');
      }
      
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Configuration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const _testProviderConnection = async (providerId: string) => {
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

  const handlePreloadWebLLM = async () => {
    // Close confirmation dialog
    setShowPreloadConfirm(false);
    
    try {
      setIsPreloading(true);
      setPreloadProgress({ progress: 0, message: t('setup.wizard.webllm.downloading') });
      
      // Create a temporary WebLLM provider to trigger download
      const webllmConfig = providerConfigs.get('webllm') || {
        id: 'webllm',
        name: 'WebLLM',
        type: 'local' as const,
        enabled: true,
        model: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
        initProgressCallback: (progress: number, message: string) => {
          setPreloadProgress({ progress, message });
        }
      };
      
      // Import and initialize WebLLM
      const { WebLLMProvider } = await import('../lib/llm/providers/webllm-provider');
      const provider = new WebLLMProvider(webllmConfig);
      await provider.initialize();
      
      setPreloadProgress({ progress: 100, message: t('setup.wizard.webllm.downloadSuccess') });
      setTimeout(() => {
        setPreloadProgress(null);
        setIsPreloading(false);
      }, 2000);
      
    } catch (error) {
      console.error('Error preloading WebLLM:', error);
      setError(t('setup.wizard.webllm.downloadError'));
      setIsPreloading(false);
      setPreloadProgress(null);
    }
  };

  const _handleTestProviders = async () => {
    setIsLoading(true);
    setStep('test');
    
    // Test all configured providers
    // Implementation would test connections here
    
    setTimeout(() => {
      setIsLoading(false);
      setStep('complete');
      onComplete?.(Array.from(providerConfigs.values()));
    }, 2000);
  };

  const renderWelcome = () => (
    <div className="text-center space-y-6">
      <div className="mx-auto w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      </div>
      
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          {t('setup.wizard.welcome.title')}
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          {t('setup.wizard.welcome.subtitle')}
        </p>
      </div>

      <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
        <div className="flex items-start">
          <span className="text-2xl mr-3">🚀</span>
          <div className="text-left">
            <p className="font-medium text-purple-900 dark:text-purple-200 mb-2">{t('setup.wizard.webllm.title')}</p>
            <ul className="text-sm text-purple-700 dark:text-purple-300 space-y-1">
              <li>✓ {t('setup.wizard.webllm.features.noConfig')}</li>
              <li>✓ {t('setup.wizard.webllm.features.private')}</li>
              <li>✓ {t('setup.wizard.webllm.features.free')}</li>
              <li>✓ {t('setup.wizard.webllm.features.offline')}</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="flex flex-col space-y-3">
        <button
          data-testid="setup-webllm"
          onClick={() => {
            // Skip to WebLLM configuration
            setSelectedProviders(['webllm']);
            setCurrentProvider('webllm');
            setStep('configure');
          }}
          className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-lg font-medium hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg"
          data-testid={TEST_IDS.provider.webllmButton}
        >
          {t('setup.wizard.welcome.useWebLLM')}
        </button>
        <button
          data-testid="setup-begin"
          onClick={() => setStep('profile')}
          className="w-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-6 py-3 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          {t('setup.wizard.welcome.startConfig')}
        </button>
      </div>
    </div>
  );

  const renderProfileSelection = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          {t('setup.wizard.profile.title')}
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          {t('setup.wizard.profile.subtitle')}
        </p>
      </div>

      <div className="grid gap-4">
        {userProfiles.map((profile) => (
          <div
            key={profile.id}
            data-testid={`profile-${profile.id}`}
            onClick={() => handleProfileSelect(profile)}
            className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 cursor-pointer hover:border-legal-300 dark:hover:border-legal-600 hover:bg-legal-50 dark:hover:bg-gray-800 transition-all bg-white dark:bg-gray-900"
          >
            <div className="flex items-start space-x-3">
              <div className="text-2xl">{profile.icon}</div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">{profile.name}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{profile.description}</p>
                
                <div className="flex flex-wrap gap-2">
                  {profile.providers.map(providerId => {
                    const metadata = providerRegistry.getProviderMetadata(providerId);
                    return metadata ? (
                      <span
                        key={providerId}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                      >
                        {metadata.name}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        data-testid="setup-custom"
        onClick={() => setStep('providers')}
        className="w-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-6 py-3 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors bg-white dark:bg-gray-900"
      >
        {t('setup.wizard.profile.customConfig')}
      </button>
    </div>
  );

  const renderProviderSelection = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          {t('setup.wizard.providers.title')}
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          {t('setup.wizard.providers.subtitle')}
        </p>
      </div>

      <div className="grid gap-4">
        {supportedProviders.map((provider) => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            selected={selectedProviders.includes(provider.id)}
            onToggle={() => handleProviderToggle(provider.id)}
          />
        ))}
      </div>

      <div className="flex space-x-4">
        <button
          onClick={() => setStep('profile')}
          className="flex-1 border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
        >
          {t('common.back')}
        </button>
        <button
          onClick={() => {
            if (selectedProviders.length > 0) {
              setCurrentProvider(selectedProviders[0]);
              setStep('configure');
            }
          }}
          disabled={selectedProviders.length === 0}
          className="flex-1 bg-legal-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-legal-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {t('setup.wizard.providers.configure', { count: selectedProviders.length })}
        </button>
      </div>
    </div>
  );

  const renderConfiguration = () => {
    if (!currentProvider) return null;
    
    const metadata = providerRegistry.getProviderMetadata(currentProvider);
    if (!metadata) return null;

    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            {t('setup.wizard.configure.title', { provider: metadata.name })}
          </h2>
          <p className="text-gray-600 dark:text-gray-400">{metadata.description}</p>
        </div>

        <ProviderConfigForm
          provider={metadata}
          models={getProviderModels(metadata.id)}
          onSave={handleProviderConfigSave}
          onCancel={() => setStep('providers')}
          isLoading={isLoading}
          error={error}
          showModelSelection={true}
        />
      </div>
    );
  };

  const renderTest = () => (
    <div className="text-center space-y-6">
      <div className="mx-auto w-16 h-16 bg-yellow-500 dark:bg-yellow-600 rounded-full flex items-center justify-center">
        {isLoading ? (
          <svg className="animate-spin w-8 h-8 text-white" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : (
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      </div>
      
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          {isLoading ? t('setup.wizard.test.testing') : t('setup.wizard.test.success')}
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          {isLoading 
            ? t('setup.wizard.test.verifying')
            : t('setup.wizard.test.ready')
          }
        </p>
      </div>

      {!isLoading && (
        <button
          onClick={() => setStep('complete')}
          className="w-full bg-legal-500 dark:bg-legal-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-legal-600 dark:hover:bg-legal-700 transition-colors"
        >
          {t('setup.wizard.test.finish')}
        </button>
      )}
    </div>
  );

  const renderComplete = () => (
    <div className="text-center space-y-6">
      <div className="mx-auto w-16 h-16 bg-green-500 dark:bg-green-600 rounded-full flex items-center justify-center">
        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          {t('setup.wizard.complete.title')}
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          {t('setup.wizard.complete.subtitle', { count: selectedProviders.length })}
        </p>
      </div>

      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
        <h3 className="font-medium text-green-800 dark:text-green-200 mb-2">{t('setup.wizard.complete.nextSteps')}</h3>
        <ul className="text-sm text-green-700 dark:text-green-300 space-y-1">
          <li>• {t('setup.wizard.complete.steps.firstQuery')}</li>
          <li>• {t('setup.wizard.complete.steps.explore')}</li>
          <li>• {t('setup.wizard.complete.steps.changeProviders')}</li>
        </ul>
      </div>

      <button
        onClick={() => {
          onComplete?.(Array.from(providerConfigs.values()));
          // Navigate to chat after completing setup
          window.location.href = getUrl('chat');
        }}
        className="w-full bg-legal-500 dark:bg-legal-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-legal-600 dark:hover:bg-legal-700 transition-colors"
      >
        {t('setup.wizard.complete.startUsing')}
      </button>
    </div>
  );

  const steps = {
    welcome: renderWelcome,
    profile: renderProfileSelection,
    providers: renderProviderSelection,
    configure: renderConfiguration,
    test: renderTest,
    complete: renderComplete
  };

  // Handle SSR/hydration
  if (!isHydrated) {
    return (
      <_HydrationBoundary 
        fallback={<_LoadingStates.ProviderSetup />} 
        testId={TEST_IDS.provider.container}
      />
    );
  }

  return (
    <div 
      data-testid={TEST_IDS.provider.container}
      className="provider-setup max-w-2xl mx-auto p-6 bg-white dark:bg-gray-900">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex space-x-2">
            {['welcome', 'profile', 'providers', 'configure', 'test', 'complete'].map((stepName, index) => (
              <div
                key={stepName}
                className={`w-3 h-3 rounded-full ${
                  Object.keys(steps).indexOf(step) >= index
                    ? 'bg-legal-500'
                    : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
          <span className="text-sm text-gray-500">
            {Object.keys(steps).indexOf(step) + 1} de {Object.keys(steps).length}
          </span>
        </div>
      </div>

      {steps[step]()}
      
      {/* WebLLM Download Progress Modal */}
      {webllmProgress && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Descargando modelo WebLLM</h3>
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">{webllmProgress.message}</p>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-legal-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${webllmProgress.progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                {webllmProgress.progress}% completado
              </p>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
              Esto puede tomar varios minutos la primera vez...
            </p>
          </div>
        </div>
      )}
      
      {/* Preload Confirmation Dialog */}
      {showPreloadConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              ¿Descargar modelo Llama 3.2 3B?
            </h3>
            
            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-start space-x-2">
                <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    Advertencia de Uso de Datos
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    Se descargará aproximadamente 1.7GB de datos.
                  </p>
                  <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300 mt-1">
                    ⚠️ No recomendado en conexiones móviles. Usa WiFi para evitar cargos excesivos.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setShowPreloadConfirm(false)}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handlePreloadWebLLM}
                className="flex-1 px-4 py-2 bg-legal-500 text-white rounded-lg hover:bg-legal-600 transition-colors"
              >
                Descargar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper components
function ProviderCard({ 
  provider, 
  selected, 
  onToggle 
}: { 
  provider: ProviderMetadata;
  selected: boolean;
  onToggle: () => void;
}) {
  const costColors: Record<CostLevel, string> = {
    free: 'bg-green-100 text-green-800',
    low: 'bg-blue-100 text-blue-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-red-100 text-red-800'
  };

  return (
    <div
      onClick={onToggle}
      className={`border rounded-lg p-4 cursor-pointer transition-all ${
        selected 
          ? 'border-legal-300 dark:border-legal-600 bg-legal-50 dark:bg-legal-900/20' 
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-900'
      }`}
    >
      <div className="flex items-start space-x-3">
        <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
          <img src={provider.icon} alt={provider.name} className="w-6 h-6" />
        </div>
        
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{provider.name}</h3>
            <div className="flex items-center space-x-2">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${costColors[provider.costLevel]}`}>
                {provider.costLevel === 'free' ? 'Gratis' : provider.costLevel}
              </span>
              {selected && (
                <svg className="w-5 h-5 text-legal-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
            </div>
          </div>
          
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{provider.description}</p>
          
          <div className="flex flex-wrap gap-1">
            {provider.capabilities.map((capability: string) => (
              <span
                key={capability}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
              >
                {capability}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// This function is no longer used - replaced by imported ProviderConfigForm component
function _LegacyProviderConfigForm({ 
  provider, 
  onSave, 
  onCancel, 
  isLoading, 
  error,
  isPreloading,
  preloadProgress,
  onPreload,
  connectionStatus,
  onTestConnection
}: {
  provider: ProviderMetadata;
  onSave: (config: ProviderConfig) => void;
  onCancel: () => void;
  isLoading: boolean;
  error: string | null;
  isPreloading?: boolean;
  preloadProgress?: { progress: number; message: string } | null;
  onPreload?: () => void;
  connectionStatus?: 'untested' | 'testing' | 'success' | 'error';
  onTestConnection?: () => void;
}) {
  const [config, setConfig] = useState<Partial<ProviderConfig>>({
    id: provider.id,
    name: provider.name,
    type: provider.type,
    enabled: true,
    priority: 1,
    temperature: 0.1,
    costLimit: { daily: 10, monthly: 200 }
  });
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  
  // Get models for the provider
  const getModels = (): LLMModel[] => {
    const dummyConfig: ProviderConfig = { id: provider.id, name: provider.name, enabled: true };
    
    switch (provider.id) {
      case 'openai':
        return new OpenAIProvider(dummyConfig).models;
      case 'anthropic':
        return new ClaudeProvider(dummyConfig).models;
      case 'google':
        return new GeminiProvider(dummyConfig).models;
      default:
        return [];
    }
  };
  
  const providerModels = getModels();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalConfig = { ...config, model: selectedModelId || config.model };
    onSave(finalConfig as ProviderConfig);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {provider.type === 'cloud' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              API Key *
            </label>
            <input
              type="password"
              required
              placeholder={`Ingresa tu clave API de ${provider.name}`}
              value={config.apiKey || ''}
              onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-legal-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Tu clave se almacena encriptada localmente
            </p>
          </div>
          
          {/* Model Selection for Cloud Providers */}
          {providerModels.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Selecciona un modelo
              </label>
              <ProviderModelGrid
                models={providerModels}
                selectedModelId={selectedModelId}
                onModelSelect={setSelectedModelId}
                showCost={true}
                columns={2}
              />
            </div>
          )}
          
          {/* Test Connection Button */}
          {onTestConnection && config.apiKey && (
            <div>
              <TestConnectionStatus
                status={connectionStatus || 'untested'}
                onTest={onTestConnection}
                disabled={!config.apiKey}
                className="w-full"
              />
            </div>
          )}
        </>
      )}

      {provider.type === 'local' && provider.id === 'webllm' && (
        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
            <h3 className="font-medium text-blue-900 dark:text-blue-200 mb-2">
              🚀 Modelo de IA en tu navegador
            </h3>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              WebLLM ejecuta modelos de IA directamente en tu navegador. No necesitas API key ni servidor.
            </p>
            <ul className="mt-2 text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <li>✓ 100% privado - nada sale de tu dispositivo</li>
              <li>✓ Sin costos - completamente gratis</li>
              <li>✓ Funciona offline una vez descargado</li>
            </ul>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Selecciona un modelo
            </label>
            <WebLLMModelGrid
              selectedModelId={selectedModelId || config.model || 'Llama-3.2-3B-Instruct-q4f16_1-MLC'}
              onModelSelect={(modelId) => {
                setSelectedModelId(modelId);
                setConfig(prev => ({ ...prev, model: modelId }));
              }}
              showDataWarning={true}
            />
          </div>

          {/* Preload Button */}
          {onPreload && (
            <div>
              <button
                type="button"
                onClick={onPreload}
                disabled={isPreloading}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-legal-600 rounded-md hover:bg-legal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-legal-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPreloading ? 'Descargando modelo...' : 'Precargar modelo ahora'}
              </button>
              {preloadProgress && (
                <div className="mt-2">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-legal-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${preloadProgress.progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{preloadProgress.message}</p>
                </div>
              )}
            </div>
          )}

          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md p-3">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Requisitos:</strong> Chrome o Edge actualizado, mínimo 4GB de RAM disponible
            </p>
          </div>
        </div>
      )}

      {provider.type === 'local' && provider.id !== 'webllm' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Endpoint *
          </label>
          <input
            type="url"
            required
            placeholder="http://localhost:11434"
            value={config.endpoint || ''}
            onChange={(e) => setConfig(prev => ({ ...prev, endpoint: e.target.value }))}
            className="w-full px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-legal-500 focus:border-transparent"
          />
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      <div className="flex space-x-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors bg-white dark:bg-gray-900"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 bg-legal-500 dark:bg-legal-600 text-white px-4 py-2 rounded-md hover:bg-legal-600 dark:hover:bg-legal-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 transition-colors"
        >
          {isLoading ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}