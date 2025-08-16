import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { useTranslation } from '../i18n/index';
import { HydrationBoundary as _HydrationBoundary, LoadingStates as _LoadingStates } from '../components/HydrationBoundary';
import type { LegalArea } from '../types/legal';
import type { StoredCaseData } from '../types/chat';
import { TEST_IDS as _TEST_IDS } from '../utils/test-ids';
import { LegalRAGEngine } from '../lib/rag/engine';
import { providerManager } from '../lib/llm/provider-manager';
import { promptBuilder } from '../lib/llm/prompt-builder';
import MessageContent from '../components/MessageContent';
import WebLLMProgress from '../components/WebLLMProgress';

// Lazy load the chat and timeline components
const CaseChat = lazy(() => import('./CaseChat'));
const CaseTimeline = lazy(() => import('./CaseTimeline'));

interface LegalCase {
  id: string;
  title: string;
  description: string;
  client?: string;
  caseNumber?: string;
  legalArea: LegalArea;
  status: 'active' | 'pending' | 'resolved' | 'archived';
  createdAt: Date;
  updatedAt: Date;
  documents: CaseDocument[];
  notes: CaseNote[];
  conversations: string[]; // Chat conversation IDs
  deadlines: Deadline[];
  parties: Party[];
  summary?: string; // AI-generated case summary
  statusChanges?: Array<{ date: Date; from: string; to: string }>; // Track status changes
}

interface CaseDocument {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: Date;
  content?: string;
  tags: string[];
}

interface CaseNote {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
}

interface Deadline {
  id: string;
  title: string;
  date: Date;
  type: 'court' | 'filing' | 'meeting' | 'other';
  completed: boolean;
  notes?: string;
}

interface Party {
  id: string;
  name: string;
  role: 'plaintiff' | 'defendant' | 'witness' | 'expert' | 'other';
  contact?: string;
  notes?: string;
}

type ViewMode = 'grid' | 'list';
type TabView = 'overview' | 'documents' | 'notes' | 'chat' | 'timeline';

