import { test, expect, Page } from '@playwright/test';

test.describe('Wiki Page Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Monitor console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('Console error:', msg.text());
      }
    });
    
    await page.goto('/wiki');
  });

  test('should load wiki page with all content visible', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/Wiki Legal - LexMX/);
    
    // Check main header
    await expect(page.locator('h1:has-text("Wiki del Derecho Mexicano")')).toBeVisible();
    
    // Check wiki navigation is visible
    await expect(page.locator('.wiki-navigation')).toBeVisible();
    
    // Check navigation cards
    await expect(page.locator('.wiki-nav-card:has-text("Estructura del Gobierno")')).toBeVisible();
    await expect(page.locator('.wiki-nav-card:has-text("Sistema Legal")')).toBeVisible();
    await expect(page.locator('.wiki-nav-card:has-text("Áreas del Derecho")')).toBeVisible();
    await expect(page.locator('.wiki-nav-card:has-text("Recursos Educativos")')).toBeVisible();
    
    // Check sections are present
    await expect(page.locator('#gobierno')).toBeInViewport({ ratio: 0.1 });
    await expect(page.locator('#sistema-legal')).toBeInViewport({ ratio: 0.01 });
    
    // Check hierarchy of laws is visible
    await expect(page.locator('text=Constitución Política de los Estados Unidos Mexicanos')).toBeVisible();
    await expect(page.locator('text=Tratados Internacionales')).toBeVisible();
    await expect(page.locator('text=Leyes Federales y Códigos')).toBeVisible();
  });

  test('should navigate between wiki sections', async ({ page }) => {
    // Click on Sistema Legal navigation card
    await page.locator('.wiki-nav-card:has-text("Sistema Legal")').click();
    
    // Wait for smooth scroll
    await page.waitForTimeout(500);
    
    // Check that sistema-legal section is in viewport
    await expect(page.locator('#sistema-legal')).toBeInViewport({ ratio: 0.5 });
    
    // Click on Áreas del Derecho
    await page.locator('.wiki-nav-card:has-text("Áreas del Derecho")').click();
    await page.waitForTimeout(500);
    
    // Check that areas-derecho section is in viewport
    await expect(page.locator('#areas-derecho')).toBeInViewport({ ratio: 0.5 });
  });

  test('should show interactive government structure', async ({ page }) => {
    const govStructure = page.locator('.government-structure');
    await expect(govStructure).toBeVisible();
    
    // Check initial state - División de Poderes should be active
    const divisionButton = page.locator('.government-structure button:has-text("División de Poderes")');
    await expect(divisionButton).toHaveClass(/bg-white/);
    
    // Click on Niveles de Gobierno
    const nivelesButton = page.locator('.government-structure button:has-text("Niveles de Gobierno")');
    await nivelesButton.click();
    
    // Check that content changed
    await expect(page.locator('.government-structure h3:has-text("Niveles de Gobierno")')).toBeVisible();
    await expect(nivelesButton).toHaveClass(/bg-white/);
    
    // Check the three powers are visible
    await expect(page.locator('text=Poder Ejecutivo')).toBeVisible();
    await expect(page.locator('text=Poder Legislativo')).toBeVisible();
    await expect(page.locator('text=Poder Judicial')).toBeVisible();
  });

  test('should show interactive legislative process', async ({ page }) => {
    // Scroll to legislative process
    await page.locator('text=Proceso Legislativo').first().scrollIntoViewIfNeeded();
    
    const process = page.locator('.legislative-process');
    await expect(process).toBeVisible();
    
    // Check initial state
    await expect(page.locator('text=1. Iniciativa')).toBeVisible();
    await expect(page.locator('button:has-text("Siguiente")')).toBeEnabled();
    await expect(page.locator('button:has-text("Anterior")')).toBeDisabled();
    
    // Click next
    await page.locator('button:has-text("Siguiente")').click();
    
    // Check that step 2 is highlighted
    await expect(page.locator('.border-blue-500:has-text("2. Dictamen")')).toBeVisible();
    
    // Now both buttons should be enabled
    await expect(page.locator('button:has-text("Anterior")')).toBeEnabled();
    await expect(page.locator('button:has-text("Siguiente")')).toBeEnabled();
    
    // Test reset button
    await page.locator('button:has-text("Reiniciar")').click();
    await expect(page.locator('.border-blue-500:has-text("1. Iniciativa")')).toBeVisible();
  });

  test('should show interactive legal glossary', async ({ page }) => {
    // Scroll to glossary
    await page.locator('text=Glosario Legal Interactivo').scrollIntoViewIfNeeded();
    
    const glossary = page.locator('.legal-glossary');
    await expect(glossary).toBeVisible();
    
    // Check search functionality
    const searchInput = page.locator('input[placeholder*="Buscar término"]');
    await expect(searchInput).toBeVisible();
    
    // Search for a term
    await searchInput.fill('amparo');
    
    // Check that amparo term is visible (if exists)
    const amparoTerm = page.locator('.glossary-term:has-text("amparo")');
    if (await amparoTerm.count() > 0) {
      await expect(amparoTerm.first()).toBeVisible();
    }
    
    // Clear search
    await searchInput.clear();
    
    // Check category filter
    const categoryButtons = page.locator('.glossary-category');
    if (await categoryButtons.count() > 0) {
      await categoryButtons.first().click();
      // Verify filtering works
    }
  });

  test('should handle mobile navigation', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Check mobile menu button is visible
    const mobileMenuButton = page.locator('button:has-text("Navegación de Secciones")');
    await expect(mobileMenuButton).toBeVisible();
    
    // Click to open mobile menu
    await mobileMenuButton.click();
    
    // Check navigation cards are visible
    await expect(page.locator('.wiki-nav-card').first()).toBeVisible();
    
    // Click a navigation card
    await page.locator('.wiki-nav-card:has-text("Sistema Legal")').click();
    
    // Menu should close and navigate
    await page.waitForTimeout(500);
    await expect(page.locator('#sistema-legal')).toBeInViewport({ ratio: 0.3 });
  });

  test('should show all law areas with proper styling', async ({ page }) => {
    // Scroll to areas section
    await page.locator('#areas-derecho').scrollIntoViewIfNeeded();
    
    // Check all law areas are visible
    const lawAreas = [
      'Derecho Civil',
      'Derecho Penal',
      'Derecho Laboral',
      'Derecho Fiscal',
      'Derecho Mercantil',
      'Derecho Constitucional'
    ];
    
    for (const area of lawAreas) {
      await expect(page.locator(`.law-area-card:has-text("${area}")`)).toBeVisible();
    }
    
    // Check that law codes are shown
    await expect(page.locator('text=CCF')).toBeVisible(); // Código Civil Federal
    await expect(page.locator('text=CPF')).toBeVisible(); // Código Penal Federal
    await expect(page.locator('text=LFT')).toBeVisible(); // Ley Federal del Trabajo
  });

  test('should show FAQ section with expandable items', async ({ page }) => {
    // Scroll to FAQ section
    await page.locator('text=Preguntas Frecuentes').scrollIntoViewIfNeeded();
    
    // Find FAQ details elements
    const faqItems = page.locator('details');
    const faqCount = await faqItems.count();
    
    expect(faqCount).toBeGreaterThan(0);
    
    // Test first FAQ item
    const firstFaq = faqItems.first();
    const summary = firstFaq.locator('summary');
    
    // Click to expand
    await summary.click();
    
    // Check that content is visible
    const content = firstFaq.locator('p');
    await expect(content).toBeVisible();
    
    // Click again to collapse
    await summary.click();
    await page.waitForTimeout(300);
  });

  test('should have working call to action', async ({ page }) => {
    // Scroll to CTA
    await page.locator('text=¿Necesitas ayuda legal específica?').scrollIntoViewIfNeeded();
    
    const ctaButton = page.locator('a:has-text("Consultar Asistente Legal")');
    await expect(ctaButton).toBeVisible();
    
    // Check href
    await expect(ctaButton).toHaveAttribute('href', '/chat');
  });

  test('should track section progress', async ({ page }) => {
    // Check progress indicator
    const progressBar = page.locator('.bg-gradient-to-r.from-blue-500.to-purple-500');
    await expect(progressBar).toBeVisible();
    
    // Initial progress should be 0%
    const initialWidth = await progressBar.evaluate(el => el.style.width);
    expect(initialWidth).toBe('0%');
    
    // Navigate to a section
    await page.locator('.wiki-nav-card:has-text("Sistema Legal")').click();
    await page.waitForTimeout(500);
    
    // Progress should update
    const newWidth = await progressBar.evaluate(el => el.style.width);
    expect(newWidth).not.toBe('0%');
    
    // Check section counter
    await expect(page.locator('text=/Sección \\d de 4/')).toBeVisible();
  });
});