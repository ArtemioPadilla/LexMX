import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '../i18n/index';
import type { LegalArea } from '../types/legal';
import { HydrationBoundary, LoadingStates } from '../components/HydrationBoundary';
import { TEST_IDS } from '../utils/test-ids';

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
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [activeTab, setActiveTab] = useState<TabView>('overview');
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterArea, setFilterArea] = useState<string>('all');
  const [isInitialized, setIsInitialized] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // Handle hydration
  useEffect(() => {
    setIsHydrated(true);
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
    setIsInitialized(true);
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
        setCases(parsed.map((c: any) => ({
          ...c,
          createdAt: new Date(c.createdAt),
          updatedAt: new Date(c.updatedAt),
          deadlines: c.deadlines?.map((d: any) => ({ ...d, date: new Date(d.date) })) || []
        })));
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

  const addDeadline = (deadline: Omit<Deadline, 'id'>) => {
    if (!selectedCase) return;

    const newDeadline: Deadline = {
      ...deadline,
      id: Date.now().toString()
    };

    updateCase(selectedCase.id, {
      deadlines: [...selectedCase.deadlines, newDeadline]
    });
  };

  // Wait for hydration only - don't wait for initialization
  if (!isHydrated) {
    return (
      <div className="case-manager flex h-full bg-white dark:bg-gray-900 items-center justify-center" data-testid="case-manager">
        <div className="text-gray-500 dark:text-gray-400">
          Loading...
        </div>
      </div>
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
                    onClick={() => {/* Open edit modal */}}
                    className="px-3 py-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
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
            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Parties */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">{t('cases.partiesInvolved')}</h3>
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
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">{t('cases.upcomingDeadlines')}</h3>
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
              )}

              {activeTab === 'documents' && (
                <div>
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
                <div>
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
                <div className="text-center text-gray-500 dark:text-gray-400">
                  <p>{t('cases.chatComingSoon')}</p>
                  <p className="text-sm mt-2">{t('cases.chatDescription')}</p>
                </div>
              )}

              {activeTab === 'timeline' && (
                <div className="text-center text-gray-500 dark:text-gray-400">
                  <p>{t('cases.timelineComingSoon')}</p>
                  <p className="text-sm mt-2">{t('cases.timelineDescription')}</p>
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