export default function CaseManager() {
  const { t, language } = useTranslation();
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [selectedCase, setSelectedCase] = useState<LegalCase | null>(null);
  const [_viewMode, _setViewMode] = useState<ViewMode>('grid');
  const [activeTab, setActiveTab] = useState<TabView>('overview');
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterArea, setFilterArea] = useState<string>('all');
  const [_isInitialized, _setIsInitialized] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [streamingSummary, setStreamingSummary] = useState<string>('');
  const [webllmProgress, setWebllmProgress] = useState<{ progress: number; message: string } | null>(null);
  const [isEditingCase, setIsEditingCase] = useState(false);
  const [editingCase, setEditingCase] = useState<LegalCase | null>(null);
  const [showAddPartyModal, setShowAddPartyModal] = useState(false);
  const [showAddDeadlineModal, setShowAddDeadlineModal] = useState(false);

  // Handle hydration
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Initialize provider manager and register WebLLM progress listener
  useEffect(() => {
    const progressListener = (progress: number, message: string) => {
      setWebllmProgress({ progress, message });
      
      // Auto-clear progress after completion
      if (progress === 100) {
        setTimeout(() => {
          setWebllmProgress(null);
        }, 3000);
      }
    };

    const initializeProviders = async () => {
      try {
        // Register WebLLM progress listener
        providerManager.addWebLLMProgressListener(progressListener);
        
        // Initialize provider manager
        await providerManager.initialize();
      } catch (error) {
        console.warn('Provider manager initialization warning:', error);
      }
    };

    initializeProviders();

    // Cleanup: unregister listener on unmount
    return () => {
      providerManager.removeWebLLMProgressListener(progressListener);
    };
  }, []);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load cases from IndexedDB on mount and when language changes
  useEffect(() => {
    if (!isHydrated) return;
    
    // Load cases immediately and mark as initialized
    loadCases();
    _setIsInitialized(true);
  }, [isHydrated]);

  const loadCases = async () => {
    try {
      // Check if we're in browser environment
      if (typeof window === 'undefined' || !window.localStorage) {
        return;
      }
      
      // In production, this would load from IndexedDB
      const storedCases = localStorage.getItem('lexmx_cases');
      if (storedCases) {
        const parsed = JSON.parse(storedCases);
        setCases(parsed.map((c: StoredCaseData) => ({
          ...c,
          createdAt: new Date(c.createdAt),
          updatedAt: new Date(c.updatedAt),
          deadlines: c.deadlines?.map((d) => ({ ...d, date: new Date(d.date) })) || []
        })));
      } else {
        // Add example cases for demo
        const exampleCases: LegalCase[] = [
          {
            id: '1',
            title: 'Caso de Divorcio - García vs García',
            description: 'Divorcio por mutuo consentimiento con convenio de separación de bienes',
            client: 'María García Hernández',
            caseNumber: 'FAM-2024-001',
            legalArea: 'family',
            status: 'active',
            createdAt: new Date('2024-01-15'),
            updatedAt: new Date('2024-01-20'),
            documents: [],
            notes: [],
            conversations: [],
            deadlines: [
              {
                id: 'd1',
                title: 'Audiencia de Conciliación',
                date: new Date('2024-02-15'),
                type: 'court',
                completed: false
              }
            ],
            parties: [
              { id: 'p1', name: 'María García Hernández', role: 'plaintiff', contact: '555-0123' },
              { id: 'p2', name: 'Juan García López', role: 'defendant', contact: '555-0124' }
            ]
          },
          {
            id: '2',
            title: 'Contrato de Compraventa Inmueble',
            description: 'Revisión y elaboración de contrato de compraventa para propiedad en CDMX',
            client: 'Pedro Martínez Silva',
            caseNumber: 'CIV-2024-002',
            legalArea: 'civil',
            status: 'pending',
            createdAt: new Date('2024-01-10'),
            updatedAt: new Date('2024-01-18'),
            documents: [],
            notes: [],
            conversations: [],
            deadlines: [],
            parties: []
          }
        ];
        setCases(exampleCases);
        localStorage.setItem('lexmx_cases', JSON.stringify(exampleCases));
      }
    } catch (error) {
      console.error('Error loading cases:', error);
      setCases([]); // Set empty array on error
    }
  };

  const saveCases = (updatedCases: LegalCase[]) => {
    setCases(updatedCases);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('lexmx_cases', JSON.stringify(updatedCases));
      }
    } catch (error) {
      console.error('Error saving cases:', error);
    }
  };

  const createCase = (caseData: Partial<LegalCase>) => {
    const newCase: LegalCase = {
      id: Date.now().toString(),
      title: caseData.title || t('cases.newCase'),
      description: caseData.description || '',
      client: caseData.client,
      caseNumber: caseData.caseNumber,
      legalArea: caseData.legalArea || 'civil',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      documents: [],
      notes: [],
      conversations: [],
      deadlines: [],
      parties: []
    };
    
    saveCases([...cases, newCase]);
    setSelectedCase(newCase);
    setIsCreating(false);
  };

  const updateCase = (caseId: string, updates: Partial<LegalCase>) => {
    const updatedCases = cases.map(c => 
      c.id === caseId 
        ? { ...c, ...updates, updatedAt: new Date() }
        : c
    );
    saveCases(updatedCases);
    if (selectedCase?.id === caseId) {
      setSelectedCase(updatedCases.find(c => c.id === caseId) || null);
    }
  };

  const deleteCase = (caseId: string) => {
    if (confirm(t('cases.confirmDelete'))) {
      saveCases(cases.filter(c => c.id !== caseId));
      if (selectedCase?.id === caseId) {
        setSelectedCase(null);
      }
    }
  };

  // Filter cases based on search and filters with memoization
  const filteredCases = useMemo(() => {
    return cases.filter(c => {
      const matchesSearch = debouncedSearchQuery === '' || 
        c.title?.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        c.description?.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        c.client?.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        c.caseNumber?.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
      
      const matchesStatus = filterStatus === 'all' || c.status === filterStatus;
      const matchesArea = filterArea === 'all' || c.legalArea === filterArea;
      
      return matchesSearch && matchesStatus && matchesArea;
    });
  }, [cases, debouncedSearchQuery, filterStatus, filterArea]);

  const handleFileUpload = async (files: FileList) => {
    if (!selectedCase) return;

    const newDocuments: CaseDocument[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const content = await file.text(); // For text files, store content
      
      newDocuments.push({
        id: Date.now().toString() + i,
        name: file.name,
        type: file.type,
        size: file.size,
        uploadedAt: new Date(),
        content: file.type.startsWith('text/') ? content : undefined,
        tags: []
      });
    }

    updateCase(selectedCase.id, {
      documents: [...selectedCase.documents, ...newDocuments]
    });
  };

  const addNote = (content: string) => {
    if (!selectedCase) return;

    const newNote: CaseNote = {
      id: Date.now().toString(),
      content,
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: []
    };

    updateCase(selectedCase.id, {
      notes: [...selectedCase.notes, newNote]
    });
  };

  const _addDeadline = (deadline: Omit<Deadline, 'id'>) => {
    if (!selectedCase) return;

    const newDeadline: Deadline = {
      ...deadline,
      id: Date.now().toString()
    };

    updateCase(selectedCase.id, {
      deadlines: [...selectedCase.deadlines, newDeadline]
    });
  };

  const generateSummary = async () => {
    if (!selectedCase) return;
    
    setIsGeneratingSummary(true);
    setStreamingSummary(''); // Clear any previous streaming summary
    
    try {
      // Initialize RAG engine
      const ragEngine = new LegalRAGEngine();
      await ragEngine.initialize();
      
      // Build comprehensive case information
      let caseInfo = `## Caso: ${selectedCase.title}\n\n`;
      caseInfo += `**Descripción:** ${selectedCase.description}\n`;
      caseInfo += `**Área Legal:** ${selectedCase.legalArea}\n`;
      caseInfo += `**Estado:** ${selectedCase.status}\n`;
      caseInfo += `**Fecha de Creación:** ${selectedCase.createdAt.toLocaleDateString('es-MX')}\n\n`;
      
      if (selectedCase.client) {
        caseInfo += `**Cliente:** ${selectedCase.client}\n`;
      }
      if (selectedCase.caseNumber) {
        caseInfo += `**Número de Expediente:** ${selectedCase.caseNumber}\n`;
      }
      caseInfo += '\n';
      
      // Add parties
      if (selectedCase.parties.length > 0) {
        caseInfo += `### Partes Involucradas\n`;
        selectedCase.parties.forEach(party => {
          caseInfo += `- ${party.name} (${party.role})\n`;
        });
        caseInfo += '\n';
      }
      
      // Add documents
      if (selectedCase.documents.length > 0) {
        caseInfo += `### Documentos\n`;
        selectedCase.documents.forEach(doc => {
          caseInfo += `- ${doc.name}\n`;
        });
        caseInfo += '\n';
      }
      
      // Add deadlines
      if (selectedCase.deadlines.length > 0) {
        const pendingDeadlines = selectedCase.deadlines.filter(d => !d.completed);
        const completedDeadlines = selectedCase.deadlines.filter(d => d.completed);
        
        if (pendingDeadlines.length > 0) {
          caseInfo += `### Plazos Pendientes\n`;
          pendingDeadlines.forEach(deadline => {
            const isOverdue = deadline.date < new Date();
            caseInfo += `- ${deadline.date.toLocaleDateString('es-MX')}: ${deadline.title}${isOverdue ? ' (VENCIDO)' : ''}\n`;
          });
          caseInfo += '\n';
        }
        
        if (completedDeadlines.length > 0) {
          caseInfo += `### Plazos Completados\n`;
          completedDeadlines.forEach(deadline => {
            caseInfo += `- ${deadline.date.toLocaleDateString('es-MX')}: ${deadline.title} ✓\n`;
          });
          caseInfo += '\n';
        }
      }
      
      // Add notes
      if (selectedCase.notes.length > 0) {
        caseInfo += `### Notas Importantes\n`;
        selectedCase.notes.slice(-5).forEach(note => {
          caseInfo += `- ${note.createdAt.toLocaleDateString('es-MX')}: ${note.content.substring(0, 150)}...\n`;
        });
        caseInfo += '\n';
      }
      
      // Generate summary prompt using i18n
      const prompt = promptBuilder.buildQueryPrompt({
        query: caseInfo,
        language: language,
        template: 'caseSummary'
      });
      
      // Prepare for streaming response
      let fullSummary = '';
      
      // Callback to handle streaming chunks
      const handleChunk = (chunk: string) => {
        fullSummary += chunk;
        setStreamingSummary(fullSummary);
      };
      
      // Process with RAG engine using streaming
      const response = await ragEngine.processLegalQueryStreaming(
        prompt,
        handleChunk,
        {
          legalArea: selectedCase.legalArea,
          queryType: 'analytical',
          includeReferences: false
        }
      );
      
      // Update case with generated summary
      updateCase(selectedCase.id, {
        summary: response.answer
      });
      
      // Clear streaming summary after successful update
      setStreamingSummary('');
      
      // Show success message (you might want to add a toast notification here)
      console.log('Summary generated successfully');
      
    } catch (error) {
      console.error('Error generating summary:', error);
      // You might want to show an error toast here
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // Wait for hydration only - don't wait for initialization
  if (!isHydrated) {
    return (
      <_HydrationBoundary 
        fallback={<_LoadingStates.CaseManager />} 
        testId="case-manager"
      />
    );
  }

  return (
    <div className="case-manager flex h-full bg-white dark:bg-gray-900" data-testid="case-manager">
      {/* Sidebar - Case List */}
      <div className="w-80 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('cases.title')}</h2>
            <button
              onClick={() => setIsCreating(true)}
              className="px-3 py-1 bg-legal-500 text-white rounded-lg text-sm hover:bg-legal-600 transition-colors"
              data-testid="new-case-button"
            >
              + {t('cases.newCase')}
            </button>
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder={t('cases.searchCases')}
            value={searchQuery}
            onChange={(e) => {
              const value = e.target.value;
              setSearchQuery(value);
            }}
            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-legal-500"
            data-testid="search-cases-input"
          />

          {/* Filters */}
          <div className="flex space-x-2 mt-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="flex-1 px-2 py-1 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-xs"
              data-testid="filter-status-select"
            >
              <option value="all">{t('common.all')}</option>
              <option value="active">{t('cases.statuses.active')}</option>
              <option value="pending">{t('cases.statuses.pending')}</option>
              <option value="resolved">{t('cases.statuses.closed')}</option>
              <option value="archived">{t('cases.statuses.archived')}</option>
            </select>
            <select
              value={filterArea}
              onChange={(e) => setFilterArea(e.target.value)}
              className="flex-1 px-2 py-1 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-xs"
              data-testid="filter-area-select"
            >
              <option value="all">{t('chat.legalArea.all')}</option>
              <option value="civil">{t('chat.legalArea.civil')}</option>
              <option value="criminal">{t('chat.legalArea.criminal')}</option>
              <option value="labor">{t('chat.legalArea.labor')}</option>
              <option value="tax">{t('chat.legalArea.tax')}</option>
              <option value="commercial">{t('chat.legalArea.commercial')}</option>
              <option value="administrative">{t('chat.legalArea.administrative')}</option>
              <option value="constitutional">{t('chat.legalArea.constitutional')}</option>
            </select>
          </div>
        </div>

        {/* Case List */}
        <div className="flex-1 overflow-y-auto">
          {filteredCases.length === 0 ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm" data-testid="empty-cases-message">
              {cases.length === 0 ? t('cases.noCases') : t('cases.noResults')}
            </div>
          ) : (
            <div className="space-y-1 p-2" data-testid="cases-list">
              {filteredCases.map(caseItem => (
                <button
                  key={`case-${caseItem.id}`}
                  onClick={() => setSelectedCase(caseItem)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedCase?.id === caseItem.id
                      ? 'bg-legal-50 dark:bg-legal-900/20 border border-legal-300 dark:border-legal-700'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                  data-testid={`case-item-${caseItem.id}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {caseItem.title}
                      </div>
                      {caseItem.client && (
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {caseItem.client}
                        </div>
                      )}
                      <div className="flex items-center space-x-2 mt-1">
                        <span 
                          data-testid={`case-status-${caseItem.status}`}
                          className={`inline-block px-2 py-0.5 text-xs rounded-full ${
                          caseItem.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                          caseItem.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                          caseItem.status === 'resolved' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                        }`}>
                          {caseItem.status === 'active' ? t('cases.statuses.active') :
                           caseItem.status === 'pending' ? t('cases.statuses.pending') :
                           caseItem.status === 'resolved' ? t('cases.statuses.closed') : t('cases.statuses.archived')}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {caseItem.legalArea}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {selectedCase ? (
          <>
            {/* Case Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {selectedCase.title}
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    {selectedCase.description}
                  </p>
                  <div className="flex items-center space-x-4 mt-2 text-sm">
                    {selectedCase.client && (
                      <span className="text-gray-600 dark:text-gray-400">
                        <strong>{t('cases.client')}:</strong> {selectedCase.client}
                      </span>
                    )}
                    {selectedCase.caseNumber && (
                      <span className="text-gray-600 dark:text-gray-400">
                        <strong>{t('cases.caseNumber')}:</strong> {selectedCase.caseNumber}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      setEditingCase(selectedCase);
                      setIsEditingCase(true);
                    }}
                    className="px-3 py-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                    title={t('cases.editCase')}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => deleteCase(selectedCase.id)}
                    className="px-3 py-1 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex space-x-1 mt-4 border-b border-gray-200 dark:border-gray-700">
                {(['overview', 'documents', 'notes', 'chat', 'timeline'] as TabView[]).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                      activeTab === tab
                        ? 'text-legal-600 dark:text-legal-400 border-legal-500'
                        : 'text-gray-600 dark:text-gray-400 border-transparent hover:text-gray-900 dark:hover:text-gray-100'
                    }`}
                  >
                    {tab === 'overview' ? t('cases.tabs.summary') :
                     tab === 'documents' ? t('cases.tabs.documents') :
                     tab === 'notes' ? t('cases.tabs.notes') :
                     tab === 'chat' ? t('cases.tabs.chat') : t('cases.tabs.timeline')}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {activeTab === 'overview' && (
                <div className="p-4 overflow-y-auto">
                  <div className="space-y-6">
                  {/* WebLLM Progress Indicator */}
                  {webllmProgress && (
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                      <WebLLMProgress
                        progress={webllmProgress.progress}
                        message={webllmProgress.message}
                        variant="inline"
                      />
                    </div>
                  )}
                  
                  {/* Summary Section */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {t('cases.summary')}
                      </h3>
                      <button
                        onClick={generateSummary}
                        disabled={isGeneratingSummary}
                        className="px-4 py-2 bg-gradient-to-r from-legal-500 to-legal-600 text-white rounded-lg hover:from-legal-600 hover:to-legal-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                      >
                        {isGeneratingSummary ? (
                          <>
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>{t('cases.generatingSummary')}</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span>{selectedCase.summary ? t('cases.regenerateSummary') : t('cases.generateSummary')}</span>
                          </>
                        )}
                      </button>
                    </div>
                    
                    {/* Summary Display with streaming support */}
                    {streamingSummary ? (
                      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <MessageContent 
                          content={streamingSummary}
                          className="text-gray-700 dark:text-gray-300"
                        />
                      </div>
                    ) : selectedCase.summary ? (
                      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <MessageContent 
                          content={selectedCase.summary}
                          className="text-gray-700 dark:text-gray-300"
                        />
                      </div>
                    ) : (
                      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
                        <p className="text-gray-500 dark:text-gray-400 text-sm">
                          {t('cases.noSummary')}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {/* Parties */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('cases.partiesInvolved')}</h3>
                      <button
                        onClick={() => setShowAddPartyModal(true)}
                        className="px-3 py-1 text-sm bg-legal-500 text-white rounded-lg hover:bg-legal-600 transition-colors flex items-center space-x-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span>{t('common.add')}</span>
                      </button>
                    </div>
                    {selectedCase.parties.length === 0 ? (
                      <p className="text-gray-500 dark:text-gray-400 text-sm">{t('cases.noParties')}</p>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {selectedCase.parties.map(party => (
                          <div key={party.id} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <div className="font-medium text-gray-900 dark:text-gray-100">{party.name}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">{party.role}</div>
                            {party.contact && (
                              <div className="text-sm text-gray-500 dark:text-gray-500 mt-1">{party.contact}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Deadlines */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('cases.upcomingDeadlines')}</h3>
                      <button
                        onClick={() => setShowAddDeadlineModal(true)}
                        className="px-3 py-1 text-sm bg-legal-500 text-white rounded-lg hover:bg-legal-600 transition-colors flex items-center space-x-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span>{t('common.add')}</span>
                      </button>
                    </div>
                    {selectedCase.deadlines.filter(d => !d.completed).length === 0 ? (
                      <p className="text-gray-500 dark:text-gray-400 text-sm">{t('cases.noPendingDeadlines')}</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedCase.deadlines
                          .filter(d => !d.completed)
                          .sort((a, b) => a.date.getTime() - b.date.getTime())
                          .map(deadline => (
                            <div key={deadline.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                              <div>
                                <div className="font-medium text-gray-900 dark:text-gray-100">{deadline.title}</div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                  {deadline.date.toLocaleDateString('es-MX')}
                                </div>
                              </div>
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                deadline.type === 'court' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                                deadline.type === 'filing' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                              }`}>
                                {deadline.type === 'court' ? t('cases.deadlineTypes.court') :
                                 deadline.type === 'filing' ? t('cases.deadlineTypes.filing') :
                                 deadline.type === 'meeting' ? t('cases.deadlineTypes.meeting') : t('cases.deadlineTypes.other')}
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                  </div>
                </div>
              )}

              {activeTab === 'documents' && (
                <div className="p-4 overflow-y-auto">
                  {/* Upload Area */}
                  <div className="mb-4">
                    <label data-testid="upload-area" className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <svg className="w-8 h-8 mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p data-testid="upload-text" className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                          <span className="font-semibold">{t('cases.upload.dragDrop')}</span>
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t('cases.upload.supportedFormats')}</p>
                      </div>
                      <input
                        data-testid="file-input"
                        type="file"
                        className="hidden"
                        multiple
                        onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                      />
                    </label>
                  </div>

                  {/* Document List */}
                  {selectedCase.documents.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-sm text-center">{t('cases.noDocuments')}</p>
                  ) : (
                    <div className="grid gap-3">
                      {selectedCase.documents.map(doc => (
                        <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <div>
                              <div className="font-medium text-gray-900 dark:text-gray-100">{doc.name}</div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {(doc.size / 1024).toFixed(1)} KB • {doc.uploadedAt.toLocaleDateString('es-MX')}
                              </div>
                            </div>
                          </div>
                          <button data-testid="delete-document" className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'notes' && (
                <div className="p-4 overflow-y-auto">
                  {/* Add Note Form */}
                  <div className="mb-4">
                    <textarea
                      placeholder={t('cases.addNote')}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-legal-500"
                      rows={3}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          const value = e.currentTarget.value.trim();
                          if (value) {
                            addNote(value);
                            e.currentTarget.value = '';
                          }
                        }
                      }}
                    />
                  </div>

                  {/* Notes List */}
                  {selectedCase.notes.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-sm text-center">{t('cases.noNotes')}</p>
                  ) : (
                    <div className="space-y-3">
                      {selectedCase.notes
                        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
                        .map(note => (
                          <div key={note.id} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <div className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{note.content}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                              {note.createdAt.toLocaleString('es-MX')}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'chat' && (
                <div className="flex-1 overflow-hidden">
                  <Suspense fallback={
                    <div className="flex items-center justify-center h-full">
                      <div className="text-gray-500 dark:text-gray-400">
                        {t('common.loading')}...
                      </div>
                    </div>
                  }>
                    <CaseChat
                      caseId={selectedCase.id}
                      caseTitle={selectedCase.title}
                      caseDescription={selectedCase.description}
                      legalArea={selectedCase.legalArea}
                      documents={selectedCase.documents}
                      notes={selectedCase.notes}
                      parties={selectedCase.parties}
                      deadlines={selectedCase.deadlines}
                      statusChanges={selectedCase.statusChanges}
                      summary={selectedCase.summary}
                      createdAt={selectedCase.createdAt}
                      updatedAt={selectedCase.updatedAt}
                      status={selectedCase.status}
                      onConversationUpdate={(conversationId) => {
                        // Update the case with the new conversation ID
                        if (!selectedCase.conversations.includes(conversationId)) {
                          updateCase(selectedCase.id, {
                            conversations: [...selectedCase.conversations, conversationId]
                          });
                        }
                      }}
                    />
                  </Suspense>
                </div>
              )}

              {activeTab === 'timeline' && (
                <div className="flex-1 overflow-hidden">
                  <Suspense fallback={
                    <div className="flex items-center justify-center h-full">
                      <div className="text-gray-500 dark:text-gray-400">
                        {t('common.loading')}...
                      </div>
                    </div>
                  }>
                    <CaseTimeline
                      caseId={selectedCase.id}
                      caseCreatedAt={selectedCase.createdAt}
                      caseUpdatedAt={selectedCase.updatedAt}
                      documents={selectedCase.documents.map(doc => ({
                        id: doc.id,
                        name: doc.name,
                        uploadedAt: doc.uploadedAt
                      }))}
                      notes={selectedCase.notes.map(note => ({
                        id: note.id,
                        content: note.content,
                        createdAt: note.createdAt
                      }))}
                      deadlines={selectedCase.deadlines}
                      parties={selectedCase.parties}
                      statusChanges={[]}
                      onAddEvent={(event) => {
                        // Here you could store custom events if needed
                        console.log('New event added:', event);
                      }}
                    />
                  </Suspense>
                </div>
              )}
            </div>
          </>
        ) : isCreating ? (
          <CaseCreationForm
            onSave={createCase}
            onCancel={() => setIsCreating(false)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="text-lg font-medium" data-testid="select-case-message">{t('cases.selectCase')}</p>
              <p className="text-sm mt-1" data-testid="or-create-new-message">{t('cases.orCreateNew')}</p>
            </div>
          </div>
        )}
      </div>

      {/* Edit Case Modal */}
      {isEditingCase && editingCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              {t('cases.editCase')}
            </h2>
            <form onSubmit={(e) => {
              e.preventDefault();
              updateCase(editingCase.id, editingCase);
              setIsEditingCase(false);
              setEditingCase(null);
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('cases.caseTitle')}
                </label>
                <input
                  type="text"
                  value={editingCase.title}
                  onChange={(e) => setEditingCase({...editingCase, title: e.target.value})}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-legal-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('cases.caseDescription')}
                </label>
                <textarea
                  value={editingCase.description}
                  onChange={(e) => setEditingCase({...editingCase, description: e.target.value})}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-legal-500"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('cases.client')}
                </label>
                <input
                  type="text"
                  value={editingCase.client || ''}
                  onChange={(e) => setEditingCase({...editingCase, client: e.target.value})}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-legal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('cases.status')}
                </label>
                <select
                  value={editingCase.status}
                  onChange={(e) => setEditingCase({...editingCase, status: e.target.value as any})}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-legal-500"
                >
                  <option value="active">{t('cases.statuses.active')}</option>
                  <option value="pending">{t('cases.statuses.pending')}</option>
                  <option value="resolved">{t('cases.statuses.closed')}</option>
                  <option value="archived">{t('cases.statuses.archived')}</option>
                </select>
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingCase(false);
                    setEditingCase(null);
                  }}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-legal-500 text-white rounded-lg hover:bg-legal-600 transition-colors"
                >
                  {t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Party Modal */}
      {showAddPartyModal && selectedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Agregar Parte
            </h2>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const newParty: Party = {
                id: Date.now().toString(),
                name: formData.get('name') as string,
                role: formData.get('role') as any,
                contact: formData.get('contact') as string || undefined,
                notes: formData.get('notes') as string || undefined
              };
              updateCase(selectedCase.id, {
                parties: [...selectedCase.parties, newParty]
              });
              setShowAddPartyModal(false);
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  name="name"
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-legal-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Rol *
                </label>
                <select
                  name="role"
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-legal-500"
                  required
                >
                  <option value="plaintiff">Demandante</option>
                  <option value="defendant">Demandado</option>
                  <option value="witness">Testigo</option>
                  <option value="expert">Perito</option>
                  <option value="other">Otro</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Contacto
                </label>
                <input
                  type="text"
                  name="contact"
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-legal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notas
                </label>
                <textarea
                  name="notes"
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-legal-500"
                  rows={2}
                />
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddPartyModal(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-legal-500 text-white rounded-lg hover:bg-legal-600 transition-colors"
                >
                  {t('common.add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Deadline Modal */}
      {showAddDeadlineModal && selectedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Agregar Plazo
            </h2>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const newDeadline: Deadline = {
                id: Date.now().toString(),
                title: formData.get('title') as string,
                date: new Date(formData.get('date') as string),
                type: formData.get('type') as any,
                completed: false,
                notes: formData.get('notes') as string || undefined
              };
              updateCase(selectedCase.id, {
                deadlines: [...selectedCase.deadlines, newDeadline]
              });
              setShowAddDeadlineModal(false);
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Título *
                </label>
                <input
                  type="text"
                  name="title"
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-legal-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Fecha *
                </label>
                <input
                  type="date"
                  name="date"
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-legal-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tipo *
                </label>
                <select
                  name="type"
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-legal-500"
                  required
                >
                  <option value="court">{t('cases.deadlineTypes.court')}</option>
                  <option value="filing">{t('cases.deadlineTypes.filing')}</option>
                  <option value="meeting">{t('cases.deadlineTypes.meeting')}</option>
                  <option value="other">{t('cases.deadlineTypes.other')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notas
                </label>
                <textarea
                  name="notes"
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-legal-500"
                  rows={2}
                />
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddDeadlineModal(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-legal-500 text-white rounded-lg hover:bg-legal-600 transition-colors"
                >
                  {t('common.add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Case Creation Form Component
function CaseCreationForm({ 
  onSave, 
  onCancel 
}: { 
  onSave: (data: Partial<LegalCase>) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    client: '',
    caseNumber: '',
    legalArea: 'civil' as LegalArea
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.title.trim()) {
      onSave(formData);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4" data-testid="case-creation-form">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">{t('cases.createNewCase')}</h2>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('cases.caseTitle')} *
          </label>
          <input
            type="text"
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-legal-500"
            placeholder={t('cases.exampleTitle')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('cases.caseDescription')}
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-legal-500 resize-none"
            rows={3}
            placeholder={t('cases.briefDescription')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('cases.client')}
          </label>
          <input
            type="text"
            value={formData.client}
            onChange={(e) => setFormData({ ...formData, client: e.target.value })}
            className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-legal-500"
            placeholder={t('cases.clientName')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('cases.caseNumber')}
          </label>
          <input
            type="text"
            value={formData.caseNumber}
            onChange={(e) => setFormData({ ...formData, caseNumber: e.target.value })}
            className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-legal-500"
            placeholder={t('cases.caseNumberExample')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('cases.legalArea')}
          </label>
          <select
            value={formData.legalArea}
            onChange={(e) => setFormData({ ...formData, legalArea: e.target.value as LegalArea })}
            className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-legal-500"
          >
            <option value="civil">{t('chat.legalArea.civil')}</option>
            <option value="criminal">{t('chat.legalArea.criminal')}</option>
            <option value="labor">{t('chat.legalArea.labor')}</option>
            <option value="tax">{t('chat.legalArea.tax')}</option>
            <option value="commercial">{t('chat.legalArea.commercial')}</option>
            <option value="administrative">{t('chat.legalArea.administrative')}</option>
            <option value="constitutional">{t('chat.legalArea.constitutional')}</option>
          </select>
        </div>

        <div className="flex space-x-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-2 bg-legal-500 text-white rounded-lg hover:bg-legal-600 transition-colors"
          >
            {t('cases.createCase')}
          </button>
        </div>
      </form>
    </div>
  );
}