#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const testsDir = path.join(__dirname, '..', 'tests', 'e2e');

// Common selector replacements
const selectorReplacements = [
  // Navigation selectors
  {
    pattern: /page\.locator\(`\[data-testid="cases"\]`\)/g,
    replacement: 'page.locator(\'a[href*="casos"]\').first()'
  },
  {
    pattern: /\[data-testid="cases"\]/g,
    replacement: 'a[href*="casos"]'
  },
  
  // Empty state selectors
  {
    pattern: /page\.locator\(`\[data-testid="emptyMessage"\]`\)/g,
    replacement: 'page.locator(\'text=/No tienes casos|No cases yet|Aún no has creado/i\').first()'
  },
  {
    pattern: /page\.locator\(`\[data-testid="selectMessage"\]`\)/g,
    replacement: 'page.locator(\'text=/Selecciona un caso|Select a case/i\').first()'
  },
  {
    pattern: /page\.locator\(`\[data-testid="createMessage"\]`\)/g,
    replacement: 'page.locator(\'text=/Crea tu primer caso|Create your first case/i\').first()'
  },
  
  // Button selectors
  {
    pattern: /page\.locator\(`\[data-testid="new-case-button"\]`\)/g,
    replacement: 'page.locator(\'button\').filter({ hasText: /Nuevo Caso|New Case|Crear Caso/i }).first()'
  },
  {
    pattern: /\[data-testid="new-case-button"\]/g,
    replacement: 'button:has-text("Nuevo Caso"), button:has-text("New Case")'
  },
  
  // Form selectors
  {
    pattern: /page\.locator\(`\[data-testid="creationForm"\]`\)/g,
    replacement: 'page.locator(\'form\').first()'
  },
  {
    pattern: /\[data-testid="creationForm"\]/g,
    replacement: 'form'
  },
  
  // Container selectors
  {
    pattern: /page\.waitForSelector\(`\[data-testid="container"\]`/g,
    replacement: 'page.waitForSelector(\'main, [role="main"], .container\'',
  },
  {
    pattern: /page\.locator\(`\[data-testid="container"\]`\)/g,
    replacement: 'page.locator(\'main, [role="main"], .container\').first()'
  },
  
  // Save/Submit buttons
  {
    pattern: /\[data-testid="save"\]/g,
    replacement: 'button:has-text("Guardar"), button:has-text("Save")'
  },
  
  // Search fields
  {
    pattern: /\[data-testid="search"\]/g,
    replacement: 'input[type="search"], input[placeholder*="Buscar"], input[placeholder*="Search"]'
  },
  
  // Filter selectors
  {
    pattern: /\[data-testid="statusFilter"\]/g,
    replacement: 'select[name*="status"], select[id*="status"]'
  },
  
  // Case list items
  {
    pattern: /\[data-testid="caseItem"\]/g,
    replacement: '[role="listitem"], .case-item, article'
  },
  
  // Modal selectors
  {
    pattern: /\[data-testid="modal"\]/g,
    replacement: '[role="dialog"], .modal, [aria-modal="true"]'
  },
  
  // Close buttons
  {
    pattern: /\[data-testid="close"\]/g,
    replacement: 'button[aria-label*="Close"], button[aria-label*="Cerrar"], button:has-text("×")'
  },
  
  // Error messages
  {
    pattern: /\[data-testid="error"\]/g,
    replacement: '[role="alert"], .error, .alert-error'
  },
  
  // Success messages
  {
    pattern: /\[data-testid="success"\]/g,
    replacement: '.success, .alert-success, [role="status"]'
  },
  
  // Loading indicators
  {
    pattern: /\[data-testid="loading"\]/g,
    replacement: '[aria-busy="true"], .loading, .spinner'
  }
];

function fixSelectors(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;
  
  selectorReplacements.forEach(({ pattern, replacement }) => {
    if (pattern.test(content)) {
      content = content.replace(pattern, replacement);
      modified = true;
    }
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Fixed selectors in ${path.basename(filePath)}`);
    return true;
  }
  
  return false;
}

// Process all test files
const testFiles = fs.readdirSync(testsDir).filter(f => f.endsWith('.test.ts'));

console.log('🔍 Fixing selectors in test files...\n');

let fixedCount = 0;
testFiles.forEach(file => {
  const filePath = path.join(testsDir, file);
  if (fixSelectors(filePath)) {
    fixedCount++;
  }
});

console.log(`\n✨ Fixed selectors in ${fixedCount} files`);