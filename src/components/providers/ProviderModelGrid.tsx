import React from 'react';
import type { LLMModel } from '../../types/llm';
import { useTranslation } from '../../i18n';

interface ProviderModelGridProps {
  models: LLMModel[];
  selectedModelId?: string;
  onModelSelect: (modelId: string) => void;
  showCost?: boolean;
  columns?: 1 | 2 | 3;
}

export default function ProviderModelGrid({
  models,
  selectedModelId,
  onModelSelect,
  showCost = true,
  columns = 2
}: ProviderModelGridProps) {
  const { t } = useTranslation();
  
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
  };

  if (models.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">
          No hay modelos disponibles para este proveedor.
        </p>
      </div>
    );
  }

  return (
    <div className={`grid ${gridCols[columns]} gap-4`}>
      {models.map(model => {
        const isSelected = selectedModelId === model.id;
        
        return (
          <button
            key={model.id}
            onClick={() => onModelSelect(model.id)}
            className={`relative p-4 rounded-xl border-2 transition-all text-left ${
              isSelected
                ? 'border-primary bg-accent'
                : 'border-border bg-card hover:bg-muted/60'
            }`}
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between">
                <h4 className="font-medium text-foreground">
                  {model.name}
                </h4>
                {model.recommended && (
                  <span className="text-xs px-2 py-1 bg-primary/15 text-primary rounded-full">
                    ⭐ {t('providers.webllm.recommended')}
                  </span>
                )}
              </div>
              
              <p className="text-sm text-muted-foreground">
                {model.description}
              </p>
              
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>Context: {(model.contextLength / 1000).toFixed(0)}K</span>
                <span>Max: {model.maxTokens}</span>
                {showCost && model.costPer1kTokens && (
                  <span>
                    ${model.costPer1kTokens.input}/{model.costPer1kTokens.output}
                  </span>
                )}
              </div>
              
              {/* Capabilities */}
              {model.capabilities && model.capabilities.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {model.capabilities.map(cap => (
                    <span
                      key={cap}
                      className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded"
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              )}
            </div>
            
            {/* Selection indicator */}
            {isSelected && (
              <div className="absolute top-2 right-2">
                <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}