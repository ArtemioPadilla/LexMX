import React, { useState, useEffect, useMemo } from 'react';
import { HydrationBoundary, LoadingStates } from '../components/HydrationBoundary';
import { TEST_IDS } from '../utils/test-ids';
import type { LegalDocument, LegalContent } from '../types/legal';
import { DocumentTextView } from '../components/legal/DocumentTextView';
import { DocumentPDFView } from '../components/legal/DocumentPDFView';
import { DocumentChunksView } from '../components/legal/DocumentChunksView';
import { DocumentMetadataView } from '../components/legal/DocumentMetadataView';
import { DocumentNavigation } from '../components/legal/DocumentNavigation';
import { DocumentSearch } from '../components/legal/DocumentSearch';
import { DocumentExport } from '../components/legal/DocumentExport';
import { ViewModeSelector } from '../components/legal/ViewModeSelector';
import { BreadcrumbNavigation } from '../components/legal/BreadcrumbNavigation';

export type ViewMode = 'text' | 'pdf' | 'chunks' | 'metadata' | 'article';

interface DocumentViewerProps {
  document: LegalDocument;
  initialView?: string;
  initialSection?: string;
}

export default function DocumentViewer({ 
  document, 
  initialView = 'text', 
  initialSection 
}: DocumentViewerProps) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(initialView as ViewMode);
  const [currentSection, setCurrentSection] = useState<string | null>(initialSection);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [highlightedChunks, setHighlightedChunks] = useState<string[]>([]);

  // Handle hydration
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Process document content for navigation
  const documentStructure = useMemo(() => {
    if (!document.content) return [];
    
    return document.content
      .filter(content => ['title', 'chapter', 'section', 'article'].includes(content.type))
      .map(content => ({
        id: content.id,
        type: content.type,
        number: content.number,
        title: content.title || content.content.substring(0, 100) + '...',
        parent: content.parent,
        level: content.type === 'title' ? 0 : 
               content.type === 'chapter' ? 1 :
               content.type === 'section' ? 2 : 3
      }));
  }, [document.content]);

  // Handle section navigation
  const handleSectionChange = (sectionId: string) => {
    setCurrentSection(sectionId);
    // Update URL without page reload
    if (typeof window !== 'undefined') {
      const newUrl = `/document/${document.id}/${viewMode === 'article' ? 'article/' + sectionId : viewMode}`;
      window.history.pushState({}, '', newUrl);
    }
  };

  // Handle view mode changes
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      const newUrl = currentSection && mode === 'article' 
        ? `/document/${document.id}/article/${currentSection}`
        : `/document/${document.id}/${mode}`;
      window.history.pushState({}, '', newUrl);
    }
  };

  // Handle search
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      setHighlightedChunks([]);
      return;
    }

    try {
      // Simple text search in document content
      const results = document.content?.filter(content => 
        content.content?.toLowerCase().includes(query.toLowerCase())
      ) || [];
      
      setSearchResults(results);
      setHighlightedChunks(results.map(r => r.id));
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    }
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleKeyPress = (e: KeyboardEvent) => {
        if (e.ctrlKey || e.metaKey) {
          switch (e.key) {
            case 'f':
              e.preventDefault();
              document.getElementById('document-search')?.focus();
              break;
            case '1':
              e.preventDefault();
              handleViewModeChange('text');
              break;
            case '2':
              e.preventDefault();
              handleViewModeChange('pdf');
              break;
            case '3':
              e.preventDefault();
              handleViewModeChange('chunks');
              break;
            case '4':
              e.preventDefault();
              handleViewModeChange('metadata');
              break;
          }
        }
        
        if (e.key === 'Escape') {
          setSearchQuery('');
          setSearchResults([]);
          setHighlightedChunks([]);
        }
      };

      window.addEventListener('keydown', handleKeyPress);
  // Handle SSR/hydration
  if (!isHydrated) {
    return (
      <HydrationBoundary 
        fallback={<LoadingStates.DocumentViewer />} 
        testId="document-viewer"
      />
    );
  }

  return () => window.removeEventListener('keydown', handleKeyPress);
    }
  }, []);

  return (
    <div
      data-testid="document-viewer" className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Breadcrumb */}
            <BreadcrumbNavigation 
              document={document}
              currentSection={currentSection}
              className="flex-1"
            />
            
            {/* Actions */}
            <div className="flex items-center space-x-4">
              <DocumentSearch 
                onSearch={handleSearch}
                searchQuery={searchQuery}
                searchResults={searchResults}
                onResultClick={handleSectionChange}
              />
              
              <DocumentExport 
                document={document}
                currentView={viewMode}
                currentSection={currentSection}
              />
              
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                aria-label="Toggle sidebar"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
          
          {/* View Mode Selector */}
          <div className="pb-4">
            <ViewModeSelector 
              currentMode={viewMode}
              onModeChange={handleViewModeChange}
              availableModes={['text', 'pdf', 'chunks', 'metadata']}
            />
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        {sidebarOpen && (
          <aside className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 h-screen sticky top-16 overflow-y-auto">
            <DocumentNavigation 
              documentStructure={documentStructure}
              currentSection={currentSection}
              onSectionChange={handleSectionChange}
              searchResults={searchResults}
              searchQuery={searchQuery}
            />
          </aside>
        )}

        {/* Main Content */}
        <main className={`flex-1 ${sidebarOpen ? 'ml-0' : ''}`}>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Document Header */}
            <div className="mb-8">
              <div className="flex items-center mb-4">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-legal-100 text-legal-800 dark:bg-legal-900 dark:text-legal-200">
                  {document.type.charAt(0).toUpperCase() + document.type.slice(1)}
                </span>
                <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                  Jerarquía Nivel {document.hierarchy}
                </span>
              </div>
              
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {document.title}
              </h1>
              
              {document.shortTitle && (
                <p className="text-lg text-gray-600 dark:text-gray-300">
                  {document.shortTitle}
                </p>
              )}

              {/* Document Stats */}
              <div className="flex items-center space-x-6 mt-4 text-sm text-gray-500 dark:text-gray-400">
                <span className="flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {document.content?.length || 0} secciones
                </span>
                
                {document.lastReform && (
                  <span className="flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Última reforma: {new Date(document.lastReform).toLocaleDateString('es-MX')}
                  </span>
                )}
                
                <span className="flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  {document.status}
                </span>
              </div>
            </div>

            {/* Content Views */}
            {viewMode === 'text' && (
              <DocumentTextView 
                document={document}
                currentSection={currentSection}
                searchQuery={searchQuery}
                highlightedChunks={highlightedChunks}
                onSectionChange={handleSectionChange}
              />
            )}

            {viewMode === 'pdf' && (
              <DocumentPDFView 
                document={document}
                currentSection={currentSection}
              />
            )}

            {viewMode === 'chunks' && (
              <DocumentChunksView 
                document={document}
                searchQuery={searchQuery}
                highlightedChunks={highlightedChunks}
              />
            )}

            {viewMode === 'metadata' && (
              <DocumentMetadataView 
                document={document}
              />
            )}

            {viewMode === 'article' && currentSection && (
              <DocumentTextView 
                document={document}
                currentSection={currentSection}
                searchQuery={searchQuery}
                highlightedChunks={highlightedChunks}
                onSectionChange={handleSectionChange}
                focusMode={true}
              />
            )}
          </div>
        </main>
      </div>

      {/* Floating Action Button for Mobile */}
      <div className="fixed bottom-6 right-6 md:hidden">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="bg-legal-500 text-white p-3 rounded-full shadow-lg hover:bg-legal-600 transition-colors"
          aria-label="Toggle navigation"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Keyboard Shortcuts Help */}
      <div className="fixed bottom-6 left-6 text-xs text-gray-500 dark:text-gray-400 hidden lg:block">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm">
          <p className="font-medium mb-1">Atajos de teclado:</p>
          <p>Ctrl+F: Buscar • Ctrl+1-4: Cambiar vista • Esc: Limpiar búsqueda</p>
        </div>
      </div>
    </div>
  );
}