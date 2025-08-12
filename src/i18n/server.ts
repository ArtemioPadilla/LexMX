import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

type Language = 'es' | 'en';

// Read translations at module initialization
const __dirname = dirname(fileURLToPath(import.meta.url));
const esTranslations = JSON.parse(readFileSync(join(__dirname, 'locales', 'es.json'), 'utf-8'));
const enTranslations = JSON.parse(readFileSync(join(__dirname, 'locales', 'en.json'), 'utf-8'));

const translations: Record<Language, any> = {
  es: esTranslations,
  en: enTranslations
};

/**
 * Get translation function for server-side rendering
 * Extracts language from URL path or defaults to Spanish
 */
export function getTranslation(url: URL) {
  // Extract language from URL or default to Spanish
  const lang = url.pathname.includes('/en/') ? 'en' : 'es';
  
  return function t(key: string, params?: Record<string, any>): string {
    const keys = key.split('.');
    let value: any = translations[lang];
    
    for (const k of keys) {
      value = value?.[k];
      if (value === undefined) {
        // Fallback to Spanish if key not found
        value = translations.es;
        for (const k2 of keys) {
          value = value?.[k2];
          if (value === undefined) {
            console.warn(`Translation key not found: ${key}`);
            return key; // Return key if not found
          }
        }
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
  let value: any = translations[lang];
  
  for (const k of keys) {
    value = value?.[k];
    if (value === undefined) {
      return false;
    }
  }
  
  return true;
}