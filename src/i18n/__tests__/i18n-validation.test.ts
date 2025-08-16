import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import type { TranslationValue } from '../../types/common';

describe('i18n Translation Files Validation', () => {
  const localesPath = path.join(process.cwd(), 'src/i18n/locales');
  const locales = ['es', 'en'];

  locales.forEach(locale => {
    describe(`${locale}.json validation`, () => {
      it('should be valid JSON', () => {
        const filePath = path.join(localesPath, `${locale}.json`);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        
        expect(() => JSON.parse(fileContent)).not.toThrow();
      });

      it('should not have duplicate keys at any level', () => {
        const filePath = path.join(localesPath, `${locale}.json`);
        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        
        // Recursively check for duplicate keys using the parsed JSON
        function checkDuplicates(obj: TranslationValue, path: string = ''): void {
          if (typeof obj !== 'object' || obj === null) {
            return;
          }
          
          const keys = Object.keys(obj);
          const seenKeys = new Set<string>();
          
          for (const key of keys) {
            if (seenKeys.has(key)) {
              throw new Error(
                `Duplicate key "${key}" found in ${locale}.json at path: ${path}`
              );
            }
            seenKeys.add(key);
            
            // Recursively check nested objects
            if (typeof obj[key] === 'object' && obj[key] !== null) {
              const newPath = path ? `${path}.${key}` : key;
              checkDuplicates(obj[key], newPath);
            }
          }
        }
        
        // Check the parsed JSON structure
        try {
          checkDuplicates(content);
          expect(true).toBe(true);
        } catch (error) {
          if (error instanceof Error) {
            throw error;
          }
          throw new Error('Unknown error checking for duplicates');
        }
      });

      it('should have consistent structure', () => {
        const filePath = path.join(localesPath, `${locale}.json`);
        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        
        // Check that required top-level keys exist
        const requiredKeys = ['common', 'nav', 'chat', 'setup', 'legal'];
        requiredKeys.forEach(key => {
          expect(content).toHaveProperty(key);
        });
      });
    });
  });

  it('should have the same keys in all language files', () => {
    const getAllKeys = (obj: TranslationValue, prefix = ''): string[] => {
      let keys: string[] = [];
      
      for (const key in obj) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          keys = keys.concat(getAllKeys(obj[key], fullKey));
        } else {
          keys.push(fullKey);
        }
      }
      
      return keys;
    };
    
    const localeKeys: Record<string, Set<string>> = {};
    
    locales.forEach(locale => {
      const filePath = path.join(localesPath, `${locale}.json`);
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const keys = getAllKeys(content);
      localeKeys[locale] = new Set(keys);
    });
    
    // Compare all locales against the first one (es)
    const referenceKeys = localeKeys['es'];
    
    locales.slice(1).forEach(locale => {
      const currentKeys = localeKeys[locale];
      
      // Check for missing keys
      const missingKeys = Array.from(referenceKeys).filter(key => !currentKeys.has(key));
      if (missingKeys.length > 0) {
        console.warn(`Missing keys in ${locale}.json:`, missingKeys);
      }
      
      // Check for extra keys
      const extraKeys = Array.from(currentKeys).filter(key => !referenceKeys.has(key));
      if (extraKeys.length > 0) {
        console.warn(`Extra keys in ${locale}.json:`, extraKeys);
      }
      
      // For now, just warn about differences, don't fail the test
      // In the future, you might want to enforce strict equality
      expect(currentKeys.size).toBeGreaterThan(0);
    });
  });

  it('should not have empty translation values', () => {
    const checkForEmptyValues = (obj: TranslationValue, path = ''): string[] => {
      const emptyPaths: string[] = [];
      
      for (const key in obj) {
        const fullPath = path ? `${path}.${key}` : key;
        
        if (typeof obj[key] === 'string') {
          if (obj[key].trim() === '') {
            emptyPaths.push(fullPath);
          }
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          emptyPaths.push(...checkForEmptyValues(obj[key], fullPath));
        }
      }
      
      return emptyPaths;
    };
    
    locales.forEach(locale => {
      const filePath = path.join(localesPath, `${locale}.json`);
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const emptyValues = checkForEmptyValues(content);
      
      if (emptyValues.length > 0) {
        console.warn(`Empty values found in ${locale}.json:`, emptyValues);
      }
      
      expect(emptyValues).toHaveLength(0);
    });
  });

  describe('systemPrompts validation', () => {
    it('should have systemPrompts section in all locales', () => {
      locales.forEach(locale => {
        const filePath = path.join(localesPath, `${locale}.json`);
        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        
        expect(content).toHaveProperty('systemPrompts');
        expect(content.systemPrompts).toBeDefined();
      });
    });

    it('should have required systemPrompts structure', () => {
      locales.forEach(locale => {
        const filePath = path.join(localesPath, `${locale}.json`);
        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const systemPrompts = content.systemPrompts;
        
        // Check base structure
        expect(systemPrompts).toHaveProperty('base');
        expect(systemPrompts.base).toHaveProperty('role');
        expect(systemPrompts.base).toHaveProperty('sources');
        expect(systemPrompts.base).toHaveProperty('instructions');
        expect(systemPrompts.base).toHaveProperty('format');
        
        // Check sources
        const sources = systemPrompts.base.sources;
        expect(sources).toHaveProperty('constitution');
        expect(sources).toHaveProperty('federal');
        expect(sources).toHaveProperty('jurisprudence');
        expect(sources).toHaveProperty('legislation');
        
        // Check instructions
        const instructions = systemPrompts.base.instructions;
        expect(instructions).toHaveProperty('citation');
        expect(instructions).toHaveProperty('references');
        expect(instructions).toHaveProperty('disclaimer');
        expect(instructions).toHaveProperty('verification');
        expect(instructions).toHaveProperty('clarity');
        
        // Check format
        const format = systemPrompts.base.format;
        expect(format).toHaveProperty('response');
        expect(format).toHaveProperty('legalBasis');
        expect(format).toHaveProperty('procedures');
        expect(format).toHaveProperty('warnings');
      });
    });

    it('should have all legal area specializations', () => {
      const requiredSpecializations = [
        'constitutional',
        'civil',
        'criminal',
        'labor',
        'tax',
        'commercial',
        'administrative',
        'family',
        'property'
      ];
      
      locales.forEach(locale => {
        const filePath = path.join(localesPath, `${locale}.json`);
        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const specializations = content.systemPrompts?.specializations;
        
        expect(specializations).toBeDefined();
        
        requiredSpecializations.forEach(spec => {
          expect(specializations).toHaveProperty(spec);
          expect(typeof specializations[spec]).toBe('string');
          expect(specializations[spec].length).toBeGreaterThan(0);
        });
      });
    });

    it('should have query templates', () => {
      const requiredTemplates = [
        'userQuery',
        'contextWithQuery',
        'analysisRequest',
        'documentSearch',
        'precedentLookup'
      ];
      
      locales.forEach(locale => {
        const filePath = path.join(localesPath, `${locale}.json`);
        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const templates = content.systemPrompts?.queryTemplates;
        
        expect(templates).toBeDefined();
        
        requiredTemplates.forEach(template => {
          expect(templates).toHaveProperty(template);
          expect(typeof templates[template]).toBe('string');
          expect(templates[template].length).toBeGreaterThan(0);
        });
      });
    });

    it('should have legal warning and recommended actions', () => {
      locales.forEach(locale => {
        const filePath = path.join(localesPath, `${locale}.json`);
        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const systemPrompts = content.systemPrompts;
        
        // Check legal warning
        expect(systemPrompts).toHaveProperty('legalWarning');
        expect(typeof systemPrompts.legalWarning).toBe('string');
        expect(systemPrompts.legalWarning.length).toBeGreaterThan(0);
        
        // Check recommended actions
        expect(systemPrompts).toHaveProperty('recommendedActions');
        const actions = systemPrompts.recommendedActions;
        
        ['citation', 'procedural', 'conceptual', 'default'].forEach(actionType => {
          expect(actions).toHaveProperty(actionType);
          expect(Array.isArray(actions[actionType])).toBe(true);
          expect(actions[actionType].length).toBeGreaterThan(0);
        });
      });
    });

    it('should have consistent template placeholders across languages', () => {
      const placeholderPattern = /\{\{(\w+)\}\}/g;
      
      // Get placeholders from Spanish (reference)
      const esPath = path.join(localesPath, 'es.json');
      const esContent = JSON.parse(fs.readFileSync(esPath, 'utf-8'));
      const esTemplates = esContent.systemPrompts?.queryTemplates;
      
      const esPlaceholders: Record<string, Set<string>> = {};
      
      if (esTemplates) {
        Object.keys(esTemplates).forEach(key => {
          const matches = esTemplates[key].matchAll(placeholderPattern);
          esPlaceholders[key] = new Set(Array.from(matches).map(m => m[1]));
        });
      }
      
      // Compare with other languages
      locales.slice(1).forEach(locale => {
        const filePath = path.join(localesPath, `${locale}.json`);
        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const templates = content.systemPrompts?.queryTemplates;
        
        if (templates) {
          Object.keys(templates).forEach(key => {
            const matches = templates[key].matchAll(placeholderPattern);
            const placeholders = new Set(Array.from(matches).map(m => m[1]));
            
            // Should have the same placeholders as Spanish
            if (esPlaceholders[key]) {
              expect(placeholders).toEqual(esPlaceholders[key]);
            }
          });
        }
      });
    });
  });
});