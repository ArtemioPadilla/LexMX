import { test, expect, Page, BrowserContext } from '@playwright/test';

test.describe('Navbar Tab Switching Bug Investigation', () => {
  let context: BrowserContext;
  let errors: string[] = [];
  let warnings: string[] = [];
  let storageChanges: any[] = [];

  test.beforeEach(async ({ browser }) => {
    // Create context with specific settings for debugging
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      recordVideo: {
        dir: './test-results/videos/',
        size: { width: 1920, height: 1080 }
      }
    });
  });

  test.afterEach(async () => {
    await context.close();
  });

  // Helper function to setup page monitoring
  async function setupPageMonitoring(page: Page, pageName: string) {
    // Monitor console errors and warnings
    page.on('console', msg => {
      const text = msg.text();
      if (msg.type() === 'error') {
        errors.push(`[${pageName}] ${text}`);
        console.error(`[${pageName}] Console Error:`, text);
      } else if (msg.type() === 'warning') {
        warnings.push(`[${pageName}] ${text}`);
        console.warn(`[${pageName}] Console Warning:`, text);
      }
    });

    // Monitor page errors
    page.on('pageerror', error => {
      errors.push(`[${pageName}] Page Error: ${error.message}`);
      console.error(`[${pageName}] Page Error:`, error);
    });

    // Monitor localStorage changes with addInitScript instead
    await page.addInitScript((pageName) => {
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        console.log(`[${pageName}] localStorage.setItem:`, key, value);
        window.postMessage({ 
          type: 'storage-change', 
          storage: 'local', 
          key, 
          value,
          timestamp: Date.now() 
        }, '*');
        return originalSetItem.call(this, key, value);
      };
    }, pageName);

    // Capture storage change messages
    await page.exposeFunction('captureStorageChange', (data: any) => {
      storageChanges.push({ ...data, page: pageName });
    });

    await page.addInitScript(() => {
      window.addEventListener('message', (e) => {
        if (e.data.type === 'storage-change') {
          (window as any).captureStorageChange(e.data);
        }
      });
    });
  }

  // Helper to check navbar component visibility
  async function checkNavbarComponents(page: Page) {
    const langSelector = page.locator('.language-selector').first();
    const themeToggle = page.locator('.theme-toggle').first();
    const navLinks = page.locator('nav a[href="/chat"], nav a[href="/legal"]');
    
    return {
      langSelectorVisible: await langSelector.isVisible(),
      themeToggleVisible: await themeToggle.isVisible(),
      navLinksCount: await navLinks.count(),
      langSelectorHTML: await langSelector.innerHTML().catch(() => 'N/A'),
      themeToggleHTML: await themeToggle.innerHTML().catch(() => 'N/A'),
      // Check if components are in DOM but hidden
      langSelectorInDOM: await page.locator('.language-selector').count() > 0,
      themeToggleInDOM: await page.locator('.theme-toggle').count() > 0,
      // Check React hydration markers
      hasAstroIslands: await page.locator('astro-island').count()
    };
  }

  test('CRITICAL: Reproduce tab switching navbar disappearance', async () => {
    console.log('\n🔍 Starting navbar tab switching bug investigation...\n');
    
    // Create first page
    const page1 = await context.newPage();
    await setupPageMonitoring(page1, 'Tab1');
    
    console.log('📄 Loading first tab...');
    await page1.goto('/');
    await page1.waitForLoadState('networkidle');
    await page1.waitForTimeout(2000); // Wait for hydration
    
    // Take initial screenshot
    await page1.screenshot({ 
      path: './test-results/1-initial-tab1.png',
      fullPage: false 
    });
    
    // Check initial state
    const initialState = await checkNavbarComponents(page1);
    console.log('Initial navbar state:', initialState);
    expect(initialState.langSelectorVisible).toBe(true);
    expect(initialState.themeToggleVisible).toBe(true);
    
    // Create second tab
    console.log('\n📄 Opening second tab...');
    const page2 = await context.newPage();
    await setupPageMonitoring(page2, 'Tab2');
    await page2.goto('/');
    await page2.waitForLoadState('networkidle');
    await page2.waitForTimeout(2000);
    
    await page2.screenshot({ 
      path: './test-results/2-initial-tab2.png',
      fullPage: false 
    });
    
    // Check second tab state
    const tab2State = await checkNavbarComponents(page2);
    console.log('Tab 2 navbar state:', tab2State);
    
    // Switch back to first tab
    console.log('\n🔄 Switching back to first tab...');
    await page1.bringToFront();
    await page1.waitForTimeout(1000);
    
    // Force a visibility change event
    await page1.evaluate(() => {
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('focus'));
    });
    
    await page1.screenshot({ 
      path: './test-results/3-after-switch-tab1.png',
      fullPage: false 
    });
    
    // Check state after switch
    const afterSwitchState = await checkNavbarComponents(page1);
    console.log('After switch navbar state:', afterSwitchState);
    
    // Detailed component analysis
    console.log('\n🔬 Detailed component analysis...');
    
    // Check React component state
    const reactComponentState = await page1.evaluate(() => {
      const langSelector = document.querySelector('.language-selector');
      const themeToggle = document.querySelector('.theme-toggle');
      
      return {
        langSelector: {
          exists: !!langSelector,
          hasReactFiber: !!(langSelector && (langSelector as any)._reactRootContainer),
          innerHTML: langSelector?.innerHTML || 'N/A',
          classList: langSelector?.className || 'N/A',
          computedDisplay: langSelector ? window.getComputedStyle(langSelector).display : 'N/A'
        },
        themeToggle: {
          exists: !!themeToggle,
          hasReactFiber: !!(themeToggle && (themeToggle as any)._reactRootContainer),
          innerHTML: themeToggle?.innerHTML || 'N/A',
          classList: themeToggle?.className || 'N/A',
          computedDisplay: themeToggle ? window.getComputedStyle(themeToggle).display : 'N/A'
        },
        astroIslands: Array.from(document.querySelectorAll('astro-island')).map(island => ({
          uid: island.getAttribute('uid'),
          component: island.getAttribute('component-url'),
          hydrated: island.hasAttribute('hydrated')
        }))
      };
    });
    
    console.log('React component state:', JSON.stringify(reactComponentState, null, 2));
    
    // Check for hydration issues
    const hydrationCheck = await page1.evaluate(() => {
      const checkHydration = (selector: string) => {
        const element = document.querySelector(selector);
        if (!element) return { exists: false };
        
        const astroIsland = element.closest('astro-island');
        return {
          exists: true,
          inAstroIsland: !!astroIsland,
          islandHydrated: astroIsland?.hasAttribute('hydrated'),
          islandUID: astroIsland?.getAttribute('uid'),
          hasChildren: element.children.length > 0,
          hasTextContent: !!element.textContent?.trim()
        };
      };
      
      return {
        langSelector: checkHydration('.language-selector'),
        themeToggle: checkHydration('.theme-toggle')
      };
    });
    
    console.log('Hydration check:', JSON.stringify(hydrationCheck, null, 2));
    
    // Test rapid tab switching
    console.log('\n🏃 Testing rapid tab switching...');
    for (let i = 0; i < 5; i++) {
      await page2.bringToFront();
      await page2.waitForTimeout(200);
      await page1.bringToFront();
      await page1.waitForTimeout(200);
    }
    
    await page1.screenshot({ 
      path: './test-results/4-after-rapid-switch.png',
      fullPage: false 
    });
    
    const rapidSwitchState = await checkNavbarComponents(page1);
    console.log('After rapid switch state:', rapidSwitchState);
    
    // Check localStorage state
    const storageState = await page1.evaluate(() => {
      return {
        language: localStorage.getItem('language'),
        theme: localStorage.getItem('theme'),
        allKeys: Object.keys(localStorage)
      };
    });
    console.log('LocalStorage state:', storageState);
    
    // Summary report
    console.log('\n📊 SUMMARY REPORT:');
    console.log('=================');
    console.log(`Total errors: ${errors.length}`);
    console.log(`Total warnings: ${warnings.length}`);
    console.log(`Storage changes: ${storageChanges.length}`);
    console.log('\nErrors:', errors);
    console.log('\nWarnings:', warnings);
    console.log('\nStorage changes:', storageChanges);
    
    // Assert components should still be visible
    expect(rapidSwitchState.langSelectorVisible || rapidSwitchState.langSelectorInDOM).toBe(true);
    expect(rapidSwitchState.themeToggleVisible || rapidSwitchState.themeToggleInDOM).toBe(true);
  });

  test('Test page visibility API behavior', async () => {
    const page = await context.newPage();
    await setupPageMonitoring(page, 'VisibilityTest');
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Monitor visibility change events
    await page.evaluate(() => {
      let visibilityChanges = 0;
      document.addEventListener('visibilitychange', () => {
        visibilityChanges++;
        console.log(`Visibility changed ${visibilityChanges} times. Hidden: ${document.hidden}`);
      });
      
      window.addEventListener('blur', () => {
        console.log('Window blur event');
      });
      
      window.addEventListener('focus', () => {
        console.log('Window focus event');
      });
    });
    
    // Simulate tab switching
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get() { return true; }
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    
    await page.waitForTimeout(1000);
    
    // Check component state after visibility change
    const afterHidden = await checkNavbarComponents(page);
    console.log('Components after hidden:', afterHidden);
    
    // Simulate tab becoming visible again
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get() { return false; }
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    
    await page.waitForTimeout(1000);
    
    const afterVisible = await checkNavbarComponents(page);
    console.log('Components after visible:', afterVisible);
  });

  test('Test localStorage conflicts between tabs', async () => {
    const page1 = await context.newPage();
    const page2 = await context.newPage();
    
    await page1.goto('/');
    await page2.goto('/');
    
    // Monitor storage events
    await page1.evaluate(() => {
      window.addEventListener('storage', (e) => {
        console.log('Tab1 storage event:', e.key, e.newValue, e.oldValue);
      });
    });
    
    await page2.evaluate(() => {
      window.addEventListener('storage', (e) => {
        console.log('Tab2 storage event:', e.key, e.newValue, e.oldValue);
      });
    });
    
    // Change theme in tab 2
    await page2.locator('.theme-toggle button').first().click();
    await page2.locator('button:has-text("Oscuro")').click();
    
    await page1.waitForTimeout(1000);
    
    // Check if components are still visible in tab 1
    const tab1State = await checkNavbarComponents(page1);
    console.log('Tab1 state after Tab2 theme change:', tab1State);
  });
});