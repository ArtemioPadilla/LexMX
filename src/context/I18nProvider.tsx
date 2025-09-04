import React, { createContext, useContext, useReducer, useEffect, useState } from 'react';
import { i18n, type Language } from '../i18n/index';
import type { TranslationParams } from '../types/common';

interface I18nContextType {
  language: Language;
  t: (key: string, params?: TranslationParams) => string;
  setLanguage: (lang: Language) => void;
  getSection: (section: string) => Record<string, any>;
  isLoading: boolean;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [isClient, setIsClient] = useState(false);
  const [, forceUpdate] = useReducer(x => x + 1, 0);

  // Ensure we're client-side before setting up subscriptions
  useEffect(() => {
    setIsClient(true);
    
    const unsubscribe = i18n.onChange(() => {
      forceUpdate();
    });
    return unsubscribe;
  }, []);

  const contextValue: I18nContextType = {
    language: isClient ? i18n.language : 'es',
    t: (key: string, params?: TranslationParams) => i18n.t(key, params),
    setLanguage: isClient ? i18n.setLanguage.bind(i18n) : () => {},
    getSection: (section: string) => i18n.getSection(section),
    isLoading: !isClient,
  };

  return (
    <I18nContext.Provider value={contextValue}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslationContext(): I18nContextType {
  const context = useContext(I18nContext);
  
  // If no context is available (e.g., during SSR), provide safe defaults
  if (!context) {
    return {
      language: 'es',
      t: (key: string, params?: TranslationParams) => {
        try {
          return i18n.t(key, params);
        } catch {
          return key;
        }
      },
      setLanguage: () => {},
      getSection: () => ({}),
      isLoading: true,
    };
  }
  
  return context;
}