import { useReducer, useEffect } from 'react';
import esTranslations from './locales/es.json';
import enTranslations from './locales/en.json';
import type { TranslationValue, TranslationParams } from '../types/common';

export type Language = 'es' | 'en';

export interface Translations {
  [key: string]: TranslationValue;
}

const translations: Record<Language, Translations> = {
  es: esTranslations,
  en: enTranslations
};

class I18n {
  private currentLanguage: Language = 'es';
  private listeners: Set<(lang: Language) => void> = new Set();

  constructor() {
    // Check for saved language preference - handle both string and JSON format
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('language');
        if (saved) {
          // Handle both "es" and '"es"' formats
          const lang = saved.startsWith('"') ? JSON.parse(saved) : saved;
          if (lang === 'es' || lang === 'en') {
            this.currentLanguage = lang as Language;
          }
        } else {
          // Detect browser language
          const browserLang = navigator.language.toLowerCase();
          this.currentLanguage = browserLang.startsWith('es') ? 'es' : 'en';
        }
      } catch (_e) {
        void _e;
        // If parsing fails, default to Spanish
        this.currentLanguage = 'es';
      }
    }
  }

  get language(): Language {
    return this.currentLanguage;
  }

  setLanguage(lang: Language): void {
    if (lang !== this.currentLanguage) {
      this.currentLanguage = lang;
      if (typeof window !== 'undefined') {
        localStorage.setItem('language', lang);
      }
      this.notifyListeners();
    }
  }

  t(key: string, params?: TranslationParams, language?: Language): string {
    const keys = key.split('.');
    const lang = language || this.currentLanguage;
    let value: TranslationValue | undefined = translations[lang];

    for (const k of keys) {
      if (typeof value === 'object' && value !== null && k in value) {
        value = value[k];
      } else {
        value = undefined;
      }
      
      if (value === undefined) {
        // Fallback to Spanish if translation not found
        let fallbackValue: TranslationValue | undefined = translations.es;
        for (const fallbackKey of keys) {
          if (typeof fallbackValue === 'object' && fallbackValue !== null && fallbackKey in fallbackValue) {
            fallbackValue = fallbackValue[fallbackKey];
          } else {
            fallbackValue = undefined;
            break;
          }
        }
        if (fallbackValue === undefined) {
          console.warn(`Translation key not found: ${key}`);
          return key;
        }
        value = fallbackValue;
        break;
      }
    }

    if (typeof value !== 'string') {
      console.warn(`Translation key is not a string: ${key}`);
      return key;
    }

    // Replace parameters if provided
    if (params) {
      return value.replace(/\{\{(\w+)\}\}/g, (match, param) => {
        return params[param]?.toString() || match;
      });
    }

    return value;
  }

  onChange(callback: (lang: Language) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => callback(this.currentLanguage));
  }

  // Helper method to get all translations for a section
  getSection(section: string, language?: Language): Record<string, TranslationValue> {
    const keys = section.split('.');
    const lang = language || this.currentLanguage;
    let value: TranslationValue | undefined = translations[lang];

    for (const k of keys) {
      if (typeof value === 'object' && value !== null && k in value) {
        value = value[k];
      } else {
        return {};
      }
    }

    if (typeof value === 'object' && value !== null) {
      return value as Record<string, TranslationValue>;
    }
    
    return {};
  }

  // Get available languages
  getAvailableLanguages(): Array<{ code: Language; name: string }> {
    return [
      { code: 'es', name: this.t('language.es') },
      { code: 'en', name: this.t('language.en') }
    ];
  }
}

// Export singleton instance
export const i18n = new I18n();

// Export hook for React components
export function useTranslation() {
  const [, forceUpdate] = useReducer(x => x + 1, 0);

  useEffect(() => {
    const unsubscribe = i18n.onChange(() => {
      forceUpdate();
    });
    return unsubscribe;
  }, []);

  return {
    t: i18n.t.bind(i18n),
    language: i18n.language,
    setLanguage: i18n.setLanguage.bind(i18n),
    getSection: i18n.getSection.bind(i18n)
  };
}

// For non-React usage
export function t(key: string, params?: TranslationParams): string {
  return i18n.t(key, params);
}

export function setLanguage(lang: Language): void {
  i18n.setLanguage(lang);
}

export function getLanguage(): Language {
  return i18n.language;
}