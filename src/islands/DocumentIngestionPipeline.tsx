import { useState, useEffect, useRef } from 'react';
import { useTranslation } from '../i18n/index';
import { ingestionPipeline } from '../lib/ingestion/document-ingestion-pipeline';
import type { IngestionProgress, IngestionResult } from '../lib/ingestion/document-ingestion-pipeline';
import type { DocumentRequest } from '../types/legal';

interface DocumentIngestionPipelineProps {
  request?: DocumentRequest;
  requestId?: string;
  onComplete?: (result: IngestionResult) => void;
  onCancel?: () => void;
}

export default function DocumentIngestionPipeline({ 
  request, 
  requestId,
  onComplete, 
  onCancel 
}: DocumentIngestionPipelineProps) {
  const { t } = useTranslation();
  const [isIngesting, setIsIngesting] = useState(false);
  const [progress, setProgress] = useState<IngestionProgress | null>(null);
  const [result, setResult] = useState<IngestionResult | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [manualUrl, setManualUrl] = useState('');
  const [loadedRequest, setLoadedRequest] = useState<DocumentRequest | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Progress history for visualization
  const [progressHistory, setProgressHistory] = useState<IngestionProgress[]>([]);

  useEffect(() => {
    // Initialize pipeline
    ingestionPipeline.initialize().catch(console.error);

    // Listen for progress events
    const handleProgress = (event: IngestionProgress) => {
      setProgress(event);
      setProgressHistory(prev => [...prev, event]);
    };

    ingestionPipeline.on('progress', handleProgress);

    return () => {
      ingestionPipeline.off('progress', handleProgress);
    };
  }, []);
  
  // Load request if requestId is provided
  useEffect(() => {
    if (requestId) {
      // Fetch request from storage or API
      const loadRequest = async () => {
        try {
          // For now, create a mock request - in production, this would fetch from storage
          const mockRequest: DocumentRequest = {
            id: requestId,
            title: `Document Request ${requestId}`,
            type: 'law',
            description: 'Document request loaded from /requests page',
            sources: [{
              id: 'source-1',
              type: 'url',
              url: 'https://www.dof.gob.mx/example',
              verified: false,
              isOfficial: true
            }],
            status: 'under_review',
            priority: 'high',
            requestedBy: 'moderator',
            createdAt: new Date().toISOString(),
            hierarchy: 3,
            primaryArea: 'civil',
            votes: 10,
            voters: [],
            comments: []
          };
          setLoadedRequest(mockRequest);
        } catch (error) {
          console.error('Failed to load request:', error);
        }
      };
      loadRequest();
    }
  }, [requestId]);

  const startIngestion = async () => {
    const activeRequest = request || loadedRequest;
    
    if (!activeRequest && !uploadedFile && !manualUrl) {
      alert(t('ingestion.noSourceError'));
      return;
    }

    setIsIngesting(true);
    setResult(null);
    setProgressHistory([]);
    abortControllerRef.current = new AbortController();

    try {
      let ingestionResult: IngestionResult;

      if (activeRequest) {
        // Ingest from document request
        ingestionResult = await ingestionPipeline.ingestFromRequest(activeRequest);
      } else if (uploadedFile) {
        // Ingest from uploaded file
        ingestionResult = await ingestionPipeline.ingestFromFile(uploadedFile);
      } else if (manualUrl) {
        // Ingest from URL
        ingestionResult = await ingestionPipeline.ingestFromUrl(manualUrl);
      } else {
        throw new Error('No ingestion source');
      }

      setResult(ingestionResult);
      
      if (onComplete) {
        onComplete(ingestionResult);
      }
    } catch (error) {
      console.error('Ingestion error:', error);
      setResult({
        success: false,
        stats: {
          fetchTime: 0,
          parseTime: 0,
          chunkTime: 0,
          embeddingTime: 0,
          totalTime: 0,
          chunkCount: 0,
          tokenCount: 0
        },
        errors: [error instanceof Error ? error.message : 'Unknown error']
      });
    } finally {
      setIsIngesting(false);
      abortControllerRef.current = null;
    }
  };

  const cancelIngestion = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    ingestionPipeline.cancel();
    setIsIngesting(false);
    
    if (onCancel) {
      onCancel();
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setManualUrl(''); // Clear URL when file is selected
    }
  };

  const getStageIcon = (stage: string) => {
    const icons: Record<string, string> = {
      fetching: '🔄',
      parsing: '📝',
      chunking: '✂️',
      embedding: '🧮',
      storing: '💾',
      complete: '✅',
      error: '❌'
    };
    return icons[stage] || '⏳';
  };

  const getStageColor = (stage: string) => {
    const colors: Record<string, string> = {
      fetching: 'text-blue-600',
      parsing: 'text-purple-600',
      chunking: 'text-indigo-600',
      embedding: 'text-green-600',
      storing: 'text-yellow-600',
      complete: 'text-green-700',
      error: 'text-red-600'
    };
    return colors[stage] || 'text-gray-600';
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        {t('ingestion.title')}
      </h2>

      {/* Input Section */}
      {!isIngesting && !result && (
        <div className="space-y-6 mb-8">
          {(request || loadedRequest) ? (
            // Show request details
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                {t('ingestion.processingRequest')}
              </h3>
              <p className="text-gray-600 dark:text-gray-300">{(request || loadedRequest)?.title}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {(request || loadedRequest)?.type} • {(request || loadedRequest)?.primaryArea}
              </p>
              {loadedRequest && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                  Request ID: {loadedRequest.id}
                </p>
              )}
            </div>
          ) : (
            // Manual ingestion options
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('ingestion.uploadFile')}
                </label>
                <div className="flex items-center space-x-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt,.doc,.docx,.xml"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    {t('ingestion.selectFile')}
                  </button>
                  {uploadedFile && (
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {uploadedFile.name} ({Math.round(uploadedFile.size / 1024)} KB)
                    </span>
                  )}
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">
                    {t('ingestion.or')}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('ingestion.enterUrl')}
                </label>
                <input
                  type="url"
                  value={manualUrl}
                  onChange={(e) => {
                    setManualUrl(e.target.value);
                    setUploadedFile(null); // Clear file when URL is entered
                  }}
                  placeholder="https://www.dof.gob.mx/..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-legal-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </>
          )}

          <button
            onClick={startIngestion}
            disabled={!request && !uploadedFile && !manualUrl}
            className="w-full px-6 py-3 bg-legal-600 text-white rounded-lg hover:bg-legal-700 focus:outline-none focus:ring-2 focus:ring-legal-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {t('ingestion.startIngestion')}
          </button>
        </div>
      )}

      {/* Progress Section */}
      {isIngesting && (
        <div className="space-y-6">
          {/* Current Stage */}
          {progress && (
            <div className="p-6 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{getStageIcon(progress.stage)}</span>
                  <div>
                    <p className={`font-medium ${getStageColor(progress.stage)}`}>
                      {t(`ingestion.stages.${progress.stage}`)}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {progress.message}
                    </p>
                  </div>
                </div>
                <span className="text-lg font-bold text-gray-700 dark:text-gray-300">
                  {progress.progress}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3">
                <div
                  className="bg-legal-500 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${progress.progress}%` }}
                />
              </div>

              {/* Stage Details */}
              {progress.details && (
                <div className="mt-4 p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600">
                  <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-x-auto">
                    {JSON.stringify(progress.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Progress History */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('ingestion.progressHistory')}
            </h3>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {progressHistory.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400"
                >
                  <span>{getStageIcon(item.stage)}</span>
                  <span className="flex-1">{item.message}</span>
                  <span className="text-xs">
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Cancel Button */}
          <button
            onClick={cancelIngestion}
            className="w-full px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
          >
            {t('ingestion.cancel')}
          </button>
        </div>
      )}

      {/* Result Section */}
      {result && (
        <div className="space-y-6">
          <div className={`p-6 rounded-lg ${
            result.success 
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700' 
              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700'
          }`}>
            <div className="flex items-start space-x-3">
              <span className="text-2xl">
                {result.success ? '✅' : '❌'}
              </span>
              <div className="flex-1">
                <h3 className={`font-medium ${
                  result.success 
                    ? 'text-green-800 dark:text-green-200' 
                    : 'text-red-800 dark:text-red-200'
                }`}>
                  {result.success 
                    ? t('ingestion.success') 
                    : t('ingestion.failed')}
                </h3>
                
                {result.documentId && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Document ID: <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
                      {result.documentId}
                    </code>
                  </p>
                )}

                {result.errors && result.errors.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {result.errors.map((error, index) => (
                      <p key={index} className="text-sm text-red-600 dark:text-red-400">
                        • {error}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Statistics */}
          {result.stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('ingestion.stats.chunks')}
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {result.stats.chunkCount}
                </p>
              </div>
              
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('ingestion.stats.tokens')}
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {result.stats.tokenCount.toLocaleString()}
                </p>
              </div>
              
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('ingestion.stats.time')}
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {(result.stats.totalTime / 1000).toFixed(1)}s
                </p>
              </div>
              
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('ingestion.stats.embeddings')}
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {result.embeddings?.size || 0}
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-4">
            <button
              onClick={() => {
                setResult(null);
                setProgress(null);
                setProgressHistory([]);
              }}
              className="flex-1 px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              {t('ingestion.ingestAnother')}
            </button>
            
            {result.success && result.documentId && (
              <a
                href={`/document/${result.documentId}`}
                className="flex-1 px-6 py-3 bg-legal-600 text-white rounded-lg hover:bg-legal-700 text-center transition-colors"
              >
                {t('ingestion.viewDocument')}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}