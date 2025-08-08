// Main chat interface for legal queries - integrates with RAG engine

import { useState, useRef, useEffect, useCallback } from 'react';
import type { LegalResponse, LegalArea, QueryType } from '../types/legal';
import { LegalRAGEngine } from '../lib/rag/engine';
import { providerManager } from '../lib/llm/provider-manager';
import ProviderRecommendation from './ProviderRecommendation';
import WebLLMProgress from '../components/WebLLMProgress';
import MessageContent from '../components/MessageContent';
import ProviderSelector from '../components/ProviderSelector';
import CorpusSelector from '../components/CorpusSelector';
import ModelSelectorModal from '../components/ModelSelectorModal';
import { useTranslation } from '../i18n';

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
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  
  const [currentInput, setCurrentInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedArea, setSelectedArea] = useState<LegalArea | ''>('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [ragEngine] = useState(() => new LegalRAGEngine());
  const [isInitialized, setIsInitialized] = useState(false);
  const [webllmProgress, setWebllmProgress] = useState<{ progress: number; message: string } | null>(null);
  const [corpusSelection, setCorpusSelection] = useState<{ areas: LegalArea[]; documents: string[] }>({
    areas: [],
    documents: []
  });
  
  // Modal state for model selector
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [currentProvider, setCurrentProvider] = useState('webllm');
  const [currentModel, setCurrentModel] = useState('');
  
  // Abort controller for stopping generation
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Memoize the corpus selection callback to prevent infinite re-renders
  const handleCorpusSelectionChange = useCallback((selection: { areas: LegalArea[]; documents: string[] }) => {
    setCorpusSelection(selection);
    console.log('Corpus selection changed:', selection);
  }, []);
  
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
        content: t('chat.welcome'),
        timestamp: new Date()
      }
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Remove 't' from dependencies as it causes infinite loop

  // Initialize RAG engine and provider manager
  useEffect(() => {
    // Create progress listener
    const progressListener = (progress: number, message: string) => {
      setWebllmProgress({ progress, message });
      
      // Auto-clear progress after completion
      if (progress === 100) {
        setTimeout(() => {
          setWebllmProgress(null);
        }, 3000);
      }
    };

    const initializeEngine = async () => {
      try {
        // Register WebLLM progress listener
        providerManager.addWebLLMProgressListener(progressListener);
        
        // Initialize provider manager first
        await providerManager.initialize();
        
        // Then initialize RAG engine
        await ragEngine.initialize();
        setIsInitialized(true);
        
        // Check if providers are configured
        const hasProviders = await providerManager.hasConfiguredProviders();
        if (!hasProviders) {
          addSystemMessage('ℹ️ ' + t('chat.errors.noProviders'));
        }
      } catch (error) {
        console.error('Failed to initialize system:', error);
        addSystemMessage('⚠️ ' + t('common.error') + '. ' + t('chat.errors.providerError'));
      }
    };

    initializeEngine();
    
    // Cleanup: unregister listener on unmount
    return () => {
      providerManager.removeWebLLMProgressListener(progressListener);
    };
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
      addSystemMessage('❌ ' + t('chat.errors.noProviders'));
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
    
    // Create new abort controller
    abortControllerRef.current = new AbortController();
    
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

      // Process legal query with streaming (with abort signal support)
      const legalResponse = await ragEngine.processLegalQueryStreaming(
        userMessage.content,
        handleChunk,
        {
          legalArea: selectedArea || undefined,
          includeReferences: true,
          maxResults: 5,
          corpusFilter: corpusSelection.areas.length > 0 || corpusSelection.documents.length > 0
            ? corpusSelection
            : undefined,
          abortSignal: abortControllerRef.current?.signal
        }
      );
      
      // Progress is now auto-cleared by the listener after 100%

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
              content: t('chat.errors.providerError'),
              isStreaming: false
            }
          : msg
      ));
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };
  
  const handleStopGeneration = () => {
    // Abort the current request
    abortControllerRef.current?.abort();
    setIsProcessing(false);
  };

  const clearChat = () => {
    if (isHydrated) {
      setMessages([
        {
          id: '1',
          type: 'system',
          content: t('chat.welcome'),
          timestamp: new Date()
        }
      ]);
    }
  };

  const legalAreas: { value: LegalArea | ''; label: string }[] = [
    { value: '', label: t('chat.legalArea.all') },
    { value: 'constitutional', label: t('chat.legalArea.constitutional') },
    { value: 'civil', label: t('chat.legalArea.civil') },
    { value: 'criminal', label: t('chat.legalArea.criminal') },
    { value: 'labor', label: t('chat.legalArea.labor') },
    { value: 'tax', label: t('chat.legalArea.tax') },
    { value: 'commercial', label: t('chat.legalArea.commercial') },
    { value: 'administrative', label: t('chat.legalArea.administrative') },
    { value: 'family', label: t('chat.legalArea.family') },
    { value: 'property', label: t('chat.legalArea.property') }
  ];

  const exampleQuestions = [
    t('chat.examples.q1'),
    t('chat.examples.q2'),
    t('chat.examples.q3'),
    t('chat.examples.q4'),
    t('chat.examples.q5')
  ];

  return (
    <div className={`chat-interface flex flex-col h-full bg-white dark:bg-gray-900 ${className}`}>
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t('chat.title')}</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('home.hero.subtitle')}
              {!isInitialized && (
                <span className="ml-2 inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200">
                  {t('common.loading')}
                </span>
              )}
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              title={t('chat.advancedOptions')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            
            <button
              onClick={clearChat}
              className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              title={t('chat.clear')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Advanced Options */}
        {showAdvanced && (
          <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <label htmlFor="legal-area" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('chat.legalAreaSelect')}
                </label>
                <select
                  id="legal-area"
                  value={selectedArea}
                  onChange={(e) => setSelectedArea(e.target.value as LegalArea | '')}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-legal-500 focus:border-legal-500"
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
                    {message.type === 'system' ? t('chat.system') : 'LexMX'}
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
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-200 border border-blue-200 dark:border-blue-800'
                  : 'bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              }`}>
                <MessageContent content={message.content} />
                
                {/* Legal Response Details */}
                {message.legalResponse && (
                  <div className="mt-4 space-y-3">
                    {/* Sources */}
                    {message.legalResponse.sources.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">📚 Sources:</h4>
                        <div className="space-y-2">
                          {message.legalResponse.sources.map((source, index) => (
                            <div key={index} className="p-2 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 text-sm">
                              <div className="font-medium">{source.title}</div>
                              {source.article && (
                                <div className="text-gray-600 dark:text-gray-400">Artículo {source.article}</div>
                              )}
                              <div className="text-gray-700 dark:text-gray-300 mt-1">{source.excerpt}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Relevancia: {Math.round(source.relevanceScore * 100)}%
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Legal Warning */}
                    {message.legalResponse.legalWarning && (
                      <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-sm text-yellow-800 dark:text-yellow-200">
                        {message.legalResponse.legalWarning}
                      </div>
                    )}

                    {/* Recommended Actions */}
                    {message.legalResponse.recommendedActions && message.legalResponse.recommendedActions.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">✅ {t('chat.recommendations')}:</h4>
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
                        <h4 className="font-medium text-gray-900 mb-2">💡 {t('chat.relatedQueries')}:</h4>
                        <div className="flex flex-wrap gap-2">
                          {message.legalResponse.relatedQueries.map((query, index) => (
                            <button
                              key={index}
                              onClick={() => setCurrentInput(query)}
                              className="px-3 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-full text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                            >
                              {query}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
                      {t('chat.confidence')}: {Math.round(message.legalResponse.confidence * 100)}% | 
                      {t('chat.area')}: {message.legalResponse.legalArea} | 
                      {t('chat.time')}: {message.legalResponse.processingTime}ms
                      {message.legalResponse.fromCache && ` | ${t('chat.fromCache')}`}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 px-1">
                {isHydrated ? message.timestamp.toLocaleTimeString() : '--:--:--'}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Example Questions (when chat is empty) */}
      {messages.length === 1 && (
        <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">{t('chat.examples.title')}</h3>
          <div className="grid grid-cols-1 gap-2">
            {exampleQuestions.map((question, index) => (
              <button
                key={index}
                onClick={() => setCurrentInput(question)}
                className="text-left p-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 hover:shadow-sm rounded border border-transparent hover:border-gray-200 dark:hover:border-gray-600 transition-all"
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

      {/* WebLLM Progress Indicator - Inline in chat */}
      {webllmProgress && (
        <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 bg-yellow-50 dark:bg-yellow-900/20 p-4">
          <WebLLMProgress
            progress={webllmProgress.progress}
            message={webllmProgress.message}
            variant="inline"
          />
        </div>
      )}
      
      {/* Input */}
      <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        {/* Selectors */}
        <div className="flex justify-between items-center mb-2">
          <CorpusSelector 
            onSelectionChange={handleCorpusSelectionChange}
          />
          <button
            onClick={() => setShowModelSelector(true)}
            className="flex items-center space-x-2 px-3 py-2 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors text-sm"
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
        
        <form onSubmit={handleSubmit} className="flex space-x-3">
          <div className="flex-1">
            <textarea
              ref={inputRef}
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('chat.placeholder')}
              rows={1}
              className="w-full px-4 py-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-legal-500 focus:border-legal-500 placeholder-gray-400 dark:placeholder-gray-500"
              style={{ minHeight: '52px', maxHeight: '120px' }}
              disabled={isProcessing || !isInitialized}
            />
          </div>
          
          {isProcessing ? (
            <button
              type="button"
              onClick={handleStopGeneration}
              className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
              aria-label="Detener generación"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" />
              </svg>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!currentInput.trim() || !isInitialized}
              className="px-6 py-3 bg-legal-500 text-white rounded-lg hover:bg-legal-600 focus:outline-none focus:ring-2 focus:ring-legal-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label={t('chat.send')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          )}
        </form>
        
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {!isInitialized ? (
            t('common.loading')
          ) : (
            <>{t('chat.inputHelp')}</>
          )}
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
          console.log('Model selected:', provider, model);
          // Update provider manager
          if (model) {
            providerManager.setPreferredProvider(provider, model);
          }
        }}
      />
    </div>
  );
}