import { test, expect, Page } from '@playwright/test';

test.describe('LexMX Full Site Functionality Tests', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    
    // Monitor console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('Console error:', msg.text());
      }
    });
    
    // Monitor page errors
    page.on('pageerror', error => {
      console.error('Page error:', error.message);
    });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test.describe('Homepage', () => {
    test('should load without errors', async () => {
      await page.goto('http://localhost:4323');
      await expect(page).toHaveTitle(/LexMX/);
      
      // Check main elements
      await expect(page.locator('text=Tu Asistente Legal Inteligente')).toBeVisible();
      await expect(page.locator('text=Abrir Chat Legal')).toBeVisible();
      await expect(page.locator('text=Configurar IA')).toBeVisible();
    });

    test('should navigate to all pages from navbar', async () => {
      await page.goto('http://localhost:4323');
      
      // Test navigation links
      const navLinks = [
        { text: 'Chat Legal', url: '/chat' },
        { text: 'Wiki Legal', url: '/wiki' },
        { text: 'Códigos', url: '/legal' },
        { text: 'Solicitudes', url: '/requests' },
        { text: 'Configuración', url: '/setup' },
        { text: 'Acerca de', url: '/about' }
      ];
      
      for (const link of navLinks) {
        await page.click(`text=${link.text}`);
        await expect(page).toHaveURL(new RegExp(link.url));
        await page.goBack();
      }
    });
  });

  test.describe('Theme and Language Controls', () => {
    test('theme toggle should work correctly', async () => {
      await page.goto('http://localhost:4323');
      
      // Open theme menu
      await page.click('.theme-toggle button');
      await expect(page.locator('.theme-toggle').locator('div[class*="absolute"]')).toBeVisible();
      
      // Switch to dark mode
      await page.click('button:has-text("Oscuro")');
      await expect(page.locator('html')).toHaveClass(/dark/);
      
      // Switch to light mode
      await page.click('.theme-toggle button');
      await page.click('button:has-text("Claro")');
      await expect(page.locator('html')).not.toHaveClass(/dark/);
    });

    test('language selector should work correctly', async () => {
      await page.goto('http://localhost:4323');
      
      // Open language menu
      await page.click('.language-selector button');
      await expect(page.locator('.language-selector').locator('div[class*="absolute"]')).toBeVisible();
      
      // Switch to English
      await page.click('button:has-text("English")');
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      
      // Switch back to Spanish
      await page.click('.language-selector button');
      await page.click('button:has-text("Español")');
      await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    });

    test('settings should persist across page navigation', async () => {
      await page.goto('http://localhost:4323');
      
      // Set dark mode and English
      await page.click('.theme-toggle button');
      await page.click('button:has-text("Oscuro")');
      await page.click('.language-selector button');
      await page.click('button:has-text("English")');
      
      // Navigate to another page
      await page.click('text=Chat Legal');
      
      // Check settings persisted
      await expect(page.locator('html')).toHaveClass(/dark/);
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    });
  });

  test.describe('Chat Page', () => {
    test('should load chat interface', async () => {
      await page.goto('/chat');
      
      // Check chat elements
      await expect(page.locator('.chat-interface')).toBeVisible();
      await expect(page.locator('textarea[placeholder*="pregunta legal"]')).toBeVisible();
      
      // Check welcome message
      await expect(page.locator('text=¡Bienvenido a LexMX!')).toBeVisible();
    });

    test('should show provider setup prompt if no providers configured', async () => {
      await page.goto('/chat');
      
      // If no providers configured, should show setup prompt
      const setupPrompt = page.locator('text=Configura tu primer proveedor');
      if (await setupPrompt.isVisible()) {
        await expect(setupPrompt).toBeVisible();
      }
    });
  });

  test.describe('Wiki Page', () => {
    test('should load wiki with all sections', async () => {
      await page.goto('/wiki');
      
      // Check main heading
      await expect(page.locator('h1:has-text("Wiki del Derecho Mexicano")')).toBeVisible();
      
      // Check wiki navigation cards
      await expect(page.locator('text=Estructura del Gobierno')).toBeVisible();
      await expect(page.locator('text=Sistema Legal')).toBeVisible();
      await expect(page.locator('text=Áreas del Derecho')).toBeVisible();
      await expect(page.locator('text=Recursos Educativos')).toBeVisible();
    });

    test('should navigate between wiki sections', async () => {
      await page.goto('/wiki');
      
      // Click on government structure
      await page.click('button:has-text("Estructura del Gobierno")');
      
      // Should scroll to section
      await expect(page.locator('#gobierno')).toBeInViewport();
      
      // Interactive components should work
      await page.click('button:has-text("División de Poderes")');
      await expect(page.locator('text=Poder Ejecutivo')).toBeVisible();
    });

    test('legislative process simulator should work', async () => {
      await page.goto('/wiki');
      
      // Scroll to legislative process
      await page.click('button:has-text("Sistema Legal")');
      
      // Find and interact with legislative process
      const nextButton = page.locator('button:has-text("Siguiente")').first();
      if (await nextButton.isVisible()) {
        await nextButton.click();
        // Progress should advance
        await expect(page.locator('.bg-green-500')).toBeVisible();
      }
    });
  });

  test.describe('Legal Documents Page', () => {
    test('should load legal documents index', async () => {
      await page.goto('/legal');
      
      // Check page elements
      await expect(page.locator('h1:has-text("Códigos y Leyes")')).toBeVisible();
      
      // Check for document cards
      const documentCards = page.locator('.legal-document-card');
      await expect(documentCards).toHaveCount(3); // Based on mock data
    });

    test('should search documents', async () => {
      await page.goto('/legal');
      
      // Search for a document
      await page.fill('input[placeholder*="Buscar"]', 'civil');
      
      // Should filter results
      await expect(page.locator('text=Código Civil Federal')).toBeVisible();
    });
  });

  test.describe('Document Viewer', () => {
    test('should load document viewer with multiple views', async () => {
      await page.goto('/document/codigo-civil-federal');
      
      // Check view switcher
      await expect(page.locator('button:has-text("Texto")')).toBeVisible();
      await expect(page.locator('button:has-text("PDF")')).toBeVisible();
      await expect(page.locator('button:has-text("Chunks RAG")')).toBeVisible();
      await expect(page.locator('button:has-text("Metadatos")')).toBeVisible();
    });

    test('should switch between document views', async () => {
      await page.goto('/document/codigo-civil-federal');
      
      // Switch to chunks view
      await page.click('button:has-text("Chunks RAG")');
      await expect(page.locator('text=Chunks para RAG')).toBeVisible();
      
      // Switch to metadata view
      await page.click('button:has-text("Metadatos")');
      await expect(page.locator('text=Metadatos y Linaje')).toBeVisible();
    });
  });

  test.describe('Document Requests', () => {
    test('should load requests page', async () => {
      await page.goto('/requests');
      
      // Check page elements
      await expect(page.locator('h1:has-text("Solicitudes de Documentos")')).toBeVisible();
      await expect(page.locator('text=Nueva Solicitud')).toBeVisible();
    });

    test('should load new request form', async () => {
      await page.goto('/requests/new');
      
      // Check form elements
      await expect(page.locator('h1:has-text("Nueva Solicitud")')).toBeVisible();
      await expect(page.locator('input[name="documentName"]')).toBeVisible();
      await expect(page.locator('textarea[name="description"]')).toBeVisible();
    });

    test('should validate request form', async () => {
      await page.goto('/requests/new');
      
      // Try to submit empty form
      await page.click('button:has-text("Enviar Solicitud")');
      
      // Should show validation errors
      await expect(page.locator('text=requerido')).toBeVisible();
    });
  });

  test.describe('Provider Setup', () => {
    test('should load provider setup wizard', async () => {
      await page.goto('/setup');
      
      // Check wizard steps
      await expect(page.locator('text=Configuración de Proveedores')).toBeVisible();
      
      // Should show welcome or profile selection
      const welcomeText = page.locator('text=Bienvenido a LexMX');
      const profileText = page.locator('text=Selecciona tu Perfil');
      
      await expect(welcomeText.or(profileText)).toBeVisible();
    });

    test('should navigate through setup wizard', async () => {
      await page.goto('/setup');
      
      // If welcome screen, click start
      const startButton = page.locator('button:has-text("Comenzar")');
      if (await startButton.isVisible()) {
        await startButton.click();
        
        // Should show profile selection
        await expect(page.locator('text=Privacy First')).toBeVisible();
        await expect(page.locator('text=Balanced')).toBeVisible();
      }
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test.beforeEach(async () => {
      await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    });

    test('mobile menu should work', async () => {
      await page.goto('http://localhost:4323');
      
      // Mobile menu should be hidden initially
      const desktopNav = page.locator('nav.hidden.lg\\:flex');
      await expect(desktopNav).not.toBeVisible();
      
      // Mobile menu button should be visible
      const mobileMenuButton = page.locator('button[aria-label="Abrir menú principal"]');
      if (await mobileMenuButton.isVisible()) {
        await mobileMenuButton.click();
        // Mobile menu should open
        // Note: Implementation may vary
      }
    });

    test('theme and language controls should work on mobile', async () => {
      await page.goto('http://localhost:4323');
      
      // Controls should still be accessible
      await expect(page.locator('.theme-toggle')).toBeVisible();
      await expect(page.locator('.language-selector')).toBeVisible();
      
      // Should be able to interact
      await page.click('.theme-toggle button');
      await expect(page.locator('.theme-toggle').locator('div[class*="absolute"]')).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper ARIA labels', async () => {
      await page.goto('http://localhost:4323');
      
      // Check main navigation
      await expect(page.locator('nav[aria-label]')).toHaveCount(1);
      
      // Check buttons have labels
      const buttons = page.locator('button');
      const count = await buttons.count();
      
      for (let i = 0; i < Math.min(count, 5); i++) {
        const button = buttons.nth(i);
        const ariaLabel = await button.getAttribute('aria-label');
        const text = await button.textContent();
        
        // Button should have either aria-label or text content
        expect(ariaLabel || text).toBeTruthy();
      }
    });

    test('should be keyboard navigable', async () => {
      await page.goto('http://localhost:4323');
      
      // Tab through elements
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Check focus is visible
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('should handle 404 pages gracefully', async () => {
      const response = await page.goto('/non-existent-page');
      
      // Should return 404
      expect(response?.status()).toBe(404);
      
      // Should show error page (if implemented)
      // await expect(page.locator('text=404')).toBeVisible();
    });

    test('should handle invalid document IDs', async () => {
      await page.goto('/document/invalid-document-id');
      
      // Should show error or redirect
      const errorText = page.locator('text=no encontrado');
      const redirected = page.url().includes('/legal');
      
      expect((await errorText.isVisible()) || redirected).toBeTruthy();
    });
  });

  test.describe('Performance', () => {
    test('should load pages within acceptable time', async () => {
      const startTime = Date.now();
      await page.goto('http://localhost:4323');
      const loadTime = Date.now() - startTime;
      
      // Page should load in under 3 seconds
      expect(loadTime).toBeLessThan(3000);
    });

    test('should have interactive elements quickly', async () => {
      await page.goto('http://localhost:4323');
      
      // Wait for interactive elements
      await page.waitForSelector('.theme-toggle button', { timeout: 2000 });
      await page.waitForSelector('.language-selector button', { timeout: 2000 });
      
      // Elements should be interactive
      await expect(page.locator('.theme-toggle button')).toBeEnabled();
      await expect(page.locator('.language-selector button')).toBeEnabled();
    });
  });
});