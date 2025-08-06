// Main chat interface for legal queries - integrates with RAG engine

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { LegalResponse, LegalArea, QueryType } from '../types/legal';
import { LegalRAGEngine } from '../lib/rag/engine';
import { providerManager } from '../lib/llm/provider-manager';
import ProviderRecommendation from './ProviderRecommendation';
import WebLLMProgress from '../components/WebLLMProgress';
import MessageContent from '../components/MessageContent';

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  legalResponse?: LegalResponse;
  isStreaming?: boolean;
}

interface ChatInterfaceProps {
  className?: string;
  autoFocus?: boolean;
}

export default function ChatInterface({ className = '', autoFocus = true }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  
  const [currentInput, setCurrentInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedArea, setSelectedArea] = useState<LegalArea | ''>('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [ragEngine] = useState(() => new LegalRAGEngine());
  const [isInitialized, setIsInitialized] = useState(false);
  const [webllmProgress, setWebllmProgress] = useState<{ progress: number; message: string } | null>(null);
  
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const previousMessageCountRef = useRef(0);
  const shouldAutoScrollRef = useRef(true);
  
  // Initialize messages only on client side to avoid hydration mismatch
  useEffect(() => {
    setIsHydrated(true);
    setMessages([
      {
        id: '1',
        type: 'system',
        content: '¡Bienvenido a LexMX! Soy tu asistente legal especializado en derecho mexicano. Puedes preguntarme sobre leyes, procedimientos, jurisprudencia y cualquier tema legal de México. ¿En qué puedo ayudarte?',
        timestamp: new Date()
      }
    ]);
  }, []);

  // Initialize RAG engine and provider manager
  useEffect(() => {
    const initializeEngine = async () => {
      try {
        // Set WebLLM progress callback
        providerManager.setWebLLMProgressCallback((progress, message) => {
          setWebllmProgress({ progress, message });
        });
        
        // Initialize provider manager first
        await providerManager.initialize();
        
        // Then initialize RAG engine
        await ragEngine.initialize();
        setIsInitialized(true);
        
        // Check if providers are configured
        const hasProviders = await providerManager.hasConfiguredProviders();
        if (!hasProviders) {
          addSystemMessage('ℹ️ No tienes proveedores configurados. Ve a Configuración para agregar proveedores de IA.');
        }
      } catch (error) {
        console.error('Failed to initialize system:', error);
        addSystemMessage('⚠️ Error al inicializar el sistema. Algunas funciones pueden estar limitadas.');
      }
    };

    initializeEngine();
  }, [ragEngine]);

  // Smart auto-scroll: only scroll for new messages, not streaming updates
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    
    // Check if this is a new message (not just an update)
    const isNewMessage = messages.length > previousMessageCountRef.current;
    previousMessageCountRef.current = messages.length;
    
    // Check if user has scrolled up (with 100px tolerance)
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    
    // Only auto-scroll if:
    // 1. It's a new message (not streaming update)
    // 2. User is near the bottom or we should force scroll
    if (isNewMessage && (isNearBottom || shouldAutoScrollRef.current)) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      shouldAutoScrollRef.current = true;
    }
  }, [messages]);
  
  // Track when user manually scrolls
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    
    // If user scrolls away from bottom, disable auto-scroll
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    shouldAutoScrollRef.current = isNearBottom;
  }, []);

  // Auto-focus input
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const addSystemMessage = (content: string) => {
    const systemMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'system',
      content,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, systemMessage]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentInput.trim() || isProcessing) return;

    // Check if providers are configured
    const hasProviders = await providerManager.hasConfiguredProviders();
    if (!hasProviders) {
      addSystemMessage('❌ No tienes proveedores de IA configurados. Ve a Configuración para agregar tu clave API de OpenAI, Claude, Gemini u otros proveedores.');
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: currentInput.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setCurrentInput('');
    setIsProcessing(true);
    
    // Re-enable auto-scroll when user sends a message
    shouldAutoScrollRef.current = true;

    // Add loading message
    const loadingId = (Date.now() + 1).toString();
    const loadingMessage: ChatMessage = {
      id: loadingId,
      type: 'assistant',
      content: 'Analizando tu consulta legal...',
      timestamp: new Date(),
      isStreaming: true
    };
    setMessages(prev => [...prev, loadingMessage]);

    try {
      // Prepare for streaming response
      let streamedContent = '';
      
      // Callback to handle streaming chunks
      const handleChunk = (chunk: string) => {
        streamedContent += chunk;
        
        // Update the message with the accumulated content
        setMessages(prev => prev.map(msg => 
          msg.id === loadingId 
            ? {
                ...msg,
                content: streamedContent,
                isStreaming: true
              }
            : msg
        ));
      };

      // Process legal query with streaming
      const legalResponse = await ragEngine.processLegalQueryStreaming(
        userMessage.content,
        handleChunk,
        {
          legalArea: selectedArea || undefined,
          includeReferences: true,
          maxResults: 5
        }
      );
      
      // Clear WebLLM progress when done
      setWebllmProgress(null);

      // Update the message with final response and metadata
      setMessages(prev => prev.map(msg => 
        msg.id === loadingId 
          ? {
              ...msg,
              content: legalResponse.answer,
              legalResponse,
              isStreaming: false
            }
          : msg
      ));

    } catch (error) {
      console.error('Error processing legal query:', error);
      
      // Replace loading message with error
      setMessages(prev => prev.map(msg => 
        msg.id === loadingId 
          ? {
              ...msg,
              content: 'Lo siento, ocurrió un error al procesar tu consulta. Por favor, intenta nuevamente. Si el problema persiste, verifica tu configuración de proveedores de IA.',
              isStreaming: false
            }
          : msg
      ));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const clearChat = () => {
    if (isHydrated) {
      setMessages([
        {
          id: '1',
          type: 'system',
          content: '¡Bienvenido a LexMX! Soy tu asistente legal especializado en derecho mexicano. ¿En qué puedo ayudarte?',
          timestamp: new Date()
        }
      ]);
    }
  };

  const legalAreas: { value: LegalArea | ''; label: string }[] = [
    { value: '', label: 'Todas las áreas' },
    { value: 'constitutional', label: 'Derecho Constitucional' },
    { value: 'civil', label: 'Derecho Civil' },
    { value: 'criminal', label: 'Derecho Penal' },
    { value: 'labor', label: 'Derecho Laboral' },
    { value: 'tax', label: 'Derecho Fiscal' },
    { value: 'commercial', label: 'Derecho Mercantil' },
    { value: 'administrative', label: 'Derecho Administrativo' },
    { value: 'family', label: 'Derecho Familiar' },
    { value: 'property', label: 'Derecho de Propiedad' }
  ];

  const exampleQuestions = [
    "¿Qué dice el artículo 123 constitucional sobre los derechos laborales?",
    "¿Cómo tramitar un divorcio voluntario en México?",
    "¿Cuáles son las obligaciones fiscales de una persona física?",
    "¿Qué es el juicio de amparo y cuándo procede?",
    "¿Cuáles son los requisitos para constituir una sociedad anónima?"
  ];

  return (
    <div className={`chat-interface flex flex-col h-full bg-white ${className}`}>
      {/* WebLLM Progress Indicator */}
      {webllmProgress && (
        <WebLLMProgress
          progress={webllmProgress.progress}
          message={webllmProgress.message}
          onClose={() => setWebllmProgress(null)}
        />
      )}
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Chat Legal</h1>
            <p className="text-sm text-gray-600">
              Asistente legal para derecho mexicano
              {!isInitialized && (
                <span className="ml-2 inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                  Inicializando...
                </span>
              )}
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              title="Opciones avanzadas"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            
            <button
              onClick={clearChat}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              title="Limpiar chat"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Advanced Options */}
        {showAdvanced && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <label htmlFor="legal-area" className="block text-sm font-medium text-gray-700 mb-1">
                  Área legal específica
                </label>
                <select
                  id="legal-area"
                  value={selectedArea}
                  onChange={(e) => setSelectedArea(e.target.value as LegalArea | '')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-legal-500 focus:border-legal-500"
                >
                  {legalAreas.map(area => (
                    <option key={area.value} value={area.value}>
                      {area.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      <div 
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-3xl ${message.type === 'user' ? 'ml-12' : 'mr-12'}`}>
              {message.type !== 'user' && (
                <div className="flex items-center mb-2">
                  <div className="w-8 h-8 bg-legal-500 rounded-full flex items-center justify-center mr-2">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16l5.5-3m-5.5 3l-5.5-3" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {message.type === 'system' ? 'Sistema' : 'LexMX'}
                  </span>
                  {message.isStreaming && (
                    <div className="ml-2 flex space-x-1">
                      <div className="w-2 h-2 bg-legal-500 rounded-full animate-pulse"></div>
                      <div className="w-2 h-2 bg-legal-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-2 h-2 bg-legal-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  )}
                </div>
              )}
              
              <div className={`px-4 py-3 rounded-lg ${
                message.type === 'user' 
                  ? 'bg-legal-500 text-white' 
                  : message.type === 'system'
                  ? 'bg-blue-50 text-blue-900 border border-blue-200'
                  : 'bg-gray-50 text-gray-900'
              }`}>
                <MessageContent content={message.content} />
                
                {/* Legal Response Details */}
                {message.legalResponse && (
                  <div className="mt-4 space-y-3">
                    {/* Sources */}
                    {message.legalResponse.sources.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">📚 Sources:</h4>
                        <div className="space-y-2">
                          {message.legalResponse.sources.map((source, index) => (
                            <div key={index} className="p-2 bg-white rounded border text-sm">
                              <div className="font-medium">{source.title}</div>
                              {source.article && (
                                <div className="text-gray-600">Artículo {source.article}</div>
                              )}
                              <div className="text-gray-700 mt-1">{source.excerpt}</div>
                              <div className="text-xs text-gray-500 mt-1">
                                Relevancia: {Math.round(source.relevanceScore * 100)}%
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Legal Warning */}
                    {message.legalResponse.legalWarning && (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                        {message.legalResponse.legalWarning}
                      </div>
                    )}

                    {/* Recommended Actions */}
                    {message.legalResponse.recommendedActions && message.legalResponse.recommendedActions.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">✅ Recomendaciones:</h4>
                        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                          {message.legalResponse.recommendedActions.map((action, index) => (
                            <li key={index}>{action}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Related Queries */}
                    {message.legalResponse.relatedQueries && message.legalResponse.relatedQueries.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">💡 Consultas relacionadas:</h4>
                        <div className="flex flex-wrap gap-2">
                          {message.legalResponse.relatedQueries.map((query, index) => (
                            <button
                              key={index}
                              onClick={() => setCurrentInput(query)}
                              className="px-3 py-1 bg-white border border-gray-300 rounded-full text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              {query}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="text-xs text-gray-500 pt-2 border-t border-gray-200">
                      Confianza: {Math.round(message.legalResponse.confidence * 100)}% | 
                      Área: {message.legalResponse.legalArea} | 
                      Tiempo: {message.legalResponse.processingTime}ms
                      {message.legalResponse.fromCache && ' | Desde caché'}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="text-xs text-gray-500 mt-1 px-1">
                {isHydrated ? message.timestamp.toLocaleTimeString() : '--:--:--'}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Example Questions (when chat is empty) */}
      {messages.length === 1 && (
        <div className="flex-shrink-0 p-4 border-t border-gray-200 bg-gray-50">
          <h3 className="text-sm font-medium text-gray-900 mb-2">Preguntas de ejemplo:</h3>
          <div className="grid grid-cols-1 gap-2">
            {exampleQuestions.map((question, index) => (
              <button
                key={index}
                onClick={() => setCurrentInput(question)}
                className="text-left p-2 text-sm text-gray-700 hover:bg-white hover:shadow-sm rounded border border-transparent hover:border-gray-200 transition-all"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Provider Recommendation */}
      {currentInput.trim().length > 10 && !isProcessing && (
        <div className="flex-shrink-0 px-4 pb-2">
          <ProviderRecommendation 
            query={currentInput}
            onSelectProvider={(providerId, model) => {
              console.log('Selected provider:', providerId, model);
              // TODO: Implement provider switching
            }}
          />
        </div>
      )}

      {/* Input */}
      <div className="flex-shrink-0 border-t border-gray-200 bg-white p-4">
        <form onSubmit={handleSubmit} className="flex space-x-3">
          <div className="flex-1">
            <textarea
              ref={inputRef}
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu consulta legal aquí... (Shift+Enter para nueva línea)"
              rows={1}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-legal-500 focus:border-legal-500"
              style={{ minHeight: '52px', maxHeight: '120px' }}
              disabled={isProcessing || !isInitialized}
            />
          </div>
          
          <button
            type="submit"
            disabled={!currentInput.trim() || isProcessing || !isInitialized}
            className="px-6 py-3 bg-legal-500 text-white rounded-lg hover:bg-legal-600 focus:outline-none focus:ring-2 focus:ring-legal-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Enviar mensaje"
          >
            {isProcessing ? (
              <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </form>
        
        <div className="mt-2 text-xs text-gray-500">
          {!isInitialized ? (
            'Inicializando sistema...'
          ) : (
            <>Presiona Enter para enviar, Shift+Enter para nueva línea</>
          )}
        </div>
      </div>
    </div>
  );
}