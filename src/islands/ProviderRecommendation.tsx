import React, { useState, useEffect } from 'react';
import { HydrationBoundary as _HydrationBoundary, LoadingStates as _LoadingStates } from '../components/HydrationBoundary';
import { TEST_IDS as _TEST_IDS } from '../utils/test-ids';
import { providerManager } from '../lib/llm/provider-manager';
import { useTranslation } from '../i18n';
import { getUrl } from '../utils/urls';

interface ProviderRecommendationProps {
  query: string;
  onSelectProvider?: (providerId: string, model: string) => void;
  className?: string;
}

interface Recommendation {
  providerId: string;
  model: string;
  score: number;
  estimatedCost: number;
  reasoning: string[];
  available: boolean;
}

export default function ProviderRecommendation({ 
  query, 
  onSelectProvider,
  className = '' 
}: ProviderRecommendationProps) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle hydration
  useEffect(() => {
    setIsHydrated(true);
  }, []);
  const { t } = useTranslation();

  useEffect(() => {
    if (query && query.trim().length > 10) {
      loadRecommendations();
    }
  }, [query]);

  const loadRecommendations = async () => {
    setLoading(true);
    setError(null);

    try {
      const recs = await providerManager.getProviderRecommendations(query);
      setRecommendations(recs);
    } catch (err) {
      console.error('Failed to get recommendations:', err);
      setError('Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  };

  const getProviderName = (providerId: string): string => {
    const names: Record<string, string> = {
      openai: 'OpenAI',
      claude: 'Claude',
      gemini: 'Google Gemini',
      ollama: 'Ollama (Local)'
    };
    return names[providerId] || providerId;
  };

  const getModelDisplayName = (model: string): string => {
    const displayNames: Record<string, string> = {
      'gpt-4-turbo-preview': 'GPT-4 Turbo',
      'gpt-4': 'GPT-4',
      'gpt-3.5-turbo': 'GPT-3.5 Turbo',
      'claude-3-opus': 'Claude 3 Opus',
      'claude-3-sonnet': 'Claude 3 Sonnet',
      'claude-3-haiku': 'Claude 3 Haiku',
      'gemini-1.5-pro': 'Gemini 1.5 Pro',
      'gemini-pro': 'Gemini Pro',
      'llama3': 'Llama 3',
      'mixtral': 'Mixtral'
    };
    return displayNames[model] || model;
  };

  const getCostIndicator = (cost: number): { color: string; label: string } => {
    if (cost === 0) return { color: 'text-green-600', label: t('provider.cost.free') || 'Gratis' };
    if (cost < 0.01) return { color: 'text-green-600', label: t('provider.cost.veryLow') || 'Muy Bajo' };
    if (cost < 0.05) return { color: 'text-yellow-600', label: t('provider.cost.low') || 'Bajo' };
    if (cost < 0.15) return { color: 'text-orange-600', label: t('provider.cost.medium') || 'Medio' };
    return { color: 'text-red-600', label: t('provider.cost.high') || 'Alto' };
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  if (!query || query.trim().length <= 10) {
    return null;
  }

  if (loading) {
  // Handle SSR/hydration
  if (!isHydrated) {
    return (
      <_HydrationBoundary 
        fallback={<_LoadingStates.ProviderRecommendation />} 
        testId="provider-recommendation"
      />
    );
  }

  return (
    <div
      data-testid="provider-recommendation" className={`bg-gray-50 dark:bg-gray-800 rounded-lg p-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error || recommendations.length === 0) {
    return null;
  }

  return (
    <div className={`bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 ${className}`}>
      <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-3 flex items-center">
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        {t('provider.recommendations') || 'Proveedores Recomendados'}
      </h4>

      <div className="space-y-2">
        {recommendations.slice(0, 3).map((rec, index) => {
          const costInfo = getCostIndicator(rec.estimatedCost);
          
          return (
            <div 
              key={`${rec.providerId}-${rec.model}`}
              className={`bg-white dark:bg-gray-800 rounded-lg p-3 border ${
                rec.available 
                  ? 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600' 
                  : 'border-gray-200 dark:border-gray-700 opacity-60'
              } transition-all cursor-pointer`}
              onClick={() => rec.available && onSelectProvider?.(rec.providerId, rec.model)}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    #{index + 1}
                  </span>
                  <h5 className="font-medium text-gray-900 dark:text-white">
                    {getProviderName(rec.providerId)}
                  </h5>
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {getModelDisplayName(rec.model)}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`text-xs font-medium ${costInfo.color}`}>
                    {costInfo.label}
                  </span>
                  {!rec.available && (
                    <span className="text-xs font-medium text-red-600 dark:text-red-400">
                      {t('provider.notConfigured') || 'No configurado'}
                    </span>
                  )}
                </div>
              </div>

              {/* Score Bar */}
              <div className="mb-2">
                <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                  <span>{t('provider.matchScore') || 'Coincidencia'}</span>
                  <span>{Math.round(rec.score)}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className={`${getScoreColor(rec.score)} h-2 rounded-full transition-all`}
                    style={{ width: `${rec.score}%` }}
                  />
                </div>
              </div>

              {/* Reasoning */}
              {rec.reasoning.length > 0 && (
                <div className="mt-2">
                  <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                    {rec.reasoning.slice(0, 2).map((reason, idx) => (
                      <li key={idx} className="flex items-start">
                        <span className="text-green-500 mr-1">✓</span>
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {!rec.available && (
                <div className="mt-2 text-xs">
                  <a 
                    href={getUrl('setup')} 
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {t('provider.configureNow') || 'Configurar ahora'} →
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-3 text-xs text-blue-700 dark:text-blue-300">
        {t('provider.recommendationNote') || 
         'Recomendaciones basadas en el tipo de consulta, complejidad y recursos necesarios.'}
      </div>
    </div>
  );
}