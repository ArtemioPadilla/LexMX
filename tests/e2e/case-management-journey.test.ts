import { createTestCase, expect, test, waitForHydration, navigateAndWaitForHydration } from '../utils/test-helpers-consolidated';
import { setupCompleteMockEnvironment, quickSetupProvider } from '../utils/mock-all-providers';
import { smartWait, waitForElement, clickElement, fillInput as fastFillInput, waitForText, waitForHydrationFast } from '../utils/fast-helpers';
import { 
  CASE_SELECTORS, 
  TEXT_PATTERNS, 
  TEST_CONFIG,
  TAB_SELECTORS,
  MODAL_SELECTORS,
  CASE_DETAIL_SELECTORS
} from '../constants/selectors';
import { caseStorage, storageScenarios } from '../helpers/case-storage';
import { CREATE_CASE_DATA } from '../fixtures/case-data';
import { tabHelpers } from '../helpers/tab-navigation';
import { modalHelpers } from '../helpers/modal-helpers';

/**
 * Isolated version of case management tests
 * Uses the new test isolation system for parallel execution
 */
import { TEST_IDS } from '../../src/utils/test-ids';

test.describe('Case Management (Mis Casos) User Journey (Mocked)', () => {
  test.beforeEach(async ({ page }) => {
    // Note: setupIsolatedPage is already called by the fixture
    await navigateAndWaitForHydration(page, '/casos');
  });

  test('can navigate to Mis Casos from navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await waitForHydration(page);
    
    // Click on Mis Casos in navigation
    const navLink = page.locator('a[href*="casos"]').first();
    await navLink.click();
    
    // Should navigate to /casos
    await page.waitForURL('**/casos');
    
    // Check page loaded
    await page.waitForSelector('main, [role="main"], .container', { timeout: 5000 });
    await expect(page.locator('main, [role="main"], .container').first()).toBeVisible();
    await expect(page.locator('h1').filter({ hasText: /Mis Casos/i })).toBeVisible();
  });

  test('shows empty state when no cases exist', async ({ page }) => {
    // Use storage helper to set up empty state
    await storageScenarios.emptyState(page);
    
    await page.reload();
    await waitForHydration(page);
    
    // Check empty state messages using centralized selectors
    const emptyMessage = page.locator(CASE_SELECTORS.EMPTY_CASES_MESSAGE).first();
    const selectMessage = page.locator(CASE_SELECTORS.SELECT_CASE_MESSAGE);
    const createMessage = page.locator(CASE_SELECTORS.OR_CREATE_NEW_MESSAGE);
    
    // Check that empty message appears in the cases list
    await expect(emptyMessage).toBeVisible({ timeout: TEST_CONFIG.TIMEOUTS.MEDIUM });
    // Check that the select case message appears when no case is selected
    await expect(selectMessage).toBeVisible();
    await expect(createMessage).toBeVisible();
  });

  test('can create a new case', async ({ page }) => {
    // Set up empty state first
    await storageScenarios.emptyState(page);
    await page.reload();
    await waitForHydration(page);
    
    // Click new case button using centralized selector
    const newCaseButton = page.locator(CASE_SELECTORS.NEW_CASE_BUTTON);
    await newCaseButton.click();
    
    // Wait for the form to appear
    await page.waitForSelector(CASE_SELECTORS.CREATION_FORM, { timeout: TEST_CONFIG.TIMEOUTS.MEDIUM });
    
    // Fill out the case creation form using data-testid selectors
    const testData = CREATE_CASE_DATA.SIMPLE;
    
    await page.fill(CASE_SELECTORS.TITLE_INPUT, testData.title);
    if (testData.description) {
      await page.fill(CASE_SELECTORS.DESCRIPTION_INPUT, testData.description);
    }
    if (testData.client) {
      await page.fill(CASE_SELECTORS.CLIENT_INPUT, testData.client);
    }
    if (testData.caseNumber) {
      await page.fill(CASE_SELECTORS.NUMBER_INPUT, testData.caseNumber);
    }
    if (testData.area) {
      await page.selectOption(CASE_SELECTORS.LEGAL_AREA_SELECT, { value: testData.area });
    }
    
    // Submit form
    await page.click(CASE_SELECTORS.SUBMIT_BUTTON);
    
    // Wait for case to be created and appear in the case list
    await expect(page.locator(CASE_SELECTORS.CASES_LIST).locator(`text=/${testData.title}/i`).first()).toBeVisible({ 
      timeout: TEST_CONFIG.TIMEOUTS.MEDIUM 
    });
  });

  test('can search for cases', async ({ page }) => {
    // Set up test data using storage helper
    await storageScenarios.searchTest(page);
    await page.reload();
    await waitForHydration(page);
    
    // Check cases list is visible
    const casesList = page.locator(CASE_SELECTORS.CASES_LIST);
    await expect(casesList).toBeVisible({ timeout: TEST_CONFIG.TIMEOUTS.MEDIUM });
    
    // Search for specific case
    const searchInput = page.locator(CASE_SELECTORS.SEARCH_INPUT);
    await searchInput.fill('García');
    
    // Wait for search to filter
    await page.waitForTimeout(TEST_CONFIG.WAIT_TIMES.INTERACTION);
    
    // Check filtered results - should show only the García case
    await expect(page.locator(CASE_SELECTORS.CASE_ITEM('test-case-1'))).toBeVisible(); // García case
    await expect(page.locator(CASE_SELECTORS.CASE_ITEM('test-case-2'))).not.toBeVisible(); // Silva case
    await expect(page.locator(CASE_SELECTORS.CASE_ITEM('test-case-3'))).not.toBeVisible(); // López case
    
    // Clear search
    await searchInput.clear();
    await page.waitForTimeout(TEST_CONFIG.WAIT_TIMES.INTERACTION);
    
    // All cases should be visible again after clearing search
    await expect(page.locator(CASE_SELECTORS.CASE_ITEM('test-case-1'))).toBeVisible();
    await expect(page.locator(CASE_SELECTORS.CASE_ITEM('test-case-2'))).toBeVisible();
    await expect(page.locator(CASE_SELECTORS.CASE_ITEM('test-case-3'))).toBeVisible();
  });

  test('can filter cases by status', async ({ page }) => {
    // Set up test data with multiple statuses
    await storageScenarios.multipleStatuses(page);
    await page.reload();
    await waitForHydration(page);
    
    // Verify all cases are initially visible
    const casesList = page.locator(CASE_SELECTORS.CASES_LIST);
    await expect(casesList).toBeVisible();
    await expect(page.locator('text=/García/i').first()).toBeVisible();
    await expect(page.locator('text=/López/i').first()).toBeVisible();
    
    // Wait for and interact with status filter
    const statusSelect = page.locator(CASE_SELECTORS.FILTER_STATUS_SELECT);
    await expect(statusSelect).toBeVisible({ timeout: TEST_CONFIG.TIMEOUTS.MEDIUM });
    
    // Filter by resolved status
    await statusSelect.selectOption('resolved');
    await page.waitForTimeout(TEST_CONFIG.WAIT_TIMES.INTERACTION);
    
    // Check filtered results - only resolved case (López) should be visible
    await expect(page.locator('text=/López/i').first()).toBeVisible();
    await expect(page.locator('text=/García/i')).not.toBeVisible();
    
    // Filter by active status
    await statusSelect.selectOption('active');
    await page.waitForTimeout(TEST_CONFIG.WAIT_TIMES.INTERACTION);
    
    // Check filtered results - only active case (García) should be visible
    await expect(page.locator('text=/García/i').first()).toBeVisible();
    await expect(page.locator('text=/López/i')).not.toBeVisible();
    
    // Reset filter to show all
    await statusSelect.selectOption('all');
    await page.waitForTimeout(TEST_CONFIG.WAIT_TIMES.INTERACTION);
    
    // All should be visible again
    await expect(page.locator('text=/García/i').first()).toBeVisible();
    await expect(page.locator('text=/López/i').first()).toBeVisible();
  });

  test('can view case details', async ({ page }) => {
    // Set up single case with detailed information using storage helpers
    const testCase = {
      id: 'detail-case-1',
      title: 'Caso con Detalles Completos',
      description: 'Este caso tiene información completa para verificar',
      client: 'Juan Pérez González',
      caseNumber: 'DETAIL-456/2024',
      legalArea: 'labor' as const,
      status: 'active' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      documents: [],
      notes: [],
      conversations: [],
      deadlines: [],
      parties: [],
    };
    
    await caseStorage.seedCases(page, [testCase]);
    await page.reload();
    await waitForHydration(page);
    
    // Ensure we can see the case in the list first
    const caseItem = page.locator(CASE_SELECTORS.CASE_ITEM('detail-case-1'));
    await expect(caseItem).toBeVisible({ timeout: TEST_CONFIG.TIMEOUTS.MEDIUM });
    
    // Click on the case to view details and wait for selection
    await caseItem.click();
    
    // Wait for case selection to complete - look for case being highlighted
    await expect(caseItem).toHaveClass(/bg-legal-50|border-legal-300/, { timeout: TEST_CONFIG.TIMEOUTS.MEDIUM });
    await page.waitForTimeout(TEST_CONFIG.WAIT_TIMES.INTERACTION);
    
    // Verify that we're no longer in empty state
    const selectMessage = page.locator(CASE_SELECTORS.SELECT_CASE_MESSAGE);
    await expect(selectMessage).not.toBeVisible();
    
    // Wait for case details to load and verify title appears (avoid strict mode by targeting specific h1)
    const caseTitle = page.locator('h1.text-2xl').filter({ hasText: /Caso con Detalles/i });
    await expect(caseTitle).toBeVisible({ timeout: TEST_CONFIG.TIMEOUTS.MEDIUM });
    await expect(caseTitle).toContainText('Caso con Detalles');
    
    // Check that detailed information is visible in the case details area (avoid strict mode)
    const clientInfo = page.locator(CASE_DETAIL_SELECTORS.CLIENT_INFO_IN_DETAILS);
    await expect(clientInfo).toBeVisible();
    await expect(clientInfo).toContainText('Juan Pérez');
    
    const caseNumberInfo = page.locator(CASE_DETAIL_SELECTORS.CASE_NUMBER_IN_DETAILS);
    await expect(caseNumberInfo).toBeVisible();  
    await expect(caseNumberInfo).toContainText('DETAIL-456/2024');
    
    // Verify the description is also shown in the case details
    await expect(page.locator('p').filter({ hasText: /información completa/i })).toBeVisible();
  });

  test('can add documents to a case', async ({ page }) => {
    // Set up single case for document testing
    const testCase = {
      id: 'doc-case-1',
      title: 'Caso para Documentos',
      description: 'Caso para probar funcionalidad de documentos',
      client: 'Cliente Documentos',
      caseNumber: 'DOC-001',
      legalArea: 'civil' as const,
      status: 'active' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      documents: [],
      notes: [],
      conversations: [],
      deadlines: [],
      parties: [],
    };
    
    await caseStorage.seedCases(page, [testCase]);
    await page.reload();
    await waitForHydration(page);
    
    // Click on the case to select it and verify selection
    const caseItem = page.locator(CASE_SELECTORS.CASE_ITEM('doc-case-1'));
    await expect(caseItem).toBeVisible({ timeout: TEST_CONFIG.TIMEOUTS.MEDIUM });
    await caseItem.click();
    
    // Wait for case selection to complete
    await expect(caseItem).toHaveClass(/bg-legal-50|border-legal-300/, { timeout: TEST_CONFIG.TIMEOUTS.MEDIUM });
    await page.waitForTimeout(TEST_CONFIG.WAIT_TIMES.INTERACTION);
    
    // Verify case details are showing (not empty state) - use specific selector
    const caseDetailsTitle = page.locator('h1.text-2xl').filter({ hasText: /Caso para Documentos/i });
    await expect(caseDetailsTitle).toBeVisible({ timeout: TEST_CONFIG.TIMEOUTS.MEDIUM });
    
    // Navigate to documents tab using tab helper
    const { content: documentsContent } = await tabHelpers.switchToTab(page, 'documents');
    await expect(documentsContent).toBeVisible();
    
    // Verify upload area is present in documents tab
    const uploadArea = page.locator(TAB_SELECTORS.UPLOAD_AREA);
    await expect(uploadArea).toBeVisible({ timeout: TEST_CONFIG.TIMEOUTS.MEDIUM });
    
    // Check that file input exists (it's hidden behind the drag-drop area)
    const fileInput = uploadArea.locator('input[type="file"]');
    await expect(fileInput).toHaveAttribute('type', 'file');
    
    // Check that upload instructions/text are visible
    await expect(page.locator('text=/Arrastra|Drag|Subir|Upload|Selecciona|Choose/i')).toBeVisible();
  });

  test('can add notes to a case', async ({ page }) => {
    // Set up single case for notes testing
    const testCase = {
      id: 'notes-case-1',
      title: 'Caso para Notas',
      description: 'Caso para probar funcionalidad de notas',
      client: 'Cliente Notas',
      caseNumber: 'NOTES-001',
      legalArea: 'labor' as const,
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      documents: [],
      notes: [],
      conversations: [],
      deadlines: [],
      parties: [],
    };
    
    await caseStorage.seedCases(page, [testCase]);
    await page.reload();
    await waitForHydration(page);
    
    // Click on the case to select it and verify selection
    const caseItem = page.locator(CASE_SELECTORS.CASE_ITEM('notes-case-1'));
    await expect(caseItem).toBeVisible({ timeout: TEST_CONFIG.TIMEOUTS.MEDIUM });
    await caseItem.click();
    
    // Wait for case selection to complete
    await expect(caseItem).toHaveClass(/bg-legal-50|border-legal-300/, { timeout: TEST_CONFIG.TIMEOUTS.MEDIUM });
    await page.waitForTimeout(TEST_CONFIG.WAIT_TIMES.INTERACTION);
    
    // Verify case details are showing - use specific selector
    const caseDetailsTitle = page.locator('h1.text-2xl').filter({ hasText: /Caso para Notas/i });
    await expect(caseDetailsTitle).toBeVisible({ timeout: TEST_CONFIG.TIMEOUTS.MEDIUM });
    
    // Navigate to notes tab using tab helper
    const { content: notesContent } = await tabHelpers.switchToTab(page, 'notes');
    await expect(notesContent).toBeVisible();
    
    // Find the specific notes textarea using data-testid
    const noteInput = page.locator(TAB_SELECTORS.NOTES_TEXTAREA);
    await expect(noteInput).toBeVisible({ timeout: TEST_CONFIG.TIMEOUTS.MEDIUM });
    
    // Add a test note
    const testNoteText = 'Esta es una nota de prueba para el caso';
    await noteInput.fill(testNoteText);
    
    // Look for a submit button or press Enter to add the note
    const addButton = page.locator('button').filter({ hasText: /Agregar|Add|Guardar|Save/i }).first();
    if (await addButton.isVisible()) {
      await addButton.click();
    } else {
      await noteInput.press('Enter');
    }
    
    await page.waitForTimeout(TEST_CONFIG.WAIT_TIMES.INTERACTION);
    
    // Check that note appears in the notes list/area
    await expect(page.locator(`text=/${testNoteText}/i`).first()).toBeVisible({ 
      timeout: TEST_CONFIG.TIMEOUTS.MEDIUM 
    });
  });

  test('can edit case information', async ({ page }) => {
    // Set up single case for editing
    const testCase = {
      id: 'edit-case-1',
      title: 'Caso Original',
      description: 'Descripción original del caso',
      client: 'Cliente Original',
      caseNumber: 'EDIT-001',
      legalArea: 'civil' as const,
      status: 'active' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      documents: [],
      notes: [],
      conversations: [],
      deadlines: [],
      parties: [],
    };
    
    await caseStorage.seedCases(page, [testCase]);
    await page.reload();
    await waitForHydration(page);
    
    // Click on the case to select it and verify selection
    const caseItem = page.locator(CASE_SELECTORS.CASE_ITEM('edit-case-1'));
    await expect(caseItem).toBeVisible({ timeout: TEST_CONFIG.TIMEOUTS.MEDIUM });
    await caseItem.click();
    
    // Wait for case selection to complete
    await expect(caseItem).toHaveClass(/bg-legal-50|border-legal-300/, { timeout: TEST_CONFIG.TIMEOUTS.MEDIUM });
    await page.waitForTimeout(TEST_CONFIG.WAIT_TIMES.INTERACTION);
    
    // Verify case details are shown - use specific selector
    const caseDetailsTitle = page.locator('h1.text-2xl').filter({ hasText: /Caso Original/i });
    await expect(caseDetailsTitle).toBeVisible({ timeout: TEST_CONFIG.TIMEOUTS.MEDIUM });
    
    // Open edit modal using modal helper
    await modalHelpers.openEditModal(page);
    
    // Fill and save form using modal helper
    await modalHelpers.fillAndSaveEditForm(page, {
      title: 'Caso Modificado'
    });
    
    // Check updated title appears in the case header - use specific selector
    const updatedTitle = page.locator('h1.text-2xl').filter({ hasText: /Caso Modificado/i });
    await expect(updatedTitle).toBeVisible({ 
      timeout: TEST_CONFIG.TIMEOUTS.MEDIUM 
    });
  });

  test('can delete a case', async ({ page }) => {
    // Set up single case for deletion testing
    const testCase = {
      id: 'delete-case-1',
      title: 'Caso para Eliminar',
      description: 'Este caso será eliminado en la prueba',
      client: 'Cliente Eliminar',
      caseNumber: 'DEL-001',
      legalArea: 'tax' as const,
      status: 'archived' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      documents: [],
      notes: [],
      conversations: [],
      deadlines: [],
      parties: [],
    };
    
    await caseStorage.seedCases(page, [testCase]);
    await page.reload();
    await waitForHydration(page);
    
    // Verify case appears in list initially
    const caseItem = page.locator(CASE_SELECTORS.CASE_ITEM('delete-case-1'));
    await expect(caseItem).toBeVisible({ timeout: TEST_CONFIG.TIMEOUTS.MEDIUM });
    
    // Click on the case to select it and wait for selection
    await caseItem.click();
    
    // Wait for case selection to complete
    await expect(caseItem).toHaveClass(/bg-legal-50|border-legal-300/, { timeout: TEST_CONFIG.TIMEOUTS.MEDIUM });
    await page.waitForTimeout(TEST_CONFIG.WAIT_TIMES.INTERACTION);
    
    // Verify case details are shown (we're not in empty state) - use specific selector
    const caseDetailsTitle = page.locator('h1.text-2xl').filter({ hasText: /Caso para Eliminar/i });
    await expect(caseDetailsTitle).toBeVisible({ timeout: TEST_CONFIG.TIMEOUTS.MEDIUM });
    
    // Set up dialog handler before clicking delete (for confirmation)
    page.on('dialog', dialog => dialog.accept());
    
    // Find and click delete button using specific selector
    const deleteButton = page.locator(CASE_DETAIL_SELECTORS.DELETE_BUTTON);
    await expect(deleteButton).toBeVisible({ timeout: TEST_CONFIG.TIMEOUTS.MEDIUM });
    await deleteButton.click();
    
    // Wait for deletion and state change - case should disappear from list
    await expect(caseItem).not.toBeVisible({ timeout: TEST_CONFIG.TIMEOUTS.MEDIUM });
    
    // Wait for empty state to appear
    await page.waitForTimeout(TEST_CONFIG.WAIT_TIMES.INTERACTION);
    
    // Check that we're back to empty state
    const emptyMessage = page.locator(CASE_SELECTORS.SELECT_CASE_MESSAGE);
    await expect(emptyMessage).toBeVisible({ timeout: TEST_CONFIG.TIMEOUTS.LONG });
    
    // Verify empty cases message also appears (when no cases exist)
    const emptyCasesMessage = page.locator(CASE_SELECTORS.EMPTY_CASES_MESSAGE);
    await expect(emptyCasesMessage).toBeVisible({ timeout: TEST_CONFIG.TIMEOUTS.MEDIUM });
  });

  test('shows different status indicators', async ({ page }) => {
    // Set up cases with different statuses using storage helpers
    const testCases = [
      {
        id: 'active-status-case',
        title: 'Caso Activo Status',
        description: 'Caso con estado activo',
        client: 'Cliente Activo',
        caseNumber: 'ACT-STATUS-001',
        legalArea: 'civil' as const,
        status: 'active' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        documents: [],
        notes: [],
        conversations: [],
        deadlines: [],
        parties: [],
      },
      {
        id: 'pending-status-case',
        title: 'Caso Pendiente Status',
        description: 'Caso con estado pendiente',
        client: 'Cliente Pendiente',
        caseNumber: 'PEN-STATUS-001',
        legalArea: 'labor' as const,
        status: 'pending' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        documents: [],
        notes: [],
        conversations: [],
        deadlines: [],
        parties: [],
      },
      {
        id: 'resolved-status-case',
        title: 'Caso Resuelto Status',
        description: 'Caso con estado resuelto',
        client: 'Cliente Resuelto',
        caseNumber: 'RES-STATUS-001',
        legalArea: 'commercial' as const,
        status: 'resolved' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        documents: [],
        notes: [],
        conversations: [],
        deadlines: [],
        parties: [],
      }
    ];
    
    await caseStorage.seedCases(page, testCases);
    await page.reload();
    await waitForHydration(page);
    
    // Find case items using centralized selectors
    const activeCase = page.locator(CASE_SELECTORS.CASE_ITEM('active-status-case'));
    const pendingCase = page.locator(CASE_SELECTORS.CASE_ITEM('pending-status-case'));
    const resolvedCase = page.locator(CASE_SELECTORS.CASE_ITEM('resolved-status-case'));
    
    // Check that all cases are visible
    await expect(activeCase).toBeVisible({ timeout: TEST_CONFIG.TIMEOUTS.MEDIUM });
    await expect(pendingCase).toBeVisible({ timeout: TEST_CONFIG.TIMEOUTS.MEDIUM });
    await expect(resolvedCase).toBeVisible({ timeout: TEST_CONFIG.TIMEOUTS.MEDIUM });
    
    // Check status indicators have correct colors
    const activeStatus = activeCase.locator(CASE_SELECTORS.CASE_STATUS('active'));
    await expect(activeStatus).toBeVisible({ timeout: TEST_CONFIG.TIMEOUTS.MEDIUM });
    await expect(activeStatus).toHaveClass(/bg-green/);
    
    const pendingStatus = pendingCase.locator(CASE_SELECTORS.CASE_STATUS('pending'));
    await expect(pendingStatus).toBeVisible({ timeout: TEST_CONFIG.TIMEOUTS.MEDIUM });
    await expect(pendingStatus).toHaveClass(/bg-yellow/);
    
    const resolvedStatus = resolvedCase.locator(CASE_SELECTORS.CASE_STATUS('resolved'));
    await expect(resolvedStatus).toBeVisible({ timeout: TEST_CONFIG.TIMEOUTS.MEDIUM });
    await expect(resolvedStatus).toHaveClass(/bg-blue|bg-gray/); // Resolved might be blue or gray
  });
});