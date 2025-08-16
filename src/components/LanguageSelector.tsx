import { useState, useEffect, useCallback } from 'react';
import { useTranslation, type Language } from '../i18n/index';
import { HydrationBoundary, LoadingStates } from './HydrationBoundary';
// import { TEST_IDS } from '../utils/test-ids';

declare global {
  interface Window {
    applyTranslations?: () => void;
  }
}

export function LanguageSelector() {
  const { language, setLanguage, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Handle hydration
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Initialize language on mount
  useEffect(() => {
    if (isHydrated) {
      try {
        // The i18n system handles language persistence and initialization
        document.documentElement.lang = language;
      } catch (err) {
        console.error('Error initializing language selector:', err);
        setError('Failed to initialize language');
      }
    }
  }, [language, isHydrated]);
  
  // Handle language change
  const handleLanguageChange = useCallback((newLang: Language) => {
    try {
      setLanguage(newLang);
      setIsOpen(false);
      document.documentElement.lang = newLang;
      
      // Trigger a custom event for client-side translations
      window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: newLang } }));
      
      // Call applyTranslations if it exists
      if (typeof window !== 'undefined' && window.applyTranslations) {
        window.applyTranslations();
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
  
  // Handle SSR/hydration
  if (!isHydrated) {
    return (
      <HydrationBoundary 
        fallback={<LoadingStates.LanguageSelector />}
        testId="language-selector"
      />
    );
  }

  
  if (error) {
    return (
      <div className="relative language-selector">
        <button 
          className="flex items-center space-x-1 px-2 sm:px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700" 
          aria-label={t('errors.languageError')}
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
        data-testid="language-selector"
        onClick={(_e) => {
          _e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="flex items-center space-x-1 px-2 sm:px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors border border-gray-200 dark:border-gray-600"
        aria-label={t('language.change')}
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
              data-testid={`language-option-${code}`}
              onClick={(_e) => {
                _e.stopPropagation();
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