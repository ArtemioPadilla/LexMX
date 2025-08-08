import React from 'react';
import { useTranslation } from '../../i18n';

interface TestConnectionStatusProps {
  status: 'untested' | 'testing' | 'success' | 'error';
  onTest: () => void;
  disabled?: boolean;
  className?: string;
}

export default function TestConnectionStatus({
  status,
  onTest,
  disabled = false,
  className = ''
}: TestConnectionStatusProps) {
  const { t } = useTranslation();

  return (
    <button
      onClick={onTest}
      disabled={disabled || status === 'testing'}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        status === 'success'
          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
          : status === 'error'
          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
      } ${disabled || status === 'testing' ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      {status === 'testing' ? (
        <span className="flex items-center">
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {t('setup.validation.testing')}
        </span>
      ) : status === 'success' ? (
        <span className="flex items-center">
          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          {t('setup.validation.success')}
        </span>
      ) : status === 'error' ? (
        <span className="flex items-center">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Reintentar
        </span>
      ) : (
        t('setup.validation.testConnection')
      )}
    </button>
  );
}