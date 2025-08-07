import { test, expect } from '@playwright/test';
import {
  setupPage,
  navigateAndWaitForHydration,
  createTestCase,
  clearAllStorage
} from '../utils/test-helpers';

test.describe('Case Management (Mis Casos) User Journey', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
    await clearAllStorage(page);
    await navigateAndWaitForHydration(page, '/casos');
  });

  test('can navigate to Mis Casos from navigation', async ({ page }) => {
    await page.goto('/');
    
    // Click on Mis Casos in navigation
    await page.click('nav a:has-text("Mis Casos")');
    
    // Verify we're on the casos page
    await page.waitForURL('**/casos');
    await expect(page.locator('.case-manager')).toBeVisible();
    await expect(page.locator('h1:has-text("Mis Casos")')).toBeVisible();
  });

  test('shows empty state when no cases exist', async ({ page }) => {
    // Check empty state message
    await expect(page.locator('text="No hay casos creados"')).toBeVisible();
    
    // Check main area shows prompt
    await expect(page.locator('text="Selecciona un caso"')).toBeVisible();
    await expect(page.locator('text="o crea uno nuevo para comenzar"')).toBeVisible();
  });

  test('can create a new case', async ({ page }) => {
    // Click "Nuevo Caso" button
    await page.click('button:has-text("+ Nuevo Caso")');
    
    // Check creation form is visible
    await expect(page.locator('h2:has-text("Crear Nuevo Caso")')).toBeVisible();
    
    // Fill in case details
    await page.fill('input[placeholder*="Divorcio"]', 'Caso de Prueba');
    await page.fill('textarea[placeholder*="descripción"]', 'Descripción del caso de prueba');
    await page.fill('input[placeholder="Nombre del cliente"]', 'Cliente Test');
    await page.fill('input[placeholder*="123/2024"]', 'TEST-001/2024');
    
    // Select legal area
    await page.selectOption('select', 'labor');
    
    // Submit form
    await page.click('button:has-text("Crear Caso")');
    
    // Verify case was created and is visible in sidebar
    await expect(page.locator('text="Caso de Prueba"').first()).toBeVisible();
    await expect(page.locator('text="Cliente Test"').first()).toBeVisible();
    
    // Verify case is selected and details are shown
    await expect(page.locator('h1:has-text("Caso de Prueba")')).toBeVisible();
    await expect(page.locator('text="Descripción del caso de prueba"')).toBeVisible();
  });

  test('can search for cases', async ({ page }) => {
    // Create multiple test cases
    await createTestCase(page, {
      title: 'Divorcio García',
      client: 'Juan García',
      legalArea: 'civil'
    });
    
    await page.evaluate(() => {
      const cases = JSON.parse(localStorage.getItem('lexmx_cases') || '[]');
      cases.push({
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
      });
      localStorage.setItem('lexmx_cases', JSON.stringify(cases));
    });
    
    await page.reload();
    
    // Search for "García"
    const searchInput = page.locator('input[placeholder="Buscar casos..."]');
    await searchInput.fill('García');
    
    // Check only García case is visible
    await expect(page.locator('text="Divorcio García"')).toBeVisible();
    await expect(page.locator('text="Despido Injustificado"')).not.toBeVisible();
    
    // Clear search
    await searchInput.clear();
    
    // Check both cases are visible
    await expect(page.locator('text="Divorcio García"')).toBeVisible();
    await expect(page.locator('text="Despido Injustificado"')).toBeVisible();
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
    
    // Filter by active status
    await page.selectOption('select:has(option[value="active"])', 'active');
    
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
    await expect(page.locator('text="Click para subir"')).toBeVisible();
    
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
    await expect(page.locator('text="Click para subir"')).toBeVisible();
    await expect(page.locator('text="o arrastra archivos aquí"')).toBeVisible();
    
    // Simulate file upload
    const fileInput = page.locator('input[type="file"]');
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
    await page.click('svg[viewBox="0 0 24 24"]:has(path[d*="M19 7l-.867"])').locator('..');
    
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
    const activeCase = page.locator('button:has-text("Active Case")');
    await expect(activeCase.locator('span:has-text("Activo")')).toBeVisible();
    await expect(activeCase.locator('span:has-text("Activo")')).toHaveClass(/bg-green/);
    
    const pendingCase = page.locator('button:has-text("Pending Case")');
    await expect(pendingCase.locator('span:has-text("Pendiente")')).toBeVisible();
    await expect(pendingCase.locator('span:has-text("Pendiente")')).toHaveClass(/bg-yellow/);
    
    const resolvedCase = page.locator('button:has-text("Resolved Case")');
    await expect(resolvedCase.locator('span:has-text("Resuelto")')).toBeVisible();
    await expect(resolvedCase.locator('span:has-text("Resuelto")')).toHaveClass(/bg-blue/);
  });

  test('can cancel case creation', async ({ page }) => {
    // Click "Nuevo Caso" button
    await page.click('button:has-text("+ Nuevo Caso")');
    
    // Check creation form is visible
    await expect(page.locator('h2:has-text("Crear Nuevo Caso")')).toBeVisible();
    
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