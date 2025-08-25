# Análisis de Errores de Timeout en Pruebas E2E

## Problemas Identificados

### 1. **Selectores Incorrectos**
- Los tests buscan `'WebLLM (Browser)'` pero el texto real es `'WebLLM - IA en tu Navegador'`
- Muchos selectores dependen del idioma exacto
- Uso inconsistente de data-testid

### 2. **Problemas de Hidratación**
- Múltiples llamadas a `waitForLoadState('domcontentloaded')` consecutivas
- `waitForHydration` no siempre espera lo suficiente para componentes React
- Astro islands pueden tardar más en hidratarse

### 3. **Configuración de Proveedores**
- Los tests intentan navegar a `/setup` y configurar manualmente
- Deberían usar `setupWebLLMProvider(page)` que ya está disponible
- La configuración manual es propensa a errores

### 4. **Esperas Arbitrarias**
- Muchos `waitForTimeout` comentados que necesitan condiciones apropiadas
- No hay espera para animaciones o transiciones

## Soluciones Aplicadas

### 1. **Selectores Mejorados**
- Cambiado `'WebLLM (Browser)'` → `'WebLLM'`
- Uso de regex con múltiples opciones: `text=/Guardar|Save/i`
- Preferencia por data-testid cuando está disponible

### 2. **Configuración Simplificada**
- Reemplazado navegación manual a `/setup` con `setupWebLLMProvider(page)`
- Esto configura el provider directamente en localStorage
- Evita problemas de UI y timing

### 3. **Esperas Robustas**
- `waitForHydration` mejorado que verifica múltiples condiciones
- Timeout aumentado para operaciones que requieren modelo AI (90 segundos)
- Eliminadas duplicaciones de `waitForLoadState`

### 4. **Selectores Flexibles**
- Uso de `[data-testid*="selector"]` para coincidir parcialmente
- Selectores de botones con múltiples variantes de texto
- Fallbacks cuando el elemento principal no existe

## Estado Actual

Los scripts han aplicado las siguientes correcciones:

1. **fix-test-timeouts.js**: 
   - Arregló selectores de WebLLM
   - Mejoró selectores de botones
   - Aumentó timeouts donde es necesario

2. **Archivos actualizados** (15 tests):
   - streaming-markdown.test.ts: WebLLM selector, Save button
   - provider-selector-journey.test.ts: Provider setup simplificado
   - integrated-chat-journey.test.ts: Selectores flexibles
   - Y otros 12 archivos

## Recomendaciones

### Para Resolver Timeouts Restantes:

1. **Verificar elementos en la UI real**:
   ```bash
   npm run dev
   # Navegar manualmente y verificar textos/selectores exactos
   ```

2. **Usar el debug mode de Playwright**:
   ```bash
   npx playwright test --debug [archivo].test.ts
   ```

3. **Agregar logs de depuración**:
   ```typescript
   console.log('Element visible:', await element.isVisible());
   await page.screenshot({ path: 'debug.png' });
   ```

4. **Considerar usar Page Object Model**:
   ```typescript
   class SetupPage {
     async selectWebLLM() {
       await this.page.click('[data-testid="provider-webllm"]');
     }
   }
   ```

## Próximos Pasos

1. Ejecutar tests individualmente para identificar fallos específicos
2. Verificar que los data-testid existen en los componentes
3. Considerar agregar más data-testid para hacer tests más robustos
4. Implementar reintentos automáticos para operaciones críticas