import React, { useState, useEffect, useRef, useCallback as _useCallback } from 'react';
import { useTranslation } from '../i18n';
import type { LegalResponse, LegalArea } from '../types/legal';
import type { StoredChatMessage } from '../types/chat';
import { LegalRAGEngine } from '../lib/rag/engine';
import { providerManager } from '../lib/llm/provider-manager';
import MessageContent from '../components/MessageContent';
import ModelSelectorModal from '../components/ModelSelectorModal';
import WebLLMProgress from '../components/WebLLMProgress';

export interface CaseChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  legalResponse?: LegalResponse;
  isStreaming?: boolean;
}

interface CaseChatProps {
  caseId: string;
  caseTitle: string;
  caseDescription: string;
  legalArea: LegalArea;
  documents: Array<{ id: string; name: string; content?: string; uploadedAt?: Date }>;
  notes: Array<{ id: string; content: string; createdAt: Date }>;
  parties: Array<{ name: string; role: string }>;
  deadlines?: Array<{ id: string; title: string; date: Date; type: string; completed: boolean }>;
  statusChanges?: Array<{ date: Date; from: string; to: string }>;
  summary?: string;
  createdAt?: Date;
  updatedAt?: Date;
  status?: string;
  onConversationUpdate?: (conversationId: string) => void;
}

