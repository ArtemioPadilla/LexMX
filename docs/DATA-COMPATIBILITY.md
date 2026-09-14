# Contrato de compatibilidad de datos del cliente

LexMX guarda todo en el navegador del usuario. Este documento fija los nombres,
versiones y parámetros que **no pueden cambiar** sin una migración explícita,
porque un cambio silencioso deja ilegibles los datos de los usuarios actuales
(llaves cifradas de proveedores, casos, historial, corpus instalado).

Cualquier PR que toque uno de estos valores debe (1) incrementar la versión
correspondiente, (2) implementar `onupgradeneeded` o una migración de claves,
(3) actualizar esta tabla y (4) añadir un test que lea datos con el formato
anterior. Este contrato se convierte en tests en la Fase 3 del plan
(`docs/INCEPTOR-MIGRATION-ANALYSIS.md`).

## IndexedDB

| Base | Versión | Object stores | Dónde |
|---|---|---|---|
| `lexmx_vectors` | ver `src/lib/storage/indexeddb-vector-store.ts` | vectores y metadatos de embeddings | `src/lib/storage/indexeddb-vector-store.ts` |
| `lexmx_metadata` | ver `src/lib/storage/metadata-store.ts` | `lineages`, `audits`, `changeDetection`, `ragMetadata` | `src/lib/storage/metadata-store.ts` |
| `LexMX_Enhanced_Storage` | 4 | almacenamiento offline y caché | `src/lib/storage/enhanced-offline-storage.ts` |
| `LexMX_OfflineQueue` | 2 | cola de operaciones offline | `src/lib/offline/offline-queue-manager.ts` |

## localStorage / sessionStorage

| Clave | Contenido | Dónde |
|---|---|---|
| `lexmx_openai_key`, `lexmx_claude_key`, `lexmx_gemini_key` | llaves de proveedor cifradas (ver cifrado) | `src/lib/security/secure-storage.ts` |
| `lexmx_cases` | casos del usuario (JSON) | `src/islands/CaseManager.tsx` |
| `lexmx_query_history` | historial de consultas para métricas locales | `src/lib/admin/admin-data-service.ts` |
| `lexmx-search-history` | historial de búsquedas | islas de búsqueda |
| `lexmx_user_preferences`, `lexmx_user_fingerprint` | preferencias y huella del dispositivo | `src/lib/security` |
| `lexmx_push_subscription`, `lexmx_pwa_state` | estado PWA | `src/lib/pwa` |
| `lexmx_quality_results`, `lexmx_quality_test_results` | resultados de pruebas de calidad | `src/lib/admin/quality-test-suite.ts` |
| `language` | idioma (`es` / `en`) | `src/i18n/index.ts` |
| `theme` | `light` / `dark` / `system` (JSON) | `src/components/ThemeToggle.tsx`, `BaseLayout.astro` |
| `webllm_loaded_models` | modelos WebLLM descargados | `src/lib/llm/providers/webllm-provider.ts` |

## Cifrado (WebCrypto)

| Parámetro | Valor | Dónde |
|---|---|---|
| Algoritmo | `AES-GCM`, llave de 256 bits | `src/lib/security/encryption.ts` |
| Derivación de llave | `PBKDF2`, `SHA-256`, `keyDerivationRounds` (ver config) | `src/lib/security/encryption.ts` |
| Sal | 16 bytes aleatorios | `src/lib/security/encryption.ts` |
| IV | 12 bytes aleatorios | `src/lib/security/encryption.ts` |

Cambiar cualquiera de estos valores hace ilegibles las llaves guardadas. Si se
cambia, hay que re-cifrar con la contraseña del usuario en el momento del
próximo desbloqueo, nunca de forma silenciosa.

## Service worker y manifest

| Elemento | Valor actual | Nota |
|---|---|---|
| Registro del SW | `${base}sw.js` | `src/components/layout/BaseLayout.astro` |
| Caché del SW | `lexmx-${CACHE_VERSION}` | `public/sw.js` |
| Manifest | `public/manifest.json`, sin `id`, `start_url: "./"` | Al pasar a `@vite-pwa/astro` (Fase 5) el SW nuevo debe borrar los caches `lexmx-*` y fijar `id` explícito para no reinstalar la PWA |

## Origen

La app vive en `https://artemiop.com/LexMX/` (redirigida desde
`artemiopadilla.github.io/LexMX/`). Mientras el origen y el subpath no
cambien, IndexedDB y localStorage se conservan entre despliegues.
