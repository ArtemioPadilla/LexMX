import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from '../i18n';
import { providerManager } from '../lib/llm/provider-manager';

interface Model {
  id: string;
  name: string;
  size: string;
  family: string;
  descriptionKey: string;
  recommended?: boolean;
}

interface WebLLMSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
  onClose?: () => void;
  className?: string;
}

const MODELS: Model[] = [
  // Llama Family
  {
    id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    name: 'Llama 3.2 1B',
    size: '0.8GB',
    family: 'Llama',
    descriptionKey: 'fast'
  },
  {
    id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
    name: 'Llama 3.2 3B',
    size: '1.7GB',
    family: 'Llama',
    descriptionKey: 'balanced',
    recommended: true
  },
  {
    id: 'Llama-3.1-8B-Instruct-q4f32_1-MLC',
    name: 'Llama 3.1 8B',
    size: '4.3GB',
    family: 'Llama',
    descriptionKey: 'complex'
  },
  {
    id: 'Hermes-3-Llama-3.2-3B-q4f16_1-MLC',
    name: 'Hermes 3 Llama 3.2 3B',
    size: '1.8GB',
    family: 'Llama',
    descriptionKey: 'instructions'
  },
  
  // Gemma Family
  {
    id: 'gemma-2-2b-it-q4f32_1-MLC',
    name: 'Gemma 2 2B',
    size: '1.3GB',
    family: 'Gemma',
    descriptionKey: 'compact'
  },
  {
    id: 'gemma-2-9b-it-q4f32_1-MLC',
    name: 'Gemma 2 9B',
    size: '5.1GB',
    family: 'Gemma',
    descriptionKey: 'complex'
  },
  
  // Phi Family
  {
    id: 'Phi-3.5-mini-instruct-q4f16_1-MLC',
    name: 'Phi 3.5 Mini',
    size: '1.2GB',
    family: 'Phi',
    descriptionKey: 'reasoning'
  },
  
  // Qwen Family
  {
    id: 'Qwen2.5-7B-Instruct-q4f16_1-MLC',
    name: 'Qwen 2.5 7B',
    size: '3.8GB',
    family: 'Qwen',
    descriptionKey: 'multilingual'
  },
  
  // Mistral Family
  {
    id: 'Mistral-7B-Instruct-v0.3-q4f16_1-MLC',
    name: 'Mistral 7B v0.3',
    size: '3.9GB',
    family: 'Mistral',
    descriptionKey: 'versatile'
  },
  
  // StableLM Family
  {
    id: 'stablelm-2-zephyr-1_6b-q4f16_1-MLC',
    name: 'StableLM 2 Zephyr 1.6B',
    size: '0.9GB',
    family: 'StableLM',
    descriptionKey: 'light'
  }
];

const MODEL_FAMILIES = [
  { id: 'all', name: 'provider.webllm.allFamilies', icon: '🔷' },
  { id: 'Llama', name: 'Llama', icon: '🦙' },
  { id: 'Gemma', name: 'Gemma', icon: '💎' },
  { id: 'Phi', name: 'Phi', icon: '🔬' },
  { id: 'Qwen', name: 'Qwen', icon: '🌐' },
  { id: 'Mistral', name: 'Mistral', icon: '🌪️' },
  { id: 'StableLM', name: 'StableLM', icon: '⚡' }
];

