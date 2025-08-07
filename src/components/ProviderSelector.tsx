import React, { useState, useEffect } from 'react';
import { providerManager } from '../lib/llm/provider-manager';
import { providerRegistry } from '../lib/llm/provider-registry';
import type { ProviderConfig } from '../types/llm';

interface ProviderSelectorProps {
  onProviderChange?: (providerId: string, model?: string) => void;
  className?: string;
}

export default function ProviderSelector({ onProviderChange, className = '' }: ProviderSelectorProps) {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [currentProvider, setCurrentProvider] = useState<string>('');
  const [currentModel, setCurrentModel] = useState<string>('');
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      await providerManager.initialize();
      const configs = await providerManager.getEnabledProviders();
      setProviders(configs);
      
      // Get current provider
      const current = await providerManager.getCurrentProvider();
      if (current) {
        setCurrentProvider(current.id);
        if (current.model) {
          setCurrentModel(current.model);
        }
      } else if (configs.length > 0) {
        // Default to first provider
        setCurrentProvider(configs[0].id);
        if (configs[0].model) {
          setCurrentModel(configs[0].model);
        }
      }
    } catch (error) {
      console.error('Error loading providers:', error);
    }
  };

  const handleProviderSelect = async (providerId: string, model?: string) => {
    try {
      setCurrentProvider(providerId);
      if (model) {
        setCurrentModel(model);
      }
      
      // Update provider manager
      await providerManager.setPreferredProvider(providerId, model);
      
      setIsOpen(false);
      onProviderChange?.(providerId, model);
    } catch (error) {
      console.error('Error setting provider:', error);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    if (isOpen && mounted) {
      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        if (!target.closest('.provider-selector')) {
          setIsOpen(false);
        }
      };
      
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isOpen, mounted]);

  if (!mounted) {
    return null;
  }

  // Show a button to configure providers if none are configured
  if (providers.length === 0) {
    return (
      <div className={`relative provider-selector ${className}`}>
        <a
          href="/setup"
          className="flex items-center space-x-2 px-3 py-2 bg-yellow-50 dark:bg-yellow-900/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg transition-colors text-sm"
        >
          <svg className="w-4 h-4 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-yellow-700 dark:text-yellow-300">Configurar IA</span>
        </a>
      </div>
    );
  }

  const currentProviderConfig = providers.find(p => p.id === currentProvider);
  const metadata = currentProviderConfig ? providerRegistry.getProviderMetadata(currentProviderConfig.id) : null;

  return (
    <div className={`relative provider-selector ${className}`}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="flex items-center space-x-2 px-3 py-2 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors text-sm"
        aria-expanded={isOpen}
      >
        {metadata && (
          <>
            <img src={metadata.icon} alt={metadata.name} className="w-4 h-4" />
            <span className="text-gray-700 dark:text-gray-300">
              {metadata.name}
              {currentModel && currentProvider === 'webllm' && (
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                  ({currentModel.split('-')[0]})
                </span>
              )}
            </span>
          </>
        )}
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute bottom-full mb-2 right-0 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 max-h-96 overflow-y-auto">
          <div className="p-2">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 px-2 py-1 uppercase tracking-wider">
              Proveedores Disponibles
            </div>
            {providers.map((provider) => {
              const meta = providerRegistry.getProviderMetadata(provider.id);
              if (!meta) return null;

              const isWebLLM = provider.id === 'webllm';
              const isSelected = provider.id === currentProvider;

              return (
                <div key={provider.id} className="mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (!isWebLLM) {
                        handleProviderSelect(provider.id, provider.model);
                      } else {
                        // For WebLLM, just select it but keep dropdown open for model selection
                        setCurrentProvider(provider.id);
                      }
                    }}
                    className={`w-full text-left px-2 py-2 rounded-md transition-colors flex items-center space-x-2 ${
                      isSelected
                        ? 'bg-legal-50 dark:bg-legal-900/20 text-legal-700 dark:text-legal-300'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <img src={meta.icon} alt={meta.name} className="w-5 h-5" />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {meta.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {meta.costLevel === 'free' ? 'Gratis' : meta.costLevel}
                      </div>
                    </div>
                    {isSelected && !isWebLLM && (
                      <svg className="w-4 h-4 text-legal-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>

                  {/* WebLLM Model Selection */}
                  {isWebLLM && isSelected && (
                    <div className="ml-7 mt-1 space-y-1">
                      {['Llama-3.2-3B-Instruct-q4f16_1-MLC', 'Llama-3.2-1B-Instruct-q4f16_1-MLC', 'gemma-2-2b-it-q4f32_1-MLC'].map((modelId) => {
                        const modelName = modelId.split('-')[0] + ' ' + modelId.split('-')[1];
                        const size = modelId.includes('3B') ? '1.7GB' : modelId.includes('1B') ? '0.8GB' : '1.3GB';
                        
                        return (
                          <button
                            key={modelId}
                            type="button"
                            onClick={() => handleProviderSelect(provider.id, modelId)}
                            className={`w-full text-left px-2 py-1 rounded text-sm transition-colors ${
                              currentModel === modelId
                                ? 'bg-legal-100 dark:bg-legal-800/30 text-legal-700 dark:text-legal-300'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-gray-700 dark:text-gray-300">{modelName}</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">{size}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 p-2">
            <a
              href="/setup"
              className="block w-full text-center px-3 py-2 text-sm text-legal-600 dark:text-legal-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors"
            >
              Configurar Proveedores
            </a>
          </div>
        </div>
      )}
    </div>
  );
}