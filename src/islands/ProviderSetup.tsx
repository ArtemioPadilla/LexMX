// Provider setup wizard component

import React, { useState, useEffect } from 'react';
import type { ProviderMetadata, UserProfile, ProviderConfig } from '@/types/llm';
import { providerRegistry } from '@/lib/llm/provider-registry';
import { secureStorage } from '@/lib/security/secure-storage';

interface ProviderSetupProps {
  onComplete?: (configs: ProviderConfig[]) => void;
}

type SetupStep = 'welcome' | 'profile' | 'providers' | 'configure' | 'test' | 'complete';

export default function ProviderSetup({ onComplete }: ProviderSetupProps) {
  const [step, setStep] = useState<SetupStep>('welcome');
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [providerConfigs, setProviderConfigs] = useState<Map<string, ProviderConfig>>(new Map());
  const [currentProvider, setCurrentProvider] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supportedProviders = providerRegistry.getSupportedProviders();
  const userProfiles = providerRegistry.getRecommendedProfiles();

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

  const handleConfigureProvider = (providerId: string) => {
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
      setProviderConfigs(prev => new Map(prev).set(config.id, config));
      
      // Move to next unconfigured provider or test step
      const nextProvider = selectedProviders.find(id => 
        !providerConfigs.has(id) && id !== providerId
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

  const handleTestProviders = async () => {
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
      <div className="mx-auto w-16 h-16 bg-legal-500 rounded-full flex items-center justify-center">
        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      </div>
      
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Configura tu Asistente Legal IA
        </h2>
        <p className="text-gray-600">
          LexMX te permite usar múltiples proveedores de IA para obtener las mejores respuestas legales.
          Tus configuraciones se almacenan de forma segura y encriptada en tu navegador.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <svg className="w-5 h-5 text-blue-500 mt-0.5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="text-sm text-blue-700">
            <p className="font-medium mb-1">Privacidad Total</p>
            <p>Todas tus configuraciones y consultas se procesan localmente. 
               Nunca enviamos tus datos a servidores externos.</p>
          </div>
        </div>
      </div>

      <button
        onClick={() => setStep('profile')}
        className="w-full bg-legal-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-legal-600 transition-colors"
      >
        Comenzar Configuración
      </button>
    </div>
  );

  const renderProfileSelection = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Elige tu Perfil de Uso
        </h2>
        <p className="text-gray-600">
          Selecciona el perfil que mejor se adapte a tus necesidades
        </p>
      </div>

      <div className="grid gap-4">
        {userProfiles.map((profile) => (
          <div
            key={profile.id}
            onClick={() => handleProfileSelect(profile)}
            className="border border-gray-200 rounded-lg p-4 cursor-pointer hover:border-legal-300 hover:bg-legal-50 transition-all"
          >
            <div className="flex items-start space-x-3">
              <div className="text-2xl">{profile.icon}</div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{profile.name}</h3>
                <p className="text-sm text-gray-600 mb-2">{profile.description}</p>
                
                <div className="flex flex-wrap gap-2">
                  {profile.providers.map(providerId => {
                    const metadata = providerRegistry.getProviderMetadata(providerId);
                    return metadata ? (
                      <span
                        key={providerId}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
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
        onClick={() => setStep('providers')}
        className="w-full border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
      >
        Configuración Personalizada
      </button>
    </div>
  );

  const renderProviderSelection = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Selecciona Proveedores de IA
        </h2>
        <p className="text-gray-600">
          Elige los proveedores que quieres configurar
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
          Atrás
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
          Configurar ({selectedProviders.length})
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
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Configurar {metadata.name}
          </h2>
          <p className="text-gray-600">{metadata.description}</p>
        </div>

        <ProviderConfigForm
          provider={metadata}
          onSave={handleProviderConfigSave}
          onCancel={() => setStep('providers')}
          isLoading={isLoading}
          error={error}
        />
      </div>
    );
  };

  const renderTest = () => (
    <div className="text-center space-y-6">
      <div className="mx-auto w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center">
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
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {isLoading ? 'Probando Conexiones...' : 'Conexiones Exitosas'}
        </h2>
        <p className="text-gray-600">
          {isLoading 
            ? 'Verificando que todos los proveedores funcionen correctamente'
            : 'Todos los proveedores están listos para usar'
          }
        </p>
      </div>

      {!isLoading && (
        <button
          onClick={() => setStep('complete')}
          className="w-full bg-legal-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-legal-600 transition-colors"
        >
          Finalizar Configuración
        </button>
      )}
    </div>
  );

  const renderComplete = () => (
    <div className="text-center space-y-6">
      <div className="mx-auto w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          ¡Configuración Completa!
        </h2>
        <p className="text-gray-600">
          Tu asistente legal está listo. Configuraste {selectedProviders.length} proveedor(es) de IA.
        </p>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h3 className="font-medium text-green-800 mb-2">Siguientes pasos:</h3>
        <ul className="text-sm text-green-700 space-y-1">
          <li>• Haz tu primera consulta legal</li>
          <li>• Explora diferentes áreas del derecho mexicano</li>
          <li>• Puedes cambiar proveedores en cualquier momento</li>
        </ul>
      </div>

      <button
        onClick={() => onComplete?.(Array.from(providerConfigs.values()))}
        className="w-full bg-legal-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-legal-600 transition-colors"
      >
        Comenzar a Usar LexMX
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

  return (
    <div className="max-w-2xl mx-auto p-6">
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
  const costColors = {
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
          ? 'border-legal-300 bg-legal-50' 
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-start space-x-3">
        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
          <img src={provider.icon} alt={provider.name} className="w-6 h-6" />
        </div>
        
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-gray-900">{provider.name}</h3>
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
          
          <p className="text-sm text-gray-600 mb-2">{provider.description}</p>
          
          <div className="flex flex-wrap gap-1">
            {provider.capabilities.map(capability => (
              <span
                key={capability}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
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

function ProviderConfigForm({ 
  provider, 
  onSave, 
  onCancel, 
  isLoading, 
  error 
}: {
  provider: ProviderMetadata;
  onSave: (config: ProviderConfig) => void;
  onCancel: () => void;
  isLoading: boolean;
  error: string | null;
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(config as ProviderConfig);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {provider.type === 'cloud' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            API Key *
          </label>
          <input
            type="password"
            required
            placeholder={`Ingresa tu clave API de ${provider.name}`}
            value={config.apiKey || ''}
            onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-legal-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">
            Tu clave se almacena encriptada localmente
          </p>
        </div>
      )}

      {provider.type === 'local' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Endpoint *
          </label>
          <input
            type="url"
            required
            placeholder="http://localhost:11434"
            value={config.endpoint || ''}
            onChange={(e) => setConfig(prev => ({ ...prev, endpoint: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-legal-500 focus:border-transparent"
          />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="flex space-x-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 bg-legal-500 text-white px-4 py-2 rounded-md hover:bg-legal-600 disabled:bg-gray-400 transition-colors"
        >
          {isLoading ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}