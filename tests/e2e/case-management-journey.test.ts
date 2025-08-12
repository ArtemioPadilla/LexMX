import { test, expect } from '@playwright/test';
import {
  setupPage,
  navigateAndWaitForHydration,
  createTestCase,
  clearAllStorage
} from '../utils/test-helpers';
import { TEST_IDS } from '../../src/utils/test-ids';
import { TEST_DATA } from '../../src/utils/test-data';

test.describe('Case Management (Mis Casos) User Journey', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
    await clearAllStorage(page);
    
    // Set Spanish language before navigation
    await page.evaluate(() => {
      localStorage.setItem('language', '"es"');
    });
    
    await navigateAndWaitForHydration(page, '/casos');
    
    // Log console messages to help debug
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Browser error:', msg.text());
      }
    });
    
    // Wait for CaseManager to fully load and initialize
    await page.waitForSelector('[data-testid="case-manager"]', { timeout: 10000 });
    
    // Additional wait to ensure language is applied
    await page.waitForTimeout(1000);
  });

  test('can navigate to Mis Casos from navigation', async ({ page }) => {
    await page.goto('/');
    
    // Click on Mis Casos in navigation
    await page.click('nav a:has-text("Mis Casos")');
    
    // Verify we're on the casos page
    await page.waitForURL('**/casos');
    await expect(page.locator('[data-testid="case-manager"]')).toBeVisible();
    await expect(page.locator('h1:has-text("Mis Casos")')).toBeVisible();
  });

  test('shows empty state when no cases exist', async ({ page }) => {
    // Wait for hydration
    await page.waitForTimeout(1000);
    
    // Check empty state message using data-testid
    const emptyMessage = page.locator('[data-testid="empty-cases-message"]');
    await expect(emptyMessage).toBeVisible({ timeout: 10000 });
    
    // Check main area shows prompt using data-testid
    const selectMessage = page.locator('[data-testid="select-case-message"]');
    const createMessage = page.locator('[data-testid="or-create-new-message"]');
    
    await expect(selectMessage).toBeVisible();
    await expect(createMessage).toBeVisible();
  });

  test('can create a new case', async ({ page }) => {
    // Wait for CaseManager to initialize
    await page.waitForTimeout(1000);
    
    // Click new case button - use data-testid
    const newCaseButton = page.locator('[data-testid="new-case-button"]');
    await newCaseButton.click();
    
    // Check creation form is visible - use data-testid
    const createCaseForm = page.locator('[data-testid="case-creation-form"]');
    await expect(createCaseForm).toBeVisible();
    
    // Fill in case details - use more robust selectors
    const titleInput = page.locator('input[type="text"]').first();
    const descriptionTextarea = page.locator('textarea').first();
    const clientInput = page.locator('input[type="text"]').nth(1);
    const caseNumberInput = page.locator('input[type="text"]').nth(2);
    
    await titleInput.fill('Caso de Prueba');
    await descriptionTextarea.fill('Descripción del caso de prueba');
    await clientInput.fill('Cliente Test');
    await caseNumberInput.fill('TEST-001/2024');
    
    // Select legal area
    const legalAreaSelect = page.locator('select').nth(2);
    await legalAreaSelect.selectOption('civil');
    
    // Submit form - use button type submit
    const submitButton = page.locator('button[type="submit"]').first();
    await submitButton.click();
    
    // Wait for case to be created
    await page.waitForTimeout(1000);
    
    // Verify case was created by checking for case item with data-testid
    const caseItems = page.locator('[data-testid^="case-item-"]');
    await expect(caseItems).toHaveCount(1, { timeout: 10000 });
    
    // Click on the created case
    await caseItems.first().click();
    
    // Verify case details are shown (checking for the description we entered)
    await expect(page.locator('text="Descripción del caso de prueba"')).toBeVisible({ timeout: 10000 });
  });

  test('can search for cases', async ({ page }) => {
    // Log console messages to help debug
    page.on('console', msg => {
      console.log('Browser log:', msg.type(), msg.text());
    });
    
    page.on('pageerror', err => {
      console.log('Page error:', err.message);
    });
    
    // Create test cases directly in localStorage before page load
    await page.evaluate(() => {
      const cases = [
        {
          id: '1',
          title: 'Divorcio García',
          client: 'Juan García',
          legalArea: 'civil',
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          documents: [],
          notes: [],
          conversations: [],
          deadlines: [],
          parties: []
        },
        {
          id: '2',
          title: 'Despido Injustificado',
          client: 'María López',
          legalArea: 'labor',
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          documents: [],
          notes: [],
          conversations: [],
          deadlines: [],
          parties: []
        }
      ];
      localStorage.setItem('lexmx_cases', JSON.stringify(cases));
    });
    
    // Navigate away and back to trigger fresh load with localStorage data
    await page.goto('/');
    await navigateAndWaitForHydration(page, '/casos');
    
    // Wait for CaseManager to load
    await page.waitForSelector('[data-testid="case-manager"]', { timeout: 10000 });
    await page.waitForTimeout(1500); // Wait for cases to load from localStorage
    
    // Verify both cases are visible initially
    const casesList = page.locator('[data-testid="cases-list"]');
    await expect(casesList).toBeVisible({ timeout: 10000 });
    
    // Wait for cases to be rendered
    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid^="case-item-"]').length === 2,
      { timeout: 10000 }
    );
    
    // Search for "García" - use data-testid
    const searchInput = page.locator('[data-testid="search-cases-input"]');
    await searchInput.click();
    await searchInput.fill('García');
    
    // Wait for debounce (300ms) + some extra time for React to re-render
    await page.waitForTimeout(500);
    
    // Wait for filtered results using waitForFunction
    await page.waitForFunction(
      () => {
        const items = document.querySelectorAll('[data-testid^="case-item-"]');
        // Should have exactly 1 case with "García" in it
        return items.length === 1 && 
               Array.from(items).some(item => item.textContent?.includes('García'));
      },
      { timeout: 10000 }
    );
    
    // Clear search
    await searchInput.click();
    await searchInput.clear();
    
    // Wait for debounce + re-render
    await page.waitForTimeout(500);
    
    // Wait for both cases to be visible again
    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid^="case-item-"]').length === 2,
      { timeout: 10000 }
    );
  });

  test('can filter cases by status', async ({ page }) => {
    // Create cases with different statuses
    await page.evaluate(() => {
      const cases = [
        {
          id: '1',
          title: 'Caso Activo',
          status: 'active',
          legalArea: 'civil',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          documents: [],
          notes: [],
          conversations: [],
          deadlines: [],
          parties: []
        },
        {
          id: '2',
          title: 'Caso Resuelto',
          status: 'resolved',
          legalArea: 'labor',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          documents: [],
          notes: [],
          conversations: [],
          deadlines: [],
          parties: []
        }
      ];
      localStorage.setItem('lexmx_cases', JSON.stringify(cases));
    });
    
    await page.reload();
    
    // Filter by active status - use data-testid
    const statusSelect = page.locator('[data-testid="filter-status-select"]');
    await statusSelect.selectOption('active');
    
    // Check only active case is visible
    await expect(page.locator('text="Caso Activo"')).toBeVisible();
    await expect(page.locator('text="Caso Resuelto"')).not.toBeVisible();
    
    // Filter by resolved status
    await page.selectOption('select:has(option[value="active"])', 'resolved');
    
    // Check only resolved case is visible
    await expect(page.locator('text="Caso Resuelto"')).toBeVisible();
    await expect(page.locator('text="Caso Activo"')).not.toBeVisible();
  });

  test('can switch between case tabs', async ({ page }) => {
    // Create a test case
    await createTestCase(page);
    await page.reload();
    
    // Select the case
    await page.click('button:has-text("Test Case")');
    
    // Check Overview tab is active by default
    await expect(page.locator('button:has-text("Resumen")')).toHaveClass(/border-legal-500/);
    
    // Click Documents tab
    await page.click('button:has-text("Documentos")');
    await expect(page.locator('[data-testid="upload-area"]')).toBeVisible();
    
    // Click Notes tab
    await page.click('button:has-text("Notas")');
    await expect(page.locator('textarea[placeholder*="Agregar una nota"]')).toBeVisible();
    
    // Click Chat tab
    await page.click('button:has-text("Chat")');
    await expect(page.locator('text="Chat integrado próximamente"')).toBeVisible();
    
    // Click Timeline tab
    await page.click('button:has-text("Cronología")');
    await expect(page.locator('text="Cronología próximamente"')).toBeVisible();
    
    // Go back to Overview
    await page.click('button:has-text("Resumen")');
    await expect(page.locator('h3:has-text("Partes Involucradas")')).toBeVisible();
  });

  test('can add notes to a case', async ({ page }) => {
    // Create and select a test case
    await createTestCase(page);
    await page.reload();
    await page.click('button:has-text("Test Case")');
    
    // Go to Notes tab
    await page.click('button:has-text("Notas")');
    
    // Add a note
    const noteInput = page.locator('textarea[placeholder*="Agregar una nota"]');
    await noteInput.fill('Esta es una nota de prueba para el caso');
    await noteInput.press('Enter');
    
    // Check note was added
    await expect(page.locator('text="Esta es una nota de prueba para el caso"')).toBeVisible();
    
    // Add another note
    await noteInput.fill('Segunda nota del caso');
    await noteInput.press('Enter');
    
    // Check both notes are visible
    await expect(page.locator('text="Esta es una nota de prueba para el caso"')).toBeVisible();
    await expect(page.locator('text="Segunda nota del caso"')).toBeVisible();
  });

  test('can upload documents to a case', async ({ page }) => {
    // Create and select a test case
    await createTestCase(page);
    await page.reload();
    await page.click('button:has-text("Test Case")');
    
    // Go to Documents tab
    await page.click('button:has-text("Documentos")');
    
    // Check upload area is visible
    await expect(page.locator('[data-testid="upload-area"]')).toBeVisible();
    await expect(page.locator('[data-testid="upload-text"]')).toBeVisible();
    
    // Simulate file upload
    const fileInput = page.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles({
      name: 'test-document.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('test content')
    });
    
    // Note: Actual file upload handling would depend on the implementation
    // For now, we just verify the UI is present and accepts files
  });

  test('can delete a case', async ({ page }) => {
    // Create and select a test case
    await createTestCase(page);
    await page.reload();
    await page.click('button:has-text("Test Case")');
    
    // Click delete button
    page.on('dialog', dialog => dialog.accept()); // Auto-accept confirmation
    const deleteButton = page.locator('button:has(svg[viewBox="0 0 24 24"]:has(path[d*="M19 7l-.867"]))');
    await deleteButton.click();
    
    // Wait for case to be deleted
    await page.waitForTimeout(500);
    
    // Check case is no longer in sidebar
    await expect(page.locator('button:has-text("Test Case")')).not.toBeVisible();
    
    // Check empty state is shown again
    await expect(page.locator('text="No hay casos creados"')).toBeVisible();
  });

  test('case data persists after page reload', async ({ page }) => {
    // Create a case with notes
    await createTestCase(page, {
      title: 'Persistent Case',
      description: 'This case should persist',
      client: 'Persistent Client'
    });
    
    await page.reload();
    
    // Select the case
    await page.click('button:has-text("Persistent Case")');
    
    // Add a note
    await page.click('button:has-text("Notas")');
    const noteInput = page.locator('textarea[placeholder*="Agregar una nota"]');
    await noteInput.fill('Persistent note');
    await noteInput.press('Enter');
    
    // Reload page
    await page.reload();
    
    // Check case still exists
    await expect(page.locator('button:has-text("Persistent Case")')).toBeVisible();
    
    // Select case and check note still exists
    await page.click('button:has-text("Persistent Case")');
    await page.click('button:has-text("Notas")');
    await expect(page.locator('text="Persistent note"')).toBeVisible();
  });

  test('shows case status badges correctly', async ({ page }) => {
    // Create cases with different statuses
    await page.evaluate(() => {
      const cases = [
        {
          id: '1',
          title: 'Active Case',
          status: 'active',
          legalArea: 'civil',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          documents: [],
          notes: [],
          conversations: [],
          deadlines: [],
          parties: []
        },
        {
          id: '2',
          title: 'Pending Case',
          status: 'pending',
          legalArea: 'labor',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          documents: [],
          notes: [],
          conversations: [],
          deadlines: [],
          parties: []
        },
        {
          id: '3',
          title: 'Resolved Case',
          status: 'resolved',
          legalArea: 'tax',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          documents: [],
          notes: [],
          conversations: [],
          deadlines: [],
          parties: []
        }
      ];
      localStorage.setItem('lexmx_cases', JSON.stringify(cases));
    });
    
    await page.reload();
    
    // Check status badges are visible with correct colors
    const activeCase = page.locator('[data-testid="case-item-1"]');
    await expect(activeCase.locator('[data-testid="case-status-active"]')).toBeVisible();
    await expect(activeCase.locator('[data-testid="case-status-active"]')).toHaveClass(/bg-green/);
    
    const pendingCase = page.locator('[data-testid="case-item-2"]');
    await expect(pendingCase.locator('[data-testid="case-status-pending"]')).toBeVisible();
    await expect(pendingCase.locator('[data-testid="case-status-pending"]')).toHaveClass(/bg-yellow/);
    
    const resolvedCase = page.locator('[data-testid="case-item-3"]');
    await expect(resolvedCase.locator('[data-testid="case-status-resolved"]')).toBeVisible();
    await expect(resolvedCase.locator('[data-testid="case-status-resolved"]')).toHaveClass(/bg-blue/);
  });

  test('can cancel case creation', async ({ page }) => {
    // Click "Nuevo Caso" button - use data-testid
    const newCaseButton = page.locator('[data-testid="new-case-button"]');
    await newCaseButton.click();
    
    // Check creation form is visible - use data-testid
    const createCaseForm = page.locator('[data-testid="case-creation-form"]');
    await expect(createCaseForm).toBeVisible();
    
    // Fill some data
    await page.fill('input[placeholder*="Divorcio"]', 'Cancelled Case');
    
    // Click cancel
    await page.click('button:has-text("Cancelar")');
    
    // Check form is no longer visible
    await expect(page.locator('h2:has-text("Crear Nuevo Caso")')).not.toBeVisible();
    
    // Check case was not created
    await expect(page.locator('text="Cancelled Case"')).not.toBeVisible();
    
    // Check empty state is shown
    await expect(page.locator('text="Selecciona un caso"')).toBeVisible();
  });
});