import { useState, useEffect } from 'react';
import { useTranslation } from '../i18n/index';
import type { LegalArea } from '../types/legal';
import { TEST_IDS } from '../utils/test-ids';

interface CorpusDocument {
  id: string;
  title: string;
  area: LegalArea;
  type: 'constitution' | 'law' | 'code' | 'regulation' | 'nom' | 'jurisprudence';
  shortName?: string;
  articles?: number;
  lastReform?: string;
}

interface CorpusSelection {
  areas: LegalArea[];
  documents: string[];
}

interface CorpusSelectorProps {
  onSelectionChange?: (selection: CorpusSelection) => void;
  className?: string;
}

// Sample corpus documents - in production this would come from the corpus
const CORPUS_DOCUMENTS: CorpusDocument[] = [
  // Constitutional
  { id: 'cpeum', title: 'Constitución Política de los Estados Unidos Mexicanos', area: 'constitutional', type: 'constitution', shortName: 'CPEUM', articles: 136 },
  { id: 'amparo', title: 'Ley de Amparo', area: 'constitutional', type: 'law', shortName: 'Ley de Amparo', articles: 267 },
  
  // Labor
  { id: 'lft', title: 'Ley Federal del Trabajo', area: 'labor', type: 'law', shortName: 'LFT', articles: 1010 },
  { id: 'lss', title: 'Ley del Seguro Social', area: 'labor', type: 'law', shortName: 'LSS', articles: 313 },
  { id: 'linfonavit', title: 'Ley del INFONAVIT', area: 'labor', type: 'law', shortName: 'LINFONAVIT', articles: 68 },
  
  // Civil
  { id: 'ccf', title: 'Código Civil Federal', area: 'civil', type: 'code', shortName: 'CCF', articles: 3074 },
  { id: 'cfpc', title: 'Código Federal de Procedimientos Civiles', area: 'civil', type: 'code', shortName: 'CFPC', articles: 583 },
  
  // Criminal
  { id: 'cpf', title: 'Código Penal Federal', area: 'criminal', type: 'code', shortName: 'CPF', articles: 434 },
  { id: 'cnpp', title: 'Código Nacional de Procedimientos Penales', area: 'criminal', type: 'code', shortName: 'CNPP', articles: 456 },
  
  // Tax
  { id: 'cff', title: 'Código Fiscal de la Federación', area: 'tax', type: 'code', shortName: 'CFF', articles: 305 },
  { id: 'lisr', title: 'Ley del Impuesto Sobre la Renta', area: 'tax', type: 'law', shortName: 'LISR', articles: 206 },
  { id: 'liva', title: 'Ley del Impuesto al Valor Agregado', area: 'tax', type: 'law', shortName: 'LIVA', articles: 67 },
  
  // Commercial
  { id: 'ccom', title: 'Código de Comercio', area: 'commercial', type: 'code', shortName: 'CCom', articles: 1463 },
  { id: 'lgsm', title: 'Ley General de Sociedades Mercantiles', area: 'commercial', type: 'law', shortName: 'LGSM', articles: 264 },
  { id: 'ltoc', title: 'Ley de Títulos y Operaciones de Crédito', area: 'commercial', type: 'law', shortName: 'LTOC', articles: 413 },
  
  // Administrative
  { id: 'lgra', title: 'Ley General de Responsabilidades Administrativas', area: 'administrative', type: 'law', shortName: 'LGRA', articles: 230 },
  { id: 'loapf', title: 'Ley Orgánica de la Administración Pública Federal', area: 'administrative', type: 'law', shortName: 'LOAPF', articles: 59 },
  { id: 'lfpa', title: 'Ley Federal de Procedimiento Administrativo', area: 'administrative', type: 'law', shortName: 'LFPA', articles: 102 },
];

