import React from 'react';
import { useTranslation } from '../i18n';

interface WebLLMProgressProps {
  progress: number;
  message: string;
  onClose?: () => void;
  variant?: 'inline' | 'popup';
}

export default function WebLLMProgress({ progress, message, onClose, variant = 'popup' }: WebLLMProgressProps) {
  const { t } = useTranslation();
  
  if (variant === 'inline') {
    return (
      <div className="w-full">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-600 dark:text-gray-400">{message}</span>
          <span className="text-xs font-medium text-gray-900 dark:text-gray-100">{progress}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="bg-legal-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {t('providers.webllm.firstTimeDownload')}
        </p>
      </div>
    );
  }
  
  return (
    <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4 max-w-sm z-50">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium text-gray-900 dark:text-gray-100">{t('providers.webllm.downloadingModel')}</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label={t('common.close')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      
      <div className="space-y-2">
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="bg-legal-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">{message}</span>
          <span className="font-medium text-gray-900 dark:text-gray-100">{progress}%</span>
        </div>
      </div>
      
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
        {t('providers.webllm.firstTimeDownload')}
      </p>
    </div>
  );
}