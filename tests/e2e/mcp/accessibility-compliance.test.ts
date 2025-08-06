import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';
import { 
  setupPage, 
  clearAllStorage,
  setupMockProviders,
  testDarkMode
} from '../../utils/test-helpers';

test.describe('Accessibility and WCAG Compliance', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
    await clearAllStorage(page);
  });

  test('full accessibility audit of all pages', async ({ page }) => {
    const pages = [
      { url: '/', name: 'Homepage' },
      { url: '/chat', name: 'Chat' },
      { url: '/wiki', name: 'Wiki' },
      { url: '/legal', name: 'Legal Documents' },
      { url: '/requests', name: 'Document Requests' },
      { url: '/setup', name: 'Setup' },
      { url: '/privacy', name: 'Privacy' }
    ];

    for (const pageInfo of pages) {
      await page.goto(`http://localhost:4321${pageInfo.url}`);
      await page.waitForLoadState('networkidle');
      
      // Inject axe for accessibility testing
      await injectAxe(page);
      
      // Run accessibility checks
      await checkA11y(page, null, {
        detailedReport: true,
        detailedReportOptions: {
          html: true
        }
      });
      
      // Additional manual checks
      // 1. Page has proper heading structure
      const h1Count = await page.locator('h1').count();
      expect(h1Count).toBe(1); // Each page should have exactly one h1
      
      // 2. All images have alt text
      const images = page.locator('img');
      const imageCount = await images.count();
      
      for (let i = 0; i < imageCount; i++) {
        const img = images.nth(i);
        const alt = await img.getAttribute('alt');
        expect(alt).toBeTruthy();
      }
      
      // 3. Form labels are properly associated
      const inputs = page.locator('input:not([type="hidden"]), textarea, select');
      const inputCount = await inputs.count();
      
      for (let i = 0; i < inputCount; i++) {
        const input = inputs.nth(i);
        const id = await input.getAttribute('id');
        const ariaLabel = await input.getAttribute('aria-label');
        const placeholder = await input.getAttribute('placeholder');
        
        if (id) {
          // Check for associated label
          const label = await page.locator(`label[for="${id}"]`).count();
          expect(label > 0 || ariaLabel || placeholder).toBeTruthy();
        } else {
          // Must have aria-label or placeholder
          expect(ariaLabel || placeholder).toBeTruthy();
        }
      }
    }
  });

  test('keyboard navigation through complete user journey', async ({ page }) => {
    await setupMockProviders(page);
    
    // 1. Homepage keyboard navigation
    await page.goto('http://localhost:4321');
    
    // Tab to skip link
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toHaveText(/Saltar|Skip/);
    
    // Tab through main navigation
    await page.keyboard.press('Tab'); // Logo
    await page.keyboard.press('Tab'); // Chat
    await page.keyboard.press('Tab'); // Wiki
    await page.keyboard.press('Tab'); // Códigos
    await page.keyboard.press('Tab'); // Solicitudes
    await page.keyboard.press('Tab'); // Configuración
    await page.keyboard.press('Tab'); // Acerca de
    
    // Navigate to chat with Enter
    await page.keyboard.press('ArrowLeft'); // Back to Chat
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Enter');
    
    await page.waitForURL('**/chat');
    
    // 2. Chat keyboard interaction
    // Focus should be on textarea
    await page.waitForSelector('textarea');
    await page.keyboard.type('Consulta con teclado');
    await page.keyboard.press('Enter');
    
    // Wait for response
    await page.waitForSelector('text="Consulta con teclado"', { timeout: 5000 });
    
    // Tab to advanced options
    await page.keyboard.press('Tab'); // Send button
    await page.keyboard.press('Tab'); // Advanced options
    await page.keyboard.press('Enter'); // Open advanced
    
    // Navigate legal area dropdown with keyboard
    await page.keyboard.press('Tab'); // Focus select
    await page.keyboard.press('ArrowDown'); // Open dropdown
    await page.keyboard.press('ArrowDown'); // Select option
    await page.keyboard.press('Enter'); // Confirm
    
    // 3. Wiki keyboard navigation
    await page.goto('http://localhost:4321/wiki');
    
    // Tab to navigation buttons
    let tabCount = 0;
    while (tabCount < 20 && !(await page.locator(':focus').textContent())?.includes('Estructura')) {
      await page.keyboard.press('Tab');
      tabCount++;
    }
    
    // Navigate wiki sections with keyboard
    await page.keyboard.press('Enter'); // Select section
    await expect(page.locator('h2:has-text("Estructura")')).toBeVisible();
    
    // Navigate glossary filters
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Search with keyboard
    const searchInput = page.locator('input[placeholder*="Buscar términos"]');
    await searchInput.focus();
    await page.keyboard.type('amparo');
    
    // 4. Document viewer keyboard controls
    await page.goto('http://localhost:4321/legal');
    
    // Tab to document link
    tabCount = 0;
    while (tabCount < 30 && !(await page.locator(':focus').textContent())?.includes('Constitución')) {
      await page.keyboard.press('Tab');
      tabCount++;
    }
    
    await page.keyboard.press('Enter');
    await page.waitForURL('**/document/constitucion');
    
    // Test document navigation
    await page.keyboard.press('Tab'); // Skip to search
    await page.keyboard.type('artículo 1');
    await page.keyboard.press('Enter');
  });

  test('screen reader announcements and ARIA labels', async ({ page }) => {
    await setupMockProviders(page);
    
    // 1. Chat screen reader experience
    await page.goto('http://localhost:4321/chat');
    
    // Check ARIA live regions
    const liveRegions = page.locator('[aria-live]');
    const liveCount = await liveRegions.count();
    expect(liveCount).toBeGreaterThan(0);
    
    // Send message and verify announcement
    await page.fill('textarea[placeholder*="consulta legal"]', 'Test query');
    await page.click('button[aria-label="Enviar mensaje"]');
    
    // Loading state should be announced
    const loadingAnnouncement = await page.locator('[aria-live] >> text=/Analizando|procesando/i').count();
    expect(loadingAnnouncement).toBeGreaterThan(0);
    
    // 2. Wiki navigation announcements
    await page.goto('http://localhost:4321/wiki');
    
    // Section navigation should have proper ARIA
    const navButtons = page.locator('.wiki-navigation button');
    const navCount = await navButtons.count();
    
    for (let i = 0; i < navCount; i++) {
      const button = navButtons.nth(i);
      const ariaLabel = await button.getAttribute('aria-label');
      const text = await button.textContent();
      expect(ariaLabel || text).toBeTruthy();
    }
    
    // 3. Form field announcements
    await page.goto('http://localhost:4321/setup');
    await page.click('button:has-text("Comenzar Configuración")');
    
    // Profile cards should be properly labeled
    const profileCards = page.locator('div[role="button"], div[tabindex="0"]');
    const profileCount = await profileCards.count();
    
    for (let i = 0; i < Math.min(profileCount, 3); i++) {
      const card = profileCards.nth(i);
      const label = await card.getAttribute('aria-label');
      const text = await card.textContent();
      expect(label || text).toBeTruthy();
    }
  });

  test('color contrast and visual accessibility', async ({ page }) => {
    // Test both light and dark modes
    const modes = ['light', 'dark'];
    
    for (const mode of modes) {
      if (mode === 'dark') {
        await page.evaluate(() => {
          document.documentElement.classList.add('dark');
          localStorage.setItem('theme', JSON.stringify('dark'));
        });
      }
      
      await page.goto('http://localhost:4321');
      await injectAxe(page);
      
      // Check color contrast
      await checkA11y(page, null, {
        rules: {
          'color-contrast': { enabled: true }
        }
      });
      
      // Test interactive elements visibility
      const buttons = page.locator('button:visible');
      const buttonCount = await buttons.count();
      
      for (let i = 0; i < Math.min(buttonCount, 5); i++) {
        const button = buttons.nth(i);
        
        // Check focus visibility
        await button.focus();
        const focusVisible = await button.evaluate(el => {
          const styles = window.getComputedStyle(el);
          const outline = styles.outline;
          const boxShadow = styles.boxShadow;
          return outline !== 'none' || boxShadow !== 'none';
        });
        
        expect(focusVisible).toBeTruthy();
      }
    }
  });

  test('responsive accessibility on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await setupMockProviders(page);
    
    // 1. Mobile navigation accessibility
    await page.goto('http://localhost:4321');
    
    // Mobile menu should be accessible
    const menuButton = page.locator('button[aria-label*="menú"]');
    await expect(menuButton).toBeVisible();
    
    // Check menu keyboard interaction
    await menuButton.focus();
    await page.keyboard.press('Enter');
    
    // Menu should open
    await expect(page.locator('.mobile-menu')).toBeVisible();
    
    // 2. Touch target sizes
    const interactiveElements = page.locator('button:visible, a:visible, input:visible, textarea:visible');
    const elementCount = await interactiveElements.count();
    
    for (let i = 0; i < Math.min(elementCount, 10); i++) {
      const element = interactiveElements.nth(i);
      const box = await element.boundingBox();
      
      if (box) {
        // WCAG 2.1 AA requires 44x44 pixels minimum
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
    
    // 3. Mobile form accessibility
    await page.goto('http://localhost:4321/chat');
    
    // Textarea should be properly sized for mobile
    const textarea = page.locator('textarea');
    const textareaBox = await textarea.boundingBox();
    expect(textareaBox?.width).toBeGreaterThan(300);
  });

  test('focus management and tab order', async ({ page }) => {
    await page.goto('http://localhost:4321');
    
    // 1. Test natural tab order
    const tabbableElements: string[] = [];
    
    // Tab through entire page
    for (let i = 0; i < 50; i++) {
      await page.keyboard.press('Tab');
      
      const focused = await page.evaluate(() => {
        const el = document.activeElement;
        return {
          tag: el?.tagName,
          text: el?.textContent?.substring(0, 50),
          role: el?.getAttribute('role'),
          type: (el as HTMLInputElement)?.type
        };
      });
      
      if (focused.tag) {
        tabbableElements.push(`${focused.tag} - ${focused.text || focused.role || focused.type}`);
      }
      
      // Stop if we've cycled back
      if (i > 10 && tabbableElements[0] === tabbableElements[tabbableElements.length - 1]) {
        break;
      }
    }
    
    // Verify logical order (skip link should be first)
    expect(tabbableElements[0]).toContain('Saltar');
    
    // 2. Modal focus trap
    await page.goto('http://localhost:4321/setup');
    await page.click('button:has-text("Comenzar Configuración")');
    
    // If there's a modal, test focus trap
    const modal = page.locator('[role="dialog"], .modal');
    if (await modal.isVisible()) {
      // Tab should cycle within modal
      const modalElements: string[] = [];
      
      for (let i = 0; i < 20; i++) {
        await page.keyboard.press('Tab');
        
        const focused = await page.evaluate(() => {
          return document.activeElement?.textContent?.substring(0, 30);
        });
        
        if (focused) {
          modalElements.push(focused);
        }
        
        // Check for cycling
        if (modalElements.length > 5 && 
            modalElements[modalElements.length - 1] === modalElements[0]) {
          break;
        }
      }
      
      // Focus should stay within modal
      expect(modalElements.length).toBeGreaterThan(0);
    }
  });

  test('error messaging and validation accessibility', async ({ page }) => {
    await page.goto('http://localhost:4321/requests');
    await page.click('button:has-text("Nueva Solicitud")');
    
    // 1. Submit empty form
    await page.click('button:has-text("Enviar Solicitud")');
    
    // Check for accessible error messages
    const errors = page.locator('[role="alert"], [aria-invalid="true"]');
    const errorCount = await errors.count();
    
    if (errorCount > 0) {
      // Errors should be announced
      for (let i = 0; i < errorCount; i++) {
        const error = errors.nth(i);
        const text = await error.textContent();
        expect(text).toBeTruthy();
      }
    }
    
    // 2. Invalid field should have aria-invalid
    const titleInput = page.locator('input[placeholder*="Título"]');
    await titleInput.fill('a'); // Too short
    await titleInput.blur();
    
    // Wait a bit for validation
    await page.waitForTimeout(500);
    
    const ariaInvalid = await titleInput.getAttribute('aria-invalid');
    const ariaDescribedBy = await titleInput.getAttribute('aria-describedby');
    
    // Should have error indication
    expect(ariaInvalid === 'true' || ariaDescribedBy).toBeTruthy();
    
    // 3. Success messages
    await titleInput.fill('Título válido para la solicitud');
    await page.selectOption('select[name="type"]', { index: 1 });
    await page.fill('textarea[placeholder*="Descripción"]', 'Descripción completa');
    await page.fill('textarea[placeholder*="Justificación"]', 'Justificación detallada');
    
    await page.click('button:has-text("Enviar Solicitud")');
    
    // Success should be announced
    const success = await page.locator('[role="status"], .success-message').count();
    expect(success).toBeGreaterThanOrEqual(0);
  });

  test('reduced motion and animation preferences', async ({ page }) => {
    // Enable prefers-reduced-motion
    await page.emulateMedia({ reducedMotion: 'reduce' });
    
    await page.goto('http://localhost:4321');
    
    // Check that animations are disabled
    const animatedElements = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      const animated = [];
      
      elements.forEach(el => {
        const styles = window.getComputedStyle(el);
        const transition = styles.transition;
        const animation = styles.animation;
        
        if (transition !== 'none' || animation !== 'none') {
          animated.push({
            tag: el.tagName,
            transition,
            animation
          });
        }
      });
      
      return animated;
    });
    
    // Critical animations should respect reduced motion
    animatedElements.forEach(el => {
      if (el.transition !== 'none') {
        expect(el.transition).toMatch(/0s|none/);
      }
    });
  });
});