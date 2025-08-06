import React from 'react';

interface WebLLMProgressProps {
  progress: number;
  message: string;
  onClose?: () => void;
}

export default function WebLLMProgress({ progress, message, onClose }: WebLLMProgressProps) {
  return (
    <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg border border-gray-200 p-4 max-w-sm">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium text-gray-900">Descargando modelo IA</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Cerrar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      
      <div className="space-y-2">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-legal-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">{message}</span>
          <span className="font-medium text-gray-900">{progress}%</span>
        </div>
      </div>
      
      <p className="text-xs text-gray-500 mt-2">
        Primera vez usando WebLLM. El modelo se almacenará localmente.
      </p>
    </div>
  );
}