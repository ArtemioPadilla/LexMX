import { useState, useEffect } from 'react';
import { HydrationBoundary, LoadingStates } from '../components/HydrationBoundary';
import { TEST_IDS } from '../utils/test-ids';
import type { 
  DocumentRequest, 
  RequestFilter, 
  RequestStatus, 
  DocumentType, 
  LegalArea, 
  RequestPriority,
  RequestComment
} from '../types/legal';
import { 
  REQUEST_STATUS_LABELS, 
  PRIORITY_LABELS, 
  REQUEST_VOTE_THRESHOLDS 
} from '../types/legal';

interface DocumentRequestListProps {
  requests: DocumentRequest[];
  currentUserId?: string;
  onVote: (requestId: string, vote: 'up' | 'down') => Promise<void>;
  onComment: (requestId: string, comment: string) => Promise<void>;
  onStatusChange?: (requestId: string, status: RequestStatus, reason?: string) => Promise<void>;
  isModeratorView?: boolean;
}

export default function DocumentRequestList({ 
  requests = [], 
  currentUserId, 
  onVote, 
  onComment, 
  onStatusChange,
  isModeratorView = false 
}: DocumentRequestListProps) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [filter, setFilter] = useState<RequestFilter>({});
  const [sortBy, setSortBy] = useState<'votes' | 'date' | 'priority'>('votes');
  const [expandedRequest, setExpandedRequest] = useState<string | null>(null);
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [votingStates, setVotingStates] = useState<Record<string, boolean>>({});

  // Handle hydration
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const filteredAndSortedRequests = (requests || [])
    .filter(request => {
      if (filter.status && !filter.status.includes(request.status)) return false;
      if (filter.type && !filter.type.includes(request.type)) return false;
      if (filter.area && !filter.area.includes(request.primaryArea)) return false;
      if (filter.priority && !filter.priority.includes(request.priority)) return false;
      if (filter.minVotes && request.votes < filter.minVotes) return false;
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        return request.title?.toLowerCase().includes(searchLower) ||
               request.description?.toLowerCase().includes(searchLower);
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'votes':
          return b.votes - a.votes;
        case 'date':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'priority':
          const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        default:
          return 0;
      }
    });

  const handleVote = async (requestId: string, voteType: 'up' | 'down') => {
    if (!currentUserId || votingStates[requestId]) return;

    setVotingStates(prev => ({ ...prev, [requestId]: true }));
    
    try {
      await onVote(requestId, voteType);
    } catch (error) {
      console.error('Error voting:', error);
    } finally {
      setVotingStates(prev => ({ ...prev, [requestId]: false }));
    }
  };

  const handleComment = async (requestId: string) => {
    const comment = commentText[requestId]?.trim();
    if (!comment || !currentUserId) return;

    try {
      await onComment(requestId, comment);
      setCommentText(prev => ({ ...prev, [requestId]: '' }));
    } catch (error) {
      console.error('Error commenting:', error);
    }
  };

  const getPriorityColor = (priority: RequestPriority) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'low': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getStatusColor = (status: RequestStatus) => {
    switch (status) {
      case 'pending': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      case 'under_review': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
      case 'in_progress': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300';
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'rejected': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      case 'duplicate': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
    }
  };

  const getVoteThresholdProgress = (votes: number) => {
    const thresholds = Object.values(REQUEST_VOTE_THRESHOLDS);
    const nextThreshold = thresholds.find(t => votes < t) || thresholds[thresholds.length - 1];
  // Handle SSR/hydration
  if (!isHydrated) {
    return (
      <HydrationBoundary 
        fallback={<LoadingStates.DocumentRequestList />} 
        testId="document-request-list"
      />
    );
  }

  return (votes / nextThreshold) * 100;
  };

  const hasUserVoted = (request: DocumentRequest) => {
    return currentUserId && request.voters.includes(currentUserId);
  };

  return (
    <div
      data-testid="document-request-list" className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Solicitudes de Documentos Legales
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          Vota por las solicitudes más importantes para priorizar su inclusión en LexMX
        </p>
      </div>

      {/* Filters and Controls */}
      <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Estado
            </label>
            <select
              value={filter.status?.[0] || ''}
              onChange={(e) => setFilter(prev => ({ 
                ...prev, 
                status: e.target.value ? [e.target.value as RequestStatus] : undefined 
              }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-legal-500 dark:bg-gray-700 dark:text-white text-sm"
            >
              <option value="">Todos los estados</option>
              <option value="pending">Pendiente</option>
              <option value="under_review">En Revisión</option>
              <option value="in_progress">En Proceso</option>
              <option value="completed">Completado</option>
              <option value="rejected">Rechazado</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tipo
            </label>
            <select
              value={filter.type?.[0] || ''}
              onChange={(e) => setFilter(prev => ({ 
                ...prev, 
                type: e.target.value ? [e.target.value as DocumentType] : undefined 
              }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-legal-500 dark:bg-gray-700 dark:text-white text-sm"
            >
              <option value="">Todos los tipos</option>
              <option value="law">Ley</option>
              <option value="regulation">Reglamento</option>
              <option value="code">Código</option>
              <option value="norm">Norma</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Área Legal
            </label>
            <select
              value={filter.area?.[0] || ''}
              onChange={(e) => setFilter(prev => ({ 
                ...prev, 
                area: e.target.value ? [e.target.value as LegalArea] : undefined 
              }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-legal-500 dark:bg-gray-700 dark:text-white text-sm"
            >
              <option value="">Todas las áreas</option>
              <option value="civil">Civil</option>
              <option value="criminal">Penal</option>
              <option value="labor">Laboral</option>
              <option value="tax">Fiscal</option>
              <option value="commercial">Mercantil</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Ordenar por
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'votes' | 'date' | 'priority')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-legal-500 dark:bg-gray-700 dark:text-white text-sm"
            >
              <option value="votes">Más Votados</option>
              <option value="date">Más Recientes</option>
              <option value="priority">Prioridad</option>
            </select>
          </div>
        </div>

        <div>
          <input
            type="text"
            placeholder="Buscar solicitudes..."
            value={filter.search || ''}
            onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value }))}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-legal-500 dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>

      {/* Request List */}
      <div className="space-y-4">
        {filteredAndSortedRequests.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p className="text-lg mb-2">No se encontraron solicitudes</p>
            <p>Prueba ajustando los filtros o crea una nueva solicitud</p>
          </div>
        ) : (
          filteredAndSortedRequests.map(request => (
            <div key={request.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                        {REQUEST_STATUS_LABELS[request.status]}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(request.priority)}`}>
                        {PRIORITY_LABELS[request.priority]}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {request.type} • {request.primaryArea}
                      </span>
                    </div>
                    
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      {request.title}
                    </h3>
                    
                    <p className="text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">
                      {request.description}
                    </p>
                    
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 space-x-4">
                      <span>Por usuario-{request.requestedBy.slice(-4)}</span>
                      <span>{new Date(request.createdAt).toLocaleDateString()}</span>
                      <span>{request.comments.length} comentarios</span>
                    </div>
                  </div>

                  {/* Voting Section */}
                  <div className="ml-6 flex flex-col items-center space-y-2">
                    <button
                      onClick={() => handleVote(request.id, 'up')}
                      disabled={!currentUserId || hasUserVoted(request) || votingStates[request.id]}
                      className={`p-2 rounded-full transition-colors ${
                        hasUserVoted(request) 
                          ? 'bg-legal-100 text-legal-600 dark:bg-legal-900/20' 
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                    
                    <div className="text-center">
                      <div className="text-lg font-bold text-gray-900 dark:text-white">
                        {request.votes}
                      </div>
                      <div className="text-xs text-gray-500">votos</div>
                    </div>

                    {/* Vote Progress Bar */}
                    <div className="w-12 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-legal-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(getVoteThresholdProgress(request.votes), 100)}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-500">
                      {Math.round(getVoteThresholdProgress(request.votes))}%
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-600">
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setExpandedRequest(expandedRequest === request.id ? null : request.id)}
                      className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                    >
                      {expandedRequest === request.id ? 'Ocultar detalles' : 'Ver detalles'}
                    </button>
                    
                    {request.sources.length > 0 && (
                      <a
                        href={request.sources[0].url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-legal-600 dark:text-legal-400 hover:text-legal-800 dark:hover:text-legal-300"
                      >
                        Ver fuente
                      </a>
                    )}
                  </div>

                  {isModeratorView && onStatusChange && (
                    <div className="flex space-x-2">
                      <select
                        onChange={(e) => onStatusChange(request.id, e.target.value as RequestStatus)}
                        className="text-sm px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-legal-500 dark:bg-gray-700 dark:text-white"
                        defaultValue={request.status}
                      >
                        <option value="pending">Pendiente</option>
                        <option value="under_review">En Revisión</option>
                        <option value="in_progress">En Proceso</option>
                        <option value="completed">Completado</option>
                        <option value="rejected">Rechazado</option>
                        <option value="duplicate">Duplicado</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Expanded Details */}
                {expandedRequest === request.id && (
                  <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-600">
                    {/* Sources */}
                    <div className="mb-6">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-3">Fuentes</h4>
                      <div className="space-y-2">
                        {request.sources.map((source, index) => (
                          <div key={index} className="flex items-center text-sm">
                            <div className={`w-2 h-2 rounded-full mr-2 ${source.isOfficial ? 'bg-green-500' : 'bg-yellow-500'}`} />
                            {source.url ? (
                              <a 
                                href={source.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-legal-600 dark:text-legal-400 hover:underline"
                              >
                                {source.url}
                              </a>
                            ) : (
                              <span className="text-gray-600 dark:text-gray-400">
                                {source.filename} ({Math.round((source.fileSize || 0) / 1024)} KB)
                              </span>
                            )}
                            {source.isOfficial && (
                              <span className="ml-2 text-xs text-green-600 dark:text-green-400">Oficial</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Comments */}
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                        Comentarios ({request.comments.length})
                      </h4>
                      
                      {/* Comment Form */}
                      {currentUserId && (
                        <div className="mb-4">
                          <div className="flex space-x-3">
                            <textarea
                              value={commentText[request.id] || ''}
                              onChange={(e) => setCommentText(prev => ({ ...prev, [request.id]: e.target.value }))}
                              placeholder="Agregar un comentario..."
                              rows={2}
                              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-legal-500 dark:bg-gray-700 dark:text-white text-sm"
                            />
                            <button
                              onClick={() => handleComment(request.id)}
                              disabled={!commentText[request.id]?.trim()}
                              className="px-4 py-2 bg-legal-600 text-white rounded-md hover:bg-legal-700 focus:outline-none focus:ring-2 focus:ring-legal-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                            >
                              Comentar
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Comments List */}
                      <div className="space-y-3">
                        {request.comments.map(comment => (
                          <div key={comment.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                usuario-{comment.authorId.slice(-4)}
                                {comment.isModeratorComment && (
                                  <span className="ml-2 px-1 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300 text-xs rounded">
                                    Moderador
                                  </span>
                                )}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {new Date(comment.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700 dark:text-gray-300">{comment.content}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Stats Summary */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {requests.length}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Solicitudes</div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {requests.filter(r => r.status === 'completed').length}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Completadas</div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {requests.filter(r => r.status === 'in_progress').length}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">En Proceso</div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-legal-600 dark:text-legal-400">
            {requests.reduce((sum, r) => sum + r.votes, 0)}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Votos</div>
        </div>
      </div>
    </div>
  );
}