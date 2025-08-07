import { test, expect } from '@playwright/test';
import {
  setupPage,
  navigateAndWaitForHydration,
  setupWebLLMProvider,
  setupMockProviders,
  waitForProviderSelector,
  selectProvider,
  clearAllStorage
} from '../utils/test-helpers';

test.describe('Provider Selector User Journey', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
    await clearAllStorage(page);
  });

  test('provider selector is visible in chat interface', async ({ page }) => {
    await navigateAndWaitForHydration(page, '/chat');
    await setupWebLLMProvider(page);
    
    // Check provider selector is visible
    const providerSelector = page.locator('.provider-selector').first();
    await expect(providerSelector).toBeVisible();
    
    // Check it shows WebLLM by default
    await expect(providerSelector).toContainText('WebLLM');
  });

  test('can open provider dropdown and see options', async ({ page }) => {
    await navigateAndWaitForHydration(page, '/chat');
    
    // Set up multiple providers
    await setupMockProviders(page, [
      {
        id: 'webllm',
        name: 'WebLLM',
        apiKey: '',
        models: ['Llama-3.2-3B'],
        enabled: true
      },
      {
        id: 'openai',
        name: 'OpenAI',
        apiKey: 'test-key',
        models: ['gpt-4'],
        enabled: true
      },
      {
        id: 'anthropic',
        name: 'Claude',
        apiKey: 'test-key',
        models: ['claude-3'],
        enabled: true
      }
    ]);
    
    await page.reload();
    await waitForProviderSelector(page);
    
    // Open dropdown
    const selector = page.locator('.provider-selector button').first();
    await selector.click();
    
    // Check dropdown is visible
    const dropdown = page.locator('.provider-selector').first();
    await expect(dropdown.locator('text="Proveedores Disponibles"')).toBeVisible();
    
    // Check providers are listed
    await expect(dropdown.locator('text="WebLLM"')).toBeVisible();
    await expect(dropdown.locator('text="OpenAI"')).toBeVisible();
    await expect(dropdown.locator('text="Claude"')).toBeVisible();
    
    // Check cost levels are shown
    await expect(dropdown.locator('text="Gratis"').first()).toBeVisible();
    await expect(dropdown.locator('text="high"')).toBeVisible();
    await expect(dropdown.locator('text="medium"')).toBeVisible();
  });

  test('WebLLM provider shows model selection', async ({ page }) => {
    await navigateAndWaitForHydration(page, '/chat');
    await setupWebLLMProvider(page);
    await page.reload();
    
    // Open provider selector
    const selector = page.locator('.provider-selector button').first();
    await selector.click();
    
    // Click on WebLLM to see models
    const webllmOption = page.locator('button:has-text("WebLLM")').first();
    await webllmOption.click();
    
    // Check model options are visible
    await expect(page.locator('text="Llama 3.2"')).toBeVisible();
    await expect(page.locator('text="1.7GB"')).toBeVisible();
    
    // Select a model
    const modelButton = page.locator('button:has-text("Llama 3.2")').first();
    await modelButton.click();
    
    // Verify selection is saved
    await expect(selector).toContainText('Llama');
  });

  test('provider selector has link to setup page', async ({ page }) => {
    await navigateAndWaitForHydration(page, '/chat');
    await setupWebLLMProvider(page);
    
    // Open provider selector
    const selector = page.locator('.provider-selector button').first();
    await selector.click();
    
    // Check setup link is visible
    const setupLink = page.locator('a:has-text("Configurar Proveedores")');
    await expect(setupLink).toBeVisible();
    
    // Click the link
    await setupLink.click();
    
    // Verify navigation to setup page
    await page.waitForURL('**/setup');
    await expect(page.locator('.provider-setup')).toBeVisible();
  });

  test('provider selection persists after page reload', async ({ page }) => {
    await navigateAndWaitForHydration(page, '/chat');
    
    // Set up multiple providers
    await setupMockProviders(page, [
      {
        id: 'webllm',
        name: 'WebLLM',
        apiKey: '',
        models: ['Llama-3.2-3B'],
        enabled: true
      },
      {
        id: 'openai',
        name: 'OpenAI',
        apiKey: 'test-key',
        models: ['gpt-4'],
        enabled: true
      }
    ]);
    
    await page.reload();
    await waitForProviderSelector(page);
    
    // Select OpenAI
    const selector = page.locator('.provider-selector button').first();
    await selector.click();
    
    const openaiOption = page.locator('button:has-text("OpenAI")').first();
    await openaiOption.click();
    
    // Verify OpenAI is selected
    await expect(selector).toContainText('OpenAI');
    
    // Reload page
    await page.reload();
    await waitForProviderSelector(page);
    
    // Check OpenAI is still selected
    const selectorAfterReload = page.locator('.provider-selector button').first();
    await expect(selectorAfterReload).toContainText('OpenAI');
  });

  test('shows provider icons correctly', async ({ page }) => {
    await navigateAndWaitForHydration(page, '/chat');
    
    await setupMockProviders(page, [
      {
        id: 'webllm',
        name: 'WebLLM',
        apiKey: '',
        models: ['Llama-3.2-3B'],
        enabled: true
      }
    ]);
    
    await page.reload();
    await waitForProviderSelector(page);
    
    // Check icon is visible in button
    const selector = page.locator('.provider-selector button').first();
    const icon = selector.locator('img').first();
    await expect(icon).toBeVisible();
    await expect(icon).toHaveAttribute('alt', 'WebLLM');
    await expect(icon).toHaveAttribute('src', '/icons/webllm.svg');
  });

  test('provider selector works in mobile view', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await navigateAndWaitForHydration(page, '/chat');
    await setupWebLLMProvider(page);
    
    // Check provider selector is visible
    const providerSelector = page.locator('.provider-selector').first();
    await expect(providerSelector).toBeVisible();
    
    // Open dropdown
    const selector = page.locator('.provider-selector button').first();
    await selector.click();
    
    // Check dropdown fits in mobile view
    const dropdown = page.locator('.provider-selector [role="listbox"]').first();
    const boundingBox = await dropdown.boundingBox();
    
    if (boundingBox) {
      expect(boundingBox.width).toBeLessThanOrEqual(375);
      expect(boundingBox.x).toBeGreaterThanOrEqual(0);
    }
  });

  test('corpus selector is visible alongside provider selector', async ({ page }) => {
    await navigateAndWaitForHydration(page, '/chat');
    await setupWebLLMProvider(page);
    
    // Check both selectors are visible
    const providerSelector = page.locator('.provider-selector').first();
    const corpusSelector = page.locator('.corpus-selector').first();
    
    await expect(providerSelector).toBeVisible();
    await expect(corpusSelector).toBeVisible();
    
    // Check they are in the same row
    const container = page.locator('.flex.justify-between.items-center.mb-2').first();
    await expect(container).toBeVisible();
    await expect(container).toContainText('Todo el corpus'); // Default corpus text
    await expect(container).toContainText('WebLLM'); // Default provider
  });

  test('provider selector updates when new provider is configured', async ({ page }) => {
    await navigateAndWaitForHydration(page, '/chat');
    await setupWebLLMProvider(page);
    
    // Initially only WebLLM
    const selector = page.locator('.provider-selector button').first();
    await selector.click();
    
    let dropdown = page.locator('.provider-selector').first();
    await expect(dropdown.locator('text="WebLLM"')).toBeVisible();
    await expect(dropdown.locator('text="OpenAI"')).not.toBeVisible();
    
    // Close dropdown
    await page.keyboard.press('Escape');
    
    // Add OpenAI provider
    await page.evaluate(() => {
      const openaiConfig = {
        id: 'openai',
        name: 'OpenAI',
        type: 'cloud',
        enabled: true,
        apiKey: 'test-key',
        model: 'gpt-4',
        priority: 2
      };
      localStorage.setItem('lexmx_provider_openai', JSON.stringify(openaiConfig));
    });
    
    // Refresh to load new provider
    await page.reload();
    await waitForProviderSelector(page);
    
    // Open dropdown again
    await page.locator('.provider-selector button').first().click();
    
    // Check both providers are now visible
    dropdown = page.locator('.provider-selector').first();
    await expect(dropdown.locator('text="WebLLM"')).toBeVisible();
    await expect(dropdown.locator('text="OpenAI"')).toBeVisible();
  });

  test('disabled providers are not shown in selector', async ({ page }) => {
    await navigateAndWaitForHydration(page, '/chat');
    
    // Set up providers with one disabled
    await page.evaluate(() => {
      const webllmConfig = {
        id: 'webllm',
        name: 'WebLLM',
        type: 'local',
        enabled: true,
        model: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
        priority: 1
      };
      
      const openaiConfig = {
        id: 'openai',
        name: 'OpenAI',
        type: 'cloud',
        enabled: false, // Disabled
        apiKey: 'test-key',
        model: 'gpt-4',
        priority: 2
      };
      
      localStorage.setItem('lexmx_provider_webllm', JSON.stringify(webllmConfig));
      localStorage.setItem('lexmx_provider_openai', JSON.stringify(openaiConfig));
    });
    
    await page.reload();
    await waitForProviderSelector(page);
    
    // Open dropdown
    const selector = page.locator('.provider-selector button').first();
    await selector.click();
    
    // Check only enabled provider is shown
    const dropdown = page.locator('.provider-selector').first();
    await expect(dropdown.locator('text="WebLLM"')).toBeVisible();
    await expect(dropdown.locator('text="OpenAI"')).not.toBeVisible();
  });
});