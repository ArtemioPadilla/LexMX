import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '../i18n';
import type { RAGProgressEvent, RAGSearchResult } from '../types/embeddings';

interface RAGStage {
  id: string;
  name: string;
  description?: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  details?: string | Record<string, unknown>;
  startTime?: number;
  endTime?: number;
  progress?: number;
}

interface RAGProgressIndicatorProps {
  events?: RAGProgressEvent[];
  documents?: RAGSearchResult[];
  variant?: 'inline' | 'expanded';
  showDetails?: boolean;
  onClose?: () => void;
}

export default function RAGProgressIndicator({
  events = [],
  documents = [],
  variant = 'inline',
  showDetails = true,
  onClose
}: RAGProgressIndicatorProps) {
  const { t, language } = useTranslation();
  const [stages, setStages] = useState<RAGStage[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentStage, setCurrentStage] = useState<string | null>(null);
  
  // Debug: Log documents when they change
  useEffect(() => {
    if (documents.length > 0) {
      console.log('RAGProgressIndicator received documents:', documents);
    }
  }, [documents]);

  // Memoize stage definitions to prevent recreation on every render
  // Only recreate when language changes, not when t function reference changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stageDefinitions: RAGStage[] = useMemo(() => [
    {
      id: 'query_analysis',
      name: t('rag.stages.analyzing'),
      description: t('rag.stages.analyzingDesc'),
      status: 'pending'
    },
    {
      id: 'embedding_generation',
      name: t('rag.stages.embedding'),
      description: t('rag.stages.embeddingDesc'),
      status: 'pending'
    },
    {
      id: 'document_search',
      name: t('rag.stages.searching'),
      description: t('rag.stages.searchingDesc'),
      status: 'pending'
    },
    {
      id: 'context_building',
      name: t('rag.stages.building'),
      description: t('rag.stages.buildingDesc'),
      status: 'pending'
    },
    {
      id: 'response_generation',
      name: t('rag.stages.generating'),
      description: t('rag.stages.generatingDesc'),
      status: 'pending'
    }
  ], [language]);

  // Update stages based on events
  useEffect(() => {
    if (events.length === 0) {
      setStages(stageDefinitions);
      return;
    }

    const updatedStages = [...stageDefinitions];
    let activeStage: string | null = null;
    
    events.forEach(event => {
      const stageIndex = updatedStages.findIndex(s => s.id === event.stage);
      if (stageIndex !== -1) {
        updatedStages[stageIndex] = {
          ...updatedStages[stageIndex],
          status: event.status,
          details: event.details,
          progress: event.progress,
          startTime: event.status === 'active' ? event.timestamp : updatedStages[stageIndex].startTime,
          endTime: event.status === 'completed' ? event.timestamp : updatedStages[stageIndex].endTime
        };

        if (event.status === 'active') {
          activeStage = event.stage;
        }
      }
    });

    setStages(updatedStages);
    
    // Only update currentStage if it has changed
    if (activeStage !== null) {
      setCurrentStage(prevStage => prevStage !== activeStage ? activeStage : prevStage);
    }
  }, [events, stageDefinitions]);

  // Calculate overall progress
  const overallProgress = () => {
    const completed = stages.filter(s => s.status === 'completed').length;
    return Math.round((completed / stages.length) * 100);
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'active':
        return (
          <div className="w-5 h-5">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-legal-500"></div>
          </div>
        );
      case 'error':
        return (
          <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600"></div>
        );
    }
  };

  // Format time duration
  const formatDuration = (start?: number, end?: number) => {
    if (!start) return '';
    const duration = (end || Date.now()) - start;
    if (duration < 1000) return `${duration} ms`;
    return `${(duration / 1000).toFixed(1)} s`;
  };

  if (variant === 'inline') {
    return (
      <div className="w-full space-y-3">
        {/* Show documents summary if we have them but no events (after completion) */}
        {documents.length > 0 && events.length === 0 && (
          <div className="p-3 bg-legal-50 dark:bg-legal-900/20 rounded-lg border border-legal-200 dark:border-legal-800">
            <p className="text-sm font-semibold text-legal-700 dark:text-legal-300 mb-2">
              📚 {t('rag.details.documentsFound', { count: documents.length })} - {t('rag.details.topResults')}
            </p>
            <div className="space-y-1">
              {documents.slice(0, 3).map((doc, _index) => (
                <div key={_index} className="text-xs text-gray-600 dark:text-gray-400">
                  • {doc.metadata?.title || `Document ${doc.documentId}`}
                  {doc.metadata?.article && ` - ${t('legal.article')}: ${doc.metadata.article}`}
                  <span className="ml-2 font-semibold text-legal-600 dark:text-legal-400">
                    ({Math.round(doc.score * 100)}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Progress bar - only show if we have events */}
        {events.length > 0 && (
          <div className="flex items-center space-x-3">
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {currentStage ? stages.find(s => s.id === currentStage)?.name : t('rag.processing')}
                </span>
                <span className="text-xs font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                  {overallProgress()}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-legal-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${overallProgress()}%` }}
                />
              </div>
            </div>
            
            {showDetails && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                aria-label={isExpanded ? t('common.collapse') : t('common.expand')}
              >
                <svg
                  className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Expanded details */}
        {isExpanded && showDetails && (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-2">
            {/* Documents found - Show prominently when available */}
            {documents.length > 0 && (
              <div className="mb-3 p-3 bg-legal-50 dark:bg-legal-900/20 rounded-lg border border-legal-200 dark:border-legal-800">
                <p className="text-sm font-semibold text-legal-700 dark:text-legal-300 mb-2">
                  📚 {t('rag.details.documentsFound', { count: documents.length })}
                </p>
                <div className="space-y-1.5">
                  {documents.slice(0, 3).map((doc, _index) => (
                    <div key={_index} className="flex items-start justify-between p-2 bg-white dark:bg-gray-800 rounded border border-legal-100 dark:border-gray-700">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                          {doc.metadata?.title || `Document ${doc.documentId}`}
                        </div>
                        {doc.metadata?.article && (
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            {t('legal.article')}: {doc.metadata.article}
                          </div>
                        )}
                      </div>
                      <div className="ml-2 text-xs font-bold text-legal-600 dark:text-legal-400">
                        {Math.round(doc.score * 100)}%
                      </div>
                    </div>
                  ))}
                  {documents.length > 3 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center pt-1">
                      +{documents.length - 3} {t('common.more')}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Stages list */}
            <div className="space-y-2">
              {stages.map((stage, _index) => (
                <div key={stage.id} className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {getStatusIcon(stage.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={`text-sm ${
                        stage.status === 'active' ? 'font-medium text-gray-900 dark:text-white' : 
                        stage.status === 'completed' ? 'text-gray-600 dark:text-gray-400' :
                        'text-gray-400 dark:text-gray-500'
                      }`}>
                        {stage.name}
                      </p>
                      {stage.startTime && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 whitespace-nowrap">
                          {formatDuration(stage.startTime, stage.endTime)}
                        </span>
                      )}
                    </div>
                    
                    {/* Stage-specific details */}
                    {stage.status === 'active' && stage.details?.modelProgress && (
                      <div className="mt-1">
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {stage.details.modelProgress.file}: {Math.round(stage.details.modelProgress.progress)}%
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 mt-1">
                          <div
                            className="bg-legal-400 h-1 rounded-full transition-all"
                            style={{ width: `${stage.details.modelProgress.progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Expanded variant (for modal or sidebar)
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-5 min-w-[380px] max-w-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-gray-900 dark:text-gray-100">
          {t('rag.title')}
        </h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label={t('common.close')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Progress overview */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {t('rag.overallProgress')}
          </span>
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {overallProgress()}%
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="bg-legal-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${overallProgress()}%` }}
          />
        </div>
      </div>

      {/* Detailed stages */}
      <div className="space-y-3">
        {stages.map((stage) => (
          <div key={stage.id} className="border-l-2 border-gray-200 dark:border-gray-700 pl-4 ml-2">
            <div className="flex items-start -ml-7">
              <div className="flex-shrink-0 bg-white dark:bg-gray-800 pr-2">
                {getStatusIcon(stage.status)}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className={`text-sm font-medium ${
                    stage.status === 'active' ? 'text-gray-900 dark:text-white' :
                    stage.status === 'completed' ? 'text-gray-700 dark:text-gray-300' :
                    'text-gray-500 dark:text-gray-400'
                  }`}>
                    {stage.name}
                  </h4>
                  {stage.startTime && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDuration(stage.startTime, stage.endTime)}
                    </span>
                  )}
                </div>
                {stage.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {stage.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Documents section - Show prominently when available */}
      {documents.length > 0 && (
        <div className="mt-4 p-4 bg-legal-50 dark:bg-legal-900/20 rounded-lg border border-legal-200 dark:border-legal-800">
          <h4 className="text-sm font-semibold text-legal-700 dark:text-legal-300 mb-3">
            📚 {t('rag.details.topResults')} ({documents.length})
          </h4>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {documents.map((doc, _index) => (
              <div key={_index} className="bg-white dark:bg-gray-800 rounded p-3 border border-legal-100 dark:border-gray-700">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      {doc.metadata?.title || `Document ${doc.documentId}`}
                    </div>
                    {doc.metadata?.article && (
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {t('legal.article')}: {doc.metadata.article}
                      </div>
                    )}
                    {doc.metadata?.excerpt && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 line-clamp-2">
                        {doc.metadata.excerpt}
                      </div>
                    )}
                    {doc.metadata?.legalArea && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {t('legal.area')}: {doc.metadata.legalArea}
                      </div>
                    )}
                  </div>
                  <div className="ml-3 text-right">
                    <div className="text-sm font-bold text-legal-600 dark:text-legal-400">
                      {Math.round(doc.score * 100)}%
                    </div>
                    {doc.metadata?.hierarchy && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Nivel {doc.metadata.hierarchy}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}