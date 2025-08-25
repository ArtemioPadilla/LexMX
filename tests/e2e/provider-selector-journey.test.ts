import { clearAllStorage, expect, setupWebLLMProvider, test, navigateAndWaitForHydration } from '../utils/test-helpers-consolidated';
import { setupCompleteMockEnvironment, quickSetupProvider } from '../utils/mock-all-providers';
import { smartWait, waitForElement, clickElement, fillInput as fastFillInput, waitForText, waitForHydrationFast } from '../utils/fast-helpers';

/**
 * Isolated version of provider-selector-journey tests
 * Uses the new test isolation system for parallel execution
 */
import { TEST_IDS } from '../../src/utils/test-ids';
import { TEST_DATA } from '../../src/utils/test-data';

// Helper functions
async function setupLegacyMockProviders(page: any, providers: any[]) {
  for (const provider of providers) {
    const config = {
      encrypted: false,
      data: {
        id: provider.id,
        name: provider.name,
        type: provider.id === 'webllm' ? 'local' : 'cloud',
        enabled: provider.enabled,
        apiKey: provider.apiKey || '',
        model: provider.models?.[0] || '',
        priority: providers.indexOf(provider) + 1
      },
      timestamp: Date.now(),
      version: 1
    };
    await page.evaluate((data) => {
      localStorage.setItem(`lexmx_provider_${data.provider.id}`, JSON.stringify(data.config));
    }, { provider, config });
  }
}

async function waitForProviderSelectorReady(page: any) {
  await page.waitForSelector(`[data-testid="${TEST_IDS.provider.selectorToggle}"]`, { 
    state: 'visible', 
    timeout: 5000 
  });
  await smartWait(page, "interaction");
}

