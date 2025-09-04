import { useState, useEffect } from 'react';
import { offlineQueueManager, type OfflineQuery, type OfflineDocument } from '../lib/offline/offline-queue-manager';
import { useTranslation } from '../i18n/index';
import '../types/background-sync';

/**
 * Offline Queue Management Component
 * Shows pending queries and documents, sync status, and manual sync controls
 */
export default function OfflineQueueManager() {
  const [isOpen, setIsOpen] = useState(false);
  const [stats, setStats] = useState<{
    queries: { pending: number; completed: number; failed: number };
    documents: { pending: number; completed: number; failed: number };
  } | null>(null);
  const [pendingQueries, setPendingQueries] = useState<OfflineQuery[]>([]);
  const [pendingDocuments, setPendingDocuments] = useState<OfflineDocument[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    loadQueueData();
    
    // Listen for online/offline events
    const handleOnline = () => {
      setIsOnline(true);
      loadQueueData(); // Refresh data when coming online
    };
    
    const handleOffline = () => {
      setIsOnline(false);
    };

    // Listen for queue completion events
    const handleQueryCompleted = (event: CustomEvent) => {
      console.log('Query completed:', event.detail);
      loadQueueData();
      setLastSync(new Date());
    };

    const handleDocumentCompleted = (event: CustomEvent) => {
      console.log('Document completed:', event.detail);
      loadQueueData();
      setLastSync(new Date());
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('offline-queryCompleted', handleQueryCompleted as EventListener);
    window.addEventListener('offline-documentCompleted', handleDocumentCompleted as EventListener);

    // Poll for updates every 30 seconds
    const pollInterval = setInterval(loadQueueData, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('offline-queryCompleted', handleQueryCompleted as EventListener);
      window.removeEventListener('offline-documentCompleted', handleDocumentCompleted as EventListener);
      clearInterval(pollInterval);
    };
  }, []);

  const loadQueueData = async () => {
    try {
      const [queueStats, queries, documents] = await Promise.all([
        offlineQueueManager.getQueueStats(),
        offlineQueueManager.getPendingQueries(),
        offlineQueueManager.getPendingDocuments()
      ]);

      setStats(queueStats);
      setPendingQueries(queries);
      setPendingDocuments(documents);
    } catch (error) {
      console.error('Failed to load queue data:', error);
    }
  };

  const handleClearCompleted = async () => {
    try {
      await offlineQueueManager.clearCompleted();
      await loadQueueData();
    } catch (error) {
      console.error('Failed to clear completed items:', error);
    }
  };

  const triggerSync = async () => {
    if (!isOnline) {
      alert(t('offline.noConnection') || 'No hay conexión a internet disponible');
      return;
    }

    try {
      // Trigger background sync if available
      if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
        const registration = await navigator.serviceWorker.ready;
        
        await Promise.all([
          registration.sync.register('legal-query-sync'),
          registration.sync.register('document-upload-sync')
        ]);
        
        setLastSync(new Date());
        alert(t('offline.syncTriggered') || 'Sincronización iniciada en segundo plano');
      } else {
        alert(t('offline.syncNotSupported') || 'Sincronización en segundo plano no disponible');
      }
    } catch (error) {
      console.error('Failed to trigger sync:', error);
      alert(t('offline.syncError') || 'Error al iniciar sincronización');
    }
  };

  const formatTimeAgo = (date: Date): string => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    
    if (seconds < 60) return t('time.justNow') || 'Hace un momento';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  const getTotalPending = (): number => {
    return (stats?.queries.pending || 0) + (stats?.documents.pending || 0);
  };

  // Don't render if no pending items and never been opened
  const totalPending = getTotalPending();
  if (!isOpen && totalPending === 0) {
    return null;
  }

  // Floating button when closed
  if (!isOpen) {
    return (
      <div className="fixed bottom-20 right-4 z-40">
        <button
          onClick={() => setIsOpen(true)}
          className={`relative p-3 rounded-full shadow-lg transition-colors ${
            isOnline 
              ? 'bg-green-500 hover:bg-green-600 text-white' 
              : 'bg-orange-500 hover:bg-orange-600 text-white'
          }`}
          title={
            isOnline 
              ? t('offline.onlineWithQueue') || `En línea - ${totalPending} pendientes`
              : t('offline.offlineWithQueue') || `Sin conexión - ${totalPending} pendientes`
          }
        >
          {isOnline ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M12 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          
          {totalPending > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {totalPending > 9 ? '9+' : totalPending}
            </span>
          )}
        </button>
      </div>
    );
  }

  // Full queue manager panel
  return (
    <div className="fixed bottom-4 right-4 z-40 w-96 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-[70vh] overflow-hidden">
      {/* Header */}
      <div className={`flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 ${
        isOnline ? 'bg-green-50 dark:bg-green-900/20' : 'bg-orange-50 dark:bg-orange-900/20'
      }`}>
        <div className="flex items-center space-x-2">
          {isOnline ? (
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M12 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {isOnline ? t('offline.online') || 'En línea' : t('offline.offline') || 'Sin conexión'}
          </h3>
          {lastSync && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {t('offline.lastSync') || 'Última sync'}: {formatTimeAgo(lastSync)}
            </span>
          )}
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-4 overflow-y-auto max-h-[50vh]">
        {/* Stats Summary */}
        {stats && (
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
              <div className="text-sm font-medium text-blue-900 dark:text-blue-100">
                {t('offline.queries') || 'Consultas'}
              </div>
              <div className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                {stats.queries.pending} {t('offline.pending') || 'pendientes'} •{' '}
                {stats.queries.completed} {t('offline.completed') || 'completadas'}
                {stats.queries.failed > 0 && (
                  <span className="text-red-600">
                    {' '}• {stats.queries.failed} {t('offline.failed') || 'fallidas'}
                  </span>
                )}
              </div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
              <div className="text-sm font-medium text-purple-900 dark:text-purple-100">
                {t('offline.documents') || 'Documentos'}
              </div>
              <div className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                {stats.documents.pending} {t('offline.pending') || 'pendientes'} •{' '}
                {stats.documents.completed} {t('offline.completed') || 'completadas'}
                {stats.documents.failed > 0 && (
                  <span className="text-red-600">
                    {' '}• {stats.documents.failed} {t('offline.failed') || 'fallidas'}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Pending Queries */}
        {pendingQueries.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              {t('offline.pendingQueries') || 'Consultas pendientes'}
            </h4>
            <div className="space-y-2">
              {pendingQueries.slice(0, 3).map((query) => (
                <div key={query.id} className="bg-gray-50 dark:bg-gray-700 p-3 rounded text-sm">
                  <div className="font-medium text-gray-900 dark:text-white truncate">
                    {query.query.length > 50 ? `${query.query.substring(0, 50)}...` : query.query}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center justify-between">
                    <span>{formatTimeAgo(new Date(query.timestamp))}</span>
                    {query.retryCount > 0 && (
                      <span className="text-orange-600">
                        {query.retryCount}/{query.maxRetries} {t('offline.retries') || 'reintentos'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {pendingQueries.length > 3 && (
                <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  +{pendingQueries.length - 3} {t('offline.more') || 'más'}...
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pending Documents */}
        {pendingDocuments.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              {t('offline.pendingDocuments') || 'Documentos pendientes'}
            </h4>
            <div className="space-y-2">
              {pendingDocuments.slice(0, 3).map((doc) => (
                <div key={doc.id} className="bg-gray-50 dark:bg-gray-700 p-3 rounded text-sm">
                  <div className="font-medium text-gray-900 dark:text-white truncate">
                    📄 {doc.filename}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {formatTimeAgo(new Date(doc.timestamp))}
                  </div>
                </div>
              ))}
              {pendingDocuments.length > 3 && (
                <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  +{pendingDocuments.length - 3} {t('offline.more') || 'más'}...
                </div>
              )}
            </div>
          </div>
        )}

        {/* No pending items */}
        {totalPending === 0 && (
          <div className="text-center py-6 text-gray-500 dark:text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm">
              {t('offline.noPending') || 'No hay elementos pendientes'}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex space-x-2 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={triggerSync}
            disabled={!isOnline || totalPending === 0}
            className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium py-2 px-3 rounded"
          >
            {isOnline ? (
              <>
                <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {t('offline.syncNow') || 'Sincronizar'}
              </>
            ) : (
              <>
                <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364" />
                </svg>
                {t('offline.waitingConnection') || 'Sin conexión'}
              </>
            )}
          </button>
          
          {(stats?.queries.completed || 0) + (stats?.documents.completed || 0) > 0 && (
            <button
              onClick={handleClearCompleted}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-sm font-medium py-2 px-3"
            >
              {t('offline.clear') || 'Limpiar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}