export default function CaseChat({
  caseId,
  caseTitle,
  caseDescription,
  legalArea,
  documents,
  notes,
  parties,
  deadlines = [],
  statusChanges = [],
  summary,
  createdAt,
  _updatedAt,
  status,
  onConversationUpdate
}: CaseChatProps) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<CaseChatMessage[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversationId, setConversationId] = useState<string>('');
  const [ragEngine] = useState(() => new LegalRAGEngine());
  const [currentProvider, setCurrentProvider] = useState('webllm');
  const [currentModel, setCurrentModel] = useState('');
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [webllmProgress, setWebllmProgress] = useState<{ progress: number; message: string } | null>(null);
  
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Initialize RAG engine, provider manager, and load conversation
  useEffect(() => {
    // Create progress listener for WebLLM
    const progressListener = (progress: number, message: string) => {
      setWebllmProgress({ progress, message });
      
      // Auto-clear progress after completion
      if (progress === 100) {
        setTimeout(() => {
          setWebllmProgress(null);
        }, 3000);
      }
    };
    
    const initializeAndLoad = async () => {
      // Register WebLLM progress listener
      providerManager.addWebLLMProgressListener(progressListener);
      
      // Initialize provider manager
      try {
        await providerManager.initialize();
      } catch (error) {
        console.warn('Provider manager initialization warning:', error);
      }
      
      // Initialize RAG engine
      try {
        await ragEngine.initialize();
      } catch (error) {
        console.warn('RAG engine initialization warning:', error);
      }
      
      // Load existing conversation or create new one
      const storageKey = `lexmx_case_chat_${caseId}`;
      const savedConversation = localStorage.getItem(storageKey);
      
      if (savedConversation) {
        try {
          const parsed = JSON.parse(savedConversation);
          setMessages(parsed.messages.map((msg: StoredChatMessage) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          })));
          setConversationId(parsed.conversationId);
        } catch (error) {
          console.error('Error loading conversation:', error);
          initializeNewConversation();
        }
      } else {
        initializeNewConversation();
      }
    };
    
    initializeAndLoad();
    
    // Cleanup: unregister listener on unmount
    return () => {
      providerManager.removeWebLLMProgressListener(progressListener);
    };
  }, [caseId]);
  
  // Save conversation when messages change
  useEffect(() => {
    if (messages.length > 1 && conversationId) { // Don't save just the welcome message
      const storageKey = `lexmx_case_chat_${caseId}`;
      const conversationData = {
        conversationId,
        caseId,
        messages,
        lastUpdated: new Date().toISOString()
      };
      localStorage.setItem(storageKey, JSON.stringify(conversationData));
    }
  }, [messages, caseId, conversationId]);
  
  const initializeNewConversation = () => {
    const newConversationId = `conv_${Date.now()}`;
    setConversationId(newConversationId);
    setMessages([
      {
        id: '1',
        type: 'system',
        content: t('cases.chat.welcome', { caseTitle }),
        timestamp: new Date()
      }
    ]);
    
    if (onConversationUpdate) {
      onConversationUpdate(newConversationId);
    }
  };
  
  const buildCaseContext = (): string => {
    let context = ``;
    
    // Include summary if available
    if (summary) {
      context += `## Resumen del Caso\n${summary}\n\n`;
    }
    
    context += `## Información Básica\n`;
    context += `**Título:** ${caseTitle}\n`;
    context += `**Descripción:** ${caseDescription}\n`;
    context += `**Área Legal:** ${legalArea}\n`;
    if (status) {
      context += `**Estado:** ${status}\n`;
    }
    if (createdAt) {
      context += `**Fecha de Creación:** ${createdAt.toLocaleDateString('es-MX')}\n`;
    }
    context += '\n';
    
    // Build timeline of events
    const timelineEvents: Array<{ date: Date; description: string }> = [];
    
    // Add case creation
    if (createdAt) {
      timelineEvents.push({ date: createdAt, description: 'Caso creado' });
    }
    
    // Add status changes
    if (statusChanges && statusChanges.length > 0) {
      statusChanges.forEach(change => {
        timelineEvents.push({ 
          date: change.date, 
          description: `Estado cambió de ${change.from} a ${change.to}` 
        });
      });
    }
    
    // Add document uploads
    documents.forEach(doc => {
      if (doc.uploadedAt) {
        timelineEvents.push({ 
          date: doc.uploadedAt, 
          description: `Documento agregado: ${doc.name}` 
        });
      }
    });
    
    // Add notes
    notes.forEach(note => {
      timelineEvents.push({ 
        date: note.createdAt, 
        description: `Nota agregada: ${note.content.substring(0, 50)}...` 
      });
    });
    
    // Add deadlines
    if (deadlines && deadlines.length > 0) {
      deadlines.forEach(deadline => {
        const status = deadline.completed ? ' ✓' : deadline.date < new Date() ? ' ⚠️ VENCIDO' : '';
        timelineEvents.push({ 
          date: deadline.date, 
          description: `Plazo: ${deadline.title}${status}` 
        });
      });
    }
    
    // Sort timeline events by date
    timelineEvents.sort((a, b) => b.date.getTime() - a.date.getTime());
    
    // Add timeline to context
    if (timelineEvents.length > 0) {
      context += `### Cronología de Eventos\n`;
      timelineEvents.slice(0, 10).forEach(event => { // Show last 10 events
        context += `- **${event.date.toLocaleDateString('es-MX')}**: ${event.description}\n`;
      });
      context += '\n';
    }
    
    // Add parties
    if (parties.length > 0) {
      context += `### Partes Involucradas\n`;
      parties.forEach(party => {
        context += `- ${party.name} (${party.role})\n`;
      });
      context += '\n';
    }
    
    // Add current documents
    if (documents.length > 0) {
      context += `### Documentos Actuales\n`;
      documents.forEach(doc => {
        context += `- ${doc.name}\n`;
        if (doc.content && doc.content.length > 0) {
          context += `  Extracto: ${doc.content.substring(0, 150)}...\n`;
        }
      });
      context += '\n';
    }
    
    // Add pending deadlines
    if (deadlines && deadlines.length > 0) {
      const pendingDeadlines = deadlines.filter(d => !d.completed);
      if (pendingDeadlines.length > 0) {
        context += `### Plazos Pendientes\n`;
        pendingDeadlines
          .sort((a, b) => a.date.getTime() - b.date.getTime())
          .forEach(deadline => {
            const isOverdue = deadline.date < new Date();
            const status = isOverdue ? ' ⚠️ VENCIDO' : '';
            context += `- **${deadline.date.toLocaleDateString('es-MX')}**: ${deadline.title}${status}\n`;
          });
        context += '\n';
      }
    }
    
    // Add recent notes
    if (notes.length > 0) {
      context += `### Notas Recientes\n`;
      const recentNotes = notes.slice(-3); // Last 3 notes
      recentNotes.forEach(note => {
        context += `- **${note.createdAt.toLocaleDateString('es-MX')}**: ${note.content.substring(0, 100)}...\n`;
      });
      context += '\n';
    }
    
    context += `### Instrucciones\n`;
    context += `Por favor, proporciona asesoría legal específica para este caso considerando todo el contexto proporcionado, `;
    context += `incluyendo la cronología de eventos y los plazos importantes. `;
    context += `Basa tus respuestas en la legislación mexicana aplicable al área de ${legalArea}.\n\n`;
    
    return context;
  };
  
  const handleSendMessage = async () => {
    const input = currentInput.trim();
    if (!input || isProcessing) return;
    
    // Create abort controller for this request
    abortControllerRef.current = new AbortController();
    
    const userMessage: CaseChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: input,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setCurrentInput('');
    setIsProcessing(true);
    
    try {
      // Build enhanced query with case context
      const caseContext = buildCaseContext();
      const enhancedQuery = `${caseContext}\n\n**Consulta del Usuario:** ${input}`;
      
      // Create assistant message for streaming
      const assistantMessageId = (Date.now() + 1).toString();
      const assistantMessage: CaseChatMessage = {
        id: assistantMessageId,
        type: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      // Prepare for streaming response
      let streamedContent = '';
      
      // Callback to handle streaming chunks
      const handleChunk = (chunk: string) => {
        streamedContent += chunk;
        
        // Update the message with the accumulated content
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessageId 
            ? {
                ...msg,
                content: streamedContent,
                isStreaming: true
              }
            : msg
        ));
      };
      
      // Process legal query with streaming (includes RAG + LLM)
      const legalResponse = await ragEngine.processLegalQueryStreaming(
        enhancedQuery,
        handleChunk,
        {
          legalArea: legalArea,
          includeReferences: true,
          maxResults: 5,
          abortSignal: abortControllerRef.current?.signal
        }
      );
      
      // Update the message with final response and metadata
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? {
              ...msg,
              content: legalResponse.answer,
              legalResponse,
              isStreaming: false
            }
          : msg
      ));
    } catch (error) {
      console.error('Error processing message:', error);
      
      const errorMessage: CaseChatMessage = {
        id: (Date.now() + 2).toString(),
        type: 'system',
        content: error instanceof Error ? error.message : 'Error al procesar el mensaje',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  };
  
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsProcessing(false);
      
      // Mark the last streaming message as complete
      setMessages(prev => prev.map(msg => {
        if (msg.isStreaming) {
          return {
            ...msg,
            isStreaming: false,
            content: msg.content + '\n\n[Generación detenida por el usuario]'
          };
        }
        return msg;
      }));
    }
  };
  
  const handleClearConversation = () => {
    if (confirm(t('cases.chat.confirmClear'))) {
      const storageKey = `lexmx_case_chat_${caseId}`;
      localStorage.removeItem(storageKey);
      initializeNewConversation();
    }
  };
  
  const handleExportConversation = () => {
    const exportData = {
      caseTitle,
      caseId,
      conversationId,
      exportDate: new Date().toISOString(),
      messages: messages.map(msg => ({
        type: msg.type,
        content: msg.content,
        timestamp: msg.timestamp.toISOString()
      }))
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `caso_${caseId}_chat_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Chat Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-gradient-to-br from-legal-400 to-legal-600 rounded-lg flex items-center justify-center shadow-md">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {t('cases.chat.title')}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {caseTitle}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowModelSelector(true)}
            className="flex items-center space-x-2 px-3 py-2 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-all hover:shadow-md text-sm"
          >
            <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="text-gray-700 dark:text-gray-300">
              {currentProvider === 'webllm' ? 'WebLLM' : currentProvider}
              {currentModel && (
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                  ({currentModel.split('-')[0]})
                </span>
              )}
            </span>
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportConversation}
            className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            title={t('cases.chat.export')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
          <button
            onClick={handleClearConversation}
            className="px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
            title={t('cases.chat.clear')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Model Selector Modal */}
      <ModelSelectorModal
        isOpen={showModelSelector}
        onClose={() => setShowModelSelector(false)}
        currentProvider={currentProvider}
        currentModel={currentModel}
        onModelSelect={(provider, model) => {
          setCurrentProvider(provider);
          setCurrentModel(model || '');
          if (model) {
            providerManager.setPreferredProvider(provider, model);
          }
        }}
      />
      
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-3xl px-5 py-4 rounded-2xl shadow-md transition-all hover:shadow-lg ${
                message.type === 'user'
                  ? 'bg-gradient-to-br from-legal-500 to-legal-600 text-white'
                  : message.type === 'system'
                  ? 'bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 text-blue-900 dark:text-blue-200 border border-blue-200 dark:border-blue-800'
                  : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700'
              }`}
            >
              {message.type === 'assistant' ? (
                <MessageContent 
                  content={message.content} 
                  legalResponse={message.legalResponse}
                  isStreaming={message.isStreaming}
                />
              ) : (
                <div className="whitespace-pre-wrap">{message.content}</div>
              )}
              <div className="text-xs opacity-70 mt-2">
                {message.timestamp.toLocaleTimeString('es-MX')}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      {/* WebLLM Progress Indicator - Inline in chat */}
      {webllmProgress && (
        <div className="border-t border-gray-200 dark:border-gray-700 bg-yellow-50 dark:bg-yellow-900/20 p-4">
          <WebLLMProgress
            progress={webllmProgress.progress}
            message={webllmProgress.message}
            variant="inline"
          />
        </div>
      )}
      
      {/* Input Area */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
        <div className="flex space-x-2">
          <textarea
            ref={inputRef}
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={t('cases.chat.placeholder')}
            className="flex-1 px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-legal-500 focus:border-legal-500 transition-all placeholder-gray-400 dark:placeholder-gray-500 shadow-sm"
            rows={2}
            disabled={isProcessing}
          />
          {isProcessing ? (
            <button
              onClick={handleStopGeneration}
              className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition-all shadow-md hover:shadow-lg"
            >
              {t('chat.stop')}
            </button>
          ) : (
            <button
              onClick={handleSendMessage}
              disabled={!currentInput.trim()}
              className="px-6 py-3 bg-gradient-to-r from-legal-500 to-legal-600 text-white rounded-xl hover:from-legal-600 hover:to-legal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg disabled:shadow-none"
            >
              {t('chat.send')}
            </button>
          )}
        </div>
        
        {/* Context Indicator */}
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {t('cases.chat.contextInfo', { 
            documents: documents.length, 
            notes: notes.length 
          })}
        </div>
      </div>
    </div>
  );
}