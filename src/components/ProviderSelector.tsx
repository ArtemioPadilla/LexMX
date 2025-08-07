import React, { useState, useEffect } from 'react';
import { providerManager } from '../lib/llm/provider-manager';
import { providerRegistry } from '../lib/llm/provider-registry';
import WebLLMSelector from './WebLLMSelector';
import { useTranslation } from '../i18n';
import type { ProviderConfig } from '../types/llm';

interface ProviderSelectorProps {
  onProviderChange?: (providerId: string, model?: string) => void;
  className?: string;
}

export default function ProviderSelector({ onProviderChange, className = '' }: ProviderSelectorProps) {
  const { t } = useTranslation();
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [currentProvider, setCurrentProvider] = useState<string>('');
  const [currentModel, setCurrentModel] = useState<string>('');
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showWebLLMSelector, setShowWebLLMSelector] = useState(false);

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

  // If no providers configured, show WebLLM as default with warning
  if (providers.length === 0) {
    // Set default to WebLLM if not already set
    if (!currentProvider) {
      setCurrentProvider('webllm');
    }
  }

  const currentProviderConfig = providers.find(p => p.id === currentProvider);
  const metadata = currentProviderConfig ? providerRegistry.getProviderMetadata(currentProviderConfig.id) : 
                   currentProvider === 'webllm' ? providerRegistry.getProviderMetadata('webllm') : null;

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
        {currentProvider === 'webllm' ? (
          <>
            <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="text-gray-700 dark:text-gray-300">
              WebLLM
              {currentModel && (
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                  ({currentModel.split('-')[0]})
                </span>
              )}
            </span>
          </>
        ) : metadata ? (
          <>
            <img src={metadata.icon} alt={metadata.name} className="w-4 h-4" />
            <span className="text-gray-700 dark:text-gray-300">
              {metadata.name}
            </span>
          </>
        ) : (
          <span className="text-gray-700 dark:text-gray-300">{t('provider.selectProvider')}</span>
        )}
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 right-0 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 max-h-[600px] overflow-hidden">
          <div className="p-2">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 px-2 py-1 uppercase tracking-wider">
              {t('provider.availableProviders')}
            </div>
            
            {/* Always show WebLLM as an option */}
            <div className="mt-1">
              <button
                type="button"
                onClick={() => {
                  setCurrentProvider('webllm');
                  setShowWebLLMSelector(true);
                }}
                className={`w-full text-left px-2 py-2 rounded-md transition-colors flex items-center space-x-2 ${
                  currentProvider === 'webllm'
                    ? 'bg-legal-50 dark:bg-legal-900/20 text-legal-700 dark:text-legal-300'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {t('provider.webllm.name')}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {t('provider.cost.free')} • {t('provider.webllm.description')}
                  </div>
                </div>
                {currentProvider === 'webllm' && (
                  <svg className="w-4 h-4 text-legal-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>

              {/* WebLLM Model Selector */}
              {currentProvider === 'webllm' && showWebLLMSelector && (
                <div className="mt-2 p-2 border-t border-gray-200 dark:border-gray-700">
                  <WebLLMSelector
                    value={currentModel}
                    onChange={(modelId) => {
                      handleProviderSelect('webllm', modelId);
                      setShowWebLLMSelector(false);
                      setIsOpen(false);
                    }}
                    onClose={() => setShowWebLLMSelector(false)}
                  />
                </div>
              )}
            </div>
            
            {/* Other configured providers */}
            {providers.filter(p => p.id !== 'webllm').map((provider) => {
              const meta = providerRegistry.getProviderMetadata(provider.id);
              if (!meta) return null;

              const isSelected = provider.id === currentProvider;

              return (
                <div key={provider.id} className="mt-1">
                  <button
                    type="button"
                    onClick={() => handleProviderSelect(provider.id, provider.model)}
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
                    {isSelected && (
                      <svg className="w-4 h-4 text-legal-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
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