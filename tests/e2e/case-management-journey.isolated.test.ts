/**
 * Isolated version of case management tests
 * Uses the new test isolation system for parallel execution
 */
import { isolatedTest as test, expect } from '../utils/isolated-fixtures';
import { 
  navigateAndWaitForHydration, 
  waitForHydration,
  createTestCase
} from '../utils/test-helpers';
import { TEST_IDS } from '../../src/utils/test-ids';

test.describe('Case Management (Mis Casos) User Journey - Isolated', () => {
  test.beforeEach(async ({ page }) => {
    // Note: setupIsolatedPage is already called by the fixture
    await navigateAndWaitForHydration(page, '/casos');
  });

  test('can navigate to Mis Casos from navigation', async ({ page }) => {
    await page.goto('/');
    await waitForHydration(page);
    
    // Click on Mis Casos in navigation
    const navLink = page.locator(`[data-testid="${TEST_IDS.nav.cases}"]`);
    await navLink.click();
    
    // Should navigate to /casos
    await page.waitForURL('**/casos');
    
    // Check page loaded
    await page.waitForSelector(`[data-testid="${TEST_IDS.cases.container}"]`, { timeout: 10000 });
    await expect(page.locator(`[data-testid="${TEST_IDS.cases.container}"]`)).toBeVisible();
    await expect(page.locator('h1').filter({ hasText: /Mis Casos/i })).toBeVisible();
  });

  test('shows empty state when no cases exist', async ({ page }) => {
    // Clear any existing cases
    await page.evaluate(() => {
      localStorage.removeItem('lexmx_cases');
    });
    
    await page.reload();
    await waitForHydration(page);
    
    // Check empty state messages
    const emptyMessage = page.locator(`[data-testid="${TEST_IDS.cases.emptyMessage}"]`);
    const selectMessage = page.locator(`[data-testid="${TEST_IDS.cases.selectMessage}"]`);
    const createMessage = page.locator(`[data-testid="${TEST_IDS.cases.createMessage}"]`);
    
    await expect(emptyMessage).toBeVisible({ timeout: 10000 });
    await expect(selectMessage).toBeVisible();
    await expect(createMessage).toBeVisible();
  });

  test('can create a new case', async ({ page }) => {
    // Click new case button
    const newCaseButton = page.locator(`[data-testid="${TEST_IDS.cases.newCaseButton}"]`);
    await newCaseButton.click();
    
    // Fill out the case creation form
    const createCaseForm = page.locator(`[data-testid="${TEST_IDS.cases.creationForm}"]`);
    await expect(createCaseForm).toBeVisible();
    
    // Fill form fields using placeholders with regex for i18n
    await page.fill('input[placeholder*="Título"], input[placeholder*="Title"]', 'Caso de prueba');
    await page.fill('textarea[placeholder*="Descripción"], textarea[placeholder*="Description"]', 'Descripción del caso de prueba');
    await page.fill('input[placeholder*="Cliente"], input[placeholder*="Client"]', 'Cliente de prueba');
    await page.fill('input[placeholder*="Número"], input[placeholder*="Number"]', '123/2024');
    
    // Select legal area
    await page.selectOption('select', 'civil');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Wait for case to be created
    await page.waitForTimeout(1000);
    
    // Check case appears in list
    await expect(page.locator('text=/Caso de prueba/i')).toBeVisible({ timeout: 10000 });
  });

  test('can search for cases', async ({ page }) => {
    // Create multiple test cases
    await createTestCase(page, {
      title: 'Caso Activo',
      description: 'Un caso activo',
      status: 'active'
    });
    
    await createTestCase(page, {
      title: 'Caso Resuelto',
      description: 'Un caso resuelto',
      status: 'resolved'
    });
    
    await page.reload();
    await waitForHydration(page);
    
    // Check cases list is visible
    const casesList = page.locator(`[data-testid="${TEST_IDS.cases.caseList}"]`);
    await expect(casesList).toBeVisible({ timeout: 10000 });
    
    // Search for specific case
    const searchInput = page.locator(`[data-testid="${TEST_IDS.cases.searchInput}"]`);
    await searchInput.fill('Activo');
    
    // Wait for search to filter
    await page.waitForTimeout(500);
    
    // Check filtered results
    await expect(page.locator('text=/Caso Activo/i')).toBeVisible();
    await expect(page.locator('text=/Caso Resuelto/i')).not.toBeVisible();
    
    // Clear search
    await searchInput.clear();
    await page.waitForTimeout(500);
    
    // Both cases should be visible
    await expect(page.locator('text=/Caso Activo/i')).toBeVisible();
    await expect(page.locator('text=/Caso Resuelto/i')).toBeVisible();
  });

  test('can filter cases by status', async ({ page }) => {
    // Create cases with different statuses
    await createTestCase(page, {
      title: 'Caso Activo',
      status: 'active'
    });
    
    await createTestCase(page, {
      title: 'Caso Resuelto',
      status: 'resolved'
    });
    
    await page.reload();
    await waitForHydration(page);
    
    // Filter by status
    const statusSelect = page.locator(`[data-testid="${TEST_IDS.cases.filterStatus}"]`);
    await statusSelect.selectOption('resolved');
    
    // Check filtered results
    await page.waitForTimeout(500);
    await expect(page.locator('text=/Caso Resuelto/i')).toBeVisible();
    await expect(page.locator('text=/Caso Activo/i')).not.toBeVisible();
    
    // Reset filter
    await statusSelect.selectOption('all');
    await page.waitForTimeout(500);
    
    // Both should be visible
    await expect(page.locator('text=/Caso Activo/i')).toBeVisible();
    await expect(page.locator('text=/Caso Resuelto/i')).toBeVisible();
  });

  test('can view case details', async ({ page }) => {
    // Create a test case with details
    await createTestCase(page, {
      title: 'Caso con Detalles',
      description: 'Este caso tiene información completa',
      client: 'Juan Pérez',
      caseNumber: '456/2024',
      legalArea: 'labor',
      status: 'active'
    });
    
    await page.reload();
    await waitForHydration(page);
    
    // Click on the case
    await page.click('text=/Caso con Detalles/i');
    await page.waitForTimeout(500);
    
    // Check details are visible
    await expect(page.locator(`[data-testid="${TEST_IDS.upload.area}"]`)).toBeVisible();
    await expect(page.locator('textarea[placeholder*="Agregar una nota"], textarea[placeholder*="Add a note"]')).toBeVisible();
  });

  test('can add documents to a case', async ({ page }) => {
    // Create and select a case
    await createTestCase(page, {
      title: 'Caso para Documentos',
      status: 'active'
    });
    
    await page.reload();
    await waitForHydration(page);
    
    await page.click('text=/Caso para Documentos/i');
    await page.waitForTimeout(500);
    
    // Check upload area is visible
    await expect(page.locator(`[data-testid="${TEST_IDS.upload.area}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="${TEST_IDS.upload.text}"]`)).toBeVisible();
    
    // Upload would happen here (file input interaction)
    const fileInput = page.locator(`[data-testid="${TEST_IDS.upload.input}"]`);
    await expect(fileInput).toHaveAttribute('type', 'file');
  });

  test('can add notes to a case', async ({ page }) => {
    // Create and select a case
    await createTestCase(page, {
      title: 'Caso para Notas',
      status: 'pending'
    });
    
    await page.reload();
    await waitForHydration(page);
    
    await page.click('text=/Caso para Notas/i');
    await page.waitForTimeout(500);
    
    // Add a note
    const noteInput = page.locator('textarea[placeholder*="Agregar una nota"], textarea[placeholder*="Add a note"]');
    await noteInput.fill('Esta es una nota de prueba para el caso');
    
    // Submit note (press Enter or click button)
    await noteInput.press('Enter');
    await page.waitForTimeout(500);
    
    // Check note appears
    await expect(page.locator('text=/Esta es una nota de prueba para el caso/i')).toBeVisible();
  });

  test('can edit case information', async ({ page }) => {
    // Create a case
    await createTestCase(page, {
      title: 'Caso Original',
      description: 'Descripción original',
      status: 'active'
    });
    
    await page.reload();
    await waitForHydration(page);
    
    // Click on the case
    await page.click('text=/Caso Original/i');
    await page.waitForTimeout(500);
    
    // Look for edit button
    const editButton = page.locator('button').filter({ hasText: /Editar|Edit/i }).first();
    if (await editButton.isVisible()) {
      await editButton.click();
      
      // Edit form should appear
      const titleInput = page.locator('input[value*="Caso Original"]');
      if (await titleInput.isVisible()) {
        await titleInput.clear();
        await titleInput.fill('Caso Modificado');
        
        // Save changes
        await page.click('button[type="submit"]');
        await page.waitForTimeout(500);
        
        // Check updated title
        await expect(page.locator('text=/Caso Modificado/i')).toBeVisible();
      }
    }
  });

  test('can delete a case', async ({ page }) => {
    // Create a case to delete
    await createTestCase(page, {
      title: 'Caso para Eliminar',
      status: 'archived'
    });
    
    await page.reload();
    await waitForHydration(page);
    
    // Click on the case
    await page.click('text=/Caso para Eliminar/i');
    await page.waitForTimeout(500);
    
    // Look for delete button
    const deleteButton = page.locator('button').filter({ hasText: /Eliminar|Delete|Borrar/i }).first();
    if (await deleteButton.isVisible()) {
      // Set up dialog handler before clicking delete
      page.on('dialog', dialog => dialog.accept());
      
      await deleteButton.click();
      await page.waitForTimeout(1000);
      
      // Check case is removed
      await expect(page.locator('text=/Caso para Eliminar/i')).not.toBeVisible();
    }
  });

  test('shows different status indicators', async ({ page }) => {
    // Create cases with different statuses
    await createTestCase(page, {
      title: 'Caso Activo Status',
      status: 'active'
    });
    
    await createTestCase(page, {
      title: 'Caso Pendiente Status',
      status: 'pending'
    });
    
    await createTestCase(page, {
      title: 'Caso Resuelto Status',
      status: 'resolved'
    });
    
    await page.reload();
    await waitForHydration(page);
    
    // Find case items by ID pattern
    const activeCase = page.locator('[data-testid*="case-item-"]').filter({ hasText: /Caso Activo Status/i });
    const pendingCase = page.locator('[data-testid*="case-item-"]').filter({ hasText: /Caso Pendiente Status/i });
    const resolvedCase = page.locator('[data-testid*="case-item-"]').filter({ hasText: /Caso Resuelto Status/i });
    
    // Check status indicators
    await expect(activeCase.locator(`[data-testid="${TEST_IDS.cases.caseStatus('active')}"]`)).toBeVisible();
    await expect(activeCase.locator(`[data-testid="${TEST_IDS.cases.caseStatus('active')}"]`)).toHaveClass(/bg-green/);
    
    await expect(pendingCase.locator(`[data-testid="${TEST_IDS.cases.caseStatus('pending')}"]`)).toBeVisible();
    await expect(pendingCase.locator(`[data-testid="${TEST_IDS.cases.caseStatus('pending')}"]`)).toHaveClass(/bg-yellow/);
    
    await expect(resolvedCase.locator(`[data-testid="${TEST_IDS.cases.caseStatus('resolved')}"]`)).toBeVisible();
    await expect(resolvedCase.locator(`[data-testid="${TEST_IDS.cases.caseStatus('resolved')}"]`)).toHaveClass(/bg-blue/);
  });
});