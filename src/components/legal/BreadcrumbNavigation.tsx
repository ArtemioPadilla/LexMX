import React from 'react';
import type { LegalDocument } from '../../types/legal';

interface BreadcrumbNavigationProps {
  document: LegalDocument;
  currentSection?: string | null;
  className?: string;
}

export function BreadcrumbNavigation({ document, currentSection, className = '' }: BreadcrumbNavigationProps) {
  // Build breadcrumb path
  const breadcrumbs = [
    {
      name: 'LexMX',
      href: '/',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5l4-4 4 4" />
        </svg>
      )
    },
    {
      name: 'Documentos Legales',
      href: '/legal'
    },
    {
      name: getDocumentTypeDisplay(document.type),
      href: `/legal?type=${document.type}`
    },
    {
      name: document.shortTitle || document.title,
      href: `/document/${document.id}`,
      current: !currentSection
    }
  ];

  // Add current section if viewing a specific section
  if (currentSection) {
    const sectionContent = document.content?.find(c => 
      c.id === currentSection || c.number === currentSection
    );
    
    if (sectionContent) {
      breadcrumbs.push({
        name: getSectionDisplay(sectionContent.type, sectionContent.number, sectionContent.title),
        href: `/document/${document.id}/article/${currentSection}`,
        current: true
      });
    }
  }

  function getDocumentTypeDisplay(type: string): string {
    const types: Record<string, string> = {
      'constitution': 'Constitución',
      'law': 'Leyes',
      'code': 'Códigos',
      'regulation': 'Reglamentos',
      'norm': 'Normas',
      'jurisprudence': 'Jurisprudencia',
      'treaty': 'Tratados',
      'format': 'Formatos'
    };
    return types[type] || type.charAt(0).toUpperCase() + type.slice(1);
  }

  function getSectionDisplay(type: string, number?: string, title?: string): string {
    const typeDisplays: Record<string, string> = {
      'title': 'Título',
      'chapter': 'Capítulo',
      'section': 'Sección', 
      'article': 'Artículo',
      'paragraph': 'Párrafo',
      'fraction': 'Fracción'
    };
    
    const typeDisplay = typeDisplays[type] || type;
    if (number) {
      return `${typeDisplay} ${number}${title ? ` - ${title}` : ''}`;
    }
    return title || typeDisplay;
  }

  // Get document hierarchy badge
  const getHierarchyBadge = (hierarchy: number) => {
    const colors: Record<number, string> = {
      1: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      2: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      3: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      4: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      5: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      6: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
      7: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
    };
    
    return colors[hierarchy] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  };

  return (
    <nav className={`flex items-center space-x-2 ${className}`} aria-label="Breadcrumb">
      {/* Document status and hierarchy info */}
      <div className="flex items-center space-x-2 mr-4">
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getHierarchyBadge(document.hierarchy)}`}>
          Nivel {document.hierarchy}
        </span>
        
        {document.status !== 'active' && (
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            document.status === 'repealed' 
              ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
          }`}>
            {document.status === 'repealed' ? 'Derogado' : 'Suspendido'}
          </span>
        )}
      </div>

      {/* Breadcrumb items */}
      <ol className="flex items-center space-x-2">
        {breadcrumbs.map((breadcrumb, index) => (
          <li key={index} className="flex items-center">
            {index > 0 && (
              <svg className="w-4 h-4 text-gray-400 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
            
            {breadcrumb.current ? (
              <span className="flex items-center text-sm font-medium text-gray-900 dark:text-white">
                {breadcrumb.icon && (
                  <span className="mr-2 text-legal-600 dark:text-legal-400">
                    {breadcrumb.icon}
                  </span>
                )}
                <span className="max-w-xs truncate">{breadcrumb.name}</span>
              </span>
            ) : (
              <a
                href={breadcrumb.href}
                className="flex items-center text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-legal-600 dark:hover:text-legal-400 transition-colors"
              >
                {breadcrumb.icon && (
                  <span className="mr-2">
                    {breadcrumb.icon}
                  </span>
                )}
                <span className="max-w-xs truncate">{breadcrumb.name}</span>
              </a>
            )}
          </li>
        ))}
      </ol>

      {/* Quick actions */}
      <div className="flex items-center space-x-2 ml-auto">
        {/* Share button */}
        <button
          onClick={() => {
            const url = window.location.href;
            if (navigator.share) {
              navigator.share({
                title: document.title,
                text: `Consulta ${document.title} en LexMX`,
                url: url
              });
            } else {
              navigator.clipboard.writeText(url);
              alert('Enlace copiado al portapapeles');
            }
          }}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Compartir documento"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
          </svg>
        </button>

        {/* Print button */}
        <button
          onClick={() => window.print()}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Imprimir documento"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
        </button>

        {/* Back to search */}
        <a
          href="/chat"
          className="inline-flex items-center px-3 py-2 text-sm font-medium text-legal-600 dark:text-legal-400 bg-legal-50 dark:bg-legal-900/20 rounded-lg hover:bg-legal-100 dark:hover:bg-legal-900/40 transition-colors"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          Consultar IA
        </a>
      </div>
    </nav>
  );
}