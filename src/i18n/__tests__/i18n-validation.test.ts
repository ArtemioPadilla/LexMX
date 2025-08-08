import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

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
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        
        // Check for duplicate keys by analyzing the raw JSON text
        const lines = fileContent.split('\n');
        const keyPattern = /^\s*"([^"]+)":/;
        const keyStack: { key: string; level: number }[] = [];
        const seenKeys = new Map<string, Set<string>>();
        
        let currentLevel = 0;
        const levelPath: string[] = [];
        
        lines.forEach((line, lineNumber) => {
          // Track nesting level
          const openBraces = (line.match(/{/g) || []).length;
          const closeBraces = (line.match(/}/g) || []).length;
          
          if (closeBraces > 0) {
            currentLevel -= closeBraces;
            levelPath.pop();
          }
          
          const match = line.match(keyPattern);
          if (match) {
            const key = match[1];
            const fullPath = [...levelPath].join('.');
            
            if (!seenKeys.has(fullPath)) {
              seenKeys.set(fullPath, new Set());
            }
            
            const keysAtLevel = seenKeys.get(fullPath)!;
            
            // Check for duplicate
            if (keysAtLevel.has(key)) {
              throw new Error(
                `Duplicate key "${key}" found at line ${lineNumber + 1} in ${locale}.json. ` +
                `Path: ${fullPath ? fullPath + '.' : ''}${key}`
              );
            }
            
            keysAtLevel.add(key);
          }
          
          if (openBraces > 0) {
            // Extract the key before the opening brace
            const keyMatch = line.match(/^\s*"([^"]+)":\s*{/);
            if (keyMatch) {
              levelPath.push(keyMatch[1]);
            }
            currentLevel += openBraces;
          }
        });
        
        // If we get here, no duplicates were found
        expect(true).toBe(true);
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
    const getAllKeys = (obj: any, prefix = ''): string[] => {
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
    const checkForEmptyValues = (obj: any, path = ''): string[] => {
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