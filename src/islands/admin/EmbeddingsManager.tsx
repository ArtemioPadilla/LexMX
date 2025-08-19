import { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n/index';
import { embeddingsService, type EmbeddingStats } from '../../lib/admin/embeddings-service';
import { adminDataService } from '../../lib/admin/admin-data-service';
import type { LegalDocument } from '@/types/legal';

export default function EmbeddingsManager() {
  const { t } = useTranslation();
  
  // State for statistics
  const [stats, setStats] = useState<EmbeddingStats | null>(null);
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  
  // State for generation
  const [generating, setGenerating] = useState(false);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [progress, setProgress] = useState<{
    stage: string;
    documentId?: string;
    progress: number;
    total?: number;
    successful?: number;
    failed?: number;
  } | null>(null);
  
  // State for provider management
  const [currentProvider, setCurrentProvider] = useState<'transformers' | 'openai' | 'mock'>('transformers');
  const [switchingProvider, setSwitchingProvider] = useState(false);
  
  // State for UI
  const [loading, setLoading] = useState(true);
  const [operation, setOperation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [batchSize, setBatchSize] = useState(5);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    initializeService();
  }, []);

  useEffect(() => {
    if (!loading) {
      loadData();
    }
  }, [loading, currentProvider]);

  useEffect(() => {
    // Subscribe to progress events
    const handleProgress = (event: any) => {
      setProgress(event);
    };

    const handleError = (event: any) => {
      setError(`Error: ${event.error || 'Unknown error'}`);
      setGenerating(false);
      setGeneratingAll(false);
    };

    embeddingsService.on('progress', handleProgress);
    embeddingsService.on('error', handleError);

    return () => {
      embeddingsService.off('progress', handleProgress);
      embeddingsService.off('error', handleError);
    };
  }, []);

  const initializeService = async () => {
    try {
      setLoading(true);
      await embeddingsService.initialize(currentProvider);
    } catch (error) {
      console.error('Failed to initialize embeddings service:', error);
      setError(t('admin.embeddings.initError'));
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    try {
      setError(null);
      
      // Load statistics from API
      const embeddingStats = await adminDataService.getEmbeddingsStats();
      setStats(embeddingStats);
      
      // Load documents from API  
      const docs = await adminDataService.getDocumentsList();
      setDocuments(docs);
    } catch (error) {
      console.error('Failed to load data:', error);
      setError(error instanceof Error ? error.message : t('admin.embeddings.loadError'));
    }
  };

  const handleProviderSwitch = async (provider: 'transformers' | 'openai' | 'mock') => {
    if (provider === currentProvider) return;
    
    setSwitchingProvider(true);
    setError(null);
    
    try {
      await embeddingsService.switchProvider(provider);
      setCurrentProvider(provider);
      await loadData();
    } catch (error) {
      console.error('Failed to switch provider:', error);
      setError(t('admin.embeddings.switchError'));
    } finally {
      setSwitchingProvider(false);
    }
  };

  const handleGenerateSelected = async () => {
    if (selectedDocuments.size === 0) {
      setError(t('admin.embeddings.noSelection'));
      return;
    }
    
    setGenerating(true);
    setError(null);
    setProgress({ stage: 'starting', progress: 0 });
    
    try {
      let successful = 0;
      let failed = 0;
      
      for (const docId of selectedDocuments) {
        setProgress({
          stage: 'generating',
          documentId: docId,
          progress: ((successful + failed) / selectedDocuments.size) * 100,
          total: selectedDocuments.size,
          successful,
          failed
        });
        
        try {
          await embeddingsService.generateEmbeddings(docId);
          successful++;
        } catch (error) {
          console.error(`Failed to generate embeddings for ${docId}:`, error);
          failed++;
        }
      }
      
      setProgress({
        stage: 'complete',
        progress: 100,
        total: selectedDocuments.size,
        successful,
        failed
      });
      
      // Reload stats
      await loadData();
      
      // Clear selection
      setSelectedDocuments(new Set());
    } catch (error) {
      console.error('Failed to generate embeddings:', error);
      setError(t('admin.embeddings.generateError'));
    } finally {
      setGenerating(false);
      setTimeout(() => setProgress(null), 3000);
    }
  };

  const handleGenerateAll = async () => {
    if (!confirm(t('admin.embeddings.confirmGenerateAll'))) return;
    
    setGeneratingAll(true);
    setError(null);
    setProgress({ stage: 'starting', progress: 0 });
    
    try {
      const result = await embeddingsService.generateAllEmbeddings(batchSize);
      
      setProgress({
        stage: 'complete',
        progress: 100,
        total: result.totalDocuments,
        successful: result.successfulDocuments,
        failed: result.failedDocuments
      });
      
      if (result.errors.length > 0) {
        console.error('Errors during generation:', result.errors);
        setError(`${t('admin.embeddings.partialError')}: ${result.errors.length} documents failed`);
      }
      
      // Reload stats
      await loadData();
    } catch (error) {
      console.error('Failed to generate all embeddings:', error);
      setError(t('admin.embeddings.generateAllError'));
    } finally {
      setGeneratingAll(false);
      setTimeout(() => setProgress(null), 5000);
    }
  };

  const handleClearCache = async () => {
    if (!confirm(t('admin.embeddings.confirmClear'))) return;
    
    setOperation('clear');
    setError(null);
    
    try {
      await adminDataService.clearEmbeddingsCache();
      await loadData();
      alert(t('admin.embeddings.clearSuccess'));
    } catch (error) {
      console.error('Failed to clear cache:', error);
      setError(error instanceof Error ? error.message : t('admin.embeddings.clearError'));
    } finally {
      setOperation(null);
    }
  };

  const handleRebuildIndex = async () => {
    if (!confirm(t('admin.embeddings.confirmRebuild'))) return;
    
    setOperation('rebuild');
    setError(null);
    setProgress({ stage: 'rebuilding', progress: 0 });
    
    try {
      await adminDataService.rebuildIndex();
      await loadData();
      alert(t('admin.embeddings.rebuildSuccess'));
    } catch (error) {
      console.error('Failed to rebuild index:', error);
      setError(error instanceof Error ? error.message : t('admin.embeddings.rebuildError'));
    } finally {
      setOperation(null);
      setProgress(null);
    }
  };

  const handleExport = async () => {
    setOperation('export');
    setError(null);
    
    try {
      const blob = await adminDataService.exportEmbeddings();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `embeddings-${new Date().toISOString()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export embeddings:', error);
      setError(error instanceof Error ? error.message : t('admin.embeddings.exportError'));
    } finally {
      setOperation(null);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'ready': return 'text-green-600 dark:text-green-400';
      case 'building': return 'text-yellow-600 dark:text-yellow-400';
      case 'error': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-legal-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {t('admin.embeddings.stats.totalVectors')}
            </h3>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {stats.totalVectors.toLocaleString()}
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {t('admin.embeddings.stats.storageSize')}
            </h3>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {formatBytes(stats.storageSize)}
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {t('admin.embeddings.stats.avgTime')}
            </h3>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {stats.averageGenerationTime || stats.averageQueryTime}ms
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {t('admin.embeddings.stats.status')}
            </h3>
            <p className={`text-2xl font-bold mt-1 ${getStatusColor(stats.indexStatus)}`}>
              {stats.indexStatus}
            </p>
          </div>
        </div>
      )}

      {/* Provider Selection */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">{t('admin.embeddings.provider.title')}</h3>
        
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('admin.embeddings.provider.current')}:
          </label>
          <select
            value={currentProvider}
            onChange={(e) => handleProviderSwitch(e.target.value as any)}
            disabled={switchingProvider || generating || generatingAll}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
          >
            <option value="transformers">Transformers (Local)</option>
            <option value="openai">OpenAI</option>
            <option value="mock">Mock (Testing)</option>
          </select>
          
          {switchingProvider && (
            <span className="text-sm text-gray-500">{t('admin.embeddings.provider.switching')}</span>
          )}
        </div>
        
        {stats && (
          <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            <p>{t('admin.embeddings.provider.model')}: {stats.currentModel}</p>
            <p>{t('admin.embeddings.provider.available')}: {stats.modelsAvailable.join(', ')}</p>
          </div>
        )}
      </div>

      {/* Generation Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">{t('admin.embeddings.generation.title')}</h3>
        
        {/* Progress Display */}
        {progress && (
          <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{progress.stage}</span>
              <span className="text-sm">{Math.round(progress.progress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-legal-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress.progress}%` }}
              />
            </div>
            {progress.total && (
              <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                {t('admin.embeddings.generation.progress')}: {progress.successful || 0}/{progress.total}
                {progress.failed > 0 && ` (${progress.failed} failed)`}
              </div>
            )}
          </div>
        )}
        
        {/* Error Display */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <div className="flex items-start">
              <span className="text-red-500 mr-2 font-bold">⚠️</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">Error</p>
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="mt-2 text-xs text-red-500 hover:text-red-700 underline"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleGenerateSelected}
            disabled={generating || generatingAll || selectedDocuments.size === 0}
            className="px-4 py-2 bg-legal-600 text-white rounded-lg hover:bg-legal-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? t('admin.embeddings.generating') : t('admin.embeddings.generateSelected')} 
            {selectedDocuments.size > 0 && ` (${selectedDocuments.size})`}
          </button>
          
          <button
            onClick={handleGenerateAll}
            disabled={generating || generatingAll}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generatingAll ? t('admin.embeddings.generating') : t('admin.embeddings.generateAll')}
          </button>
          
          <button
            onClick={handleClearCache}
            disabled={operation !== null}
            className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {operation === 'clear' ? t('admin.embeddings.clearing') : t('admin.embeddings.clearCache')}
          </button>
          
          <button
            onClick={handleRebuildIndex}
            disabled={operation !== null}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {operation === 'rebuild' ? t('admin.embeddings.rebuilding') : t('admin.embeddings.rebuildIndex')}
          </button>
          
          <button
            onClick={handleExport}
            disabled={operation !== null}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {operation === 'export' ? t('admin.embeddings.exporting') : t('admin.embeddings.export')}
          </button>
        </div>
        
        {/* Advanced Options */}
        <div className="mt-4">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-legal-600 hover:text-legal-700 dark:text-legal-400 dark:hover:text-legal-300"
          >
            {showAdvanced ? '▼' : '▶'} {t('admin.embeddings.advanced')}
          </button>
          
          {showAdvanced && (
            <div className="mt-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('admin.embeddings.batchSize')}:
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={batchSize}
                onChange={(e) => setBatchSize(parseInt(e.target.value) || 5)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-white"
              />
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {t('admin.embeddings.batchSizeHelp')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Document Selection Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold">{t('admin.embeddings.documents.title')}</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedDocuments.size === documents.length && documents.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedDocuments(new Set(documents.map(d => d.id)));
                      } else {
                        setSelectedDocuments(new Set());
                      }
                    }}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('admin.embeddings.documents.title')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('admin.embeddings.documents.type')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('admin.embeddings.documents.chunks')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('admin.embeddings.documents.status')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedDocuments.has(doc.id)}
                      onChange={(e) => {
                        const newSelection = new Set(selectedDocuments);
                        if (e.target.checked) {
                          newSelection.add(doc.id);
                        } else {
                          newSelection.delete(doc.id);
                        }
                        setSelectedDocuments(newSelection);
                      }}
                      className="rounded border-gray-300 dark:border-gray-600"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {doc.title}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {doc.type}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {doc.content?.length || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      {t('admin.embeddings.documents.indexed')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}