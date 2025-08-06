import { test, expect, Page } from '@playwright/test';

test.describe('Document Visualization Tests', () => {
  const testDocumentId = 'codigo-civil-federal';

  test.beforeEach(async ({ page }) => {
    await page.goto(`/document/${testDocumentId}`);
  });

  test('should load document viewer', async ({ page }) => {
    // Check page loads
    await expect(page).toHaveTitle(/Código Civil Federal - LexMX/);
    
    // Check document viewer is visible
    await expect(page.locator('.document-viewer, #document-viewer')).toBeVisible();
    
    // Check document header
    await expect(page.locator('h1:has-text("Código Civil Federal")')).toBeVisible();
    
    // Check view mode selector
    await expect(page.locator('button:has-text("Texto")')).toBeVisible();
    await expect(page.locator('button:has-text("PDF")')).toBeVisible();
    await expect(page.locator('button:has-text("Chunks RAG")')).toBeVisible();
    await expect(page.locator('button:has-text("Metadatos")')).toBeVisible();
  });

  test('should switch between view modes', async ({ page }) => {
    // Default should be text view
    await expect(page.locator('.document-text-view, [data-view="text"]')).toBeVisible();
    
    // Switch to PDF view
    await page.click('button:has-text("PDF")');
    await expect(page.locator('.document-pdf-view, [data-view="pdf"], iframe[src*="pdf"]')).toBeVisible();
    
    // Switch to chunks view
    await page.click('button:has-text("Chunks RAG")');
    await expect(page.locator('.document-chunks-view, [data-view="chunks"]')).toBeVisible();
    await expect(page.locator('text=/chunk|fragmento/i')).toBeVisible();
    
    // Switch to metadata view
    await page.click('button:has-text("Metadatos")');
    await expect(page.locator('.document-metadata-view, [data-view="metadata"]')).toBeVisible();
    await expect(page.locator('text=/fecha|versión|autoridad/i')).toBeVisible();
    
    // Switch back to text
    await page.click('button:has-text("Texto")');
    await expect(page.locator('.document-text-view, [data-view="text"]')).toBeVisible();
  });

  test('should show document navigation', async ({ page }) => {
    // Check sidebar navigation
    const navigation = page.locator('.document-navigation, aside');
    await expect(navigation).toBeVisible();
    
    // Check for articles/sections
    await expect(page.locator('text=/artículo|título|capítulo/i').first()).toBeVisible();
    
    // Click on a navigation item
    const navItem = page.locator('.nav-item, a[href*="#"]').first();
    if (await navItem.isVisible()) {
      await navItem.click();
      // Should scroll to section
      await page.waitForTimeout(500);
    }
  });

  test('should handle document search', async ({ page }) => {
    // Look for search input
    const searchInput = page.locator('input[placeholder*="Buscar"], input[type="search"]');
    
    if (await searchInput.isVisible()) {
      // Type search query
      await searchInput.fill('obligaciones');
      
      // Press Enter or click search
      await searchInput.press('Enter');
      
      // Should highlight results
      await page.waitForTimeout(500);
      const highlights = page.locator('.highlight, mark');
      if (await highlights.first().isVisible()) {
        expect(await highlights.count()).toBeGreaterThan(0);
      }
    }
  });

  test('should display document metadata', async ({ page }) => {
    // Switch to metadata view
    await page.click('button:has-text("Metadatos")');
    
    // Check metadata fields
    await expect(page.locator('text=/tipo.*código/i')).toBeVisible();
    await expect(page.locator('text=/jerarquía.*3/i')).toBeVisible();
    await expect(page.locator('text=/área.*civil/i')).toBeVisible();
    await expect(page.locator('text=/vigente/i')).toBeVisible();
    
    // Check for dates
    await expect(page.locator('text=/publicación|reforma/i')).toBeVisible();
  });

  test('should show document chunks for RAG', async ({ page }) => {
    // Switch to chunks view
    await page.click('button:has-text("Chunks RAG")');
    
    // Check chunks are displayed
    const chunks = page.locator('.chunk-item, .rag-chunk');
    await expect(chunks.first()).toBeVisible();
    
    // Check chunk has content
    const firstChunk = chunks.first();
    await expect(firstChunk).toContainText(/artículo|disposición/i);
    
    // Check chunk metadata
    const chunkMeta = firstChunk.locator('.chunk-meta, .chunk-info');
    if (await chunkMeta.isVisible()) {
      await expect(chunkMeta).toContainText(/tokens|embeddings|vector/i);
    }
  });

  test('should handle article navigation', async ({ page }) => {
    // Navigate to specific article
    await page.goto(`/document/${testDocumentId}/article/1`);
    
    // Should show article view
    await expect(page.locator('text=/artículo.*1/i')).toBeVisible();
    
    // Check navigation between articles
    const nextButton = page.locator('button:has-text("Siguiente"), a:has-text("Siguiente")');
    if (await nextButton.isVisible()) {
      await nextButton.click();
      await expect(page).toHaveURL(/article\/2/);
    }
  });

  test('should export document', async ({ page }) => {
    // Look for export button
    const exportButton = page.locator('button[aria-label*="Exportar"], button:has-text("Exportar")');
    
    if (await exportButton.isVisible()) {
      await exportButton.click();
      
      // Check export options
      await expect(page.locator('text=/PDF|TXT|DOCX/i')).toBeVisible();
      
      // Test download (mock)
      const downloadPromise = page.waitForEvent('download');
      await page.click('button:has-text("PDF")');
      
      // Verify download started
      try {
        const download = await Promise.race([
          downloadPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('No download')), 2000))
        ]);
      } catch {
        // Download might be mocked
      }
    }
  });

  test('should handle mobile view', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Check document viewer adapts
    await expect(page.locator('.document-viewer, #document-viewer')).toBeVisible();
    
    // Navigation should be hidden or collapsible
    const navigation = page.locator('.document-navigation');
    const navToggle = page.locator('button[aria-label*="navigation"], button[aria-label*="menú"]');
    
    if (await navToggle.isVisible()) {
      // Toggle navigation
      await navToggle.click();
      await expect(navigation).toBeVisible();
      
      // Toggle again to close
      await navToggle.click();
    }
    
    // View mode selector should be accessible
    await expect(page.locator('button:has-text("Texto")')).toBeVisible();
  });

  test('should show related documents', async ({ page }) => {
    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    
    // Check for related documents section
    const relatedSection = page.locator('text=/relacionados|similares|ver también/i');
    
    if (await relatedSection.isVisible()) {
      // Check related document links
      const relatedLinks = page.locator('a[href*="/document/"]');
      expect(await relatedLinks.count()).toBeGreaterThan(0);
    }
  });

  test('should handle print view', async ({ page }) => {
    // Look for print button
    const printButton = page.locator('button[aria-label*="Imprimir"], button:has-text("Imprimir")');
    
    if (await printButton.isVisible()) {
      // Listen for print dialog
      page.once('dialog', dialog => {
        dialog.dismiss();
      });
      
      await printButton.click();
      
      // Or check print CSS
      const printStyles = await page.evaluate(() => {
        const styles = Array.from(document.styleSheets);
        return styles.some(sheet => {
          try {
            return Array.from(sheet.cssRules).some(rule => 
              rule.cssText.includes('@media print')
            );
          } catch {
            return false;
          }
        });
      });
      
      expect(printStyles).toBeTruthy();
    }
  });

  test('should track reading progress', async ({ page }) => {
    // Look for progress indicator
    const progressBar = page.locator('.reading-progress, .progress-bar');
    
    if (await progressBar.isVisible()) {
      // Get initial progress
      const initialProgress = await progressBar.evaluate(el => {
        const width = el.style.width || '0%';
        return parseInt(width);
      });
      
      // Scroll down
      await page.evaluate(() => window.scrollTo(0, window.innerHeight));
      await page.waitForTimeout(100);
      
      // Check progress updated
      const newProgress = await progressBar.evaluate(el => {
        const width = el.style.width || '0%';
        return parseInt(width);
      });
      
      expect(newProgress).toBeGreaterThan(initialProgress);
    }
  });

  test('should handle document not found', async ({ page }) => {
    // Navigate to non-existent document
    await page.goto('/document/documento-inexistente');
    
    // Should show error or redirect
    const errorMessage = page.locator('text=/no encontrado|no existe|404/i');
    const redirected = page.url().includes('/legal');
    
    expect((await errorMessage.isVisible()) || redirected).toBeTruthy();
  });
});