test.describe('Provider Selector User Journey (Mocked)', () => {
  test.beforeEach(async ({ page }) => {
    // Note: setupIsolatedPage is already called by the fixture
    await clearAllStorage(page);
  });

  test('provider selector is visible in chat interface', async ({ page }) => {
    await navigateAndWaitForHydration(page, '/chat');
    await quickSetupProvider(page, "webllm");
    
    // Wait for provider selector to initialize
    // await smartWait(page, "interaction"); // TODO: Replace with proper wait condition;
    
    // Check provider selector is visible
    const providerSelector = page.locator(`[data-testid="${TEST_IDS.provider.selector}"]`).first();
    await expect(providerSelector).toBeVisible({ timeout: 5000 });
    
    // Check it shows WebLLM by default (may show "Loading..." initially)
    await expect(providerSelector).toContainText(/WebLLM|Loading/);
  });

  test('can open provider dropdown and see options', async ({ page }) => {
    await navigateAndWaitForHydration(page, '/chat');
    
    // Set up multiple providers
    await setupLegacyMockProviders(page, [
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
    await navigateAndWaitForHydration(page, '/chat');
    await waitForProviderSelectorReady(page);
    
    // Open dropdown
    const selector = page.locator(`[data-testid="${TEST_IDS.provider.selectorToggle}"]`).first();
    await selector.click();
    
    // Check dropdown is visible
    const dropdown = page.locator(`[data-testid="${TEST_IDS.provider.selector}"]`).first();
    await expect(dropdown.locator('text=/Proveedores Disponibles/i')).toBeVisible();
    
    // Check providers are listed
    await expect(dropdown.locator('text=/WebLLM/i')).toBeVisible();
    await expect(dropdown.locator('text=/OpenAI/i')).toBeVisible();
    await expect(dropdown.locator('text=/Claude/i')).toBeVisible();
    
    // Check cost levels are shown
    await expect(dropdown.locator('text=/Gratis/i').first()).toBeVisible();
    await expect(dropdown.locator('text=/high/i')).toBeVisible();
    await expect(dropdown.locator('text=/medium/i')).toBeVisible();
  });

  test('WebLLM provider shows model selection', async ({ page }) => {
    await navigateAndWaitForHydration(page, '/chat');
    await quickSetupProvider(page, "webllm");
    await page.reload();
    
    // Open provider selector
    const selector = page.locator(`[data-testid="${TEST_IDS.provider.selectorToggle}"]`).first();
    await selector.click();
    
    // Click on WebLLM to see models
    const webllmOption = page.locator('button:has-text("WebLLM")').first();
    await webllmOption.click();
    
    // Check model options are visible
    await expect(page.locator('text=/Llama 3.2/i')).toBeVisible();
    await expect(page.locator('text=/1.7GB/i')).toBeVisible();
    
    // Select a model
    const modelButton = page.locator('button:has-text("Llama 3.2")').first();
    await modelButton.click();
    
    // Verify selection is saved
    await expect(selector).toContainText('Llama');
  });

  test('provider selector has link to setup page', async ({ page }) => {
    await navigateAndWaitForHydration(page, '/chat');
    await quickSetupProvider(page, "webllm");
    
    // Open provider selector
    const selector = page.locator(`[data-testid="${TEST_IDS.provider.selectorToggle}"]`).first();
    await selector.click();
    
    // Check setup link is visible
    const setupLink = page.locator('a:text="Configurar Proveedores", :has-text(/Configurar Proveedores/i)');
    await expect(setupLink).toBeVisible();
    
    // Click the link
    await setupLink.click();
    
    // Verify navigation to setup page
    await page.waitForURL('**/setup');
    await expect(page.locator(`[data-testid="${TEST_IDS.provider.container}"]`)).toBeVisible();
  });

  test('provider selection persists after page reload', async ({ page }) => {
    await navigateAndWaitForHydration(page, '/chat');
    
    // Set up multiple providers
    await setupLegacyMockProviders(page, [
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
    await navigateAndWaitForHydration(page, '/chat');
    await waitForProviderSelectorReady(page);
    
    // Select OpenAI
    const selector = page.locator(`[data-testid="${TEST_IDS.provider.selectorToggle}"]`).first();
    await selector.click();
    
    const openaiOption = page.locator('button:has-text("OpenAI")').first();
    await openaiOption.click();
    
    // Verify OpenAI is selected
    await expect(selector).toContainText('OpenAI');
    
    // Reload page
    await page.reload();
    await navigateAndWaitForHydration(page, '/chat');
    await waitForProviderSelectorReady(page);
    
    // Check OpenAI is still selected
    const selectorAfterReload = page.locator(`[data-testid="${TEST_IDS.provider.selectorToggle}"]`).first();
    await expect(selectorAfterReload).toContainText('OpenAI');
  });

  test('shows provider icons correctly', async ({ page }) => {
    await navigateAndWaitForHydration(page, '/chat');
    
    await setupLegacyMockProviders(page, [
      {
        id: 'webllm',
        name: 'WebLLM',
        apiKey: '',
        models: ['Llama-3.2-3B'],
        enabled: true
      }
    ]);
    
    await page.reload();
    await navigateAndWaitForHydration(page, '/chat');
    await waitForProviderSelectorReady(page);
    
    // Check icon is visible in button
    const selector = page.locator(`[data-testid="${TEST_IDS.provider.selectorToggle}"]`).first();
    const icon = selector.locator('img').first();
    await expect(icon).toBeVisible();
    await expect(icon).toHaveAttribute('alt', 'WebLLM');
    await expect(icon).toHaveAttribute('src', '/icons/webllm.svg');
  });

  test('provider selector works in mobile view', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await navigateAndWaitForHydration(page, '/chat');
    await quickSetupProvider(page, "webllm");
    
    // Check provider selector is visible
    const providerSelector = page.locator(`[data-testid="${TEST_IDS.provider.selector}"]`).first();
    await expect(providerSelector).toBeVisible();
    
    // Open dropdown
    const selector = page.locator(`[data-testid="${TEST_IDS.provider.selectorToggle}"]`).first();
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
    await quickSetupProvider(page, "webllm");
    
    // Check both selectors are visible
    // Model selector button contains WebLLM text
    const modelSelectorButton = page.locator('button:has-text("WebLLM")').first();
    const corpusSelector = page.locator(`[data-testid="${TEST_IDS.corpus.selectorToggle}"]`).first();
    
    await expect(modelSelectorButton).toBeVisible();
    await expect(corpusSelector).toBeVisible();
    
    // Check they are in the same row
    const container = page.locator('.flex.justify-between.items-center.mb-2').first();
    await expect(container).toBeVisible();
    await expect(container).toContainText('Todo el corpus'); // Default corpus text
    await expect(container).toContainText('WebLLM'); // Default provider
  });

  test('provider selector updates when new provider is configured', async ({ page }) => {
    await navigateAndWaitForHydration(page, '/chat');
    await quickSetupProvider(page, "webllm");
    
    // Initially only WebLLM
    const selector = page.locator(`[data-testid="${TEST_IDS.provider.selectorToggle}"]`).first();
    await selector.click();
    
    let dropdown = page.locator(`[data-testid="${TEST_IDS.provider.selector}"]`).first();
    await expect(dropdown.locator('text=/WebLLM/i')).toBeVisible();
    await expect(dropdown.locator('text=/OpenAI/i')).not.toBeVisible();
    
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
    await navigateAndWaitForHydration(page, '/chat');
    await waitForProviderSelectorReady(page);
    
    // Open dropdown again
    await page.locator(`[data-testid="${TEST_IDS.provider.selectorToggle}"]`).first().click();
    
    // Check both providers are now visible
    dropdown = page.locator(`[data-testid="${TEST_IDS.provider.selector}"]`).first();
    await expect(dropdown.locator('text=/WebLLM/i')).toBeVisible();
    await expect(dropdown.locator('text=/OpenAI/i')).toBeVisible();
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
    await navigateAndWaitForHydration(page, '/chat');
    await waitForProviderSelectorReady(page);
    
    // Open dropdown
    const selector = page.locator(`[data-testid="${TEST_IDS.provider.selectorToggle}"]`).first();
    await selector.click();
    
    // Check only enabled provider is shown
    const dropdown = page.locator(`[data-testid="${TEST_IDS.provider.selector}"]`).first();
    await expect(dropdown.locator('text=/WebLLM/i')).toBeVisible();
    await expect(dropdown.locator('text=/OpenAI/i')).not.toBeVisible();
  });
});