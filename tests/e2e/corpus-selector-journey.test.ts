import { test, expect, Page } from '@playwright/test';
import {
  setupPage,
  navigateAndWaitForHydration,
  setupWebLLMProvider,
  clearAllStorage
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

test.describe('Corpus Selector User Journey', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
    await clearAllStorage(page);
    await navigateAndWaitForHydration(page, '/chat');
    await setupWebLLMProvider(page);
    // Wait for corpus selector to be ready
    await waitForCorpusSelectorReady(page);
  });

  test('corpus selector is visible in chat interface', async ({ page }) => {
    // Use data-testid instead of CSS class
    const corpusSelector = page.locator('[data-testid="corpus-selector-toggle"]');
    
    // Check corpus selector is visible
    await expect(corpusSelector).toBeVisible({ timeout: 10000 });
    
    // Check default text (already waited in beforeEach)
    await expect(corpusSelector).toContainText('Todo el corpus');
    
    // Check icon is visible
    const icon = corpusSelector.locator('svg').first();
    await expect(icon).toBeVisible();
  });

  test('can open corpus selector dropdown', async ({ page }) => {
    // Open corpus selector
    const selector = page.locator('[data-testid="corpus-selector-toggle"]');
    await selector.click();
    
    // Wait for dropdown animation and content
    await page.waitForTimeout(500);
    
    // Check dropdown is visible with more flexible selector
    await expect(page.locator('h3').filter({ hasText: /Seleccionar Corpus|Select Corpus/i })).toBeVisible({ timeout: 10000 });
    
    // Check tabs are visible
    await expect(page.locator('button').filter({ hasText: /Por Área|By Area/i })).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button').filter({ hasText: /Por Documento|By Document/i })).toBeVisible({ timeout: 5000 });
    
    // Check action buttons with data-testid
    await expect(page.locator('[data-testid="corpus-select-all"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="corpus-clear-all"]')).toBeVisible({ timeout: 5000 });
  });

  test('can switch between area and document tabs', async ({ page }) => {
    // Open corpus selector
    const selector = page.locator('[data-testid="corpus-selector-toggle"]');
    await selector.click();
    
    await page.waitForTimeout(500);
    
    // Get tabs with more flexible selectors
    const areaTab = page.locator('button').filter({ hasText: /Por Área|By Area/i });
    const docTab = page.locator('button').filter({ hasText: /Por Documento|By Document/i });
    
    // Click document tab
    await docTab.click();
    await page.waitForTimeout(300);
    
    // Check search box appears in document tab
    await expect(page.locator('input[placeholder*="Buscar"], input[placeholder*="Search"]')).toBeVisible({ timeout: 5000 });
    
    // Switch back to area tab
    await areaTab.click();
    await page.waitForTimeout(300);
    
    // Verify area content is visible
    await expect(page.locator('button').filter({ hasText: /Civil|Labor|Criminal/i }).first()).toBeVisible();
  });

  test('can select legal areas', async ({ page }) => {
    // Open corpus selector
    const selector = page.locator('[data-testid="corpus-selector-toggle"]');
    await selector.click();
    
    await page.waitForTimeout(500);
    
    // Click on Civil area - use more flexible selector
    const civilArea = page.locator('button').filter({ hasText: 'Civil' }).first();
    await civilArea.click();
    
    // Wait for state change
    await page.waitForTimeout(300);
    
    // Check checkbox is checked
    const civilCheckbox = civilArea.locator('input[type="checkbox"]');
    await expect(civilCheckbox).toBeChecked({ timeout: 5000 });
    
    // Wait for documents to appear
    await page.waitForTimeout(300);
    
    // Check documents appear under the area
    await expect(page.locator('button').filter({ hasText: 'CCF' })).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button').filter({ hasText: 'CFPC' })).toBeVisible({ timeout: 5000 });
    
    // Click area again to deselect
    await civilArea.click();
    await page.waitForTimeout(300);
    await expect(civilCheckbox).not.toBeChecked();
  });

  test('can select individual documents', async ({ page }) => {
    // Open corpus selector
    const selector = page.locator('[data-testid="corpus-selector-toggle"]');
    await selector.click();
    
    await page.waitForTimeout(500);
    
    // Switch to documents tab
    const docTab = page.locator('button').filter({ hasText: /Por Documento|By Document/i });
    await docTab.click();
    
    await page.waitForTimeout(500);
    
    // Select a specific document
    const lftDoc = page.locator('button').filter({ hasText: 'LFT' }).first();
    await lftDoc.click();
    
    // Wait for state update
    await page.waitForTimeout(300);
    
    // Check checkbox is checked
    const checkbox = lftDoc.locator('input[type="checkbox"]');
    await expect(checkbox).toBeChecked({ timeout: 5000 });
    
    // Close dropdown
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    
    // Check selector shows document count
    await expect(selector).toContainText(/1 seleccionado|1 selected/i);
  });

  test('can search for documents', async ({ page }) => {
    // Open corpus selector
    const selector = page.locator('[data-testid="corpus-selector-toggle"]');
    await selector.click();
    
    await page.waitForTimeout(500);
    
    // Switch to documents tab
    const docTab = page.locator('button').filter({ hasText: /Por Documento|By Document/i });
    await docTab.click();
    
    await page.waitForTimeout(500);
    
    // Search for "trabajo"
    const searchInput = page.locator('input[placeholder*="Buscar"], input[placeholder*="Search"]');
    await searchInput.fill('trabajo');
    
    // Wait for search to filter
    await page.waitForTimeout(500);
    
    // Check trabajo-related documents are visible
    await expect(page.locator('button').filter({ hasText: /Trabajo|LFT/i })).toBeVisible({ timeout: 5000 });
    
    // Clear search
    await searchInput.clear();
    
    // Wait for all documents to reappear
    await page.waitForTimeout(500);
    
    // Check documents are visible again
    await expect(page.locator('button').filter({ hasText: /Civil|CCF/i }).first()).toBeVisible({ timeout: 5000 });
  });

  test('select all and clear all buttons work', async ({ page }) => {
    // Open corpus selector
    const selector = page.locator('[data-testid="corpus-selector-toggle"]').first();
    await selector.click();
    
    // Wait for dropdown to be visible
    await page.waitForSelector('[data-testid="corpus-select-all"]', { timeout: 10000 });
    
    // Click "Seleccionar todo" using data-testid
    await page.click('[data-testid="corpus-select-all"]');
    
    // Wait a moment for selection to update
    await page.waitForTimeout(500);
    
    // Close and reopen to check
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    
    // Should show count of selected documents
    const text = await selector.textContent();
    expect(text).toMatch(/\d+ seleccionados/);
    
    await selector.click();
    await page.waitForSelector('[data-testid="corpus-clear-all"]', { timeout: 10000 });
    
    // Click "Limpiar" using data-testid
    await page.click('[data-testid="corpus-clear-all"]');
    
    // Wait for clear to process
    await page.waitForTimeout(500);
    
    // Close dropdown
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    
    // Check selector shows "Todo el corpus" (default when nothing selected)
    await expect(selector).toContainText('Todo el corpus');
  });

  test('selecting area auto-selects its documents', async ({ page }) => {
    // Open corpus selector
    const selector = page.locator('[data-testid="corpus-selector-toggle"]').first();
    await selector.click();
    
    // Wait for dropdown and areas to load
    await page.waitForTimeout(500);
    
    // Select Labor area using flexible selector for i18n
    const laborArea = page.locator('button').filter({ hasText: /Laboral|Labor/i }).first();
    await expect(laborArea).toBeVisible({ timeout: 10000 });
    await laborArea.click();
    
    // Wait for the area expansion animation
    await page.waitForTimeout(500);
    
    // When an area is selected, documents within it should be visible
    // Check if labor documents are now visible in the expanded section
    const lftButton = page.locator('button').filter({ hasText: 'LFT' }).first();
    const lssButton = page.locator('button').filter({ hasText: 'LSS' }).first();
    
    // Verify the documents are visible in the expanded area
    await expect(lftButton).toBeVisible({ timeout: 5000 });
    await expect(lssButton).toBeVisible({ timeout: 5000 });
    
    // The checkboxes should be checked for documents in selected area
    const lftCheckbox = lftButton.locator('input[type="checkbox"]');
    const lssCheckbox = lssButton.locator('input[type="checkbox"]');
    
    await expect(lftCheckbox).toBeChecked({ timeout: 5000 });
    await expect(lssCheckbox).toBeChecked({ timeout: 5000 });
    
    // Close dropdown
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    
    // Check selector shows document count
    const buttonText = await selector.textContent();
    expect(buttonText).toMatch(/\d+ seleccionado/); // Should show number of selected documents
  });

  test('corpus selection persists while chatting', async ({ page }) => {
    // Open corpus selector
    const selector = page.locator('[data-testid="corpus-selector-toggle"]').first();
    await selector.click();
    
    // Wait for dropdown to load
    await page.waitForTimeout(500);
    
    // Select specific documents using flexible selectors
    const docTab = page.locator('button').filter({ hasText: /Por Documento|By Document/i });
    await docTab.click();
    await page.waitForTimeout(500);
    
    const cpeumButton = page.locator('button').filter({ hasText: 'CPEUM' }).first();
    await cpeumButton.click();
    await page.waitForTimeout(200);
    
    const lftButton = page.locator('button').filter({ hasText: 'LFT' }).first();
    await lftButton.click();
    await page.waitForTimeout(200);
    
    // Close dropdown
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    
    // Check selection is shown
    await expect(selector).toContainText(/2 seleccionado/);
    
    // Send a chat message
    const input = page.locator('[data-testid="chat-input"]');
    await input.fill('¿Qué dice la constitución sobre el trabajo?');
    await page.keyboard.press('Enter');
    
    // Wait a moment for any UI updates
    await page.waitForTimeout(1000);
    
    // Check corpus selection is still the same
    await expect(selector).toContainText(/2 seleccionado/);
  });

  test('corpus selector shows document count in footer', async ({ page }) => {
    // Open corpus selector
    const selector = page.locator('[data-testid="corpus-selector-toggle"]').first();
    await selector.click();
    
    // Wait for dropdown to load
    await page.waitForTimeout(500);
    
    // Switch to documents tab using flexible selector
    const docTab = page.locator('button').filter({ hasText: /Por Documento|By Document/i });
    await expect(docTab).toBeVisible({ timeout: 10000 });
    await docTab.click();
    await page.waitForTimeout(500);
    
    // Select some documents using flexible selectors
    const cpeumButton = page.locator('button').filter({ hasText: 'CPEUM' }).first();
    await cpeumButton.click();
    await page.waitForTimeout(200);
    
    const lftButton = page.locator('button').filter({ hasText: 'LFT' }).first();
    await lftButton.click();
    await page.waitForTimeout(200);
    
    const ccfButton = page.locator('button').filter({ hasText: 'CCF' }).first();
    await ccfButton.click();
    await page.waitForTimeout(200);
    
    // Close dropdown
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    
    // Check selector button shows selected count
    await expect(selector).toContainText(/3 seleccionado/);
  });

  test('corpus selector works in mobile view', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Wait for page to adjust to mobile viewport
    await page.waitForTimeout(500);
    
    // Check corpus selector is visible using data-testid
    const selector = page.locator('[data-testid="corpus-selector-toggle"]').first();
    await expect(selector).toBeVisible({ timeout: 10000 });
    
    // Open dropdown
    await selector.click();
    await page.waitForTimeout(500);
    
    // Check dropdown is visible
    const dropdown = page.locator('[data-testid="corpus-dropdown"]').first();
    
    // Try to check if dropdown exists, if not, use alternative selector
    const dropdownVisible = await dropdown.isVisible().catch(() => false);
    if (!dropdownVisible) {
      // Use alternative method to check dropdown is open
      await expect(page.locator('h3').filter({ hasText: /Seleccionar Corpus|Select Corpus/i })).toBeVisible({ timeout: 5000 });
    }
    
    // Check tabs are still functional using flexible selectors
    const docTab = page.locator('button').filter({ hasText: /Por Documento|By Document/i });
    await docTab.click();
    await page.waitForTimeout(500);
    
    // Check search input is visible
    await expect(page.locator('input[placeholder*="Buscar"], input[placeholder*="Search"]')).toBeVisible({ timeout: 5000 });
  });

  test('can deselect individual documents from selected area', async ({ page }) => {
    // Open corpus selector
    const selector = page.locator('[data-testid="corpus-selector-toggle"]').first();
    await selector.click();
    
    // Wait for dropdown to load
    await page.waitForTimeout(500);
    
    // Select Civil area (selects all civil documents) using flexible selector
    const civilArea = page.locator('button').filter({ hasText: 'Civil' }).first();
    await expect(civilArea).toBeVisible({ timeout: 10000 });
    await civilArea.click();
    
    // Wait for documents to appear
    await page.waitForTimeout(500);
    
    // Deselect one document
    const ccfDoc = page.locator('button').filter({ hasText: 'CCF' }).first();
    await expect(ccfDoc).toBeVisible({ timeout: 5000 });
    await ccfDoc.click();
    
    // Wait for state update
    await page.waitForTimeout(300);
    
    // Check CCF is unchecked but area is still selected
    const ccfCheckbox = ccfDoc.locator('input[type="checkbox"]');
    await expect(ccfCheckbox).not.toBeChecked({ timeout: 5000 });
    
    const areaCheckbox = civilArea.locator('input[type="checkbox"]');
    await expect(areaCheckbox).toBeChecked({ timeout: 5000 }); // Area stays selected
    
    // Close dropdown
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    
    // Check selector shows correct count (1 document less than total civil docs)
    await expect(selector).toContainText(/1 seleccionado/);
  });
});