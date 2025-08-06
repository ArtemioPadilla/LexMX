import { test, expect } from '@playwright/test';
import { 
  setupPage, 
  navigateAndWaitForHydration,
  clearAllStorage,
  assertNoConsoleErrors 
} from '../../utils/test-helpers';

test.describe('WebLLM as Professional Backup Provider', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
    await clearAllStorage(page);
  });

  test('legal professional uses WebLLM as offline backup', async ({ page, context }) => {
    // 1. Setup with multiple providers including WebLLM
    await navigateAndWaitForHydration(page, 'http://localhost:4321/setup');
    await page.click('button:has-text("Comenzar Configuración")');
    
    // Select balanced professional profile
    await page.click('div:has-text("Balanceado"):has-text("rendimiento y costo")');
    
    // 2. Select providers including WebLLM as backup
    await page.waitForSelector('h2:has-text("Selecciona Proveedores")');
    
    // Select Claude as primary
    await page.click('div:has-text("Claude"):has-text("razonamiento")');
    
    // Select WebLLM as backup for offline/privacy needs
    await page.click('div:has-text("WebLLM"):has-text("navegador")');
    
    await expect(page.locator('button:has-text("Configurar (2)")')).toBeVisible();
    await page.click('button:has-text("Configurar (2)")');
    
    // 3. Configure Claude
    await page.fill('input[type="password"]', 'sk-ant-professional-key');
    await page.click('button:has-text("Guardar")');
    
    // 4. Configure WebLLM
    await expect(page.locator('text="Modelo de IA en tu navegador"')).toBeVisible();
    
    // Professional selects larger model for better quality
    await page.selectOption('select', { label: 'Llama 3.1 8B (Más potente - 4.3GB)' });
    await page.click('button:has-text("Guardar")');
    
    // 5. Complete setup
    await page.waitForSelector('h2:has-text("¡Configuración Completa!")');
    await page.click('button:has-text("Comenzar a Usar LexMX")');
    await page.waitForURL('**/chat');
    
    // 6. Use Claude for initial query
    await page.fill('textarea[placeholder*="consulta legal"]', 
      'Análisis de reforma constitucional en materia electoral'
    );
    await page.click('button[aria-label="Enviar mensaje"]');
    
    // Should use Claude (primary provider)
    await expect(page.locator('text=/Claude|Anthropic/i')).toBeVisible({ timeout: 10000 });
    
    // 7. Simulate network failure
    await context.setOffline(true);
    
    // 8. Try another query while offline
    await page.fill('textarea[placeholder*="consulta legal"]', 
      'Consulta urgente: requisitos para amparo indirecto'
    );
    await page.click('button[aria-label="Enviar mensaje"]');
    
    // Should automatically fallback to WebLLM
    await expect(page.locator('text=/WebLLM|navegador|offline/i')).toBeVisible({ timeout: 10000 });
    
    // Should still get quality response
    await expect(page.locator('text=/amparo indirecto|requisitos/')).toBeVisible({ timeout: 30000 });
    
    // 9. Restore network
    await context.setOffline(false);
    
    // 10. Professional can explicitly choose WebLLM for sensitive data
    await page.click('button[title="Opciones avanzadas"]');
    
    // Look for provider selection (if implemented)
    const providerSelect = page.locator('select[aria-label*="proveedor"]');
    if (await providerSelect.count() > 0) {
      await providerSelect.selectOption({ label: 'WebLLM (Local)' });
    }
    
    await page.fill('textarea[placeholder*="consulta legal"]', 
      'Datos sensibles del cliente: estrategia de defensa en caso de fraude fiscal'
    );
    await page.click('button[aria-label="Enviar mensaje"]');
    
    // Verify local processing for sensitive data
    await expect(page.locator('text=/procesando localmente|WebLLM/')).toBeVisible({ timeout: 10000 });
    
    assertNoConsoleErrors(page);
  });

  test('cost-conscious professional workflow with WebLLM', async ({ page }) => {
    // 1. Setup focused on cost optimization
    await navigateAndWaitForHydration(page, 'http://localhost:4321/setup');
    await page.click('button:has-text("Comenzar Configuración")');
    await page.click('text="Configuración Personalizada"');
    
    // 2. Select only free/low-cost providers
    await page.click('div:has-text("WebLLM"):has-text("Gratis")');
    await page.click('div:has-text("Gemini"):has-text("low")');
    
    await page.click('button:has-text("Configurar (2)")');
    
    // 3. Configure WebLLM
    await page.click('button:has-text("Guardar")'); // Default settings
    
    // 4. Configure Gemini
    await page.fill('input[type="password"]', 'gemini-api-key');
    await page.click('button:has-text("Guardar")');
    
    // 5. Complete setup
    await page.waitForSelector('h2:has-text("¡Configuración Completa!")');
    await page.click('button:has-text("Comenzar a Usar LexMX")');
    await page.waitForURL('**/chat');
    
    // 6. Professional workflow with cost tracking
    await page.fill('textarea[placeholder*="consulta legal"]', 
      'Consulta simple: definición de contrato de compraventa'
    );
    await page.click('button[aria-label="Enviar mensaje"]');
    
    // Should use WebLLM for simple queries (free)
    await expect(page.locator('text=/WebLLM|$0|gratis/i')).toBeVisible({ timeout: 10000 });
    
    // 7. Complex query that might use Gemini
    await page.fill('textarea[placeholder*="consulta legal"]', 
      'Análisis complejo: implicaciones de la reforma energética en contratos de exploración petrolera existentes'
    );
    await page.click('button[aria-label="Enviar mensaje"]');
    
    // System might choose Gemini for complex analysis
    await page.waitForSelector('text=/respuesta|análisis/', { timeout: 30000 });
    
    // 8. Check cost tracking
    const costIndicator = page.locator('text=/$[0-9]+\\.[0-9]+|Costo:/');
    if (await costIndicator.count() > 0) {
      // Verify costs are minimal
      const costText = await costIndicator.textContent();
      expect(costText).toMatch(/\$0\.|gratis|free/i);
    }
  });

  test('WebLLM handles professional document analysis', async ({ page }) => {
    // Quick setup with WebLLM
    await page.evaluate(() => {
      localStorage.setItem('lexmx_providers', JSON.stringify([{
        id: 'webllm',
        name: 'WebLLM (Browser)',
        type: 'local',
        enabled: true,
        model: 'Llama-3.1-8B-Instruct-q4f32_1-MLC', // Larger model for documents
        priority: 1
      }]));
    });
    
    await navigateAndWaitForHydration(page, 'http://localhost:4321/chat');
    
    // 1. Upload or reference a legal document
    await page.click('button[title="Opciones avanzadas"]');
    
    // Check if document upload is available
    const uploadButton = page.locator('button[aria-label*="documento"], input[type="file"]');
    if (await uploadButton.count() > 0) {
      // Would upload a document here
    }
    
    // 2. Professional document analysis query
    await page.fill('textarea[placeholder*="consulta legal"]', 
      `Analiza las cláusulas de terminación anticipada en un contrato de arrendamiento comercial.
      Específicamente: 
      1) Causales válidas según el CCF
      2) Procedimiento de notificación
      3) Penalizaciones aplicables
      4) Jurisprudencia relevante`
    );
    await page.click('button[aria-label="Enviar mensaje"]');
    
    // 3. Verify WebLLM handles complex analysis
    await expect(page.locator('text="Analizando tu consulta legal..."')).toBeVisible();
    
    // Should provide structured response
    await expect(page.locator('text=/Código Civil Federal|CCF/')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('text=/terminación|arrendamiento/')).toBeVisible();
    
    // 4. Follow-up with specific article reference
    await page.fill('textarea[placeholder*="consulta legal"]', 
      '¿Qué establece específicamente el artículo 2483 del CCF sobre esto?'
    );
    await page.click('button[aria-label="Enviar mensaje"]');
    
    // WebLLM should maintain context
    await expect(page.locator('text=/2483|arrendamiento/')).toBeVisible({ timeout: 30000 });
    
    assertNoConsoleErrors(page);
  });
});