export default function WebLLMSelector({
  value,
  onChange,
  onClose,
  className = ''
}: WebLLMSelectorProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFamily, setSelectedFamily] = useState('all');
  const [showConfirmDialog, setShowConfirmDialog] = useState<Model | null>(null);
  const [showRemoveDialog, setShowRemoveDialog] = useState<Model | null>(null);
  const [cachedModels, setCachedModels] = useState<Set<string>>(new Set());
  
  useEffect(() => {
    // Load cached models status
    const updateCachedModels = () => {
      const cached = new Set<string>();
      MODELS.forEach(model => {
        if (providerManager.isWebLLMModelCached(model.id)) {
          cached.add(model.id);
        }
      });
      setCachedModels(cached);
    };
    
    updateCachedModels();
    // Check periodically in case models are loaded elsewhere
    const interval = setInterval(updateCachedModels, 5000);
    return () => clearInterval(interval);
  }, []);

  const filteredModels = useMemo(() => {
    return MODELS.filter(model => {
      const matchesSearch = searchQuery.trim() === '' || 
        model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t(`provider.webllm.modelDescriptions.${model.descriptionKey}`).toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesFamily = selectedFamily === 'all' || model.family === selectedFamily;
      
      return matchesSearch && matchesFamily;
    });
  }, [searchQuery, selectedFamily, t]);

  const handleModelSelect = (model: Model) => {
    if (cachedModels.has(model.id)) {
      // If already cached, just select it
      onChange(model.id);
      onClose?.();
    } else {
      // Show download confirmation
      setShowConfirmDialog(model);
    }
  };

  const confirmDownload = () => {
    if (showConfirmDialog) {
      onChange(showConfirmDialog.id);
      setShowConfirmDialog(null);
      onClose?.();
    }
  };
  
  const handleRemoveFromCache = async (model: Model) => {
    const success = await providerManager.removeWebLLMModelFromCache(model.id);
    if (success) {
      setCachedModels(prev => {
        const next = new Set(prev);
        next.delete(model.id);
        return next;
      });
      // TODO: Show success message
    }
    setShowRemoveDialog(null);
  };

  const selectedModel = MODELS.find(m => m.id === value);

  return (
    <div className={`${className}`}>
      {/* Data Usage Warning */}
      <div className="mb-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
        <div className="flex items-start space-x-2">
          <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="flex-1">
            <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              {t('provider.webllm.dataWarning')}
            </h4>
            <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
              {t('provider.webllm.dataWarningMessage')}
            </p>
            <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1 font-medium">
              {t('provider.webllm.mobileWarning')}
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-3">
        <input
          type="text"
          placeholder={t('provider.webllm.searchModel')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-legal-500"
        />
      </div>

      {/* Family Filters */}
      <div className="mb-3">
        <div className="flex flex-wrap gap-1">
          {MODEL_FAMILIES.map(family => (
            <button
              key={family.id}
              type="button"
              onClick={() => setSelectedFamily(family.id)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                selectedFamily === family.id
                  ? 'bg-legal-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <span className="mr-1">{family.icon}</span>
              {family.id === 'all' ? t(family.name) : family.name}
            </button>
          ))}
        </div>
      </div>

      {/* Model List - Fixed max height to prevent overflow */}
      <div className="overflow-y-auto scrollbar-thin max-h-[200px] border border-gray-200 dark:border-gray-700 rounded-lg">
        {filteredModels.length > 0 ? (
          <div className="p-2 space-y-1">
            {filteredModels.map(model => {
              const isCached = cachedModels.has(model.id);
              const isSelected = value === model.id;
              
              return (
                <div
                  key={model.id}
                  className={`relative px-3 py-3 rounded-lg transition-colors ${
                    isSelected
                      ? 'bg-legal-50 dark:bg-legal-900/20 border border-legal-300 dark:border-legal-700'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleModelSelect(model)}
                    className="w-full text-left"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {model.name}
                          </span>
                          {model.recommended && (
                            <span className="text-xs text-legal-600 dark:text-legal-400">
                              ⭐ {t('provider.webllm.recommended')}
                            </span>
                          )}
                          {isCached && (
                            <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                              ✓ {t('provider.webllm.cached')}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {t(`provider.webllm.modelDescriptions.${model.descriptionKey}`)}
                        </div>
                      </div>
                      <div className="ml-3 flex items-start gap-2">
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {model.size}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {model.family}
                          </div>
                        </div>
                        {isCached && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowRemoveDialog(model);
                            }}
                            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors"
                            title={t('provider.webllm.removeFromCache')}
                          >
                            <svg className="w-4 h-4 text-red-500 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            {t('provider.webllm.noModelsFound')}
          </div>
        )}
      </div>

      {/* Download Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              {t('provider.webllm.confirmDownload').replace('{{name}}', showConfirmDialog.name)}
            </h3>
            
            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                ⚠️ {t('provider.webllm.confirmDownloadMessage').replace('{{size}}', showConfirmDialog.size)}
              </p>
            </div>

            <div className="mb-4">
              <div className="flex justify-between items-center py-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {t('provider.webllm.downloadSize')}:
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {showConfirmDialog.size}
                </span>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setShowConfirmDialog(null)}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {t('provider.webllm.downloadCancel')}
              </button>
              <button
                onClick={confirmDownload}
                className="flex-1 px-4 py-2 bg-legal-500 text-white rounded-lg hover:bg-legal-600 transition-colors"
              >
                {t('provider.webllm.downloadConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Remove from Cache Confirmation Dialog */}
      {showRemoveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              {t('provider.webllm.confirmRemove').replace('{{name}}', showRemoveDialog.name)}
            </h3>
            
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                {t('provider.webllm.confirmRemoveMessage').replace('{{size}}', showRemoveDialog.size)}
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setShowRemoveDialog(null)}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {t('provider.webllm.removeCancel')}
              </button>
              <button
                onClick={() => handleRemoveFromCache(showRemoveDialog)}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                {t('provider.webllm.removeConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}