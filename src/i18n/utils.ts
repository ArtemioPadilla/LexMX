import { computed } from 'nanostores';
import { persistentAtom } from '@nanostores/persistent';
import es from './translations/es.json';
import en from './translations/en.json';

export type Language = 'es' | 'en';

export const languages: Record<Language, string> = {
  es: 'Español',
  en: 'English',
};

// Store current language in localStorage
export const currentLanguage = persistentAtom<Language>('language', 'es', {
  encode: JSON.stringify,
  decode: JSON.parse,
});

// Translations object
const translations: Record<Language, typeof es> = {
  es,
  en,
};

// Get translation function
export const t = computed(currentLanguage, (lang) => {
  return (key: string, params?: Record<string, string>): string => {
    const keys = key.split('.');
    let value: any = translations[lang];
    
    for (const k of keys) {
      value = value?.[k];
      if (value === undefined) {
        console.warn(`Translation missing for key: ${key}`);
        return key;
      }
    }
    
    if (typeof value !== 'string') {
      console.warn(`Translation is not a string for key: ${key}`);
      return key;
    }
    
    // Replace parameters if provided
    if (params) {
      Object.entries(params).forEach(([param, val]) => {
        value = value.replace(`{${param}}`, val);
      });
    }
    
    return value;
  };
});

// Change language
export function changeLanguage(lang: Language) {
  currentLanguage.set(lang);
}

// Get current translation
export function getTranslation(key: string, params?: Record<string, string>): string {
  const translate = t.get();
  return translate(key, params);
}

// Get all translations for current language
export function getAllTranslations() {
  return translations[currentLanguage.get()];
}

// Check if translation exists
export function hasTranslation(key: string): boolean {
  const keys = key.split('.');
  let value: any = translations[currentLanguage.get()];
  
  for (const k of keys) {
    value = value?.[k];
    if (value === undefined) {
      return false;
    }
  }
  
  return true;
}