export default function CorpusSelector({ onSelectionChange, className = '' }: CorpusSelectorProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedAreas, setSelectedAreas] = useState<Set<LegalArea>>(new Set());
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'areas' | 'documents'>('areas');

  const LEGAL_AREAS: { value: LegalArea; label: string; icon: string }[] = [
    { value: 'constitutional', label: t('corpus.areas.constitutional'), icon: '⚖️' },
    { value: 'labor', label: t('corpus.areas.labor'), icon: '👷' },
    { value: 'civil', label: t('corpus.areas.civil'), icon: '👥' },
    { value: 'criminal', label: t('corpus.areas.criminal'), icon: '🚨' },
    { value: 'tax', label: t('corpus.areas.tax'), icon: '💰' },
    { value: 'commercial', label: t('corpus.areas.commercial'), icon: '🏢' },
    { value: 'administrative', label: t('corpus.areas.administrative'), icon: '📋' },
  ];

  // Filter documents based on search and selected areas
  const filteredDocuments = CORPUS_DOCUMENTS.filter(doc => {
    const matchesSearch = searchQuery === '' || 
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.shortName?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesArea = selectedAreas.size === 0 || selectedAreas.has(doc.area);
    
    return matchesSearch && matchesArea;
  });

  // Group documents by area
  const documentsByArea = filteredDocuments.reduce((acc, doc) => {
    if (!acc[doc.area]) acc[doc.area] = [];
    acc[doc.area].push(doc);
    return acc;
  }, {} as Record<LegalArea, CorpusDocument[]>);

  const handleAreaToggle = (area: LegalArea) => {
    const newAreas = new Set(selectedAreas);
    if (newAreas.has(area)) {
      newAreas.delete(area);
      // Remove all documents from this area
      const newDocs = new Set(selectedDocuments);
      CORPUS_DOCUMENTS.filter(d => d.area === area).forEach(d => newDocs.delete(d.id));
      setSelectedDocuments(newDocs);
    } else {
      newAreas.add(area);
      // Optionally add all documents from this area
      const newDocs = new Set(selectedDocuments);
      CORPUS_DOCUMENTS.filter(d => d.area === area).forEach(d => newDocs.add(d.id));
      setSelectedDocuments(newDocs);
    }
    setSelectedAreas(newAreas);
  };

  const handleDocumentToggle = (docId: string) => {
    const newDocs = new Set(selectedDocuments);
    if (newDocs.has(docId)) {
      newDocs.delete(docId);
    } else {
      newDocs.add(docId);
    }
    setSelectedDocuments(newDocs);
  };

  const handleSelectAll = () => {
    const allDocIds = new Set(CORPUS_DOCUMENTS.map(d => d.id));
    const allAreas = new Set(LEGAL_AREAS.map(a => a.value));
    setSelectedDocuments(allDocIds);
    setSelectedAreas(allAreas);
  };

  const handleClearAll = () => {
    setSelectedDocuments(new Set());
    setSelectedAreas(new Set());
  };

  // Notify parent of selection changes
  useEffect(() => {
    onSelectionChange?.({
      areas: Array.from(selectedAreas),
      documents: Array.from(selectedDocuments)
    });
  }, [selectedAreas, selectedDocuments]); // onSelectionChange excluded to prevent re-renders

  // Close dropdown when clicking outside
  useEffect(() => {
    if (isOpen) {
      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        if (!target.closest('.corpus-selector')) {
          setIsOpen(false);
        }
      };
      
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isOpen]);

  const selectedCount = selectedDocuments.size;
  // const _totalCount = CORPUS_DOCUMENTS.length;

  return (
    <div className={`relative corpus-selector ${className}`}>
      <button
        type="button"
        data-testid={TEST_IDS.corpus.selectorToggle}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="flex items-center space-x-2 px-3 py-2 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors text-sm"
        aria-expanded={isOpen}
      >
        <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
        <span className="text-gray-700 dark:text-gray-300">
          {selectedCount === 0 ? t('corpus.all') : t('corpus.selected', { count: selectedCount })}
        </span>
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Mobile backdrop */}
          <div 
            className="md:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown/Modal */}
          <div 
            data-testid={TEST_IDS.corpus.dropdown}
            className="fixed md:absolute inset-x-0 md:inset-auto bottom-0 md:top-full md:mt-2 md:left-0 md:right-auto md:w-80 lg:w-96 w-full md:mx-0 bg-white dark:bg-gray-800 rounded-t-lg md:rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 max-h-[70vh] md:max-h-[500px] flex flex-col">
            {/* Header */}
            <div className="p-3 md:p-3 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-gray-900 dark:text-gray-100">{t('corpus.selectTitle')}</h3>
                <div className="flex items-center space-x-2">
                  {/* Mobile close button */}
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="md:hidden p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    aria-label={t('common.close')}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      data-testid={TEST_IDS.corpus.selectAll}
                      onClick={handleSelectAll}
                      className="text-xs px-2 py-1 text-legal-600 dark:text-legal-400 hover:text-legal-700 dark:hover:text-legal-300"
                    >
                      {t('corpus.selectAll')}
                    </button>
                    <button
                      type="button"
                      data-testid={TEST_IDS.corpus.clearAll}
                      onClick={handleClearAll}
                      className="text-xs px-2 py-1 text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                      {t('corpus.clear')}
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Tabs */}
              <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                <button
                  type="button"
                  data-testid={TEST_IDS.corpus.areaTab}
                  onClick={() => setActiveTab('areas')}
                  className={`flex-1 px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'areas'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
                >
                  {t('corpus.byArea')}
                </button>
                <button
                  type="button"
                  data-testid={TEST_IDS.corpus.documentTab}
                  onClick={() => setActiveTab('documents')}
                  className={`flex-1 px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'documents'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
                >
                  {t('corpus.byDocument')}
                </button>
              </div>
            </div>

          {/* Search (for documents tab) */}
          {activeTab === 'documents' && (
            <div className="p-3 border-b border-gray-200 dark:border-gray-700">
              <input
                type="text"
                data-testid={TEST_IDS.corpus.searchInput}
                placeholder={t('corpus.searchDocument')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-legal-500"
              />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-3">
            {activeTab === 'areas' ? (
              // Areas view
              <div className="space-y-2">
                {LEGAL_AREAS.map(area => {
                  const areaDocCount = CORPUS_DOCUMENTS.filter(d => d.area === area.value).length;
                  const selectedDocCount = CORPUS_DOCUMENTS.filter(d => d.area === area.value && selectedDocuments.has(d.id)).length;
                  
                  return (
                    <div key={area.value} className="space-y-1">
                      <button
                        type="button"
                        onClick={() => handleAreaToggle(area.value)}
                        className={`w-full text-left px-3 py-3 md:py-2 min-h-[44px] md:min-h-0 rounded-lg transition-colors flex items-center justify-between ${
                          selectedAreas.has(area.value)
                            ? 'bg-legal-50 dark:bg-legal-900/20 text-legal-700 dark:text-legal-300'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <span>{area.icon}</span>
                          <span className="font-medium">{area.label}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {selectedDocCount}/{areaDocCount} docs
                          </span>
                          <input
                            type="checkbox"
                            checked={selectedAreas.has(area.value)}
                            onChange={() => {}}
                            className="h-4 w-4 text-legal-600 rounded border-gray-300 focus:ring-legal-500"
                          />
                        </div>
                      </button>
                      
                      {/* Show documents in this area if selected */}
                      {selectedAreas.has(area.value) && (
                        <div className="ml-8 space-y-1">
                          {CORPUS_DOCUMENTS.filter(d => d.area === area.value).map(doc => (
                            <button
                              key={doc.id}
                              type="button"
                              onClick={() => handleDocumentToggle(doc.id)}
                              className={`w-full text-left px-2 py-1 rounded text-sm transition-colors flex items-center justify-between ${
                                selectedDocuments.has(doc.id)
                                  ? 'bg-legal-100 dark:bg-legal-800/30 text-legal-700 dark:text-legal-300'
                                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                              }`}
                            >
                              <span className="truncate">{doc.shortName || doc.title}</span>
                              <input
                                type="checkbox"
                                checked={selectedDocuments.has(doc.id)}
                                onChange={() => {}}
                                className="h-3 w-3 text-legal-600 rounded border-gray-300 focus:ring-legal-500"
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              // Documents view
              <div className="space-y-3">
                {Object.entries(documentsByArea).map(([area, docs]) => {
                  const areaInfo = LEGAL_AREAS.find(a => a.value === area);
                  if (!areaInfo) return null;
                  
                  return (
                    <div key={area}>
                      <div className="flex items-center space-x-2 mb-2">
                        <span>{areaInfo.icon}</span>
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">{areaInfo.label}</h4>
                      </div>
                      <div className="space-y-1">
                        {docs.map(doc => (
                          <button
                            key={doc.id}
                            type="button"
                            onClick={() => handleDocumentToggle(doc.id)}
                            className={`w-full text-left px-3 py-3 md:py-2 min-h-[44px] md:min-h-0 rounded-md transition-colors flex items-center justify-between ${
                              selectedDocuments.has(doc.id)
                                ? 'bg-legal-50 dark:bg-legal-900/20 text-legal-700 dark:text-legal-300'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                          >
                            <div className="flex-1">
                              <div className="font-medium text-sm">{doc.shortName}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">{doc.title}</div>
                            </div>
                            <input
                              type="checkbox"
                              checked={selectedDocuments.has(doc.id)}
                              onChange={() => {}}
                              className="h-4 w-4 text-legal-600 rounded border-gray-300 focus:ring-legal-500"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
            <div className="text-xs text-gray-600 dark:text-gray-400 text-center">
              {selectedCount === 0 ? 
                t('corpus.all') : 
                t('corpus.selected', { count: selectedCount })}
            </div>
          </div>
        </div>
        </>
      )}
    </div>
  );
}