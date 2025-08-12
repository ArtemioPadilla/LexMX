import { useState, useEffect } from 'react';
import { HydrationBoundary, LoadingStates } from '../components/HydrationBoundary';
import { TEST_IDS } from '../utils/test-ids';
import type { 
  DocumentRequest, 
  ModerationAction, 
  ModeratorUser, 
  RequestStats,
  RequestStatus,
  RequestFilter
} from '../types/legal';
import { REQUEST_STATUS_LABELS, PRIORITY_LABELS } from '../types/legal';

interface ModerationPanelProps {
  requests: DocumentRequest[];
  moderator: ModeratorUser;
  stats: RequestStats;
  onApprove: (requestId: string, reason: string) => Promise<void>;
  onReject: (requestId: string, reason: string) => Promise<void>;
  onAssign: (requestId: string, moderatorId: string) => Promise<void>;
  onMerge: (requestId: string, targetId: string) => Promise<void>;
  onPriorityChange: (requestId: string, priority: string) => Promise<void>;
}

export default function ModerationPanel({
  requests,
  moderator,
  stats,
  onApprove,
  onReject,
  onAssign,
  onMerge,
  onPriorityChange
}: ModerationPanelProps) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'assigned' | 'stats' | 'all'>('pending');
  const [selectedRequests, setSelectedRequests] = useState<Set<string>>(new Set());
  const [actionModal, setActionModal] = useState<{
    type: 'approve' | 'reject' | 'merge' | null;
    requestId: string | null;
    reason: string;
  }>({ type: null, requestId: null, reason: '' });
  const [filter, setFilter] = useState<RequestFilter>({});

  // Handle hydration
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const assignedRequests = requests.filter(r => r.assignedTo === moderator.id);
  const flaggedRequests = requests.filter(r => 
    r.comments.some(c => c.flagged) || 
    (r as any).flagged
  );

  const filteredRequests = (() => {
    let filtered = requests;
    
    switch (activeTab) {
      case 'pending':
        filtered = pendingRequests;
        break;
      case 'assigned':
        filtered = assignedRequests;
        break;
      case 'all':
        filtered = requests;
        break;
    }

    // Apply additional filters
    if (filter.status) {
      filtered = filtered.filter(r => filter.status!.includes(r.status));
    }
    if (filter.priority) {
      filtered = filtered.filter(r => filter.priority!.includes(r.priority));
    }
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      filtered = filtered.filter(r => 
        r.title.toLowerCase().includes(searchLower) ||
        r.description.toLowerCase().includes(searchLower)
      );
    }

    return filtered.sort((a, b) => {
      // Prioritize by votes, then by date
      if (a.votes !== b.votes) return b.votes - a.votes;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  })();

  const handleBulkAction = async (action: 'approve' | 'reject', reason: string) => {
    const promises = Array.from(selectedRequests).map(requestId => {
      return action === 'approve' 
        ? onApprove(requestId, reason)
        : onReject(requestId, reason);
    });

    try {
      await Promise.all(promises);
      setSelectedRequests(new Set());
    } catch (error) {
      console.error('Error in bulk action:', error);
    }
  };

  const handleSingleAction = async () => {
    if (!actionModal.type || !actionModal.requestId || !actionModal.reason.trim()) return;

    try {
      switch (actionModal.type) {
        case 'approve':
          await onApprove(actionModal.requestId, actionModal.reason);
          break;
        case 'reject':
          await onReject(actionModal.requestId, actionModal.reason);
          break;
        case 'merge':
          // For merge, reason would contain the target request ID
          await onMerge(actionModal.requestId, actionModal.reason);
          break;
      }
      setActionModal({ type: null, requestId: null, reason: '' });
    } catch (error) {
      console.error('Error in moderation action:', error);
    }
  };

  const getRequestPriorityScore = (request: DocumentRequest): number => {
    let score = request.votes * 0.4; // Base score from votes
    
    // Authority bonus
    if (request.authority) score += 10;
    
    // Official source bonus
    const hasOfficialSource = request.sources.some(s => s.isOfficial);
    if (hasOfficialSource) score += 15;
    
    // Type importance
    const typeBonus = {
      constitution: 50,
      law: 30,
      code: 25,
      regulation: 15,
      norm: 10,
      jurisprudence: 20,
      treaty: 35,
      format: 5
    };
    score += typeBonus[request.type] || 0;
    
    // Recency factor (newer requests get slight boost)
    const daysSinceCreated = (Date.now() - new Date(request.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    const recencyBonus = Math.max(0, 10 - daysSinceCreated * 0.5);
    score += recencyBonus;
    
    return Math.round(score);
  };

  const formatTimeAgo = (dateString: string): string => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) return `hace ${diffMins} min`;
    if (diffHours < 24) return `hace ${diffHours}h`;
    return `hace ${diffDays}d`;
  };
  // Handle SSR/hydration
  if (!isHydrated) {
    return (
      <HydrationBoundary 
        fallback={<LoadingStates.ModerationPanel />} 
        testId="moderation-panel"
      />
    );
  }

  return (
    <div
      data-testid="moderation-panel" className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Panel de Moderación
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-2">
              Bienvenido, {moderator.username} - {moderator.role}
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <div className="text-sm text-gray-500 dark:text-gray-400">Revisadas</div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">
                {moderator.stats.totalReviewed}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500 dark:text-gray-400">Tasa de Aprobación</div>
              <div className="text-xl font-bold text-green-600">
                {Math.round(moderator.stats.approvalRate * 100)}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-yellow-500 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <div className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">
                {pendingRequests.length}
              </div>
              <div className="text-sm text-yellow-700 dark:text-yellow-300">Pendientes</div>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="ml-4">
              <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                {assignedRequests.length}
              </div>
              <div className="text-sm text-blue-700 dark:text-blue-300">Asignadas</div>
            </div>
          </div>
        </div>

        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-red-500 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="ml-4">
              <div className="text-2xl font-bold text-red-900 dark:text-red-100">
                {flaggedRequests.length}
              </div>
              <div className="text-sm text-red-700 dark:text-red-300">Reportadas</div>
            </div>
          </div>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                {requests.filter(r => r.status === 'completed').length}
              </div>
              <div className="text-sm text-green-700 dark:text-green-300">Completadas</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-600 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'pending', label: 'Pendientes', count: pendingRequests.length },
            { key: 'assigned', label: 'Asignadas', count: assignedRequests.length },
            { key: 'all', label: 'Todas', count: requests.length },
            { key: 'stats', label: 'Estadísticas', count: 0 }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.key
                  ? 'border-legal-500 text-legal-600 dark:text-legal-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-300 py-0.5 px-2 rounded-full text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'stats' ? (
        /* Statistics View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Por Estado
            </h3>
            <div className="space-y-3">
              {Object.entries(stats.byStatus).map(([status, count]) => (
                <div key={status} className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">
                    {REQUEST_STATUS_LABELS[status as RequestStatus]}
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Por Tipo
            </h3>
            <div className="space-y-3">
              {Object.entries(stats.byType).map(([type, count]) => (
                <div key={type} className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400 capitalize">
                    {type}
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Métricas Generales
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">
                  Total de Solicitudes
                </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {stats.total}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">
                  Tiempo Promedio
                </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {Math.round(stats.averageCompletionTime / (1000 * 60 * 60 * 24))} días
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Request List View */
        <>
          {/* Filters and Bulk Actions */}
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                <input
                  type="text"
                  placeholder="Buscar solicitudes..."
                  value={filter.search || ''}
                  onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-legal-500 dark:bg-gray-700 dark:text-white"
                />
                
                {selectedRequests.size > 0 && (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {selectedRequests.size} seleccionadas
                    </span>
                    <button
                      onClick={() => handleBulkAction('approve', 'Aprobación en lote')}
                      className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                    >
                      Aprobar Todas
                    </button>
                    <button
                      onClick={() => handleBulkAction('reject', 'Rechazo en lote')}
                      className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                    >
                      Rechazar Todas
                    </button>
                  </div>
                )}
              </div>
              
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Mostrando {filteredRequests.length} solicitudes
              </div>
            </div>
          </div>

          {/* Request Cards */}
          <div className="space-y-4">
            {filteredRequests.map(request => (
              <div key={request.id} className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow">
                <div className="p-6">
                  <div className="flex items-start space-x-4">
                    {/* Selection Checkbox */}
                    <input
                      type="checkbox"
                      checked={selectedRequests.has(request.id)}
                      onChange={(e) => {
                        const newSelected = new Set(selectedRequests);
                        if (e.target.checked) {
                          newSelected.add(request.id);
                        } else {
                          newSelected.delete(request.id);
                        }
                        setSelectedRequests(newSelected);
                      }}
                      className="mt-1 w-4 h-4 text-legal-600 focus:ring-legal-500 border-gray-300 rounded"
                    />

                    {/* Request Content */}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            request.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300' :
                            request.status === 'under_review' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300' :
                            request.status === 'in_progress' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300' :
                            request.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' :
                            'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                            {REQUEST_STATUS_LABELS[request.status]}
                          </span>
                          
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            request.priority === 'critical' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300' :
                            request.priority === 'high' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300' :
                            request.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300' :
                            'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                            {PRIORITY_LABELS[request.priority]}
                          </span>

                          <div className="flex items-center text-legal-600 dark:text-legal-400">
                            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                            </svg>
                            <span className="text-sm font-semibold">{request.votes}</span>
                          </div>

                          <div className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs font-medium">
                            Score: {getRequestPriorityScore(request)}
                          </div>
                        </div>

                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {formatTimeAgo(request.createdAt)}
                        </div>
                      </div>

                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        {request.title}
                      </h3>

                      <p className="text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">
                        {request.description}
                      </p>

                      <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 space-x-4 mb-4">
                        <span>{request.type} • {request.primaryArea}</span>
                        <span>{request.sources.length} fuente(s)</span>
                        <span>{request.comments.length} comentarios</span>
                        {request.sources.some(s => s.isOfficial) && (
                          <span className="text-green-600 dark:text-green-400 font-medium">
                            ✓ Fuente oficial
                          </span>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => setActionModal({ 
                            type: 'approve', 
                            requestId: request.id, 
                            reason: '' 
                          })}
                          className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                        >
                          Aprobar
                        </button>
                        
                        <button
                          onClick={() => setActionModal({ 
                            type: 'reject', 
                            requestId: request.id, 
                            reason: '' 
                          })}
                          className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                        >
                          Rechazar
                        </button>

                        <button
                          onClick={() => onAssign(request.id, moderator.id)}
                          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          Asignar a mí
                        </button>

                        <button
                          onClick={() => setActionModal({ 
                            type: 'merge', 
                            requestId: request.id, 
                            reason: '' 
                          })}
                          className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                          Fusionar
                        </button>

                        <select
                          onChange={(e) => onPriorityChange(request.id, e.target.value)}
                          defaultValue={request.priority}
                          className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:ring-2 focus:ring-legal-500 dark:bg-gray-700 dark:text-white"
                        >
                          <option value="low">Baja</option>
                          <option value="medium">Media</option>
                          <option value="high">Alta</option>
                          <option value="critical">Crítica</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Action Modal */}
      {actionModal.type && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {actionModal.type === 'approve' ? 'Aprobar Solicitud' :
               actionModal.type === 'reject' ? 'Rechazar Solicitud' :
               'Fusionar Solicitud'}
            </h3>
            
            <textarea
              value={actionModal.reason}
              onChange={(e) => setActionModal(prev => ({ ...prev, reason: e.target.value }))}
              placeholder={
                actionModal.type === 'approve' ? 'Razón para la aprobación...' :
                actionModal.type === 'reject' ? 'Razón para el rechazo...' :
                'ID de la solicitud con la que fusionar...'
              }
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-legal-500 dark:bg-gray-700 dark:text-white mb-4"
            />
            
            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setActionModal({ type: null, requestId: null, reason: '' })}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Cancelar
              </button>
              <button
                onClick={handleSingleAction}
                disabled={!actionModal.reason.trim()}
                className="px-4 py-2 bg-legal-600 text-white rounded hover:bg-legal-700 focus:outline-none focus:ring-2 focus:ring-legal-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}