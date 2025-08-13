import React, { useMemo, useRef, useEffect } from 'react';
import type { LegalDocument, LegalContent } from '../../types/legal';
import { useTranslation } from '../../i18n';

interface DocumentTextViewProps {
  document: LegalDocument;
  currentSection?: string | null;
  searchQuery?: string;
  highlightedChunks?: string[];
  onSectionChange?: (sectionId: string) => void;
  focusMode?: boolean;
}

export function DocumentTextView({ 
  document, 
  currentSection, 
  searchQuery = '', 
  highlightedChunks = [],
  onSectionChange,
  focusMode = false
}: DocumentTextViewProps) {
  const { t } = useTranslation();
  const contentRef = useRef<HTMLDivElement>(null);

  // Filter content based on focus mode and current section
  const displayContent = useMemo(() => {
    if (!document.content) return [];
    
    if (focusMode && currentSection) {
      // Show only the selected section and its children
      const selectedContent = document.content.find(c => c.id === currentSection || c.number === currentSection);
      if (selectedContent) {
        const children = document.content.filter(c => c.parent === selectedContent.id);
        return [selectedContent, ...children];
      }
    }
    
    return document.content;
  }, [document.content, currentSection, focusMode]);

  // Highlight search terms
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">
          {part}
        </mark>
      ) : part
    );
  };

  // Auto-scroll to current section
  useEffect(() => {
    if (currentSection && contentRef.current) {
      const element = contentRef.current.querySelector(`[data-section-id="${currentSection}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [currentSection]);

  // Format content based on type
  const formatContent = (content: LegalContent) => {
    const isHighlighted = highlightedChunks.includes(content.id);
    const isCurrent = currentSection === content.id || currentSection === content.number;
    
    const baseClasses = `
      transition-all duration-200 scroll-mt-20
      ${isHighlighted ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 pl-4' : ''}
      ${isCurrent ? 'bg-legal-50 dark:bg-legal-900/20 border-l-4 border-legal-500 pl-4' : ''}
    `.trim();

    switch (content.type) {
      case 'title':
        return (
          <div 
            key={content.id}
            data-section-id={content.id}
            className={`${baseClasses} mb-8`}
          >
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 cursor-pointer hover:text-legal-600 dark:hover:text-legal-400"
                onClick={() => onSectionChange?.(content.id)}>
              {content.number && (
                <span className="text-legal-600 dark:text-legal-400 mr-2">
                  {content.number}.
                </span>
              )}
              {content.title || 'Título'}
            </h2>
            {content.content && (
              <div className="prose prose-legal dark:prose-invert max-w-none">
                {highlightText(content.content, searchQuery)}
              </div>
            )}
          </div>
        );

      case 'chapter':
        return (
          <div 
            key={content.id}
            data-section-id={content.id}
            className={`${baseClasses} mb-6`}
          >
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 cursor-pointer hover:text-legal-600 dark:hover:text-legal-400"
                onClick={() => onSectionChange?.(content.id)}>
              {content.number && (
                <span className="text-legal-600 dark:text-legal-400 mr-2">
                  Capítulo {content.number}
                </span>
              )}
              {content.title}
            </h3>
            {content.content && (
              <div className="prose prose-legal dark:prose-invert max-w-none">
                {highlightText(content.content, searchQuery)}
              </div>
            )}
          </div>
        );

      case 'section':
        return (
          <div 
            key={content.id}
            data-section-id={content.id}
            className={`${baseClasses} mb-4`}
          >
            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2 cursor-pointer hover:text-legal-600 dark:hover:text-legal-400"
                onClick={() => onSectionChange?.(content.id)}>
              {content.number && (
                <span className="text-legal-600 dark:text-legal-400 mr-2">
                  Sección {content.number}
                </span>
              )}
              {content.title}
            </h4>
            {content.content && (
              <div className="prose prose-legal dark:prose-invert max-w-none">
                {highlightText(content.content, searchQuery)}
              </div>
            )}
          </div>
        );

      case 'article':
        return (
          <article 
            key={content.id}
            data-section-id={content.id}
            className={`${baseClasses} legal-article mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700`}
          >
            <header className="mb-3">
              <h5 className="text-lg font-semibold text-gray-900 dark:text-white cursor-pointer hover:text-legal-600 dark:hover:text-legal-400 flex items-center"
                  onClick={() => onSectionChange?.(content.id)}>
                <span className="bg-legal-100 dark:bg-legal-900 text-legal-800 dark:text-legal-200 px-3 py-1 rounded-full text-sm font-medium mr-3">
                  Artículo {content.number}
                </span>
                {content.title && (
                  <span className="text-base font-normal text-gray-600 dark:text-gray-300">
                    {content.title}
                  </span>
                )}
              </h5>
            </header>
            
            <div className="prose prose-legal dark:prose-invert max-w-none legal-document">
              {highlightText(content.content, searchQuery)}
            </div>

            {/* Article actions */}
            <footer className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                <button className="hover:text-legal-600 dark:hover:text-legal-400 flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copiar cita
                </button>
                <button className="hover:text-legal-600 dark:hover:text-legal-400 flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  Enlace permanente
                </button>
              </div>
              
              <div className="text-xs text-gray-400 dark:text-gray-500">
                Art. {content.number}
              </div>
            </footer>
          </article>
        );

      case 'paragraph':
        return (
          <div 
            key={content.id}
            data-section-id={content.id}
            className={`${baseClasses} mb-3 pl-6`}
          >
            <div className="prose prose-legal dark:prose-invert max-w-none">
              {content.number && (
                <span className="font-medium text-legal-600 dark:text-legal-400 mr-2">
                  {content.number}.
                </span>
              )}
              {highlightText(content.content, searchQuery)}
            </div>
          </div>
        );

      case 'fraction':
        return (
          <div 
            key={content.id}
            data-section-id={content.id}
            className={`${baseClasses} mb-2 pl-8`}
          >
            <div className="prose prose-legal dark:prose-invert max-w-none">
              {content.number && (
                <span className="font-medium text-legal-600 dark:text-legal-400 mr-2">
                  {content.number})
                </span>
              )}
              {highlightText(content.content, searchQuery)}
            </div>
          </div>
        );

      default:
        return (
          <div 
            key={content.id}
            data-section-id={content.id}
            className={`${baseClasses} mb-4`}
          >
            <div className="prose prose-legal dark:prose-invert max-w-none">
              {highlightText(content.content, searchQuery)}
            </div>
          </div>
        );
    }
  };

  if (!displayContent.length) {
    return (
      <div className="text-center py-12">
        <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No hay contenido disponible
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          Este documento no tiene contenido estructurado disponible.
        </p>
      </div>
    );
  }

  return (
    <div ref={contentRef} className="space-y-2">
      {/* Focus mode header */}
      {focusMode && currentSection && (
        <div className="bg-legal-50 dark:bg-legal-900/20 border border-legal-200 dark:border-legal-700 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-legal-800 dark:text-legal-200">
                Vista enfocada
              </h3>
              <p className="text-sm text-legal-600 dark:text-legal-400">
                {t('documentViewer.content.showingSection')}
              </p>
            </div>
            <button
              onClick={() => onSectionChange?.('')}
              className="text-legal-600 dark:text-legal-400 hover:text-legal-800 dark:hover:text-legal-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="space-y-1">
        {displayContent.map(formatContent)}
      </div>

      {/* End of document */}
      <div className="text-center py-8 border-t border-gray-200 dark:border-gray-700 mt-12">
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          {t('documentViewer.content.endOfDocument')} • {document.title}
        </p>
        {document.officialUrl && (
          <a 
            href={document.officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center mt-2 text-legal-600 dark:text-legal-400 hover:text-legal-800 dark:hover:text-legal-200 text-sm"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            {t('documentViewer.content.viewOfficialVersion')}
          </a>
        )}
      </div>
    </div>
  );
}