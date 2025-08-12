import { test, expect, Page } from '@playwright/test';

test.describe('Document Request System Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate first
    await page.goto('/requests');
    
    // Setup mock user session
    await page.evaluate(() => {
      const mockUser = {
        id: 'test-user-123',
        name: 'Test User',
        email: 'test@example.com'
      };
      localStorage.setItem('lexmx_user', JSON.stringify(mockUser));
    });
    
    // Reload to pick up the session
    await page.reload();
  });

  test('should load request listing page', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/Solicitudes de Documentos - LexMX/);
    
    // Check main header
    await expect(page.locator('h1:has-text("Solicitudes de Documentos")')).toBeVisible();
    
    // Check request list container
    await expect(page.locator('.request-list, #request-list')).toBeVisible();
    
    // Check new request button
    await expect(page.locator('a[href="/requests/new"], button:has-text("Nueva Solicitud")')).toBeVisible();
    
    // Check filter options
    await expect(page.locator('text=/filtrar|ordenar/i')).toBeVisible();
  });

  test('should display existing requests', async ({ page }) => {
    // Check for request cards
    const requestCards = page.locator('.request-card, .request-item');
    await expect(requestCards.first()).toBeVisible();
    
    // Check request card contains required elements
    const firstCard = requestCards.first();
    await expect(firstCard.locator('.request-title, h3')).toBeVisible();
    await expect(firstCard.locator('.request-type, .badge')).toBeVisible();
    await expect(firstCard.locator('.vote-count, .votes')).toBeVisible();
    await expect(firstCard.locator('.request-status')).toBeVisible();
  });

  test('should navigate to new request form', async ({ page }) => {
    // Click new request button
    await page.click('a[href="/requests/new"], button:has-text("Nueva Solicitud")');
    
    // Should navigate to new request page
    await expect(page).toHaveURL(/\/requests\/new/);
    
    // Check form is visible
    await expect(page.locator('form, .request-form')).toBeVisible();
    await expect(page.locator('h1:has-text("Nueva Solicitud de Documento")')).toBeVisible();
  });

  test('should submit new document request', async ({ page }) => {
    // Navigate to new request form
    await page.goto('/requests/new');
    
    // Fill form fields
    const titleInput = page.locator('input[name="title"], input[placeholder*="título"]');
    await titleInput.fill('Ley de Protección de Datos Personales');
    
    const typeSelect = page.locator('select[name="type"], select[aria-label*="tipo"]');
    await typeSelect.selectOption('ley-federal');
    
    const descriptionTextarea = page.locator('textarea[name="description"], textarea[placeholder*="descripción"]');
    await descriptionTextarea.fill('Necesito acceso a la LFPDPPP actualizada con las últimas reformas para un caso de privacidad digital.');
    
    const justificationTextarea = page.locator('textarea[name="justification"], textarea[placeholder*="justificación"]');
    await justificationTextarea.fill('Es fundamental para casos de protección de datos en el ámbito digital.');
    
    // Check terms checkbox
    const termsCheckbox = page.locator('input[type="checkbox"][name="terms"]');
    await termsCheckbox.check();
    
    // Submit form
    await page.click('button[type="submit"], button:has-text("Enviar Solicitud")');
    
    // Should show success message or redirect
    await expect(page.locator('text=/enviada|éxito|gracias/i')).toBeVisible();
  });

  test('should validate request form', async ({ page }) => {
    await page.goto('/requests/new');
    
    // Try to submit empty form
    await page.click('button[type="submit"], button:has-text("Enviar Solicitud")');
    
    // Should show validation errors
    await expect(page.locator('text=/requerido|obligatorio/i')).toBeVisible();
    
    // Fill only title and try again
    const titleInput = page.locator('input[name="title"], input[placeholder*="título"]');
    await titleInput.fill('Test Title');
    await page.click('button[type="submit"]');
    
    // Should still show errors for other fields
    await expect(page.locator('text=/descripción.*requerida/i')).toBeVisible();
  });

  test('should filter requests by type', async ({ page }) => {
    // Look for filter dropdown
    const filterSelect = page.locator('select[aria-label*="filtrar"], select[name="filter"]');
    
    if (await filterSelect.isVisible()) {
      // Select a filter option
      await filterSelect.selectOption('ley-federal');
      
      // Check that only federal law requests are shown
      const requestTypes = page.locator('.request-type, .badge');
      const count = await requestTypes.count();
      
      for (let i = 0; i < count; i++) {
        const text = await requestTypes.nth(i).textContent();
        expect(text?.toLowerCase()).toContain('federal');
      }
    }
  });

  test('should sort requests', async ({ page }) => {
    // Look for sort dropdown
    const sortSelect = page.locator('select[aria-label*="ordenar"], select[name="sort"]');
    
    if (await sortSelect.isVisible()) {
      // Sort by most voted
      await sortSelect.selectOption('votes');
      
      // Get vote counts
      const voteCounts = await page.locator('.vote-count').allTextContents();
      const numbers = voteCounts.map(v => parseInt(v) || 0);
      
      // Check descending order
      for (let i = 1; i < numbers.length; i++) {
        expect(numbers[i]).toBeLessThanOrEqual(numbers[i - 1]);
      }
    }
  });

  test('should vote on requests', async ({ page }) => {
    // Find vote button on first request
    const voteButton = page.locator('.vote-button, button[aria-label*="votar"]').first();
    
    if (await voteButton.isVisible()) {
      // Get initial vote count
      const voteCount = page.locator('.vote-count').first();
      const initialCount = parseInt(await voteCount.textContent() || '0');
      
      // Click vote button
      await voteButton.click();
      
      // Check vote count increased
      await page.waitForTimeout(500);
      const newCount = parseInt(await voteCount.textContent() || '0');
      expect(newCount).toBe(initialCount + 1);
      
      // Button should show voted state
      await expect(voteButton).toHaveClass(/voted|active/);
    }
  });

  test('should view request details', async ({ page }) => {
    // Click on first request
    const requestCard = page.locator('.request-card, .request-item').first();
    await requestCard.click();
    
    // Should navigate to detail page
    await expect(page).toHaveURL(/\/requests\/\d+/);
    
    // Check detail page elements
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.request-description')).toBeVisible();
    await expect(page.locator('.request-metadata')).toBeVisible();
    
    // Check comments section
    await expect(page.locator('text=/comentarios|opiniones/i')).toBeVisible();
  });

  test('should add comments to requests', async ({ page }) => {
    // Navigate to a request detail page
    const requestCard = page.locator('.request-card').first();
    await requestCard.click();
    
    // Find comment form
    const commentTextarea = page.locator('textarea[placeholder*="comentario"]');
    
    if (await commentTextarea.isVisible()) {
      // Add a comment
      await commentTextarea.fill('Este documento es muy importante para la comunidad legal.');
      
      // Submit comment
      await page.click('button:has-text("Comentar")');
      
      // Check comment appears
      await expect(page.locator('text=Este documento es muy importante')).toBeVisible();
    }
  });

  test('should show request status updates', async ({ page }) => {
    // Look for status badges
    const statusBadges = page.locator('.request-status, .status-badge');
    
    // Check different status types
    const statuses = ['pending', 'reviewing', 'approved', 'completed'];
    
    for (const status of statuses) {
      const badge = statusBadges.filter({ hasText: new RegExp(status, 'i') });
      if (await badge.count() > 0) {
        await expect(badge.first()).toBeVisible();
      }
    }
  });

  test('should show moderation panel for admins', async ({ page }) => {
    // Set admin user
    await page.evaluate(() => {
      const adminUser = {
        id: 'admin-123',
        name: 'Admin User',
        email: 'admin@lexmx.com',
        role: 'admin'
      };
      localStorage.setItem('lexmx_user', JSON.stringify(adminUser));
    });
    
    await page.reload();
    
    // Check for moderation controls
    const moderationPanel = page.locator('.moderation-panel, [data-admin-only]');
    
    if (await moderationPanel.isVisible()) {
      // Check for approve/reject buttons
      await expect(page.locator('button:has-text("Aprobar")')).toBeVisible();
      await expect(page.locator('button:has-text("Rechazar")')).toBeVisible();
    }
  });

  test('should search requests', async ({ page }) => {
    // Look for search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="buscar"]');
    
    if (await searchInput.isVisible()) {
      // Search for a specific term
      await searchInput.fill('código civil');
      await searchInput.press('Enter');
      
      // Check results are filtered
      await page.waitForTimeout(500);
      
      const results = page.locator('.request-card');
      if (await results.count() > 0) {
        const firstResult = results.first();
        const text = await firstResult.textContent();
        expect(text?.toLowerCase()).toContain('código');
      }
    }
  });

  test('should paginate results', async ({ page }) => {
    // Look for pagination
    const pagination = page.locator('.pagination, nav[aria-label*="paginación"]');
    
    if (await pagination.isVisible()) {
      // Check page numbers
      await expect(page.locator('button:has-text("1")')).toBeVisible();
      
      // Click next page if available
      const nextButton = page.locator('button:has-text("Siguiente"), button[aria-label*="siguiente"]');
      if (await nextButton.isEnabled()) {
        await nextButton.click();
        
        // URL should update
        await expect(page).toHaveURL(/page=2/);
        
        // New requests should be visible
        await expect(page.locator('.request-card').first()).toBeVisible();
      }
    }
  });

  test('should handle mobile view', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Check responsive layout
    await expect(page.locator('.request-list')).toBeVisible();
    
    // Cards should stack vertically
    const cards = page.locator('.request-card');
    if (await cards.count() >= 2) {
      const firstBox = await cards.first().boundingBox();
      const secondBox = await cards.nth(1).boundingBox();
      
      if (firstBox && secondBox) {
        expect(secondBox.y).toBeGreaterThan(firstBox.y + firstBox.height);
      }
    }
    
    // Check mobile menu
    const mobileMenu = page.locator('button[aria-label*="menú"], button[aria-label*="filtros"]');
    if (await mobileMenu.isVisible()) {
      await mobileMenu.click();
      await expect(page.locator('.mobile-filters')).toBeVisible();
    }
  });

  test('should show request statistics', async ({ page }) => {
    // Look for stats section
    const statsSection = page.locator('.request-stats, .statistics');
    
    if (await statsSection.isVisible()) {
      // Check for different metrics
      await expect(page.locator('text=/total.*solicitudes/i')).toBeVisible();
      await expect(page.locator('text=/pendientes/i')).toBeVisible();
      await expect(page.locator('text=/completadas/i')).toBeVisible();
    }
  });

  test('should export request data', async ({ page }) => {
    // Look for export button (admin feature)
    await page.evaluate(() => {
      const adminUser = {
        id: 'admin-123',
        name: 'Admin User',
        email: 'admin@lexmx.com',
        role: 'admin'
      };
      localStorage.setItem('lexmx_user', JSON.stringify(adminUser));
    });
    
    await page.reload();
    
    const exportButton = page.locator('button[aria-label*="exportar"], button:has-text("Exportar")');
    
    if (await exportButton.isVisible()) {
      await exportButton.click();
      
      // Should show export options
      await expect(page.locator('text=/CSV|JSON|PDF/i')).toBeVisible();
    }
  });
});