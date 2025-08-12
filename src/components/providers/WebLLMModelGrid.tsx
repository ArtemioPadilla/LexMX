import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { providerManager } from '../../lib/llm/provider-manager';

interface Model {
  id: string;
  name: string;
  size: string;
  family: string;
  descriptionKey: string;
  recommended?: boolean;
}

interface WebLLMModelGridProps {
  selectedModelId?: string;
  onModelSelect: (modelId: string) => void;
  onDownloadConfirm?: (model: Model) => void;
  showDataWarning?: boolean;
}

const MODEL_FAMILIES = [
  { id: 'all', name: 'Todos', icon: '🔷' },
  { id: 'Llama', name: 'Llama', icon: '🦙' },
  { id: 'Gemma', name: 'Gemma', icon: '💎' },
  { id: 'Phi', name: 'Phi', icon: '🔬' },
  { id: 'Qwen', name: 'Qwen', icon: '🌐' },
  { id: 'Mistral', name: 'Mistral', icon: '🌪️' },
  { id: 'StableLM', name: 'StableLM', icon: '⚡' }
];

const WEBLLM_MODELS: Model[] = [
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

export default function WebLLMModelGrid({
  selectedModelId,
  onModelSelect,
  onDownloadConfirm,
  showDataWarning = true
}: WebLLMModelGridProps) {
  const { t } = useTranslation();
  const [selectedFamily, setSelectedFamily] = useState('all');
  const [cachedModels, setCachedModels] = useState<Set<string>>(new Set());
  const [showConfirmDialog, setShowConfirmDialog] = useState<Model | null>(null);

  useEffect(() => {
    // Check cached models
    const updateCachedModels = () => {
      const cached = new Set<string>();
      WEBLLM_MODELS.forEach(model => {
        if (providerManager.isWebLLMModelCached(model.id)) {
          cached.add(model.id);
        }
      });
      setCachedModels(cached);
    };
    
    updateCachedModels();
    const interval = setInterval(updateCachedModels, 5000);
    return () => clearInterval(interval);
  }, []);

  const filteredModels = useMemo(() => {
    if (selectedFamily === 'all') {
      return WEBLLM_MODELS;
    }
    return WEBLLM_MODELS.filter(model => model.family === selectedFamily);
  }, [selectedFamily]);

  const handleModelSelect = (model: Model) => {
    const isCached = cachedModels.has(model.id);
    
    if (!isCached) {
      setShowConfirmDialog(model);
    } else {
      onModelSelect(model.id);
    }
  };

  const handleConfirmDownload = () => {
    if (showConfirmDialog) {
      if (onDownloadConfirm) {
        onDownloadConfirm(showConfirmDialog);
      }
      // Don't call onModelSelect here - let the parent handle it after download
      setShowConfirmDialog(null);
    }
  };

  return (
    <div>
      {/* Data Warning */}
      {showDataWarning && (
        <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <div className="flex items-start space-x-2">
            <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                {t('providers.webllm.dataWarning')}
              </p>
              <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                Los modelos se descargarán la primera vez que los uses (0.8GB - 5GB).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Family Filters */}
      <div className="mb-4">
        <div className="flex flex-wrap gap-2">
          {MODEL_FAMILIES.map(family => (
            <button
              key={family.id}
              onClick={() => setSelectedFamily(family.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedFamily === family.id
                  ? 'bg-legal-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <span className="mr-1">{family.icon}</span>
              {family.name}
            </button>
          ))}
        </div>
      </div>

      {/* Model Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredModels.map(model => {
          const isCached = cachedModels.has(model.id);
          const isSelected = selectedModelId === model.id;
          
          return (
            <button
              key={model.id}
              onClick={() => handleModelSelect(model)}
              className={`relative p-3 rounded-xl border-2 transition-all text-left ${
                isSelected
                  ? 'border-legal-500 bg-legal-500/10'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">
                    {model.name}
                  </h4>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {model.size}
                  </span>
                </div>
                
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t(`providers.webllm.modelDescriptions.${model.descriptionKey}`)}
                </p>
                
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300">
                    {model.family}
                  </span>
                  
                  {model.recommended && (
                    <span className="text-xs px-2 py-1 bg-legal-500/20 text-legal-600 dark:text-legal-400 rounded-full">
                      ⭐ {t('providers.webllm.recommended')}
                    </span>
                  )}
                  
                  {isCached && (
                    <span className="text-xs px-2 py-1 bg-green-500/20 text-green-600 dark:text-green-400 rounded-full">
                      ✓ {t('providers.webllm.cached')}
                    </span>
                  )}
                </div>
              </div>
              
              {/* Selection indicator */}
              {isSelected && (
                <div className="absolute top-2 right-2">
                  <div className="w-6 h-6 bg-legal-500 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Download Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              {t('providers.webllm.confirmDownload').replace('{{name}}', showConfirmDialog.name)}
            </h3>
            
            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                ⚠️ {t('providers.webllm.confirmDownloadMessage').replace('{{size}}', showConfirmDialog.size)}
              </p>
            </div>

            <div className="mb-4">
              <div className="flex justify-between items-center py-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {t('providers.webllm.downloadSize')}:
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
                {t('providers.webllm.downloadCancel')}
              </button>
              <button
                onClick={handleConfirmDownload}
                className="flex-1 px-4 py-2 bg-legal-500 text-white rounded-lg hover:bg-legal-600 transition-colors"
              >
                {t('providers.webllm.downloadConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}