import React, { useState, useEffect, useCallback } from 'react';
import { ErrorBoundary } from './ErrorBoundary';

type Language = 'es' | 'en';

function LanguageSelectorInner() {
  const [lang, setLang] = useState<Language>('es');
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // Initialize language on mount
  useEffect(() => {
    setMounted(true);
    
    // Get language from localStorage
    const stored = localStorage.getItem('language');
    if (stored) {
      try {
        const savedLang = JSON.parse(stored) as Language;
        setLang(savedLang);
        document.documentElement.lang = savedLang;
      } catch (e) {
        console.error('Error parsing language:', e);
        localStorage.setItem('language', JSON.stringify('es'));
      }
    } else {
      localStorage.setItem('language', JSON.stringify('es'));
      document.documentElement.lang = 'es';
    }
  }, []);
  
  // Handle language change
  const handleLanguageChange = useCallback((newLang: Language) => {
    try {
      setLang(newLang);
      setIsOpen(false);
      
      // Save to localStorage
      localStorage.setItem('language', JSON.stringify(newLang));
      
      // Update HTML lang attribute
      document.documentElement.lang = newLang;
      
      // Dispatch custom event for translations update
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('languageChanged', { 
          detail: { language: newLang } 
        }));
      }, 0);
    } catch (error) {
      console.error('Error changing language:', error);
    }
  }, []);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.language-selector')) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isOpen]);
  
  const languages = {
    es: { name: 'Español', flag: '🇲🇽' },
    en: { name: 'English', flag: '🇺🇸' },
  };
  
  if (!mounted) {
    return (
      <div className="relative language-selector">
        <button 
          className="flex items-center space-x-1 px-2 sm:px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors border border-gray-200 dark:border-gray-600" 
          aria-label="Cambiar idioma"
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
  
  return (
    <div className="relative language-selector">
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="flex items-center space-x-1 px-2 sm:px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors border border-gray-200 dark:border-gray-600"
        aria-label="Cambiar idioma"
        aria-expanded={isOpen}
      >
        <span className="text-lg">{languages[lang].flag}</span>
        <span className="hidden sm:inline text-sm font-medium text-gray-700 dark:text-gray-300">
          {lang.toUpperCase()}
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
                e.preventDefault();
                e.stopPropagation();
                handleLanguageChange(code);
              }}
              className={`w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center space-x-2 ${
                lang === code ? 'text-legal-600 dark:text-legal-400' : 'text-gray-700 dark:text-gray-300'
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

export function LanguageSelector() {
  return (
    <ErrorBoundary componentName="LanguageSelector">
      <LanguageSelectorInner />
    </ErrorBoundary>
  );
}