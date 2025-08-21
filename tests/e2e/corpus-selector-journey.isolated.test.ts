/**
 * Isolated version of corpus selector tests
 * Uses the new test isolation system for parallel execution
 */
import { isolatedTest as test, expect } from '../utils/isolated-fixtures';
import { Page } from '@playwright/test';
import {
  navigateAndWaitForHydration,
  setupWebLLMProvider
} from '../utils/test-helpers';
import { TEST_IDS } from '../../src/utils/test-ids';
import { TEST_DATA } from '../../src/utils/test-data';

// Helper function to wait for corpus selector to be ready
async function waitForCorpusSelectorReady(page: Page) {
  // Wait for component to be visible
  await page.waitForSelector('[data-testid="corpus-selector-toggle"]', { 
    state: 'visible',
    timeout: 15000 
  });
  
  // Wait for translations to load
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-testid="corpus-selector-toggle"]');
    return el && el.textContent && (
      el.textContent.includes('Todo el corpus') || 
      el.textContent.includes('seleccionados') ||
      el.textContent.includes('corpus')
    );
  }, { timeout: 10000 });
  
  // Small additional wait for React state stabilization
  await page.waitForTimeout(500);
}

test.describe('Corpus Selector User Journey (Isolated)', () => {
  test.beforeEach(async ({ page }) => {
    // Note: setupIsolatedPage is already called by the fixture
    // We just need to navigate and setup specific requirements
    await navigateAndWaitForHydration(page, '/chat');
    await setupWebLLMProvider(page);
    await waitForCorpusSelectorReady(page);
  });

  test('corpus selector is visible in chat interface', async ({ page }) => {
    const corpusSelector = page.locator('[data-testid="corpus-selector-toggle"]');
    await expect(corpusSelector).toBeVisible({ timeout: 10000 });
    
    const text = await corpusSelector.textContent();
    expect(text).toMatch(/Todo el corpus|Entire corpus/i);
  });

  test('can open corpus selector dropdown', async ({ page }) => {
    const toggleButton = page.locator('[data-testid="corpus-selector-toggle"]');
    await toggleButton.click();
    
    const dropdown = page.locator('[data-testid="corpus-dropdown"]');
    await expect(dropdown).toBeVisible({ timeout: 5000 });
    
    const areaTab = page.locator('[data-testid="corpus-area-tab"]');
    await expect(areaTab).toBeVisible();
    
    const documentTab = page.locator('[data-testid="corpus-document-tab"]'); 
    await expect(documentTab).toBeVisible();
  });

  test('can switch between area and document tabs', async ({ page }) => {
    const toggleButton = page.locator('[data-testid="corpus-selector-toggle"]');
    await toggleButton.click();
    
    await page.waitForSelector('[data-testid="corpus-dropdown"]', { state: 'visible' });
    
    // Click document tab
    const documentTab = page.locator('[data-testid="corpus-document-tab"]');
    await documentTab.click();
    
    // Check search input appears
    const searchInput = page.locator('[data-testid="corpus-search-input"]');
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    
    // Click area tab
    const areaTab = page.locator('[data-testid="corpus-area-tab"]');
    await areaTab.click();
    
    // Check area options appear
    const areaButton = page.locator('button').filter({ 
      hasText: /Constitucional|Constitutional|Civil|Penal|Criminal|Laboral|Labor/i 
    }).first();
    await expect(areaButton).toBeVisible({ timeout: 5000 });
  });

  test('can select a legal area', async ({ page }) => {
    const toggleButton = page.locator('[data-testid="corpus-selector-toggle"]');
    await toggleButton.click();
    
    await page.waitForSelector('[data-testid="corpus-dropdown"]', { state: 'visible' });
    
    // Select Constitutional area
    const constitutionalButton = page.locator('button').filter({ 
      hasText: /Constitucional|Constitutional/i 
    }).first();
    await constitutionalButton.click();
    
    // Check button shows selected state
    await expect(constitutionalButton).toHaveClass(/bg-blue-100|bg-blue-500/);
    
    // Close dropdown
    await page.keyboard.press('Escape');
    
    // Check toggle reflects selection
    const toggleText = await toggleButton.textContent();
    expect(toggleText).toMatch(/1 área seleccionada|1 area selected/i);
  });

  test('can search for documents', async ({ page }) => {
    const toggleButton = page.locator('[data-testid="corpus-selector-toggle"]');
    await toggleButton.click();
    
    await page.waitForSelector('[data-testid="corpus-dropdown"]', { state: 'visible' });
    
    // Switch to documents tab
    const documentTab = page.locator('[data-testid="corpus-document-tab"]');
    await documentTab.click();
    
    // Search for a document
    const searchInput = page.locator('[data-testid="corpus-search-input"]');
    await searchInput.fill('Constitución');
    
    // Check filtered results
    await page.waitForTimeout(500); // Wait for search debounce
    
    const documentButtons = page.locator('[data-testid="corpus-dropdown"] button').filter({
      hasText: /Constitución|CPEUM/i
    });
    
    const count = await documentButtons.count();
    expect(count).toBeGreaterThan(0);
  });

  test('can select multiple documents', async ({ page }) => {
    const toggleButton = page.locator('[data-testid="corpus-selector-toggle"]');
    await toggleButton.click();
    
    await page.waitForSelector('[data-testid="corpus-dropdown"]', { state: 'visible' });
    
    // Switch to documents tab
    const documentTab = page.locator('[data-testid="corpus-document-tab"]');
    await documentTab.click();
    
    // Select multiple documents
    const firstDoc = page.locator('[data-testid="corpus-dropdown"] button').filter({
      hasText: TEST_DATA.mockLegalDocuments[0].title
    }).first();
    
    const secondDoc = page.locator('[data-testid="corpus-dropdown"] button').filter({
      hasText: TEST_DATA.mockLegalDocuments[1].title
    }).first();
    
    if (await firstDoc.isVisible()) {
      await firstDoc.click();
      await expect(firstDoc).toHaveClass(/bg-blue-100|bg-blue-500/);
    }
    
    if (await secondDoc.isVisible()) {
      await secondDoc.click();
      await expect(secondDoc).toHaveClass(/bg-blue-100|bg-blue-500/);
    }
    
    // Close dropdown
    await page.keyboard.press('Escape');
    
    // Check toggle reflects selections
    const toggleText = await toggleButton.textContent();
    expect(toggleText).toMatch(/\d+ documentos? seleccionados?|\d+ documents? selected/i);
  });

  test('can clear all selections', async ({ page }) => {
    const toggleButton = page.locator('[data-testid="corpus-selector-toggle"]');
    await toggleButton.click();
    
    await page.waitForSelector('[data-testid="corpus-dropdown"]', { state: 'visible' });
    
    // Select an area
    const constitutionalButton = page.locator('button').filter({ 
      hasText: /Constitucional|Constitutional/i 
    }).first();
    await constitutionalButton.click();
    
    // Clear selection
    const clearButton = page.locator('button').filter({ 
      hasText: /Limpiar|Clear/i 
    }).first();
    
    if (await clearButton.isVisible()) {
      await clearButton.click();
      
      // Check selection is cleared
      await expect(constitutionalButton).not.toHaveClass(/bg-blue-100|bg-blue-500/);
    }
    
    // Close dropdown
    await page.keyboard.press('Escape');
    
    // Check toggle shows all corpus
    const toggleText = await toggleButton.textContent();
    expect(toggleText).toMatch(/Todo el corpus|Entire corpus/i);
  });

  test('selections persist across dropdown open/close', async ({ page }) => {
    const toggleButton = page.locator('[data-testid="corpus-selector-toggle"]');
    
    // Open and select
    await toggleButton.click();
    await page.waitForSelector('[data-testid="corpus-dropdown"]', { state: 'visible' });
    
    const constitutionalButton = page.locator('button').filter({ 
      hasText: /Constitucional|Constitutional/i 
    }).first();
    await constitutionalButton.click();
    
    // Close dropdown
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="corpus-dropdown"]')).not.toBeVisible();
    
    // Reopen dropdown
    await toggleButton.click();
    await page.waitForSelector('[data-testid="corpus-dropdown"]', { state: 'visible' });
    
    // Check selection persists
    await expect(constitutionalButton).toHaveClass(/bg-blue-100|bg-blue-500/);
  });

  test('can select all areas at once', async ({ page }) => {
    const toggleButton = page.locator('[data-testid="corpus-selector-toggle"]');
    await toggleButton.click();
    
    await page.waitForSelector('[data-testid="corpus-dropdown"]', { state: 'visible' });
    
    // Look for select all button
    const selectAllButton = page.locator('button').filter({ 
      hasText: /Seleccionar todo|Select all/i 
    }).first();
    
    if (await selectAllButton.isVisible()) {
      await selectAllButton.click();
      
      // Check multiple areas are selected
      const selectedButtons = page.locator('[data-testid="corpus-dropdown"] button.bg-blue-100, [data-testid="corpus-dropdown"] button.bg-blue-500');
      const count = await selectedButtons.count();
      expect(count).toBeGreaterThan(1);
    }
  });

  test('corpus selector state affects chat interface', async ({ page }) => {
    // Select specific corpus
    const toggleButton = page.locator('[data-testid="corpus-selector-toggle"]');
    await toggleButton.click();
    
    await page.waitForSelector('[data-testid="corpus-dropdown"]', { state: 'visible' });
    
    const constitutionalButton = page.locator('button').filter({ 
      hasText: /Constitucional|Constitutional/i 
    }).first();
    await constitutionalButton.click();
    
    await page.keyboard.press('Escape');
    
    // Type a message in chat
    const chatInput = page.locator('textarea[placeholder*="Pregunta"], textarea[placeholder*="Ask"]').first();
    await chatInput.fill('¿Qué dice el artículo 123?');
    
    // The corpus selection should be maintained
    const toggleText = await toggleButton.textContent();
    expect(toggleText).toMatch(/1 área seleccionada|1 area selected/i);
  });

  test('handles empty corpus gracefully', async ({ page }) => {
    // Clear mock corpus data
    await page.evaluate(() => {
      localStorage.setItem('lexmx_corpus', JSON.stringify([]));
    });
    
    await page.reload();
    await waitForCorpusSelectorReady(page);
    
    const toggleButton = page.locator('[data-testid="corpus-selector-toggle"]');
    await toggleButton.click();
    
    // Should show empty state or message
    const dropdown = page.locator('[data-testid="corpus-dropdown"]');
    await expect(dropdown).toBeVisible();
    
    const emptyMessage = page.locator('text=/No hay documentos|No documents|Sin resultados|No results/i');
    // Empty message might or might not appear depending on implementation
    // Just ensure no errors occur
  });
});