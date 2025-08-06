import React, { useState, useRef, useEffect } from 'react';

interface SearchResult {
  id: string;
  type: string;
  number?: string;
  title?: string;
  content: string;
  score: number;
}

interface DocumentSearchProps {
  onSearch: (query: string) => void;
  searchQuery: string;
  searchResults: SearchResult[];
  onResultClick: (resultId: string) => void;
}

export function DocumentSearch({ 
  onSearch, 
  searchQuery, 
  searchResults, 
  onResultClick 
}: DocumentSearchProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load search history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('lexmx-search-history');
    if (saved) {
      try {
        setSearchHistory(JSON.parse(saved));
      } catch (e) {
        console.warn('Failed to load search history:', e);
      }
    }
  }, []);

  // Handle search submission
  const handleSearch = (query: string) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    onSearch(trimmedQuery);
    setLocalQuery(trimmedQuery);
    
    // Add to search history
    const newHistory = [trimmedQuery, ...searchHistory.filter(h => h !== trimmedQuery)].slice(0, 10);
    setSearchHistory(newHistory);
    localStorage.setItem('lexmx-search-history', JSON.stringify(newHistory));
    
    setShowHistory(false);
    setIsExpanded(true);
  };

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalQuery(value);
    
    // Debounced search
    if (value.length >= 2) {
      const timeoutId = setTimeout(() => {
        onSearch(value);
        setIsExpanded(true);
      }, 300);
      
      return () => clearTimeout(timeoutId);
    } else if (value.length === 0) {
      onSearch('');
      setIsExpanded(false);
    }
  };

  // Handle key navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch(localQuery);
    } else if (e.key === 'Escape') {
      setLocalQuery('');
      onSearch('');
      setIsExpanded(false);
      setShowHistory(false);
      inputRef.current?.blur();
    } else if (e.key === 'ArrowDown' && showHistory) {
      e.preventDefault();
      // Focus first history item
      const firstHistoryItem = searchRef.current?.querySelector('[data-history-item]') as HTMLElement;
      firstHistoryItem?.focus();
    }
  };

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowHistory(false);
        if (!searchQuery) {
          setIsExpanded(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [searchQuery]);

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

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'article': return '📜';
      case 'chapter': return '📖';
      case 'section': return '📑';
      case 'title': return '📋';
      case 'paragraph': return '📝';
      case 'fraction': return '🔸';
      default: return '📄';
    }
  };

  const clearSearch = () => {
    setLocalQuery('');
    onSearch('');
    setIsExpanded(false);
    inputRef.current?.focus();
  };

  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('lexmx-search-history');
    setShowHistory(false);
  };

  return (
    <div ref={searchRef} className="relative">
      {/* Search Input */}
      <div className="relative">
        <input
          ref={inputRef}
          id="document-search"
          type="text"
          value={localQuery}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (searchHistory.length > 0 && !localQuery) {
              setShowHistory(true);
            }
          }}
          placeholder="Buscar en el documento..."
          className="w-full pl-10 pr-20 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-legal-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
        />
        
        {/* Search Icon */}
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Action Buttons */}
        <div className="absolute inset-y-0 right-0 flex items-center space-x-1 pr-2">
          {localQuery && (
            <button
              onClick={clearSearch}
              className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title="Limpiar búsqueda"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          
          <button
            onClick={() => handleSearch(localQuery)}
            disabled={!localQuery.trim()}
            className="p-1 rounded-full bg-legal-500 text-white hover:bg-legal-600 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Buscar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Search History Dropdown */}
      {showHistory && searchHistory.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                Búsquedas recientes
              </h3>
              <button
                onClick={clearHistory}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Limpiar
              </button>
            </div>
          </div>
          
          <div className="p-2">
            {searchHistory.map((historyItem, index) => (
              <button
                key={index}
                data-history-item
                onClick={() => {
                  setLocalQuery(historyItem);
                  handleSearch(historyItem);
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-700"
              >
                <div className="flex items-center">
                  <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {historyItem}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search Results Dropdown */}
      {isExpanded && searchQuery && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          {searchResults.length > 0 ? (
            <>
              <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                    {searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''} para "{searchQuery}"
                  </h3>
                  <button
                    onClick={() => setIsExpanded(false)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              
              <div className="p-2">
                {searchResults.slice(0, 10).map((result, index) => (
                  <button
                    key={`${result.id}-${index}`}
                    onClick={() => {
                      onResultClick(result.id);
                      setIsExpanded(false);
                    }}
                    className="w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors group"
                  >
                    <div className="flex items-start space-x-3">
                      <span className="text-lg mt-0.5">{getResultIcon(result.type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                            {result.type}
                          </span>
                          {result.number && (
                            <span className="text-sm font-medium text-legal-600 dark:text-legal-400">
                              {result.number}
                            </span>
                          )}
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            Relevancia: {Math.round(result.score * 100)}%
                          </span>
                        </div>
                        
                        {result.title && (
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-1 group-hover:text-legal-600 dark:group-hover:text-legal-400">
                            {highlightText(result.title, searchQuery)}
                          </h4>
                        )}
                        
                        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                          {highlightText(result.content.substring(0, 150) + (result.content.length > 150 ? '...' : ''), searchQuery)}
                        </p>
                      </div>
                      
                      <svg className="w-4 h-4 text-gray-400 group-hover:text-legal-500 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                ))}
                
                {searchResults.length > 10 && (
                  <div className="p-3 text-center text-sm text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
                    y {searchResults.length - 10} resultados más...
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="p-6 text-center">
              <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                No se encontraron resultados
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Intenta con otros términos de búsqueda
              </p>
            </div>
          )}
        </div>
      )}

      {/* Search Tips */}
      {localQuery.length >= 2 && searchResults.length === 0 && (
        <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
          <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
            Consejos de búsqueda:
          </h4>
          <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
            <li>• Usa términos específicos del derecho mexicano</li>
            <li>• Busca por número de artículo: "artículo 123"</li>
            <li>• Incluye sinónimos: "trabajo laboral empleo"</li>
            <li>• Usa comillas para frases exactas: "despido injustificado"</li>
          </ul>
        </div>
      )}
    </div>
  );
}