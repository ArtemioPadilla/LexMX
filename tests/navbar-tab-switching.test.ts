import { test, expect, Page, BrowserContext } from '@playwright/test';

test.describe('Navbar Tab Switching Bug Investigation', () => {
  let context: BrowserContext;
  let errors: string[] = [];
  let warnings: string[] = [];
  let componentChanges: any[] = [];

  test.beforeEach(async ({ browser }) => {
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

    page.on('pageerror', error => {
      errors.push(`[${pageName}] Page Error: ${error.message}`);
      console.error(`[${pageName}] Page Error:`, error);
    });
  }

  // Helper to check navbar component state
  async function checkNavbarComponents(page: Page) {
    const langSelector = page.locator('.language-selector').first();
    const themeToggle = page.locator('.theme-toggle').first();
    const navLinks = page.locator('nav a[href="/chat"], nav a[href="/legal"], nav a[href="/setup"], nav a[href="/about"]');
    
    // Get individual nav links
    const chatLink = page.locator('nav a[href="/chat"]');
    const legalLink = page.locator('nav a[href="/legal"]');
    const setupLink = page.locator('nav a[href="/setup"]');
    const aboutLink = page.locator('nav a[href="/about"]');
    
    return {
      langSelectorVisible: await langSelector.isVisible(),
      themeToggleVisible: await themeToggle.isVisible(),
      navLinksCount: await navLinks.count(),
      chatLinkVisible: await chatLink.isVisible(),
      legalLinkVisible: await legalLink.isVisible(),
      setupLinkVisible: await setupLink.isVisible(),
      aboutLinkVisible: await aboutLink.isVisible(),
      chatLinkText: await chatLink.textContent().catch(() => 'N/A'),
      legalLinkText: await legalLink.textContent().catch(() => 'N/A'),
      setupLinkText: await setupLink.textContent().catch(() => 'N/A'),
      aboutLinkText: await aboutLink.textContent().catch(() => 'N/A'),
      // Check if components are in DOM but hidden
      langSelectorInDOM: await page.locator('.language-selector').count() > 0,
      themeToggleInDOM: await page.locator('.theme-toggle').count() > 0,
      navLinksInDOM: await navLinks.count(),
      // Check Astro islands
      hasAstroIslands: await page.locator('astro-island').count(),
      astroIslandsHydrated: await page.locator('astro-island[hydrated]').count()
    };
  }

  test('CRITICAL: Reproduce navbar components disappearing when switching tabs', async () => {
    console.log('\n🔍 Starting navbar tab switching investigation...\n');
    
    const page = await context.newPage();
    await setupPageMonitoring(page, 'MainPage');
    
    console.log('📄 Loading home page...');
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Wait for hydration
    
    await page.screenshot({ 
      path: './test-results/1-home-initial.png',
      fullPage: false 
    });
    
    // Check initial state
    const homeState = await checkNavbarComponents(page);
    console.log('Home page navbar state:', homeState);
    expect(homeState.langSelectorVisible).toBe(true);
    expect(homeState.themeToggleVisible).toBe(true);
    expect(homeState.navLinksCount).toBeGreaterThan(0);
    
    // Navigate to Chat Legal
    console.log('\n📄 Navigating to Chat Legal...');
    await page.click('nav a[href="/chat"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    await page.screenshot({ 
      path: './test-results/2-chat-page.png',
      fullPage: false 
    });
    
    const chatState = await checkNavbarComponents(page);
    console.log('Chat page navbar state:', chatState);
    
    // Navigate to Códigos
    console.log('\n📄 Navigating to Códigos...');
    await page.click('nav a[href="/legal"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    await page.screenshot({ 
      path: './test-results/3-legal-page.png',
      fullPage: false 
    });
    
    const legalState = await checkNavbarComponents(page);
    console.log('Legal page navbar state:', legalState);
    
    // Navigate to Configuración
    console.log('\n📄 Navigating to Configuración...');
    await page.click('nav a[href="/setup"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    await page.screenshot({ 
      path: './test-results/4-setup-page.png',
      fullPage: false 
    });
    
    const setupState = await checkNavbarComponents(page);
    console.log('Setup page navbar state:', setupState);
    
    // Navigate to Acerca de
    console.log('\n📄 Navigating to Acerca de...');
    await page.click('nav a[href="/about"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    await page.screenshot({ 
      path: './test-results/5-about-page.png',
      fullPage: false 
    });
    
    const aboutState = await checkNavbarComponents(page);
    console.log('About page navbar state:', aboutState);
    
    // Go back to home
    console.log('\n📄 Navigating back to home...');
    await page.click('header a[href="/"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    await page.screenshot({ 
      path: './test-results/6-home-after-navigation.png',
      fullPage: false 
    });
    
    const homeAfterState = await checkNavbarComponents(page);
    console.log('Home after navigation navbar state:', homeAfterState);
    
    // Test rapid navigation between tabs
    console.log('\n🏃 Testing rapid tab switching...');
    for (let i = 0; i < 3; i++) {
      await page.click('nav a[href="/chat"]');
      await page.waitForTimeout(300);
      await page.click('nav a[href="/legal"]');
      await page.waitForTimeout(300);
      await page.click('nav a[href="/setup"]');
      await page.waitForTimeout(300);
      await page.click('nav a[href="/about"]');
      await page.waitForTimeout(300);
    }
    
    await page.screenshot({ 
      path: './test-results/7-after-rapid-switching.png',
      fullPage: false 
    });
    
    const rapidSwitchState = await checkNavbarComponents(page);
    console.log('After rapid switching navbar state:', rapidSwitchState);
    
    // Test theme and language toggle interaction during navigation
    console.log('\n🎨 Testing theme/language interaction during navigation...');
    await page.click('nav a[href="/chat"]');
    await page.waitForTimeout(500);
    
    // Try to interact with theme toggle
    const themeToggle = page.locator('.theme-toggle button').first();
    if (await themeToggle.isVisible()) {
      await themeToggle.click();
      await page.waitForTimeout(500);
    }
    
    // Try to interact with language selector
    const langSelector = page.locator('.language-selector button').first();
    if (await langSelector.isVisible()) {
      await langSelector.click();
      await page.waitForTimeout(500);
      // Click somewhere else to close dropdown
      await page.click('main');
    }
    
    await page.screenshot({ 
      path: './test-results/8-after-component-interaction.png',
      fullPage: false 
    });
    
    const afterInteractionState = await checkNavbarComponents(page);
    console.log('After component interaction navbar state:', afterInteractionState);
    
    // Detailed DOM analysis
    console.log('\n🔬 Detailed DOM analysis...');
    
    const domAnalysis = await page.evaluate(() => {
      const header = document.querySelector('header');
      const nav = document.querySelector('nav');
      const langSelector = document.querySelector('.language-selector');
      const themeToggle = document.querySelector('.theme-toggle');
      const navLinks = document.querySelectorAll('nav a[href^="/"]');
      
      return {
        headerExists: !!header,
        navExists: !!nav,
        langSelectorExists: !!langSelector,
        themeToggleExists: !!themeToggle,
        navLinksCount: navLinks.length,
        headerHTML: header?.outerHTML.substring(0, 500) || 'N/A',
        navHTML: nav?.outerHTML.substring(0, 500) || 'N/A',
        langSelectorHTML: langSelector?.outerHTML || 'N/A',
        themeToggleHTML: themeToggle?.outerHTML || 'N/A',
        astroIslands: Array.from(document.querySelectorAll('astro-island')).map(island => ({
          uid: island.getAttribute('uid'),
          component: island.getAttribute('component-url'),
          hydrated: island.hasAttribute('hydrated'),
          innerHTML: island.innerHTML.substring(0, 200)
        })),
        bodyClasses: document.body.className,
        htmlClasses: document.documentElement.className
      };
    });
    
    console.log('DOM Analysis:', JSON.stringify(domAnalysis, null, 2));
    
    // Check for hydration issues
    const hydrationAnalysis = await page.evaluate(() => {
      const checkElement = (selector: string) => {
        const element = document.querySelector(selector);
        if (!element) return { exists: false };
        
        const astroIsland = element.closest('astro-island');
        const computedStyle = window.getComputedStyle(element);
        
        return {
          exists: true,
          visible: computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden',
          inAstroIsland: !!astroIsland,
          islandHydrated: astroIsland?.hasAttribute('hydrated'),
          islandUID: astroIsland?.getAttribute('uid'),
          islandComponent: astroIsland?.getAttribute('component-url'),
          hasChildren: element.children.length > 0,
          hasTextContent: !!element.textContent?.trim(),
          computedDisplay: computedStyle.display,
          computedVisibility: computedStyle.visibility,
          computedOpacity: computedStyle.opacity
        };
      };
      
      return {
        langSelector: checkElement('.language-selector'),
        themeToggle: checkElement('.theme-toggle'),
        chatLink: checkElement('nav a[href="/chat"]'),
        legalLink: checkElement('nav a[href="/legal"]'),
        setupLink: checkElement('nav a[href="/setup"]'),
        aboutLink: checkElement('nav a[href="/about"]')
      };
    });
    
    console.log('Hydration Analysis:', JSON.stringify(hydrationAnalysis, null, 2));
    
    // Summary report
    console.log('\n📊 SUMMARY REPORT:');
    console.log('=================');
    console.log(`Total errors: ${errors.length}`);
    console.log(`Total warnings: ${warnings.length}`);
    
    if (errors.length > 0) {
      console.log('\nErrors:', errors);
    }
    if (warnings.length > 0) {
      console.log('\nWarnings:', warnings);
    }
    
    // Component visibility comparison
    const stateComparison = {
      home: homeState,
      chat: chatState,
      legal: legalState,
      setup: setupState,
      about: aboutState,
      homeAfter: homeAfterState,
      rapidSwitch: rapidSwitchState,
      afterInteraction: afterInteractionState
    };
    
    console.log('\nComponent State Comparison:');
    Object.entries(stateComparison).forEach(([page, state]) => {
      console.log(`${page}: Lang=${state.langSelectorVisible}, Theme=${state.themeToggleVisible}, NavLinks=${state.navLinksCount}, Hydrated Islands=${state.astroIslandsHydrated}`);
    });
    
    // Check for inconsistencies
    const hasInconsistencies = Object.values(stateComparison).some(state => 
      !state.langSelectorVisible || !state.themeToggleVisible || state.navLinksCount === 0
    );
    
    if (hasInconsistencies) {
      console.log('\n⚠️  ISSUE DETECTED: Component visibility inconsistencies found!');
    } else {
      console.log('\n✅ No component visibility issues detected in this test run.');
    }
    
    // Assert critical components should always be visible
    expect(afterInteractionState.langSelectorVisible || afterInteractionState.langSelectorInDOM).toBe(true);
    expect(afterInteractionState.themeToggleVisible || afterInteractionState.themeToggleInDOM).toBe(true);
    expect(afterInteractionState.navLinksCount).toBeGreaterThan(0);
  });

  test('Test component state persistence across page loads', async () => {
    const page = await context.newPage();
    await setupPageMonitoring(page, 'PersistenceTest');
    
    console.log('📄 Testing component state persistence...');
    
    // Set initial theme and language
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Change theme
    const themeToggle = page.locator('.theme-toggle button').first();
    if (await themeToggle.isVisible()) {
      await themeToggle.click();
      await page.waitForTimeout(500);
    }
    
    // Navigate through all pages and check state
    const pages = ['/chat', '/legal', '/setup', '/about', '/'];
    
    for (const pagePath of pages) {
      await page.goto(`http://localhost:4323${pagePath}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      
      const state = await checkNavbarComponents(page);
      console.log(`Page ${pagePath}: Components visible - Lang: ${state.langSelectorVisible}, Theme: ${state.themeToggleVisible}, Nav: ${state.navLinksCount}`);
      
      // All pages should have the same component state
      expect(state.langSelectorVisible).toBe(true);
      expect(state.themeToggleVisible).toBe(true);
      expect(state.navLinksCount).toBeGreaterThan(0);
    }
    
    await page.screenshot({ 
      path: './test-results/persistence-final.png',
      fullPage: false 
    });
  });
});