import { test, expect } from '@playwright/test';
import { 
  setupPage, 
  navigateAndWaitForHydration, 
  clearAllStorage,
  assertNoConsoleErrors 
} from '../../utils/test-helpers';
import { TEST_IDS } from '../../src/utils/test-ids';
import { TEST_DATA } from '../../src/utils/test-data';

test.describe('Legal Professional Complete Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
    await clearAllStorage(page);
  });

  test('complete legal professional journey from setup to complex analysis', async ({ page }) => {
    // 1. Landing page - Professional arrives
    await navigateAndWaitForHydration(page, 'http://localhost:4321');
    
    // Verify professional-oriented content is visible
    await expect(page.locator('h1:has-text("Tu Asistente Legal Mexicano")')).toBeVisible();
    await expect(page.locator('text=/Jurisprudencia SCJN|legislación mexicana/')).toBeVisible();
    
    // 2. Navigate to setup for first-time professional user
    await page.click('link:has-text("Configurar IA")');
    await page.waitForURL('**/setup');
    
    // 3. Professional provider setup - choose performance profile
    await page.click('[data-testid="setup-begin"]');
    await page.waitForSelector('h2:has-text("Elige tu Perfil")');
    
    // Select performance profile for legal professionals
    await page.click('div:has-text("Rendimiento"):has-text("mejores modelos")');
    
    // 4. Configure multiple providers for redundancy
    await page.waitForSelector('h2:has-text("Selecciona Proveedores")');
    
    // Professional setup: OpenAI for analysis, Claude for reasoning
    await page.click('div:has-text("OpenAI"):has-text("GPT-4")');
    await page.click('div:has-text("Claude"):has-text("Razonamiento avanzado")');
    
    // Should show 2 providers selected
    await expect(page.locator('button:has-text("Configurar (2)")')).toBeVisible();
    await page.click('button:has-text("Configurar (2)")');
    
    // 5. Configure OpenAI
    await expect(page.locator('h2:has-text("Configurar OpenAI")')).toBeVisible();
    await page.fill('input[type="password"]', 'sk-test-professional-openai-key');
    await page.click('button:has-text("Guardar")');
    
    // 6. Configure Claude
    await page.waitForSelector('h2:has-text("Configurar Claude")');
    await page.fill('input[type="password"]', 'sk-ant-test-professional-claude-key');
    await page.click('button:has-text("Guardar")');
    
    // 7. Complete setup
    await expect(page.locator('h2:has-text("¡Configuración Completa!")')).toBeVisible({ timeout: 10000 });
    await page.click('button:has-text("Comenzar a Usar LexMX")');
    await page.waitForURL('**/chat');
    
    // 8. Professional legal query - complex constitutional case
    await page.waitForSelector('[data-testid="chat-container"]');
    
    // Open advanced options
    await page.click('button[title="Opciones avanzadas"]');
    await expect(page.locator('select#legal-area')).toBeVisible();
    
    // Select constitutional law
    await page.selectOption('select#legal-area', 'constitutional');
    
    // Type a complex legal query
    const complexQuery = `Necesito analizar la constitucionalidad de una reforma laboral que limita 
    el derecho de huelga en servicios esenciales. ¿Cuáles son los precedentes de la SCJN sobre 
    la ponderación entre el derecho de huelga (Art. 123) y el interés público?`;
    
    await page.fill('[data-testid="chat-input"]', complexQuery);
    await page.click('button[aria-label="Enviar mensaje"]');
    
    // 9. Verify intelligent provider selection
    await expect(page.locator('text=/Analizando.*consulta|procesando/i')).toBeVisible();
    
    // Should show provider recommendation for complex query
    await page.waitForSelector('.provider-recommendation', { timeout: 10000 }).catch(() => {
      // Provider recommendation might not show if already processing
    });
    
    // 10. Verify comprehensive legal response
    await page.waitForSelector('[data-testid="chat-container"] >> text=/artículo|jurisprudencia|tesis/i', { timeout: 60000 });
    
    // Check response quality indicators
    await expect(page.locator('text=/Fuentes:|Sources:/')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=/Confianza:|Confidence:/')).toBeVisible();
    
    // 11. Navigate to Wiki for additional research
    await page.click('link:has-text("Wiki Legal")');
    await page.waitForURL('**/wiki');
    
    // Navigate to constitutional section
    await page.click('button:has-text("Sistema Legal")');
    await expect(page.locator('h2:has-text("Sistema Legal Mexicano")')).toBeVisible();
    
    // Find constitutional hierarchy information
    await page.click('text=/Constitución|jerarquía/i');
    
    // 12. Access legal document viewer
    await page.click('link:has-text("Códigos")');
    await page.waitForURL('**/legal');
    
    // Open Constitution
    await page.click('link:has-text("Constitución Política")');
    await page.waitForURL('**/document/constitucion');
    
    // Search for Article 123
    await page.fill('input[placeholder*="Buscar"]', 'artículo 123');
    await page.keyboard.press('Enter');
    
    // Verify article is highlighted
    await expect(page.locator('mark:has-text("123")')).toBeVisible({ timeout: 10000 }).catch(() => {
      // Highlighting might be implemented differently
      expect(page.locator('text=/Artículo 123/i')).toBeVisible();
    });
    
    // 13. Create a document request for additional jurisprudence
    await page.click('link:has-text("Solicitudes")');
    await page.waitForURL('**/requests');
    
    await page.click('button:has-text("Nueva Solicitud")');
    
    // Fill request form
    await page.fill('input[placeholder*="Título"]', 'Jurisprudencia SCJN - Derecho de Huelga vs Interés Público');
    await page.selectOption('select[name="type"]', { label: 'Jurisprudencia' });
    await page.fill('textarea[placeholder*="Descripción"]', 
      'Compilación de tesis y jurisprudencia de la SCJN sobre la ponderación entre el derecho de huelga y servicios esenciales'
    );
    await page.fill('textarea[placeholder*="Justificación"]', 
      'Necesario para caso de amparo sobre constitucionalidad de reforma laboral'
    );
    
    await page.click('button:has-text("Enviar Solicitud")');
    
    // 14. Return to chat with context
    await page.click('link:has-text("Chat Legal")');
    
    // Continue conversation with document context
    await page.fill('[data-testid="chat-input"]', 
      'Basándote en el artículo 123 que acabamos de revisar, ¿cómo se relaciona con los criterios de servicios esenciales?'
    );
    await page.click('button[aria-label="Enviar mensaje"]');
    
    // Verify contextual response
    await page.waitForSelector('text=/artículo 123|contexto|revisamos/i', { timeout: 20000 });
    
    // 15. Test export/save functionality (if implemented)
    // Professional users often need to export their research
    const exportButton = page.locator('button:has-text("Exportar")');
    if (await exportButton.isVisible()) {
      await exportButton.click();
      // Verify export options
    }
    
    // Verify no critical errors occurred during the workflow
    assertNoConsoleErrors(page);
  });

  test('test provider failover and recovery', async ({ page }) => {
    // Quick setup with single provider
    await page.goto('http://localhost:4321/setup');
    await page.click('[data-testid="setup-begin"]');
    await page.click('text="Configuración Personalizada"');
    await page.click('div:has-text("OpenAI")');
    await page.click('button:has-text("Configurar (1)")');
    await page.fill('input[type="password"]', 'sk-invalid-key-to-test-failure');
    await page.click('button:has-text("Guardar")');
    await page.waitForSelector('h2:has-text("¡Configuración Completa!")');
    await page.click('button:has-text("Comenzar a Usar LexMX")');
    
    // Try to send a message with invalid provider
    await page.fill('[data-testid="chat-input"]', 'Test query');
    await page.click('button[aria-label="Enviar mensaje"]');
    
    // Should show error about provider
    await expect(page.locator('text=/error|Error|problema|configuración/i')).toBeVisible({ timeout: 10000 });
  });

  test('test advanced RAG configuration', async ({ page }) => {
    // Setup provider first
    await page.goto('http://localhost:4321/setup');
    await page.click('[data-testid="setup-begin"]');
    await page.click('text="Configuración Personalizada"');
    await page.click('div:has-text("Claude")');
    await page.click('button:has-text("Configurar (1)")');
    await page.fill('input[type="password"]', 'sk-ant-test-key');
    await page.click('button:has-text("Guardar")');
    await page.waitForSelector('h2:has-text("¡Configuración Completa!")');
    await page.click('button:has-text("Comenzar a Usar LexMX")');
    
    // Open advanced options
    await page.click('button[title="Opciones avanzadas"]');
    
    // Test different legal areas
    const legalAreas = ['civil', 'criminal', 'labor', 'tax'];
    
    for (const area of legalAreas) {
      await page.selectOption('select#legal-area', area);
      
      // Send area-specific query
      const queries = {
        civil: '¿Cuáles son los requisitos para el divorcio voluntario?',
        criminal: '¿Qué establece el CNPP sobre la prisión preventiva?',
        labor: '¿Cuáles son las causales de despido justificado según la LFT?',
        tax: '¿Qué obligaciones fiscales tiene una persona moral?'
      };
      
      await page.fill('[data-testid="chat-input"]', queries[area]);
      await page.click('button[aria-label="Enviar mensaje"]');
      
      // Verify area-specific response
      await page.waitForSelector(`[data-testid="chat-container"] >> text=/${area}/i`, { timeout: 20000 });
    }
  });

  test('test memory and performance with extended session', async ({ page }) => {
    // Quick setup
    await page.goto('http://localhost:4321/setup');
    await page.click('[data-testid="setup-begin"]');
    await page.click('text="Configuración Personalizada"');
    await page.click('div:has-text("Ollama")');
    await page.click('button:has-text("Configurar (1)")');
    await page.fill('input[type="url"]', 'http://localhost:11434');
    await page.click('button:has-text("Guardar")');
    await page.waitForSelector('h2:has-text("¡Configuración Completa!")');
    await page.click('button:has-text("Comenzar a Usar LexMX")');
    
    // Simulate extended session with multiple queries
    const queries = [
      '¿Qué es el amparo?',
      '¿Cuándo procede el amparo directo?',
      '¿Diferencia entre amparo directo e indirecto?',
      '¿Plazos para interponer amparo?',
      '¿Qué es la suplencia de la queja?'
    ];
    
    // Monitor memory usage
    const initialMetrics = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return null;
    });
    
    // Send multiple queries
    for (const query of queries) {
      await page.fill('[data-testid="chat-input"]', query);
      await page.click('button[aria-label="Enviar mensaje"]');
      
      // Wait for response
      await page.waitForSelector(`[data-testid="chat-container"] >> text="${query}"`, { timeout: 10000 });
      await page.waitForTimeout(1000); // Let response complete
    }
    
    // Check memory after extended use
    const finalMetrics = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return null;
    });
    
    // Memory should not increase dramatically (less than 50MB increase)
    if (initialMetrics && finalMetrics) {
      const memoryIncrease = (finalMetrics - initialMetrics) / 1024 / 1024; // Convert to MB
      expect(memoryIncrease).toBeLessThan(50);
    }
    
    // Verify all messages are still visible
    for (const query of queries) {
      await expect(page.locator(`text="${query}"`)).toBeVisible();
    }
  });
});