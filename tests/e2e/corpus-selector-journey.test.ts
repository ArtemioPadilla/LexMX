import { test, expect } from '@playwright/test';
import {
  setupPage,
  navigateAndWaitForHydration,
  setupWebLLMProvider,
  clearAllStorage
} from '../utils/test-helpers';
import { TEST_IDS } from '../../src/utils/test-ids';
import { TEST_DATA } from '../../src/utils/test-data';

test.describe('Corpus Selector User Journey', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
    await clearAllStorage(page);
    await navigateAndWaitForHydration(page, '/chat');
    await setupWebLLMProvider(page);
  });

  test('corpus selector is visible in chat interface', async ({ page }) => {
    // Check corpus selector is visible
    const corpusSelector = page.locator('.corpus-selector').first();
    await expect(corpusSelector).toBeVisible();
    
    // Check default text
    await expect(corpusSelector).toContainText('Todo el corpus');
    
    // Check icon is visible
    const icon = corpusSelector.locator('svg').first();
    await expect(icon).toBeVisible();
  });

  test('can open corpus selector dropdown', async ({ page }) => {
    // Open corpus selector
    const selector = page.locator('[data-testid="corpus-selector-toggle"]').first();
    await selector.click();
    
    // Check dropdown is visible
    await expect(page.locator('h3:has-text("Seleccionar Corpus")')).toBeVisible();
    
    // Check tabs are visible
    await expect(page.locator('button:has-text("Por Área")')).toBeVisible();
    await expect(page.locator('button:has-text("Por Documento")')).toBeVisible();
    
    // Check action buttons
    await expect(page.locator('button:has-text("Seleccionar todo")')).toBeVisible();
    await expect(page.locator('button:has-text("Limpiar")')).toBeVisible();
  });

  test('can switch between area and document tabs', async ({ page }) => {
    // Open corpus selector
    const selector = page.locator('[data-testid="corpus-selector-toggle"]').first();
    await selector.click();
    
    // By default, "Por Área" tab should be active
    const areaTab = page.locator('button:has-text("Por Área")');
    const docTab = page.locator('button:has-text("Por Documento")');
    
    // Check area tab is active (has different styling)
    await expect(areaTab).toHaveClass(/bg-white|shadow-sm/);
    
    // Click document tab
    await docTab.click();
    
    // Check document tab is now active
    await expect(docTab).toHaveClass(/bg-white|shadow-sm/);
    
    // Check search box appears in document tab
    await expect(page.locator('input[placeholder="Buscar documento..."]')).toBeVisible();
  });

  test('can select legal areas', async ({ page }) => {
    // Open corpus selector
    const selector = page.locator('[data-testid="corpus-selector-toggle"]').first();
    await selector.click();
    
    // Click on Civil area
    const civilArea = page.locator('button:has-text("Civil")').first();
    await civilArea.click();
    
    // Check checkbox is checked
    const civilCheckbox = civilArea.locator('input[type="checkbox"]');
    await expect(civilCheckbox).toBeChecked();
    
    // Check documents appear under the area
    await expect(page.locator('text="CCF"')).toBeVisible(); // Código Civil Federal
    await expect(page.locator('text="CFPC"')).toBeVisible(); // Código Federal de Procedimientos Civiles
    
    // Click area again to deselect
    await civilArea.click();
    await expect(civilCheckbox).not.toBeChecked();
  });

  test('can select individual documents', async ({ page }) => {
    // Open corpus selector
    const selector = page.locator('[data-testid="corpus-selector-toggle"]').first();
    await selector.click();
    
    // Switch to documents tab
    await page.click('button:has-text("Por Documento")');
    
    // Select a specific document
    const lftDoc = page.locator('button:has-text("LFT")').first(); // Ley Federal del Trabajo
    await lftDoc.click();
    
    // Check checkbox is checked
    const checkbox = lftDoc.locator('input[type="checkbox"]');
    await expect(checkbox).toBeChecked();
    
    // Close dropdown
    await page.keyboard.press('Escape');
    
    // Check selector shows document count
    await expect(selector).toContainText('1 seleccionados');
  });

  test('can search for documents', async ({ page }) => {
    // Open corpus selector
    const selector = page.locator('[data-testid="corpus-selector-toggle"]').first();
    await selector.click();
    
    // Switch to documents tab
    await page.click('button:has-text("Por Documento")');
    
    // Search for "trabajo"
    const searchInput = page.locator('input[placeholder="Buscar documento..."]');
    await searchInput.fill('trabajo');
    
    // Check only trabajo-related documents are visible
    await expect(page.locator('text="Ley Federal del Trabajo"')).toBeVisible();
    
    // Check other documents are not visible
    const ccfVisible = await page.locator('text="Código Civil Federal"').isVisible();
    expect(ccfVisible).toBe(false);
    
    // Clear search
    await searchInput.clear();
    
    // Check all documents are visible again
    await expect(page.locator('text="Código Civil Federal"')).toBeVisible();
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
    
    // Wait for areas to load
    await page.waitForSelector('button:has-text("Laboral")', { timeout: 10000 });
    
    // Select Labor area
    const laborArea = page.locator('button:has-text("Laboral")').first();
    await laborArea.click();
    
    // Wait for the area expansion animation
    await page.waitForTimeout(500);
    
    // When an area is selected, documents within it should be visible
    // Check if labor documents are now visible in the expanded section
    const lftButton = page.locator('button:has-text("LFT")').first();
    const lssButton = page.locator('button:has-text("LSS")').first();
    
    // Verify the documents are visible in the expanded area
    await expect(lftButton).toBeVisible();
    await expect(lssButton).toBeVisible();
    
    // The checkboxes should be checked for documents in selected area
    const lftCheckbox = lftButton.locator('input[type="checkbox"]');
    const lssCheckbox = lssButton.locator('input[type="checkbox"]');
    
    await expect(lftCheckbox).toBeChecked();
    await expect(lssCheckbox).toBeChecked();
    
    // Close dropdown
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    
    // Check selector shows document count
    const buttonText = await selector.textContent();
    expect(buttonText).toMatch(/\d+ seleccionados/); // Should show number of selected documents
  });

  test('corpus selection persists while chatting', async ({ page }) => {
    // Open corpus selector
    const selector = page.locator('[data-testid="corpus-selector-toggle"]').first();
    await selector.click();
    
    // Select specific documents
    await page.click('button:has-text("Por Documento")');
    await page.click('button:has-text("CPEUM")'); // Constitución
    await page.click('button:has-text("LFT")'); // Ley Federal del Trabajo
    
    // Close dropdown
    await page.keyboard.press('Escape');
    
    // Check selection is shown
    await expect(selector).toContainText('2 seleccionados');
    
    // Send a chat message
    const input = page.locator('[data-testid="chat-input"]');
    await input.fill('¿Qué dice la constitución sobre el trabajo?');
    await page.keyboard.press('Enter');
    
    // Wait a moment for any UI updates
    await page.waitForTimeout(1000);
    
    // Check corpus selection is still the same
    await expect(selector).toContainText('2 seleccionados');
  });

  test('corpus selector shows document count in footer', async ({ page }) => {
    // Open corpus selector
    const selector = page.locator('[data-testid="corpus-selector-toggle"]').first();
    await selector.click();
    
    // Wait for the dropdown to be fully loaded
    await page.waitForSelector('button:has-text("Por Documento")', { timeout: 10000 });
    
    // Switch to documents tab
    await page.click('button:has-text("Por Documento")');
    await page.waitForTimeout(500);
    
    // Select some documents
    await page.click('button:has-text("CPEUM")');
    await page.waitForTimeout(200);
    await page.click('button:has-text("LFT")');
    await page.waitForTimeout(200);
    await page.click('button:has-text("CCF")');
    await page.waitForTimeout(200);
    
    // Close dropdown
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    
    // Check selector button shows selected count
    await expect(selector).toContainText('3 seleccionados');
  });

  test('corpus selector works in mobile view', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Wait for page to adjust to mobile viewport
    await page.waitForTimeout(500);
    
    // Check corpus selector is visible
    const corpusSelector = page.locator('.corpus-selector').first();
    await expect(corpusSelector).toBeVisible();
    
    // Open dropdown
    const selector = page.locator('[data-testid="corpus-selector-toggle"]').first();
    await selector.click();
    
    // Check dropdown fits in mobile view
    const dropdown = page.locator('.corpus-selector').locator('[role="dialog"]').first();
    const boundingBox = await dropdown.boundingBox();
    
    if (boundingBox) {
      expect(boundingBox.width).toBeLessThanOrEqual(375);
    }
    
    // Check tabs are still functional
    await page.click('button:has-text("Por Documento")');
    await expect(page.locator('input[placeholder="Buscar documento..."]')).toBeVisible();
  });

  test('can deselect individual documents from selected area', async ({ page }) => {
    // Open corpus selector
    const selector = page.locator('[data-testid="corpus-selector-toggle"]').first();
    await selector.click();
    
    // Select Civil area (selects all civil documents)
    const civilArea = page.locator('button:has-text("Civil")').first();
    await civilArea.click();
    
    // Deselect one document
    const ccfDoc = page.locator('button:has-text("CCF")').first();
    await ccfDoc.click();
    
    // Check CCF is unchecked but area is still selected
    const ccfCheckbox = ccfDoc.locator('input[type="checkbox"]');
    await expect(ccfCheckbox).not.toBeChecked();
    
    const areaCheckbox = civilArea.locator('input[type="checkbox"]');
    await expect(areaCheckbox).toBeChecked(); // Area stays selected
    
    // Close dropdown
    await page.keyboard.press('Escape');
    
    // Check selector shows correct count (1 document less than total civil docs)
    await expect(selector).toContainText('1 seleccionados');
  });
});