import React, { useState, useMemo } from 'react';
import type { LegalDocument, LegalChunk } from '../../types/legal';

interface DocumentChunksViewProps {
  document: LegalDocument;
  searchQuery?: string;
  highlightedChunks?: string[];
}

export function DocumentChunksView({ 
  document, 
  searchQuery = '', 
  highlightedChunks = [] 
}: DocumentChunksViewProps) {
  const [selectedChunk, setSelectedChunk] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'article' | 'paragraph' | 'fraction'>('all');
  const [sortBy, setSortBy] = useState<'order' | 'relevance' | 'length'>('order');

  // Convert document content to chunks format
  const chunks = useMemo(() => {
    if (!document.content) return [];
    
    return document.content.map((content, _index): LegalChunk => ({
      id: content.id,
      documentId: document.id,
      content: content.content,
      metadata: {
        type: content.type,
        article: content.number,
        title: content.title,
        hierarchy: document.hierarchy,
        legalArea: document.primaryArea
      },
      embedding: content.embedding,
      keywords: extractKeywords(content.content)
    }));
  }, [document]);

  // Filter and sort chunks
  const filteredChunks = useMemo(() => {
    let filtered = chunks;

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(chunk => chunk.metadata.type === filterType);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter(chunk => 
        chunk.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        chunk.metadata.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        chunk.keywords.some(keyword => 
          keyword.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }

    // Sort chunks
    switch (sortBy) {
      case 'relevance':
        if (searchQuery.trim()) {
          filtered.sort((a, b) => {
            const aScore = calculateRelevanceScore(a, searchQuery);
            const bScore = calculateRelevanceScore(b, searchQuery);
            return bScore - aScore;
          });
        }
        break;
      case 'length':
        filtered.sort((a, b) => b.content.length - a.content.length);
        break;
      case 'order':
      default:
        // Keep original order
        break;
    }

    return filtered;
  }, [chunks, filterType, searchQuery, sortBy]);

  // Extract keywords from content
  function extractKeywords(content: string): string[] {
    // Simple keyword extraction - in production, use a proper NLP library
    const words = content.toLowerCase()
      .replace(/[^\w\sáéíóúüñ]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !isStopWord(word));
    
    // Get word frequency
    const wordCount: { [key: string]: number } = {};
    words.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });
    
    // Return top keywords
    return Object.entries(wordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([word]) => word);
  }

  function isStopWord(word: string): boolean {
    const stopWords = new Set([
      'que', 'de', 'la', 'el', 'en', 'y', 'a', 'por', 'con', 'para', 'del', 'las', 'los',
      'una', 'un', 'es', 'se', 'no', 'te', 'lo', 'le', 'da', 'su', 'por', 'son', 'más',
      'pero', 'sus', 'al', 'él', 'esto', 'ya', 'todo', 'esta', 'fue', 'han', 'ser', 'su'
    ]);
    return stopWords.has(word);
  }

  function calculateRelevanceScore(chunk: LegalChunk, query: string): number {
    const content = chunk.content.toLowerCase();
    const queryLower = query.toLowerCase();
    
    let score = 0;
    
    // Exact match bonus
    if (content.includes(queryLower)) {
      score += 10;
    }
    
    // Word matches
    const queryWords = queryLower.split(/\s+/);
    queryWords.forEach(word => {
      if (content.includes(word)) {
        score += 2;
      }
    });
    
    // Keyword matches
    chunk.keywords.forEach(keyword => {
      if (keyword.includes(queryLower)) {
        score += 5;
      }
    });
    
    // Title matches
    if (chunk.metadata.title?.toLowerCase().includes(queryLower)) {
      score += 8;
    }
    
    return score;
  }

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

  const getChunkTypeIcon = (type: string) => {
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

  const getChunkTypeColor = (type: string) => {
    switch (type) {
      case 'title':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'chapter':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'section':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'article':
        return 'bg-legal-100 text-legal-800 dark:bg-legal-900 dark:text-legal-200';
      case 'paragraph':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
      case 'fraction':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Filters */}
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Filtrar por tipo:
            </label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as 'all' | 'article' | 'paragraph' | 'fraction')}
              className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">Todos</option>
              <option value="article">Artículos</option>
              <option value="paragraph">Párrafos</option>
              <option value="fraction">Fracciones</option>
            </select>
          </div>

          {/* Sort */}
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Ordenar por:
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'order' | 'relevance' | 'length')}
              className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="order">Orden original</option>
              <option value="relevance">Relevancia</option>
              <option value="length">Longitud</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center border border-gray-200 dark:border-gray-700">
          <p className="text-2xl font-bold text-legal-600 dark:text-legal-400">
            {filteredChunks.length}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-300">Chunks mostrados</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center border border-gray-200 dark:border-gray-700">
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {chunks.length}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-300">Total chunks</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center border border-gray-200 dark:border-gray-700">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {Math.round(chunks.reduce((acc, chunk) => acc + chunk.content.length, 0) / chunks.length)}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-300">Caracteres promedio</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center border border-gray-200 dark:border-gray-700">
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {new Set(chunks.map(c => c.metadata.type)).size}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-300">Tipos diferentes</p>
        </div>
      </div>

      {/* Chunks Grid */}
      <div className="grid gap-4">
        {filteredChunks.map((chunk, index) => {
          const isHighlighted = highlightedChunks.includes(chunk.id);
          const isSelected = selectedChunk === chunk.id;
          
          return (
            <div
              key={chunk.id}
              className={`
                bg-white dark:bg-gray-800 rounded-lg border p-4 cursor-pointer transition-all duration-200
                ${isHighlighted ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700'}
                ${isSelected ? 'ring-2 ring-legal-500' : ''}
                hover:shadow-md
              `}
              onClick={() => setSelectedChunk(isSelected ? null : chunk.id)}
            >
              {/* Chunk Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{getChunkTypeIcon(chunk.metadata.type)}</span>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getChunkTypeColor(chunk.metadata.type)}`}>
                        {chunk.metadata.type}
                      </span>
                      {chunk.metadata.article && (
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                          {chunk.metadata.article}
                        </span>
                      )}
                    </div>
                    {chunk.metadata.title && (
                      <h3 className="font-medium text-gray-900 dark:text-white mt-1">
                        {highlightText(chunk.metadata.title, searchQuery)}
                      </h3>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {chunk.content.length} chars
                  </span>
                  <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                            d={isSelected ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Chunk Preview */}
              <div className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                <div className={`line-clamp-3 ${isSelected ? 'line-clamp-none' : ''}`}>
                  {highlightText(chunk.content, searchQuery)}
                </div>
              </div>

              {/* Keywords */}
              {chunk.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {chunk.keywords.slice(0, isSelected ? undefined : 3).map((keyword, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              )}

              {/* Chunk Actions */}
              {isSelected && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 text-sm">
                      <button className="text-legal-600 dark:text-legal-400 hover:text-legal-800 dark:hover:text-legal-200 flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copiar chunk
                      </button>
                      <button className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        Ver en contexto
                      </button>
                    </div>
                    
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Chunk #{index + 1}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredChunks.length === 0 && (
        <div className="text-center py-12">
          <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No se encontraron chunks
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            {searchQuery ? 'Intenta con otros términos de búsqueda.' : 'Ajusta los filtros para ver más contenido.'}
          </p>
        </div>
      )}
    </div>
  );
}