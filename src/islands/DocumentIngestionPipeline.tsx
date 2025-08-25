import { useState, useEffect, useRef } from 'react';
import { useTranslation } from '../i18n/index';
import { ingestionPipeline } from '../lib/ingestion/document-ingestion-pipeline';
import type { IngestionProgress, IngestionResult } from '../lib/ingestion/document-ingestion-pipeline';
import type { DocumentRequest } from '../types/legal';
import { contentExtractor } from '../lib/ingestion/document-content-extractors';
import { CorsBlockedError } from '../lib/ingestion/document-fetcher';
import { isLikelyCorsBlocked } from '../lib/utils/cors-aware-fetch';

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
  
  // Format detection and preview
  const [urlAnalysis, setUrlAnalysis] = useState<{
    isValid: boolean;
    isOfficial: boolean;
    detectedFormat: string;
    estimatedSize?: string;
    previewText?: string;
    isAnalyzing: boolean;
    error?: string;
    corsWarning?: boolean;
  }>({
    isValid: false,
    isOfficial: false,
    detectedFormat: 'unknown',
    isAnalyzing: false
  });

  // CORS error state
  const [corsError, setCorsError] = useState<{
    blocked: boolean;
    suggestions: string[];
    url?: string;
  } | null>(null);

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
      
      // Handle CORS errors specifically
      if (error instanceof CorsBlockedError) {
        setCorsError({
          blocked: true,
          suggestions: error.suggestions || [],
          url: manualUrl || activeRequest?.sources[0]?.url
        });
      } else {
        setCorsError(null);
      }
      
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

  // Analyze URL for format and validity
  const analyzeUrl = async (url: string) => {
    if (!url.trim()) {
      setUrlAnalysis({
        isValid: false,
        isOfficial: false,
        detectedFormat: 'unknown',
        corsWarning: false,
        isAnalyzing: false
      });
      return;
    }

    setUrlAnalysis(prev => ({ ...prev, isAnalyzing: true, error: undefined }));

    try {
      // Validate URL format
      const parsedUrl = new URL(url);
      
      // Check if official source
      const officialDomains = [
        'dof.gob.mx', 'scjn.gob.mx', 'diputados.gob.mx', 'senado.gob.mx',
        'gob.mx', 'sat.gob.mx', 'imss.gob.mx', 'infonavit.org.mx'
      ];
      const isOfficial = officialDomains.some(domain => 
        parsedUrl.hostname.includes(domain)
      );

      // Detect format from URL
      let detectedFormat = 'html';
      let formatIcon = '🌐';
      
      if (url.toLowerCase().includes('.pdf')) {
        detectedFormat = 'PDF Document';
        formatIcon = '📄';
      } else if (url.toLowerCase().includes('.doc')) {
        detectedFormat = 'Word Document';
        formatIcon = '📝';
      } else if (url.toLowerCase().includes('.xml')) {
        detectedFormat = 'XML Document';
        formatIcon = '🔖';
      }

      // Try to get content info with HEAD request
      try {
        const response = await fetch(url, { 
          method: 'HEAD',
          signal: AbortSignal.timeout(5000)
        });
        
        if (response.ok) {
          const contentType = response.headers.get('content-type') || '';
          const contentLength = response.headers.get('content-length');
          
          // Refine format detection based on content type
          if (contentType.includes('pdf')) {
            detectedFormat = 'PDF Document';
            formatIcon = '📄';
          } else if (contentType.includes('msword') || contentType.includes('wordprocessingml')) {
            detectedFormat = 'Word Document';
            formatIcon = '📝';
          } else if (contentType.includes('xml')) {
            detectedFormat = 'XML Document';
            formatIcon = '🔖';
          } else if (contentType.includes('html')) {
            detectedFormat = 'Web Page';
            formatIcon = '🌐';
          }

          const estimatedSize = contentLength ? 
            `${Math.round(parseInt(contentLength) / 1024)} KB` : 
            undefined;

          setUrlAnalysis({
            isValid: true,
            isOfficial,
            detectedFormat: `${formatIcon} ${detectedFormat}`,
            estimatedSize,
            corsWarning: isLikelyCorsBlocked(url),
            isAnalyzing: false
          });

        } else {
          setUrlAnalysis({
            isValid: false,
            isOfficial,
            detectedFormat: `${formatIcon} ${detectedFormat}`,
            corsWarning: isLikelyCorsBlocked(url),
            isAnalyzing: false,
            error: `HTTP ${response.status}: ${response.statusText}`
          });
        }
      } catch (fetchError) {
        // Still valid URL, just couldn't fetch metadata
        setUrlAnalysis({
          isValid: true,
          isOfficial,
          detectedFormat: `${formatIcon} ${detectedFormat}`,
          corsWarning: isLikelyCorsBlocked(url),
          isAnalyzing: false,
          error: 'Could not verify document accessibility'
        });
      }

    } catch (error) {
      setUrlAnalysis({
        isValid: false,
        isOfficial: false,
        detectedFormat: 'Invalid URL',
        corsWarning: false,
        isAnalyzing: false,
        error: 'Please enter a valid URL'
      });
    }
  };

  // Debounced URL analysis
  useEffect(() => {
    if (!manualUrl.trim()) {
      setUrlAnalysis({
        isValid: false,
        isOfficial: false,
        detectedFormat: 'unknown',
        corsWarning: false,
        isAnalyzing: false
      });
      return;
    }

    const timeoutId = setTimeout(() => {
      analyzeUrl(manualUrl);
    }, 1000); // Wait 1 second after user stops typing

    return () => clearTimeout(timeoutId);
  }, [manualUrl]);

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

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('ingestion.enterUrl')}
                </label>
                <div className="relative">
                  <input
                    type="url"
                    value={manualUrl}
                    onChange={(e) => {
                      setManualUrl(e.target.value);
                      setUploadedFile(null); // Clear file when URL is entered
                    }}
                    placeholder="https://www.diputados.gob.mx/LeyesBiblio/pdf/CPEUM.pdf"
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-legal-500 dark:bg-gray-700 dark:text-white transition-colors ${
                      manualUrl.trim() && urlAnalysis.isValid 
                        ? 'border-green-300 dark:border-green-600' 
                        : manualUrl.trim() && !urlAnalysis.isAnalyzing && !urlAnalysis.isValid
                        ? 'border-red-300 dark:border-red-600'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                  />
                  {urlAnalysis.isAnalyzing && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-legal-600"></div>
                    </div>
                  )}
                </div>

                {/* URL Analysis Results */}
                {manualUrl.trim() && !urlAnalysis.isAnalyzing && (
                  <div className={`p-3 rounded-lg border ${
                    urlAnalysis.isValid 
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                      : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                  }`}>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium">
                            {urlAnalysis.detectedFormat}
                          </span>
                          {urlAnalysis.isOfficial && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              🏛️ Official Source
                            </span>
                          )}
                          {urlAnalysis.estimatedSize && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {urlAnalysis.estimatedSize}
                            </span>
                          )}
                        </div>
                        {urlAnalysis.error && (
                          <p className="text-xs text-red-600 dark:text-red-400">
                            {urlAnalysis.error}
                          </p>
                        )}
                        {urlAnalysis.isValid && !urlAnalysis.error && (
                          <>
                            <p className="text-xs text-green-600 dark:text-green-400">
                              ✓ Document is accessible and ready for ingestion
                            </p>
                            {urlAnalysis.corsWarning && (
                              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                ⚠️ CORS may block direct access - fallback strategies available
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Quick Examples */}
                {!manualUrl.trim() && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                      Quick examples:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { 
                          label: '📄 Constitution (PDF)', 
                          url: 'https://www.diputados.gob.mx/LeyesBiblio/pdf/CPEUM.pdf' 
                        },
                        { 
                          label: '📝 Constitution (DOC)', 
                          url: 'https://www.diputados.gob.mx/LeyesBiblio/doc/CPEUM.doc' 
                        },
                        { 
                          label: '📄 Labor Law (PDF)', 
                          url: 'https://www.diputados.gob.mx/LeyesBiblio/pdf/125_120924.pdf' 
                        }
                      ].map((example, index) => (
                        <button
                          key={index}
                          onClick={() => setManualUrl(example.url)}
                          className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                          {example.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
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
      {result && !(corsError && corsError.blocked) && (
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

      {/* CORS Error Help Section - Independent */}
      {corsError && corsError.blocked && (
        <div className="p-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
          <div className="flex items-start space-x-3">
            <span className="text-2xl">🔒</span>
            <div className="flex-1">
              <h3 className="font-medium text-amber-800 dark:text-amber-200 mb-2">
                CORS Policy Blocked Document Access
              </h3>
              <p className="text-sm text-amber-700 dark:text-amber-300 mb-4">
                Your browser blocked direct access to <code className="px-1 py-0.5 bg-amber-100 dark:bg-amber-800 rounded text-xs">{corsError.url}</code> due to CORS security policy. 
                This is normal for external websites.
              </p>
              
              {corsError.suggestions.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium text-amber-800 dark:text-amber-200 text-sm">
                    📝 Alternative Options:
                  </h4>
                  <ul className="space-y-2 text-sm text-amber-700 dark:text-amber-300">
                    {corsError.suggestions.map((suggestion, index) => (
                      <li key={index} className="flex items-start space-x-2">
                        <span className="text-amber-600 dark:text-amber-400 flex-shrink-0">•</span>
                        <span>{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <div className="mt-4 p-3 bg-amber-100 dark:bg-amber-800 rounded border border-amber-200 dark:border-amber-600">
                    <div className="flex items-start space-x-2">
                      <span className="text-blue-600 dark:text-blue-400 text-sm">💡</span>
                      <div className="text-sm text-amber-800 dark:text-amber-200">
                        <strong>Recommended:</strong> Use the file upload option above instead of the URL. Download the document to your computer first, then upload it here.
                      </div>
                    </div>
                  </div>
                  
                  {/* Action Button for CORS Error */}
                  <div className="mt-4">
                    <button
                      onClick={() => {
                        setCorsError(null);
                        setResult(null);
                        setProgress(null);
                        setProgressHistory([]);
                      }}
                      className="w-full px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                    >
                      Try Another Document
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}