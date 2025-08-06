import React, { useState, useMemo } from 'react';

interface Model {
  id: string;
  name: string;
  size: string;
  family: string;
  description: string;
  recommended?: boolean;
}

interface WebLLMModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
  className?: string;
}

const MODELS: Model[] = [
  // Llama Family
  {
    id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    name: 'Llama 3.2 1B',
    size: '0.8GB',
    family: 'Llama',
    description: 'Rápido y eficiente para consultas básicas'
  },
  {
    id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
    name: 'Llama 3.2 3B',
    size: '1.7GB',
    family: 'Llama',
    description: 'Balance ideal entre velocidad y capacidad',
    recommended: true
  },
  {
    id: 'Llama-3.1-8B-Instruct-q4f32_1-MLC',
    name: 'Llama 3.1 8B',
    size: '4.3GB',
    family: 'Llama',
    description: 'Análisis legal complejo y detallado'
  },
  {
    id: 'Hermes-3-Llama-3.2-3B-q4f16_1-MLC',
    name: 'Hermes 3 Llama 3.2 3B',
    size: '1.8GB',
    family: 'Llama',
    description: 'Optimizado para seguir instrucciones'
  },
  
  // Gemma Family
  {
    id: 'gemma-2-2b-it-q4f32_1-MLC',
    name: 'Gemma 2 2B',
    size: '1.3GB',
    family: 'Gemma',
    description: 'Modelo de Google, compacto y eficiente'
  },
  {
    id: 'gemma-2-9b-it-q4f32_1-MLC',
    name: 'Gemma 2 9B',
    size: '5.1GB',
    family: 'Gemma',
    description: 'Mayor capacidad para tareas complejas'
  },
  
  // Phi Family
  {
    id: 'Phi-3.5-mini-instruct-q4f16_1-MLC',
    name: 'Phi 3.5 Mini',
    size: '1.2GB',
    family: 'Phi',
    description: 'Microsoft, excelente para razonamiento'
  },
  
  // Qwen Family
  {
    id: 'Qwen2.5-7B-Instruct-q4f16_1-MLC',
    name: 'Qwen 2.5 7B',
    size: '3.8GB',
    family: 'Qwen',
    description: 'Buen rendimiento multilingüe'
  },
  
  // Mistral Family
  {
    id: 'Mistral-7B-Instruct-v0.3-q4f16_1-MLC',
    name: 'Mistral 7B v0.3',
    size: '3.9GB',
    family: 'Mistral',
    description: 'Potente y versátil para análisis legal'
  },
  
  // StableLM Family
  {
    id: 'stablelm-2-zephyr-1_6b-q4f16_1-MLC',
    name: 'StableLM 2 Zephyr 1.6B',
    size: '0.9GB',
    family: 'StableLM',
    description: 'Ligero y eficiente'
  }
];

const MODEL_FAMILIES = [
  { id: 'all', name: 'Todos', icon: '🔷' },
  { id: 'Llama', name: 'Llama', icon: '🦙' },
  { id: 'Gemma', name: 'Gemma', icon: '💎' },
  { id: 'Phi', name: 'Phi', icon: '🔬' },
  { id: 'Qwen', name: 'Qwen', icon: '🌐' },
  { id: 'Mistral', name: 'Mistral', icon: '🌪️' },
  { id: 'StableLM', name: 'StableLM', icon: '⚡' }
];

export default function WebLLMModelSelector({
  value,
  onChange,
  className = ''
}: WebLLMModelSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFamily, setSelectedFamily] = useState('all');
  const [isOpen, setIsOpen] = useState(false);

  const filteredModels = useMemo(() => {
    return MODELS.filter(model => {
      const matchesSearch = searchQuery.trim() === '' || 
        model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        model.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesFamily = selectedFamily === 'all' || model.family === selectedFamily;
      
      return matchesSearch && matchesFamily;
    });
  }, [searchQuery, selectedFamily]);

  const selectedModel = MODELS.find(m => m.id === value);

  return (
    <div className={`relative ${className}`}>
      {/* Current Selection */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-legal-500 focus:border-legal-500"
      >
        <div className="flex items-center justify-between">
          <div>
            {selectedModel ? (
              <>
                <div className="font-medium text-gray-900 dark:text-gray-100">
                  {selectedModel.name}
                  {selectedModel.recommended && (
                    <span className="ml-2 text-xs text-legal-600 dark:text-legal-400">⭐ Recomendado</span>
                  )}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedModel.size} • {selectedModel.description}
                </div>
              </>
            ) : (
              <span className="text-gray-500 dark:text-gray-400">Selecciona un modelo</span>
            )}
          </div>
          <svg className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-2 w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 max-h-[500px] overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <input
              type="text"
              placeholder="Buscar modelo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-legal-500"
            />
          </div>

          {/* Family Filters */}
          <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
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
                  {family.name}
                </button>
              ))}
            </div>
          </div>

          {/* Model List */}
          <div className="overflow-y-auto max-h-[350px]">
            {filteredModels.length > 0 ? (
              <div className="p-2 space-y-1">
                {filteredModels.map(model => (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => {
                      onChange(model.id);
                      setIsOpen(false);
                    }}
                    className={`w-full px-3 py-2 rounded-lg text-left transition-colors ${
                      value === model.id
                        ? 'bg-legal-50 dark:bg-legal-900/20 border border-legal-300 dark:border-legal-700'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {model.name}
                          {model.recommended && (
                            <span className="ml-2 text-xs text-legal-600 dark:text-legal-400">⭐ Recomendado</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {model.description}
                        </div>
                      </div>
                      <div className="ml-3 text-right">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {model.size}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {model.family}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                No se encontraron modelos
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}