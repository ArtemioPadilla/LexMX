import React from 'react';

export type ViewMode = 'text' | 'pdf' | 'chunks' | 'metadata';

interface ViewModeSelectorProps {
  currentMode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  availableModes: ViewMode[];
}

export function ViewModeSelector({ currentMode, onModeChange, availableModes }: ViewModeSelectorProps) {
  const viewModes = [
    {
      id: 'text' as ViewMode,
      name: 'Texto',
      description: 'Vista de texto estructurado',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      shortcut: 'Ctrl+1'
    },
    {
      id: 'pdf' as ViewMode,
      name: 'PDF',
      description: 'Vista de documento PDF',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      ),
      shortcut: 'Ctrl+2'
    },
    {
      id: 'chunks' as ViewMode,
      name: 'Chunks',
      description: 'Vista de chunks para RAG',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
      shortcut: 'Ctrl+3'
    },
    {
      id: 'metadata' as ViewMode,
      name: 'Metadatos',
      description: 'Información y linaje del documento',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      shortcut: 'Ctrl+4'
    }
  ];

  // Filter modes based on availability
  const filteredModes = viewModes.filter(mode => availableModes.includes(mode.id));

  return (
    <div className="flex items-center justify-between">
      {/* View Mode Tabs */}
      <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
        {filteredModes.map((mode) => (
          <button
            key={mode.id}
            onClick={() => onModeChange(mode.id)}
            title={`${mode.description} (${mode.shortcut})`}
            className={`
              flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-md transition-all duration-200
              ${currentMode === mode.id
                ? 'bg-white dark:bg-gray-800 text-legal-600 dark:text-legal-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600'
              }
            `}
          >
            <span className={currentMode === mode.id ? 'text-legal-600 dark:text-legal-400' : ''}>
              {mode.icon}
            </span>
            <span>{mode.name}</span>
            
            {/* Active indicator */}
            {currentMode === mode.id && (
              <div className="w-1.5 h-1.5 bg-legal-500 rounded-full ml-1"></div>
            )}
          </button>
        ))}
      </div>

      {/* View Options */}
      <div className="flex items-center space-x-3 text-sm text-gray-500 dark:text-gray-400">
        {/* Current view info */}
        <div className="hidden md:flex items-center space-x-2">
          <span className="text-xs">Vista actual:</span>
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {filteredModes.find(m => m.id === currentMode)?.name}
          </span>
        </div>

        {/* Keyboard shortcuts hint */}
        <div className="hidden lg:flex items-center space-x-1 text-xs">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 00-2-2z" />
          </svg>
          <span>Usa Ctrl+1-4 para cambiar de vista</span>
        </div>
      </div>
    </div>
  );
}