import { test, expect } from '@playwright/test';
import { 
  setupPage, 
  navigateAndWaitForHydration,
  clearAllStorage,
  setupMockProviders,
  assertNoConsoleErrors 
} from '../../utils/test-helpers';

test.describe('Legal Research and Wiki Navigation Journey', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
    await clearAllStorage(page);
    // Pre-configure a provider for chat integration
    await setupMockProviders(page);
  });

  test('comprehensive legal research workflow with wiki exploration', async ({ page }) => {
    // 1. Start with a legal question in mind
    await navigateAndWaitForHydration(page, 'http://localhost:4321/wiki');
    
    // Verify wiki loaded
    await expect(page.locator('h1:has-text("Wiki Legal Mexicano")')).toBeVisible();
    
    // 2. Explore glossary to understand legal terms
    await page.locator('h2:has-text("Glosario Legal")').scrollIntoViewIfNeeded();
    
    // Search for a specific term
    await page.fill('input[placeholder*="Buscar términos"]', 'amparo');
    await page.waitForTimeout(300); // Debounce
    
    // Should filter to show amparo
    await expect(page.locator('h4:has-text("Amparo")')).toBeVisible();
    
    // Expand term definition
    const amparoCard = page.locator('div:has(h4:has-text("Amparo"))');
    await amparoCard.locator('button').click();
    
    // Should show expanded definition
    await expect(amparoCard.locator('text=/protege.*derechos.*fundamentales/')).toBeVisible();
    
    // 3. Filter by legal area
    await page.click('button:has-text("Constitucional")');
    
    // Should show only constitutional terms
    await expect(page.locator('text="Debido Proceso"')).toBeVisible();
    
    // Clear filter
    await page.click('button:has-text("Todos")');
    
    // 4. Navigate to legal system section
    await page.click('button:has-text("Sistema Legal")');
    
    // Should show legal hierarchy
    await expect(page.locator('h2:has-text("Sistema Legal Mexicano")')).toBeVisible();
    await expect(page.locator('text=/Jerarquía.*Normativa/')).toBeVisible();
    
    // Verify hierarchy order
    const hierarchyItems = page.locator('list:has-text("Constitución") >> listitem');
    const items = await hierarchyItems.allTextContents();
    expect(items[0]).toContain('Constitución');
    expect(items[1]).toContain('Tratados');
    expect(items[2]).toContain('Leyes Federales');
    
    // 5. Explore legislative process
    await page.locator('h2:has-text("Proceso Legislativo")').scrollIntoViewIfNeeded();
    
    // Interact with process steps
    await page.click('button:has-text("Siguiente")');
    
    // Progress should update
    await expect(page.locator('text=/33%|34%/')).toBeVisible({ timeout: 5000 });
    
    // Click on specific step
    await page.click('div:has-text("3. Discusión en Cámara de Origen")');
    
    // Should show step details
    await expect(page.locator('text=/Debate.*votación/')).toBeVisible();
    
    // Continue through process
    await page.click('button:has-text("Siguiente")');
    await page.click('button:has-text("Siguiente")');
    
    // Reset process
    await page.click('button:has-text("Reiniciar")');
    await expect(page.locator('text="17%"')).toBeVisible();
    
    // 6. Explore government structure
    await page.click('button:has-text("Estructura del Gobierno")');
    await expect(page.locator('h2:has-text("Estructura del Gobierno")')).toBeVisible();
    
    // Switch between tabs
    await page.click('button:has-text("Niveles de Gobierno")');
    await expect(page.locator('text=/Federal|Estatal|Municipal/')).toBeVisible();
    
    // Back to division of powers
    await page.click('button:has-text("División de Poderes")');
    
    // Expand power details
    await page.click('div:has-text("Poder Judicial")');
    await expect(page.locator('text=/Impartición.*justicia/')).toBeVisible();
    
    // 7. Navigate to legal areas
    await page.click('button:has-text("Áreas del Derecho")');
    await expect(page.locator('h2:has-text("Áreas del Derecho")')).toBeVisible();
    
    // Click on labor law
    await page.click('link:has-text("Ver documentos →")[href*="labor"]');
    await page.waitForURL('**/legal#labor');
    
    // Should navigate to legal documents page with labor filter
    await expect(page.locator('text=/Laboral|LFT/')).toBeVisible();
    
    // 8. Return to wiki with browser back
    await page.goBack();
    await page.waitForURL('**/wiki');
    
    // 9. Access educational resources
    await page.click('button:has-text("Recursos Educativos")');
    
    // Scroll to FAQ section
    await page.locator('h2:has-text("Preguntas Frecuentes")').scrollIntoViewIfNeeded();
    
    // 10. Integrate with chat for deeper questions
    // After researching amparo in wiki, ask specific question in chat
    await page.click('link:has-text("Chat Legal")');
    await page.waitForURL('**/chat');
    
    // Ask question based on wiki research
    const researchQuery = 'Basándome en lo que leí sobre el amparo, ¿cuál es la diferencia entre amparo directo e indirecto?';
    await page.fill('textarea[placeholder*="consulta legal"]', researchQuery);
    await page.click('button[aria-label="Enviar mensaje"]');
    
    // Should get contextual response
    await page.waitForSelector('text=/directo.*indirecto/i', { timeout: 20000 });
    
    // 11. Cross-reference with documents
    await page.click('link:has-text("Códigos")');
    await page.waitForURL('**/legal');
    
    // Search for amparo law
    await page.fill('input[placeholder*="Buscar"]', 'Ley de Amparo');
    
    // Should find and be able to access
    await expect(page.locator('text=/Ley de Amparo/')).toBeVisible();
    
    assertNoConsoleErrors(page);
  });

  test('legal term discovery and learning path', async ({ page }) => {
    await navigateAndWaitForHydration(page, 'http://localhost:4321/wiki');
    
    // 1. Start with glossary exploration
    await page.locator('h2:has-text("Glosario Legal")').scrollIntoViewIfNeeded();
    
    // 2. Explore different legal areas
    const legalAreas = ['Civil', 'Penal', 'Laboral', 'Fiscal', 'Mercantil'];
    
    for (const area of legalAreas) {
      await page.click(`button:has-text("${area}")`);
      await page.waitForTimeout(300);
      
      // Verify area-specific terms appear
      const termsCount = await page.locator(`div:has(span:has-text("${area}"))`).count();
      expect(termsCount).toBeGreaterThan(0);
    }
    
    // 3. Search for complex terms
    await page.click('button:has-text("Todos")');
    await page.fill('input[placeholder*="Buscar términos"]', 'persona');
    
    // Should find "Persona Moral"
    await expect(page.locator('text="Persona Moral"')).toBeVisible();
    
    // 4. Learn about term relationships
    const personaMoralCard = page.locator('div:has(h4:has-text("Persona Moral"))');
    await personaMoralCard.locator('button').click();
    
    // Read definition and source
    await expect(personaMoralCard.locator('text=/Código Civil Federal/')).toBeVisible();
    
    // 5. Navigate to related area
    await page.click('link:has-text("Ver documentos →")[href*="civil"]');
    await page.waitForURL('**/legal#civil');
    
    // Should be in civil law section
    await expect(page.locator('text=/Civil|CCF/')).toBeVisible();
  });

  test('legislative process interactive learning', async ({ page }) => {
    await navigateAndWaitForHydration(page, 'http://localhost:4321/wiki');
    
    // Navigate to process section
    await page.locator('h2:has-text("Proceso Legislativo")').scrollIntoViewIfNeeded();
    
    // 1. Complete full process walkthrough
    const steps = [
      'Iniciativa',
      'Dictamen',
      'Discusión en Cámara de Origen',
      'Cámara Revisora',
      'Ejecutivo Federal',
      'Publicación'
    ];
    
    for (let i = 0; i < steps.length - 1; i++) {
      // Verify current step
      await expect(page.locator(`text="${steps[i]}"`).first()).toBeVisible();
      
      // Click next
      await page.click('button:has-text("Siguiente")');
      await page.waitForTimeout(300);
      
      // Progress should increase
      const progress = await page.locator('.wiki-progress >> text=%').textContent();
      const progressValue = parseInt(progress || '0');
      expect(progressValue).toBeGreaterThan(i * 16); // Roughly 16% per step
    }
    
    // 2. Should show completion
    await expect(page.locator('text=/100%|Publicación/')).toBeVisible();
    
    // 3. Access timeline information
    const timelineInfo = await page.locator('text=/90 días.*años/').isVisible();
    expect(timelineInfo).toBeTruthy();
    
    // 4. Reset and explore specific steps
    await page.click('button:has-text("Reiniciar")');
    
    // Click directly on step 4
    await page.click('div:has-text("4. Cámara Revisora")');
    
    // Should jump to that step
    await expect(page.locator('text=/Revisión.*segunda cámara/')).toBeVisible();
  });

  test('cross-feature legal research workflow', async ({ page }) => {
    // 1. Start research in wiki
    await navigateAndWaitForHydration(page, 'http://localhost:4321/wiki');
    
    // Research labor law
    await page.click('button:has-text("Áreas del Derecho")');
    await page.locator('h3:has-text("Derecho Laboral")').scrollIntoViewIfNeeded();
    await expect(page.locator('text=/trabajadores.*empleadores/')).toBeVisible();
    
    // 2. Check glossary for labor terms
    await page.locator('h2:has-text("Glosario Legal")').scrollIntoViewIfNeeded();
    await page.click('button:has-text("Laboral")');
    
    // Find contract definition
    await expect(page.locator('text="Contrato de Trabajo"')).toBeVisible();
    
    // 3. Navigate to labor documents
    await page.click('link:has-text("Ver documentos →")[href*="labor"]');
    await page.waitForURL('**/legal#labor');
    
    // 4. Open LFT document
    await page.click('link:has-text("Ley Federal del Trabajo")');
    await page.waitForURL('**/document/ley-federal-trabajo');
    
    // Search for Article 123
    await page.fill('input[placeholder*="Buscar"]', 'artículo 123');
    await page.keyboard.press('Enter');
    
    // 5. Go to chat with context
    await page.click('link:has-text("Chat Legal")');
    await page.waitForURL('**/chat');
    
    // Ask contextual question
    await page.fill('textarea[placeholder*="consulta legal"]', 
      'Con base en el artículo 123 constitucional y la LFT, ¿cuáles son los derechos básicos de los trabajadores?'
    );
    await page.click('button[aria-label="Enviar mensaje"]');
    
    // Should get comprehensive response
    await page.waitForSelector('text=/artículo 123|derechos.*trabajadores/i', { timeout: 20000 });
    
    // 6. Create a document request for more information
    await page.click('link:has-text("Solicitudes")');
    await page.waitForURL('**/requests');
    
    await page.click('button:has-text("Nueva Solicitud")');
    
    // Fill request based on research
    await page.fill('input[placeholder*="Título"]', 'Jurisprudencia Laboral - Derechos Fundamentales');
    await page.selectOption('select[name="type"]', { label: 'Jurisprudencia' });
    await page.fill('textarea[placeholder*="Descripción"]', 
      'Tesis y jurisprudencia sobre interpretación del artículo 123 constitucional'
    );
    
    assertNoConsoleErrors(page);
  });

  test('mobile wiki navigation and search', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await navigateAndWaitForHydration(page, 'http://localhost:4321/wiki');
    
    // 1. Verify mobile-friendly navigation
    await expect(page.locator('.wiki-navigation')).toBeVisible();
    
    // 2. Navigate sections on mobile
    await page.click('button:has-text("Sistema Legal")');
    await expect(page.locator('h2:has-text("Sistema Legal")')).toBeVisible();
    
    // 3. Use glossary search on mobile
    await page.locator('h2:has-text("Glosario Legal")').scrollIntoViewIfNeeded();
    await page.fill('input[placeholder*="Buscar términos"]', 'delito');
    
    // Should find term
    await expect(page.locator('text="Delito"')).toBeVisible();
    
    // 4. Interact with process visualization on mobile
    await page.locator('h2:has-text("Proceso Legislativo")').scrollIntoViewIfNeeded();
    
    // Process should be mobile-optimized
    await page.click('button:has-text("Siguiente")');
    await expect(page.locator('text=/Dictamen|33%/')).toBeVisible();
    
    // 5. Access areas on mobile
    await page.click('button:has-text("Áreas del Derecho")');
    
    // Cards should stack vertically
    const areaCards = page.locator('div:has(h3:has-text("Derecho"))');
    const count = await areaCards.count();
    expect(count).toBeGreaterThan(4);
  });
});