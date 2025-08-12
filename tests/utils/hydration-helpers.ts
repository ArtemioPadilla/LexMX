import { Page } from '@playwright/test';

/**
 * Waits for Astro islands to hydrate on the page
 * @param page - Playwright page object
 * @param timeout - Maximum time to wait for hydration
 */
export async function waitForHydration(page: Page, timeout = 10000): Promise<void> {
  // First wait for the page to be loaded
  await page.waitForLoadState('domcontentloaded');
  
  // Wait for all astro-island elements to be hydrated
  await page.waitForFunction(
    () => {
      const islands = document.querySelectorAll('astro-island[uid]');
      if (islands.length === 0) return true;
      
      return Array.from(islands).every(island => {
        // Check if the island has been hydrated
        const hasHydrated = island.hasAttribute('hydrate') === false || 
                           island.classList.contains('hydrated') ||
                           island.querySelector(':scope > *:not(template)') !== null;
        return hasHydrated;
      });
    },
    { timeout }
  );
  
  // Additional wait for React components to be interactive
  await page.waitForTimeout(500);
}

/**
 * Waits for a specific component to be hydrated
 * @param page - Playwright page object
 * @param selector - CSS selector for the component
 * @param timeout - Maximum time to wait
 */
export async function waitForComponentHydration(
  page: Page, 
  selector: string, 
  timeout = 10000
): Promise<void> {
  // First wait for the element to be visible
  await page.waitForSelector(selector, { state: 'visible', timeout });
  
  await page.waitForFunction(
    (sel) => {
      const element = document.querySelector(sel);
      if (!element) return false;
      
      // Check if element is interactive (has event listeners)
      const isInteractive = element.matches('button, a, input, textarea, select') ||
                          element.querySelector('button, a, input, textarea, select') !== null;
      
      // For React components, check if they have the data-reactroot attribute
      const hasReactRoot = element.hasAttribute('data-reactroot') ||
                         element.querySelector('[data-reactroot]') !== null;
      
      // Also check if the element has content
      const hasContent = element.textContent && element.textContent.trim().length > 0;
      
      return isInteractive || hasReactRoot || hasContent;
    },
    selector,
    { timeout }
  );
  
  // Small additional wait for event handlers to be attached
  await page.waitForTimeout(300);
}

/**
 * Checks if hydration has completed for all components
 * @param page - Playwright page object
 */
export async function isFullyHydrated(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    // Check for any pending hydration
    const islands = document.querySelectorAll('astro-island[uid]');
    if (islands.length === 0) return true;
    
    const allHydrated = Array.from(islands).every(island => {
      return !island.hasAttribute('hydrate') || island.classList.contains('hydrated');
    });
    
    // Also check for React hydration markers
    const hasReactComponents = document.querySelector('[data-reactroot]') !== null;
    
    return allHydrated || hasReactComponents;
  });
}

/**
 * Waits for client-side JavaScript to be fully loaded
 * @param page - Playwright page object
 */
export async function waitForClientJS(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => {
    // Check if common client-side globals are available
    return typeof window !== 'undefined' && 
           document.readyState === 'complete';
  });
}

/**
 * Helper to wait for specific hydration wrapper elements
 * @param page - Playwright page object
 * @param wrapperName - Name attribute of the hydration wrapper
 */
export async function waitForHydrationWrapper(
  page: Page,
  wrapperName: string,
  timeout = 5000
): Promise<void> {
  await page.waitForSelector(
    `.hydration-wrapper[data-name="${wrapperName}"]`,
    { state: 'attached', timeout }
  );
  
  // Wait for the wrapper to finish hydrating
  await page.waitForFunction(
    (name) => {
      const wrapper = document.querySelector(`.hydration-wrapper[data-name="${name}"]`);
      if (!wrapper) return false;
      
      // Check if content is loaded
      const hasContent = wrapper.children.length > 0;
      const isNotLoading = !wrapper.classList.contains('hydrating');
      
      return hasContent && isNotLoading;
    },
    wrapperName,
    { timeout }
  );
}

/**
 * Utility to check for hydration errors in console
 * @param page - Playwright page object
 */
export function setupHydrationErrorMonitoring(page: Page): void {
  const hydrationErrors: string[] = [];
  
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('Hydration') || 
        text.includes('hydrat') || 
        text.includes('React will try to recreate') ||
        text.includes('did not match')) {
      hydrationErrors.push(text);
    }
  });
  
  page.on('pageerror', (error) => {
    if (error.message.includes('hydrat')) {
      hydrationErrors.push(error.message);
    }
  });
  
  // Expose method to check for errors
  (page as any).getHydrationErrors = () => hydrationErrors;
}

/**
 * Wait for all lazy-loaded components to be ready
 * @param page - Playwright page object
 */
export async function waitForLazyComponents(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    // Check for any loading indicators
    const loadingElements = document.querySelectorAll(
      '.loading, .skeleton, [data-loading="true"], .animate-pulse'
    );
    return loadingElements.length === 0;
  });
}

/**
 * Ensures interactive elements are ready for interaction
 * @param page - Playwright page object
 * @param selector - Selector for the interactive element
 */
export async function waitForInteractive(
  page: Page,
  selector: string
): Promise<void> {
  await page.waitForSelector(selector, { state: 'visible' });
  await page.waitForFunction(
    (sel) => {
      const element = document.querySelector(sel) as HTMLElement;
      if (!element) return false;
      
      // Check if element is not disabled
      const isEnabled = !element.hasAttribute('disabled') &&
                       !element.classList.contains('disabled') &&
                       !element.hasAttribute('aria-disabled');
      
      // Check if element is visible and has dimensions
      const rect = element.getBoundingClientRect();
      const isVisible = rect.width > 0 && rect.height > 0;
      
      return isEnabled && isVisible;
    },
    selector
  );
}