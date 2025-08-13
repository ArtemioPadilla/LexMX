import React, { useState, useMemo } from 'react';
import { useTranslation } from '../../i18n';

interface DocumentStructureItem {
  id: string;
  type: string;
  number?: string;
  title: string;
  parent?: string;
  level: number;
}

interface DocumentNavigationProps {
  documentStructure: DocumentStructureItem[];
  currentSection?: string | null;
  onSectionChange?: (sectionId: string) => void;
  searchResults?: any[];
  searchQuery?: string;
}

export function DocumentNavigation({ 
  documentStructure, 
  currentSection, 
  onSectionChange,
  searchResults = [],
  searchQuery = ''
}: DocumentNavigationProps) {
  const { t } = useTranslation();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'titles' | 'articles'>('all');

  // Build hierarchical structure
  const hierarchicalStructure = useMemo(() => {
    const itemMap = new Map(documentStructure.map(item => [item.id, item]));
    const rootItems: DocumentStructureItem[] = [];
    const childrenMap = new Map<string, DocumentStructureItem[]>();

    // Group children by parent
    documentStructure.forEach(item => {
      if (!item.parent) {
        rootItems.push(item);
      } else {
        if (!childrenMap.has(item.parent)) {
          childrenMap.set(item.parent, []);
        }
        childrenMap.get(item.parent)!.push(item);
      }
    });

    // Recursive function to build tree
    const buildTree = (items: DocumentStructureItem[]): (DocumentStructureItem & { children?: any[] })[] => {
      return items.map(item => ({
        ...item,
        children: childrenMap.has(item.id) ? buildTree(childrenMap.get(item.id)!) : undefined
      }));
    };

    return buildTree(rootItems);
  }, [documentStructure]);

  // Filter structure based on current filter
  const filteredStructure = useMemo(() => {
    if (filter === 'all') return hierarchicalStructure;
    
    const filterItems = (items: any[]): any[] => {
      return items.reduce((acc, item) => {
        const matchesFilter = 
          (filter === 'titles' && ['title', 'chapter', 'section'].includes(item.type)) ||
          (filter === 'articles' && item.type === 'article');
        
        const filteredChildren = item.children ? filterItems(item.children) : [];
        
        if (matchesFilter || filteredChildren.length > 0) {
          acc.push({
            ...item,
            children: filteredChildren
          });
        }
        
        return acc;
      }, []);
    };

    return filterItems(hierarchicalStructure);
  }, [hierarchicalStructure, filter]);

  const toggleExpanded = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'title':
        return '📋';
      case 'chapter':
        return '📖';
      case 'section':
        return '📑';
      case 'article':
        return '📜';
      case 'paragraph':
        return '📝';
      case 'fraction':
        return '🔸';
      default:
        return '📄';
    }
  };

  const getItemColor = (type: string) => {
    switch (type) {
      case 'title':
        return 'text-purple-600 dark:text-purple-400';
      case 'chapter':
        return 'text-blue-600 dark:text-blue-400';
      case 'section':
        return 'text-green-600 dark:text-green-400';
      case 'article':
        return 'text-legal-600 dark:text-legal-400';
      case 'paragraph':
        return 'text-gray-600 dark:text-gray-400';
      case 'fraction':
        return 'text-orange-600 dark:text-orange-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  // Highlight search terms in title
  const highlightSearchTerms = (text: string, query: string) => {
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

  // Render navigation item
  const renderNavigationItem = (item: any, depth = 0) => {
    const isExpanded = expandedItems.has(item.id);
    const isCurrent = currentSection === item.id || currentSection === item.number;
    const hasChildren = item.children && item.children.length > 0;
    const isSearchResult = searchResults.some(result => result.id === item.id);

    const baseClasses = `
      flex items-center w-full px-3 py-2 text-sm rounded-lg transition-all duration-150
      ${isCurrent 
        ? 'bg-legal-100 dark:bg-legal-900 text-legal-900 dark:text-legal-100 font-medium' 
        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
      }
      ${isSearchResult 
        ? 'ring-2 ring-yellow-400 dark:ring-yellow-600' 
        : ''
      }
    `.trim();

    return (
      <div key={item.id}>
        <button
          className={baseClasses}
          style={{ paddingLeft: `${0.75 + depth * 1.5}rem` }}
          onClick={() => {
            if (hasChildren) {
              toggleExpanded(item.id);
            }
            onSectionChange?.(item.id);
          }}
        >
          {/* Expand/Collapse Icon */}
          {hasChildren && (
            <svg 
              className={`w-4 h-4 mr-2 transition-transform duration-200 ${
                isExpanded ? 'rotate-90' : ''
              } text-gray-400`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}

          {/* Item Icon */}
          <span className="mr-2 text-base">{getItemIcon(item.type)}</span>

          {/* Item Content */}
          <div className="flex-1 text-left">
            <div className="flex items-center space-x-2">
              {item.number && (
                <span className={`font-medium ${getItemColor(item.type)}`}>
                  {item.number}
                </span>
              )}
              <span className="truncate">
                {highlightSearchTerms(item.title, searchQuery)}
              </span>
            </div>
            
            {/* Item Type Badge */}
            <div className="flex items-center mt-1 space-x-2">
              <span className={`text-xs ${getItemColor(item.type)} capitalize`}>
                {item.type}
              </span>
              {hasChildren && (
                <span className="text-xs text-gray-400">
                  {item.children.length} elemento{item.children.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>

          {/* Current Indicator */}
          {isCurrent && (
            <div className="w-2 h-2 bg-legal-500 rounded-full"></div>
          )}
        </button>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="mt-1 space-y-1">
            {item.children.map((child: any) => renderNavigationItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          {t('documentViewer.navigation.title')}
        </h2>

        {/* Filter */}
        <div className="flex items-center space-x-2">
          <label className="text-sm text-gray-600 dark:text-gray-400">{t('documentViewer.navigation.show')}:</label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="all">{t('documentViewer.navigation.all')}</option>
            <option value="titles">{t('documentViewer.navigation.onlyTitles')}</option>
            <option value="articles">{t('documentViewer.navigation.onlyArticles')}</option>
          </select>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center space-x-2 mt-3">
          <button
            onClick={() => setExpandedItems(new Set(documentStructure.map(item => item.id)))}
            className="text-xs text-legal-600 dark:text-legal-400 hover:text-legal-800 dark:hover:text-legal-200"
          >
            {t('documentViewer.navigation.expandAll')}
          </button>
          <span className="text-gray-300 dark:text-gray-600">•</span>
          <button
            onClick={() => setExpandedItems(new Set())}
            className="text-xs text-legal-600 dark:text-legal-400 hover:text-legal-800 dark:hover:text-legal-200"
          >
            {t('documentViewer.navigation.collapseAll')}
          </button>
        </div>
      </div>

      {/* Search Results Section */}
      {searchQuery && searchResults.length > 0 && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-700">
          <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
            {t('documentViewer.search.results')} ({searchResults.length})
          </h3>
          <div className="space-y-1">
            {searchResults.slice(0, 5).map((result, index) => (
              <button
                key={`search-${index}`}
                onClick={() => onSectionChange?.(result.id)}
                className="w-full text-left p-2 text-sm bg-yellow-100 dark:bg-yellow-800/30 rounded hover:bg-yellow-200 dark:hover:bg-yellow-800/50 transition-colors"
              >
                <div className="font-medium text-yellow-900 dark:text-yellow-100">
                  {result.number && `${result.number} - `}
                  {highlightSearchTerms(result.title || result.content.substring(0, 50) + '...', searchQuery)}
                </div>
                <div className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                  {result.type} • {result.content.length} caracteres
                </div>
              </button>
            ))}
            {searchResults.length > 5 && (
              <p className="text-xs text-yellow-600 dark:text-yellow-400 text-center py-1">
                y {searchResults.length - 5} más...
              </p>
            )}
          </div>
        </div>
      )}

      {/* Navigation Tree */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredStructure.length > 0 ? (
          <div className="space-y-1">
            {filteredStructure.map(item => renderNavigationItem(item))}
          </div>
        ) : (
          <div className="text-center py-8">
            <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {searchQuery ? 'No se encontraron resultados' : 'No hay elementos para mostrar'}
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
          {documentStructure.length} {documentStructure.length !== 1 ? t('documentViewer.content.elements') : t('documentViewer.content.element')} {t('documentViewer.content.elementsTotal').split(' ').pop()}
          {currentSection && (
            <div className="mt-1">
              <span className="text-legal-600 dark:text-legal-400">
                📍 Sección actual
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}