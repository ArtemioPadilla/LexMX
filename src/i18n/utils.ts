// Server-side translation utilities for Astro
import esTranslations from './locales/es.json';
import enTranslations from './locales/en.json';
import type { TranslationValue, TranslationParams } from '../types/common';

type Language = 'es' | 'en';

const translations: Record<Language, TranslationValue> = {
  es: esTranslations,
  en: enTranslations
};

/**
 * Get translation function for server-side rendering
 * Extracts language from URL path or defaults to Spanish
 */
export function getTranslation(url: URL | string) {
  // Handle both URL object and string path
  let pathname: string;
  
  if (!url) {
    console.warn('No URL provided to getTranslation, defaulting to Spanish');
    pathname = '/';
  } else if (typeof url === 'string') {
    pathname = url;
  } else if (typeof url === 'object' && 'pathname' in url) {
    pathname = url.pathname;
  } else {
    console.warn('Invalid URL parameter, defaulting to Spanish');
    pathname = '/';
  }
  
  // Extract language from URL or default to Spanish
  const lang = pathname.includes('/en') ? 'en' : 'es';
  
  return function t(key: string, params?: TranslationParams): string {
    const keys = key.split('.');
    let value: TranslationValue | undefined = translations[lang];
    
    for (const k of keys) {
      if (typeof value === 'object' && value !== null && k in value) {
        value = value[k];
      } else {
        value = undefined;
      }
      
      if (value === undefined) {
        // Fallback to Spanish if key not found
        let fallbackValue: TranslationValue | undefined = translations.es;
        for (const k2 of keys) {
          if (typeof fallbackValue === 'object' && fallbackValue !== null && k2 in fallbackValue) {
            fallbackValue = fallbackValue[k2];
          } else {
            console.warn(`Translation key not found: ${key}`);
            return key; // Return key if not found
          }
        }
        value = fallbackValue;
        break;
      }
    }
    
    if (typeof value !== 'string') {
      console.warn(`Translation value is not a string for key: ${key}`);
      return key;
    }
    
    // Replace parameters if provided
    let result = value;
    if (params) {
      Object.entries(params).forEach(([param, val]) => {
        result = result.replace(new RegExp(`{{${param}}}`, 'g'), String(val));
      });
    }
    
    return result;
  };
}

/**
 * Get translation function for a specific language
 */
export function getTranslationForLang(lang: Language = 'es') {
  return function t(key: string, params?: TranslationParams): string {
    const keys = key.split('.');
    let value: TranslationValue | undefined = translations[lang];
    
    for (const k of keys) {
      if (typeof value === 'object' && value !== null && k in value) {
        value = value[k];
      } else {
        value = undefined;
      }
      
      if (value === undefined) {
        // Fallback to Spanish if key not found
        let fallbackValue: TranslationValue | undefined = translations.es;
        for (const k2 of keys) {
          if (typeof fallbackValue === 'object' && fallbackValue !== null && k2 in fallbackValue) {
            fallbackValue = fallbackValue[k2];
          } else {
            console.warn(`Translation key not found: ${key}`);
            return key; // Return key if not found
          }
        }
        value = fallbackValue;
        break;
      }
    }
    
    if (typeof value !== 'string') {
      console.warn(`Translation value is not a string for key: ${key}`);
      return key;
    }
    
    // Replace parameters if provided
    let result = value;
    if (params) {
      Object.entries(params).forEach(([param, val]) => {
        result = result.replace(new RegExp(`{{${param}}}`, 'g'), String(val));
      });
    }
    
    return result;
  };
}

/**
 * Get all translations for a specific language
 */
export function getTranslations(lang: Language = 'es') {
  return translations[lang];
}

/**
 * Check if a translation key exists
 */
export function hasTranslation(key: string, lang: Language = 'es'): boolean {
  const keys = key.split('.');
  let value: TranslationValue | undefined = translations[lang];
  
  for (const k of keys) {
    if (typeof value === 'object' && value !== null && k in value) {
      value = value[k];
    } else {
      return false;
    }
  }
  
  return value !== undefined;
}