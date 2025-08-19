import { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n/index';
import { corpusService, type DocumentMetrics } from '../../lib/admin/corpus-service';
import { adminDataService, type CorpusStats } from '../../lib/admin/admin-data-service';
import type { LegalDocument, DocumentType, LegalArea } from '../../types/legal';
import type { CorpusFilter } from '../../lib/admin/corpus-service';

export default function CorpusManager() {
  const { t } = useTranslation();
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<LegalDocument | null>(null);
  const [documentMetrics, setDocumentMetrics] = useState<DocumentMetrics | null>(null);
  const [corpusStats, setCorpusStats] = useState<CorpusStats | null>(null);
  const [filter, setFilter] = useState<CorpusFilter>({});
  const [loading, setLoading] = useState(true);
  const [operation, setOperation] = useState<string | null>(null);
  const [validationResults, setValidationResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDocuments();
    loadStats();
  }, [filter]);

  useEffect(() => {
    if (selectedDocument) {
      loadDocumentMetrics(selectedDocument.id);
    }
  }, [selectedDocument]);

  const loadDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      // Use adminDataService which now calls API endpoints
      let docs = await adminDataService.getDocumentsList();
      
      // Apply client-side filtering for now
      if (filter.type) {
        docs = docs.filter(doc => doc.type === filter.type);
      }
      if (filter.legalArea) {
        docs = docs.filter(doc => doc.primaryArea === filter.legalArea);
      }
      if (filter.searchTerm) {
        const searchLower = filter.searchTerm.toLowerCase();
        docs = docs.filter(doc => 
          doc.title.toLowerCase().includes(searchLower) ||
          doc.identifier?.toLowerCase().includes(searchLower)
        );
      }
      
      setDocuments(docs);
    } catch (error) {
      console.error('Failed to load documents:', error);
      setError(error instanceof Error ? error.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const stats = await adminDataService.getCorpusStats();
      setCorpusStats(stats);
    } catch (error) {
      console.error('Failed to load stats:', error);
      setError(error instanceof Error ? error.message : 'Failed to load statistics');
    }
  };

  const loadDocumentMetrics = async (documentId: string) => {
    try {
      // For now, create basic metrics from the document data
      const doc = documents.find(d => d.id === documentId);
      if (doc) {
        const metrics: DocumentMetrics = {
          id: doc.id,
          title: doc.title,
          type: doc.type,
          legalArea: doc.primaryArea,
          chunks: doc.content?.length || 0,
          embeddings: doc.content?.length || 0, // Assume all chunks have embeddings
          lastUpdated: doc.lastModified || new Date().toISOString(),
          size: JSON.stringify(doc).length,
          quality: 85 // Placeholder quality score
        };
        setDocumentMetrics(metrics);
      }
    } catch (error) {
      console.error('Failed to load document metrics:', error);
      setError('Failed to load document details');
    }
  };

  const handleDelete = async (documentId: string) => {
    if (!confirm(t('admin.corpus.confirmDelete'))) return;
    
    setOperation('delete');
    setError(null);
    try {
      await adminDataService.deleteDocument(documentId);
      await loadDocuments();
      await loadStats();
      setSelectedDocument(null);
      alert(t('admin.corpus.deleteSuccess'));
    } catch (error) {
      console.error('Failed to delete document:', error);
      setError(error instanceof Error ? error.message : t('admin.corpus.deleteError'));
    } finally {
      setOperation(null);
    }
  };

  const handleReindex = async (documentId: string) => {
    setOperation('reindex');
    setError(null);
    try {
      // Call embeddings generation API for specific document
      const response = await fetch('/api/embeddings/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          operation: 'regenerate',
          documentIds: [documentId] 
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Reindex failed: ${response.status}`);
      }
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Reindex failed');
      }
      
      await loadDocuments();
      alert(t('admin.corpus.reindexSuccess'));
    } catch (error) {
      console.error('Failed to reindex document:', error);
      setError(error instanceof Error ? error.message : t('admin.corpus.reindexError'));
    } finally {
      setOperation(null);
    }
  };

  const handleValidate = async () => {
    setOperation('validate');
    setError(null);
    try {
      // Call corpus stats API with detailed validation
      const response = await fetch('/api/corpus/stats?detailed=true');
      if (!response.ok) {
        throw new Error(`Validation failed: ${response.status}`);
      }
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Validation failed');
      }
      
      setValidationResults(data.data.validation);
    } catch (error) {
      console.error('Failed to validate corpus:', error);
      setError(error instanceof Error ? error.message : t('admin.corpus.validateError'));
    } finally {
      setOperation(null);
    }
  };

  const handleExport = async () => {
    setOperation('export');
    try {
      const blob = await adminDataService.exportCorpus();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `corpus-${new Date().toISOString()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export corpus:', error);
      alert(t('admin.corpus.exportError'));
    } finally {
      setOperation(null);
    }
  };

  const handleImport = async (file: File) => {
    setOperation('import');
    setError(null);
    try {
      // For now, show a message that import is not yet implemented via API
      setError('Document import via API is not yet implemented. Please use the corpus builder tools.');
      
      // TODO: Implement import API endpoint
      // const formData = new FormData();
      // formData.append('document', file);
      // const response = await fetch('/api/corpus/import', {
      //   method: 'POST',
      //   body: formData,
      // });
      
    } catch (error) {
      console.error('Failed to import document:', error);
      setError(error instanceof Error ? error.message : t('admin.corpus.importError'));
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

  return (
    <div className="p-6">
      {/* Stats Overview */}
      {corpusStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {t('admin.corpus.stats.totalDocuments')}
            </h3>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {corpusStats.totalDocuments}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {t('admin.corpus.stats.totalChunks')}
            </h3>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {corpusStats.totalChunks}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {t('admin.corpus.stats.totalSize')}
            </h3>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {formatBytes(corpusStats.totalSize)}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {t('admin.corpus.stats.lastUpdate')}
            </h3>
            <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">
              {new Date(corpusStats.lastUpdate).toLocaleDateString()}
            </p>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
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

      {/* Actions Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6 p-4">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={handleValidate}
              disabled={operation !== null}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {operation === 'validate' ? t('admin.corpus.validating') : t('admin.corpus.validate')}
            </button>
            <button
              onClick={handleExport}
              disabled={operation !== null}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {operation === 'export' ? t('admin.corpus.exporting') : t('admin.corpus.export')}
            </button>
            <label className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 cursor-pointer">
              <input
                type="file"
                accept=".json"
                onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])}
                className="hidden"
                disabled={operation !== null}
              />
              {operation === 'import' ? t('admin.corpus.importing') : t('admin.corpus.import')}
            </label>
          </div>
          
          {/* Filters */}
          <div className="flex gap-2">
            <select
              value={filter.type || ''}
              onChange={(e) => setFilter({ ...filter, type: e.target.value as DocumentType || undefined })}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
            >
              <option value="">{t('admin.corpus.allTypes')}</option>
              <option value="law">{t('admin.corpus.types.law')}</option>
              <option value="code">{t('admin.corpus.types.code')}</option>
              <option value="regulation">{t('admin.corpus.types.regulation')}</option>
              <option value="norm">{t('admin.corpus.types.norm')}</option>
            </select>
            
            <select
              value={filter.legalArea || ''}
              onChange={(e) => setFilter({ ...filter, legalArea: e.target.value as LegalArea || undefined })}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
            >
              <option value="">{t('admin.corpus.allAreas')}</option>
              <option value="civil">{t('admin.corpus.areas.civil')}</option>
              <option value="criminal">{t('admin.corpus.areas.criminal')}</option>
              <option value="labor">{t('admin.corpus.areas.labor')}</option>
              <option value="tax">{t('admin.corpus.areas.tax')}</option>
              <option value="commercial">{t('admin.corpus.areas.commercial')}</option>
            </select>
            
            <input
              type="text"
              placeholder={t('admin.corpus.search')}
              value={filter.searchTerm || ''}
              onChange={(e) => setFilter({ ...filter, searchTerm: e.target.value })}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Validation Results */}
      {validationResults && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6 p-4">
          <h3 className="text-lg font-semibold mb-3">{t('admin.corpus.validationResults')}</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <span className="text-green-600 font-bold">{validationResults.valid}</span> {t('admin.corpus.validDocuments')}
            </div>
            <div>
              <span className="text-red-600 font-bold">{validationResults.invalid}</span> {t('admin.corpus.invalidDocuments')}
            </div>
          </div>
          {validationResults.issues.length > 0 && (
            <div className="max-h-60 overflow-y-auto">
              <h4 className="text-sm font-medium mb-2">{t('admin.corpus.issues')}</h4>
              {validationResults.issues.map((item: any) => (
                <div key={item.documentId} className="text-sm mb-2">
                  <span className="font-mono">{item.documentId}:</span>
                  <ul className="ml-4 text-red-600">
                    {item.issues.map((issue: string, idx: number) => (
                      <li key={idx}>• {issue}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Document List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('admin.corpus.table.title')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('admin.corpus.table.type')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('admin.corpus.table.area')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('admin.corpus.table.chunks')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('admin.corpus.table.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    {t('admin.corpus.loading')}
                  </td>
                </tr>
              ) : !documents || documents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    {t('admin.corpus.noDocuments')}
                  </td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr 
                    key={doc.id}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer ${
                      selectedDocument?.id === doc.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                    onClick={() => setSelectedDocument(doc)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {doc.title}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {doc.type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {doc.primaryArea}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {doc.content?.length || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReindex(doc.id);
                        }}
                        disabled={operation !== null}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-3"
                      >
                        {t('admin.corpus.reindex')}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(doc.id);
                        }}
                        disabled={operation !== null}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                      >
                        {t('admin.corpus.delete')}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Document Details */}
      {selectedDocument && documentMetrics && (
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">{t('admin.corpus.documentDetails')}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.corpus.details.id')}</p>
              <p className="font-mono text-sm">{selectedDocument.id}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.corpus.details.hierarchy')}</p>
              <p className="text-sm">{selectedDocument.hierarchy}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.corpus.details.size')}</p>
              <p className="text-sm">{formatBytes(documentMetrics.size)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.corpus.details.quality')}</p>
              <div className="flex items-center">
                <div className="w-32 bg-gray-200 rounded-full h-2 mr-2">
                  <div 
                    className={`h-2 rounded-full ${
                      documentMetrics.quality >= 80 ? 'bg-green-600' :
                      documentMetrics.quality >= 50 ? 'bg-yellow-600' : 'bg-red-600'
                    }`}
                    style={{ width: `${documentMetrics.quality}%` }}
                  />
                </div>
                <span className="text-sm">{documentMetrics.quality}%</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.corpus.details.embeddings')}</p>
              <p className="text-sm">{documentMetrics.embeddings} / {documentMetrics.chunks}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.corpus.details.lastUpdated')}</p>
              <p className="text-sm">{new Date(documentMetrics.lastUpdated).toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}