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
| `lexmx_vectors` | 1 | `documents`, `embeddings`, `metadata` (claves `corpusVersion`: `version|buildDate|checksum` del corpus instalado; `installedDocuments`: ids instalados, para reanudar) | `src/lib/storage/indexeddb-vector-store.ts`, `src/lib/corpus/corpus-installer.ts` |
| `lexmx_metadata` | ver `src/lib/storage/metadata-store.ts` | `lineages`, `audits`, `changeDetection`, `ragMetadata` | `src/lib/storage/metadata-store.ts` |
| `LexMX_Enhanced_Storage` | 4 | almacenamiento offline y caché | `src/lib/storage/enhanced-offline-storage.ts` |
| `LexMX_OfflineQueue` | 2 | cola de operaciones offline | `src/lib/offline/offline-queue-manager.ts` |
| `LexMX_Cases` | 1 | `cases` (expedientes; fechas en ISO). En la primera apertura importa `localStorage['lexmx_cases']` (formato viejo) y marca `lexmx_cases_migrated_v1`; la clave vieja no se borra | `src/lib/case-management/case-store.ts` |

### Corpus publicado (`public/legal-corpus/`, `public/embeddings/`)

| Archivo | Contrato |
|---|---|
| `legal-corpus/metadata.json` | `version`, `buildDate`, `totalDocuments`, `checksum`, `documents[]` (`id`, `title`, `type`, `hierarchy`, `primaryArea`, `size`, `lastUpdated`) |
| `legal-corpus/<id>.json` | un `LegalDocument`; cada `content[i]` es el chunk `${id}_chunk_${i}` |
| `embeddings/index.json` | layout `per-document` (2.1): `documents[id] = { file, count }`; layout legado: `batchFiles` con `embeddings-NNN.json` |
| `embeddings/by-document/<id>.json` | `[{ id, embedding, metadata }]` de ese documento; solo secciones `article` (los ids conservan el índice de la sección: `<doc>_chunk_<i>` ↔ `content[i]`); `metadata.contentType` y `metadata.transitory` (aditivos) alimentan `src/lib/rag/ranking.ts` |

El cliente instala documento por documento (`CorpusInstaller`), guarda el
progreso en `lexmx_vectors.metadata` y **borra los vectores** cuando cambia
`corpusVersion`. Un cambio de modelo de embeddings (`Xenova/multilingual-e5-small`,
384 dimensiones) exige cambiar `version` en `index.json` para forzar la
reinstalación.

## localStorage / sessionStorage

| Clave | Contenido | Dónde |
|---|---|---|
| `lexmx_openai_key`, `lexmx_claude_key`, `lexmx_gemini_key` | llaves de proveedor leídas como respaldo de variables de entorno | `src/lib/utils/env-config.ts` |
| `lexmx_provider_<id>` | configuración de proveedor cifrada (AES-GCM) | `src/lib/security/secure-storage.ts` |
| `lexmx_cases` | casos del usuario (JSON) | `src/islands/CaseManager.tsx` |
| `lexmx_query_history` | historial de consultas para métricas locales | `src/lib/admin/admin-data-service.ts` |
| `lexmx-search-history` | historial de búsquedas | islas de búsqueda |
| `lexmx_user_preferences`, `lexmx_user_fingerprint` | preferencias y huella del dispositivo | `src/lib/security` |
| `lexmx_push_subscription`, `lexmx_pwa_state` | estado PWA | `src/lib/pwa` |
| `lexmx_quality_results`, `lexmx_quality_test_results` | resultados de pruebas de calidad | `src/lib/admin/quality-test-suite.ts` |
| `language` | idioma (`es` / `en`) | `src/i18n/index.ts` |
| `theme` | `light` / `dark` / `system` (JSON) | `src/components/ThemeToggle.tsx`, `BaseLayout.astro` |
| `webllm_loaded_models` | modelos WebLLM descargados | `src/lib/llm/providers/webllm-provider.ts` |
| `lexmx_document_requests` | solicitudes de documentos creadas en este navegador, votos y comentarios locales (`{ requests, votes, comments }`) | `src/lib/document-requests/request-store.ts` |
| `lexmx_jurisdiction` | código de jurisdicción activa (`mx`, `cl`, …); ausente ⇒ `mx` | `src/stores/jurisdiction.ts` |
| `lexmx_last_visit` | ISO de la última visita, para "Novedades" (reformas posteriores) | `src/islands/RecentReformsIsland.tsx` |
| `lexmx_kdf_salt` | sal PBKDF2 por instalación (base64, 16 bytes). Borrarla hace ilegibles los payloads versión 2 | `src/lib/security/encryption.ts` |
| `lexmx_request_voter_id` | id anónimo aleatorio para evitar votos duplicados; nunca se envía | `src/lib/document-requests/request-store.ts` |


## Cifrado (WebCrypto)

| Parámetro | Valor | Dónde |
|---|---|---|
| Algoritmo | `AES-GCM`, llave de 256 bits | `src/lib/security/encryption.ts` |
| Derivación de llave | `PBKDF2`, `SHA-256`, `keyDerivationRounds` (ver config) | `src/lib/security/encryption.ts` |
| Sal | **Versión 2**: 16 bytes aleatorios por instalación, guardados en `localStorage['lexmx_kdf_salt']` (base64). Los payloads con `version: 1` (sal constante `'lexmx-legal-assistant-2024'`) se siguen descifrando con la sal heredada y `SecureStorage.retrieve` los re-cifra con la versión 2 en su primera lectura correcta; nunca se borran en silencio | `src/lib/security/encryption.ts`, `src/lib/security/secure-storage.ts` |
| IV | 12 bytes aleatorios | `src/lib/security/encryption.ts` |

Cambiar cualquiera de estos valores hace ilegibles las llaves guardadas. Si se
cambia, hay que re-cifrar con la contraseña del usuario en el momento del
próximo desbloqueo, nunca de forma silenciosa.

## Service worker y manifest

| Elemento | Valor | Dónde |
|---|---|---|
| Worker | `sw.js` generado por `@vite-pwa/astro` (Workbox, `injectManifest`) desde `src/sw.ts`; `registerType: autoUpdate` | `astro.config.mjs`, `src/sw.ts`, `src/lib/pwa-register.ts` |
| Manifest | `manifest.webmanifest` con `id` fijo = `BASE` (`/LexMX`) para que el navegador siga tratando la PWA como la misma app instalada | `astro.config.mjs` |
| Caches | `workbox-precache-v2-*` (build), `corpus-shards` (JSON de `legal-corpus/` y `embeddings/`, cache-first), `hf-models` (modelo de embeddings), `assets` | `src/sw.ts` |
| Caches heredadas | `lexmx-*` (worker anterior en `public/sw.js`): el worker nuevo las borra en `activate` | `src/sw.ts` |
| Mensajes | `SKIP_WAITING`, `SEND_NOTIFICATION`, `GET_CACHE_INFO` → `CACHE_INFO`; sync tags `legal-query-sync` / `document-upload-sync` → `SYNC_REQUESTED` a las ventanas | `src/sw.ts`, `src/lib/pwa/pwa-manager.ts`, `src/lib/offline/offline-queue-manager.ts` |

## Origen

La app vive en `https://artemiop.com/LexMX/` (redirigida desde
`artemiopadilla.github.io/LexMX/`). Mientras el origen y el subpath no
cambien, IndexedDB y localStorage se conservan entre despliegues.
