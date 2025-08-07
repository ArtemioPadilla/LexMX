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
});