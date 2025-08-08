import { useState, useEffect, useCallback } from 'react';
import { useTranslation, type Language } from '../i18n/index';

export function LanguageSelector() {
  const { language, setLanguage, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Initialize on mount
  useEffect(() => {
    try {
      setMounted(true);
      // The i18n system handles language persistence and initialization
      document.documentElement.lang = language;
    } catch (err) {
      console.error('Error initializing language selector:', err);
      setError('Failed to initialize language');
    }
  }, [language]);
  
  // Handle language change
  const handleLanguageChange = useCallback((newLang: Language) => {
    try {
      setLanguage(newLang);
      setIsOpen(false);
      document.documentElement.lang = newLang;
      
      // Trigger a custom event for client-side translations
      window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: newLang } }));
      
      // Call applyTranslations if it exists
      if (typeof window !== 'undefined' && (window as any).applyTranslations) {
        (window as any).applyTranslations();
      }
    } catch (error) {
      console.error('Error changing language:', error);
    }
  }, [setLanguage]);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    if (typeof window !== 'undefined' && isOpen) {
      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        if (!target.closest('.language-selector')) {
          setIsOpen(false);
        }
      };
      
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isOpen]);
  
  const languages = {
    es: { name: t('language.es'), flag: '🇲🇽' },
    en: { name: t('language.en'), flag: '🇺🇸' },
  };
  
  if (!mounted) {
    return (
      <div className="relative language-selector">
        <button 
          className="flex items-center space-x-1 px-2 sm:px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors border border-gray-200 dark:border-gray-600" 
          aria-label={t('common.changeLanguage') || 'Cambiar idioma'}
          disabled
        >
          <span className="text-lg">🇲🇽</span>
          <span className="hidden sm:inline text-sm font-medium text-gray-700 dark:text-gray-300">
            ES
          </span>
        </button>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="relative language-selector">
        <button 
          className="flex items-center space-x-1 px-2 sm:px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700" 
          aria-label="Error en idioma"
          disabled
        >
          <span className="text-lg">⚠️</span>
        </button>
      </div>
    );
  }
  
  return (
    <div className="relative language-selector">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="flex items-center space-x-1 px-2 sm:px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors border border-gray-200 dark:border-gray-600"
        aria-label="Cambiar idioma"
        aria-expanded={isOpen}
      >
        <span className="text-lg">{languages[language].flag}</span>
        <span className="hidden sm:inline text-sm font-medium text-gray-700 dark:text-gray-300">
          {language.toUpperCase()}
        </span>
        <svg className="hidden sm:block w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isOpen && (
        <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
          {(Object.entries(languages) as [Language, typeof languages[Language]][]).map(([code, data]) => (
            <button
              key={code}
              onClick={(e) => {
                e.stopPropagation();
                handleLanguageChange(code);
              }}
              className={`w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center space-x-2 ${
                language === code ? 'text-legal-600 dark:text-legal-400' : 'text-gray-700 dark:text-gray-300'
              } ${code === 'es' ? 'rounded-t-lg' : 'rounded-b-lg'}`}
            >
              <span className="text-lg">{data.flag}</span>
              <span className="text-sm">{data.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}