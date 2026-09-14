# LexMX → Inceptor: análisis de migración

Fecha: 2026-09-13, revisión 6: validación adversarial (§8), mercado (§9), cobertura (§10), programa LATAM (§11) y backend en Supabase (§11.9). Alcance:
estado real de LexMX hoy, qué ofrece Inceptor, opciones comparadas y un plan
por fases. No se modificó código de producto; todos los números se midieron en
este entorno (Node 22, `npm ci` limpio) sobre `main` de ambos repos.

## 1. Veredicto en seis líneas

- **LexMX sí funciona en producción** (https://artemiop.com/LexMX/ responde 200
  y el build local pasa), pero con deuda seria: 584 errores de tipos, CI en
  rojo desde julio, 25 vulnerabilidades de npm, y un RAG que corre sobre un
  corpus de juguete con fallback silencioso a datos mock.
- **Adoptar Inceptor conviene**, pero la ruta más barata y segura **no es un
  repo nuevo**: es actualizar LexMX en sitio (Astro 5, React 19, Tailwind 4,
  que resultan casi gratis una vez borradas las rutas API), traer la capa de
  proceso y las compuertas de Inceptor con un *ratchet* de calidad, y sanear
  módulo por módulo dentro del mismo repo.
- Un repo nuevo (patrón *strangler*) sigue siendo válido si se quiere historial
  limpio, pero en GitHub Pages implica renombrar repos, stubs de redirección y
  un contrato de compatibilidad de datos que la primera versión de este
  documento no había considerado.
- El mayor riesgo del producto **no es el framework, es el contenido**: 3
  documentos de muestra y 14 vectores. Ninguna migración lo arregla; el corpus
  real necesita su propia fase.
- **Las plataformas comerciales de IA legal en México fijan el listón** (§9):
  corpus federal + 32 estados + jurisprudencia SCJN + DOF actualizado a diario,
  cita verificable a un clic, derogadas excluidas. LexMX no compite ahí hoy. Su
  cuña es lo que un SaaS en la nube no puede ofrecer: local-first, sin que el
  expediente salga de la máquina, con corpus y evaluación abiertos.
- **Decisión del equipo (§11): el objetivo es paridad total con todo el
  mercado, más los diferenciadores propios, a escala LATAM.** Eso convierte
  el plan en un programa de tres horizontes con un núcleo local intacto y un
  servidor opcional autoalojable para lo que un sitio estático no puede hacer.
  México sigue siendo el primer país; la paridad y LATAM son metas del
  programa, no del primer release.

## 2. Estado real de LexMX (medido)

### 2.1 Salud del repo

| Métrica | Valor | Fuente |
|---|---|---|
| Último commit en `main` | 2026-07-15 (`5f629a2`), 25 commits | git log |
| `npm run build` | ✅ 27 páginas, 48 s | local |
| `tsc --noEmit` / `astro check` | ❌ 526 / 584 errores | local |
| `vitest run` | 481 ✅ / 14 ❌ / 9 skipped en esta corrida | local |
| Dónde fallan los tests | 12 en `lib/ingestion/__tests__/url-ingestion-integration.test.ts` (mocks de pdfjs/mammoth); 2 en `env-config.test.ts` por variables AWS del entorno | local |
| `eslint` | 0 errores / 495 warnings (casi todos `no-explicit-any`) | local |
| `npm audit` | 25 vulns (3 critical, 15 high) | local |
| CI en `main` | ❌ `ci.yml`, `quality.yml`, `validate-deployment.yml` caen en type-check; `deploy.yml` ✅ | GitHub Actions |
| PRs / issues abiertos | 12 PRs (11 Dependabot desde 2025-08, más #73) / 0 issues | GitHub |
| Sitio en vivo | ✅ `/` y `/chat/` responden 200 vía redirect a artemiop.com | curl |

El PR #73 baja los errores de tipos de 584 a 252 y documenta que subir Astro
4→7 falla con `NoAdapterInstalled`: 13 archivos en `src/pages/api/**` declaran
`prerender = false` en un sitio `output: 'static'` sin adapter. Ese es el
bloqueo de cualquier upgrade de Astro, y esas rutas no existen en producción.

### 2.2 Tamaño y forma

| | LexMX | Inceptor |
|---|---|---|
| LOC `src/` (sin tests) | ~58.8k | ~25.5k |
| Astro / React / Tailwind | 4.16 / 18.3 / 3.4 | 5.18 / 19.2 / 4.3 |
| TypeScript / Node | 5.9 instalado (`^5.6`) / ≥20 | 6.0 / ≥22 |
| Librería UI | ninguna: 33 componentes a mano (~9k LOC) | Base UI + shadcn: 91 archivos en `ui/` |
| Islas React | 23 archivos, 11.6k LOC | 52 |
| Tests | 30 vitest + 42 Playwright | 158 vitest + 7 Playwright (visual, axe, teclado) |
| JS en `dist/` | 9.2 MB; chunk mayor 5.4 MB (transformers.js importado estático) | presupuesto Lighthouse 150 KB/ruta, **solo local** (ver §3.1) |

### 2.3 Qué está vivo, qué está muerto

**Vivo y con valor real** (se conserva y se sanea):

| Módulo | LOC sin tests | Tests | Errores tsc | Nota |
|---|---|---|---|---|
| `lib/llm/` | 7 867 | 2 | 61 | registry de 10 proveedores, `provider-manager`, `intelligent-selector`, `prompt-builder`; 4 pares duplicados |
| `lib/rag/` | 2 597 | 1 | 38 | `engine`, `contextual-chunker`, `hybrid-search`, `vector-search` |
| `lib/ingestion/` | 1 852 | 4 | 34 | parser real con pdfjs y mammoth; **sus tests de integración son los que fallan** |
| `lib/storage/` | 1 388 | 0 | 9 | vector store y metadata en IndexedDB |
| `lib/legal/` | 1 379 | 0 | 30 | |
| `lib/embeddings/` | 992 | 0 | 24 | 3 adaptadores de 35 líneas hechos para tests |
| `lib/security/` | 750 | 0 | 11 | AES-GCM + PBKDF2 con WebCrypto |
| `lib/corpus/` | 380 | 0 | 2 | |
| Islas vivas | 11.6k | 1 | ~45 | ChatInterface 735, ProviderSetup 869 (23 errores), CaseManager 1 405 (+CaseChat 615, +CaseTimeline 403), DocumentViewer*, DocumentRequest*, 5 del wiki |
| Diccionarios i18n | ~1 300 claves hoja por idioma | 1 | | `systemPrompts` ocupa 4.4 KB de los 75 KB de `es.json` |

Cinco de los ocho módulos de `lib/` **no tienen tests**. "Portar con sus
tests" significa escribirlos: es el grueso del trabajo, no un pie de página.

**Vivo pero acoplado a lo que se va a borrar** (corrección de la revisión 1):

- `lib/admin/` (2 992 LOC sin tests) **no está muerto**: `BaseLayout.astro:138`
  monta `<APIAdapter />` en cada página, que carga `lib/api/client-api.ts`, que
  importa `CorpusService`, `EmbeddingsService`, `AdminDataService` y los dos
  `Quality*Service`. `CorpusManager.tsx` y `QualityMetrics.tsx` importan
  `lib/admin/*` directamente y además hacen `fetch(getUrl('api/...'))` que el
  adapter atiende en el navegador. Las rutas API sí están muertas; los
  servicios detrás, no.

**Muerto, duplicado o no desplegable** (se borra):

- 13 rutas `src/pages/api/**` (`prerender = false`), `src/lib/api/`,
  `APIAdapter.astro`.
- Islas sin montar en ninguna página: `ModerationPanel`, `NotificationCenter`,
  `admin/EmbeddingsManager` (~1 455 LOC; las dos primeras solo aparecen en el
  mapa de fallbacks de `HydrationBoundary.tsx`).
- Proveedores LLM duplicados con cero importadores: `openai.ts`, `claude.ts`,
  `gemini.ts`, `ollama.ts` (`providers/index.ts` solo usa los `*-provider.ts`),
  más `webllm-provider.old.ts` (import estático de web-llm) y `webllm-mock.ts`.
- `src/context/I18nProvider.tsx` y `src/stores/theme.ts`: cero importadores.
  Segundo sistema i18n (`src/i18n/translations/`, `ClientTranslations.astro`
  montado en cada página, `T.astro` que hace fetch de JSON en runtime).
- `astro.config.mjs` `manualChunks` referencia 6 paquetes no instalados
  (`pdf-parse`, `idb`, `i18next`, `react-i18next`, `chart.js`,
  `react-chartjs-2`) y 3 rutas equivocadas.
- Basura en raíz: 9 PNG, `test-results.json` (904 KB, no es JSON), 12
  post-mortem de E2E que describen archivos que ya no existen, `docs/demo/` con
  7.7 MB de GIF/MP4 regenerados por `update-demo.yml`, ~24 codemods en
  `scripts/`.

### 2.4 El punto incómodo: el RAG es demo

- `public/legal-corpus/`: 3 JSON de ~2 KB (Constitución, CCF, LFT), un solo
  chunk cada uno. `public/embeddings/`: 14 vectores de 384 dimensiones.
- `rag/engine.ts` intenta embeddings reales al inicializar (línea 114) y, si
  falla, `useRealEmbeddings = false`; `embedding-manager.ts:93-96` cae al
  proveedor mock con un `console.warn`. Con corpus vacío el engine responde con
  `mockDocuments` hardcodeados (líneas 638-697).
- El chat conversa si el usuario configura un proveedor (BYOK) o WebLLM, pero
  las citas salen de ese índice mínimo.
- `CLAUDE.md` describe un `lib/case-management/` que no existe: los casos viven
  en `localStorage['lexmx_cases']` dentro de `CaseManager.tsx`.

## 3. Qué da Inceptor y qué no

### 3.1 Lo que resuelve directamente

- **Subpath de GitHub Pages**: `ASTRO_BASE` + `withBase()` en `src/lib/href.ts`.
  Equivale al `getUrl()` de LexMX (25 archivos): reemplazo mecánico.
- **Compuertas en CI**: `npm run check` corre en paralelo `astro check`, `tsc`,
  vitest, eslint y `check-ts-pragmas`, luego build. Playwright visual
  light/dark, axe WCAG AA y recorrido de teclado en `visual.yml`. CI verde hoy.
  **Lighthouse y los budgets no están en CI**: `ci.yml:70-77` los difiere a
  local hasta tener staging; `lighthouse-budgets.json` es una sola regla `/*`.
- **Capa de proceso**: agentes `prometeo` / `forja` / `centinela`, `doctor`,
  `ship`, `monday`, triage de issues con Claude (`claude.yml`), `FeedbackFAB` +
  `ErrorBoundary` + `HydrationCanary` que pre-llenan issues. Esto es lo que
  hace viable retomar en modo issue → PR con agentes.
- **Primitivas de IA** (`ui/ai/`): `ChatThread` con auto-scroll, `PromptInput`,
  `StreamingText`, `ThinkingIndicator`, `CitationRef`/`CitationList`,
  `AIOutputLabel` (exigido por `docs/ETHICS.md`), `AIFeedback`. Con el split
  panel de `AppLayoutIsland` es la UI que un RAG legal necesita.
- **Shells**: `AppLayoutIsland`, `WizardIsland` (para reemplazar
  `ProviderSetup`), `DetailsPage*`, `DataTable` con TanStack.
- **PWA** con `@vite-pwa/astro`, stores `$online`/`$installPrompt`,
  `OfflineBanner`, `UpdateToast`. **Tauri** desktop y Android en un script.
- **Todo esto se puede adoptar pieza por pieza**: `registry.json` (shadcn, 25
  items) y `mcp-server/` sirven componentes individuales; agentes, checklists,
  `forbidden-imports.json` y workflows son archivos que se copian.

### 3.2 Lo que NO trae y hay que construir

1. **No hay ruta brownfield documentada.** `init.mjs` se niega sobre un
   directorio existente (`:37-38`) y genera un proyecto sin PWA, i18n ni
   Playwright. Adoptar en sitio es copiar archivos y usar el registry.
2. **i18n para islas no existe en Inceptor.** Su sistema es compile-time y
   tipado pero solo lo usan 3 páginas `.astro`; cero islas traducen. LexMX ya
   tiene un singleton sin Context (`src/i18n/index.ts`, set de listeners en
   líneas 107-112): se conserva y se envuelve en `useSyncExternalStore`. No
   hay que construir un sistema nuevo.
3. **Sin renderizado de Markdown en el chat.** `ChatMessage` solo hace
   `whitespace-pre-wrap`. Se conserva `react-markdown` + `remark-gfm`.
4. **IndexedDB solo como caché de TanStack Query.** Los stores de LexMX se
   conservan.
5. **El backend de IA asumido es servidor BYOK** (`docs/recipes/ai-byok.md`),
   lo contrario de la inferencia en navegador. No es conflicto, pero los
   recipes no aplican tal cual.
6. **Presupuesto de 150 KB vs 5.4 MB de transformers.js.** Workbox no
   precachea `.onnx/.wasm/.bin` (no están en `globPatterns`), pero el chunk JS
   de 5.4 MB supera el límite por defecto de 2 MiB y queda fuera del precache
   en silencio: funciona online, falla offline. Hay que importar
   transformers.js diferido (hoy estático en `transformers-provider.ts:3`;
   web-llm ya es diferido) y fijar `maximumFileSizeToCacheInBytes` a
   propósito.
7. **TS 6 con `noUncheckedIndexedAccess`** genera errores nuevos sobre código
   que ya trae 526. Adoptar la config de Inceptor solo sobre módulos ya
   saneados (ver ratchet en §5).

## 4. Opciones comparadas

Datos que cambian la comparación (medidos para la revisión 2):

- React 18→19: cero usos de `ReactDOM.render`, `defaultProps`, `forwardRef`,
  string refs o `react-dom/test-utils`; `@testing-library/react` ya es `^16.3`.
  **React 19 es gratis.**
- Astro 4→5: el único bloqueo es `prerender = false` en 13 archivos. Borrar
  `src/pages/api`, `src/lib/api`, `APIAdapter.astro` y `/admin/quality` lo
  elimina. `astro-compress` y `@astrojs/sitemap` tienen versiones para Astro 5.
- Tailwind 3→4: `tailwind.config.mjs` no tiene plugins (comentados), 4 archivos
  usan `@apply`, 3 paletas custom pasan a `@theme`. **Cambio pequeño.**
- GitHub Pages: no hay `CNAME` en el repo; `artemiop.com` está ligado a la
  cuenta, así que **el subpath lo dicta el nombre del repo**. Un repo nuevo
  vive en `/<nombre-nuevo>/`; quedarse en `/LexMX/` exige renombrar dos repos.
- Datos de usuario en el mismo origen: IndexedDB `lexmx_metadata`,
  `lexmx_vectors`, `LexMX_Enhanced_Storage`, `LexMX_OfflineQueue`;
  localStorage `lexmx_openai_key`, `lexmx_claude_key`, `lexmx_gemini_key`,
  `lexmx_cases`, `language`, `webllm_loaded_models`. Cualquier cambio de
  nombre, `version` o parámetros de derivación de clave (PBKDF2) los deja
  ilegibles.

| Opción | Qué implica | Pros | Contras |
|---|---|---|---|
| **A+. Actualizar en sitio + adoptar Inceptor por piezas (recomendada)** | Borrar rutas API y adapter, subir Astro 5 / React 19 / TW 4, copiar agentes, gates y workflows de Inceptor, instalar componentes vía registry, sanear módulo por módulo con ratchet | Sin repo nuevo, sin renombrar, sin migración de datos, sin URLs rotas, historial intacto; gates activos desde la semana 2 | El saneamiento ocurre en el mismo árbol; el ratchet exige disciplina para no relajarlo |
| **C. Repo nuevo + strangler** | Fork del template, podar vitrina, portar módulo por módulo con `check` verde como compuerta | Historial limpio; cada módulo entra limpio | Doble renombre de repos o cambio de subpath; stubs de redirección para 8 rutas; contrato de datos y limpieza del SW viejo; dos repos vivos varias semanas; el trabajo de saneamiento es el mismo |
| **B. Copiar LexMX dentro de un fork** | Volcar `src/` encima del template | Arranque rápido | `check` rojo desde el día 1; el gate se vuelve decorativo |

La revisión 1 recomendaba C con el argumento de que "TW 4 y React 19 se hacen
igual" y que las compuertas no serían aplicables en sitio. Lo primero es
cierto pero barato; lo segundo se resuelve con un ratchet (§5, Fase 2). C
queda como alternativa si se prefiere historial limpio y se aceptan los
contras de la tabla.

## 5. Plan por fases (opción A+)

Cada fase termina con build verde y deploy a `/LexMX/`. El sitio nunca deja de
servir. Tamaños en orden de magnitud para una persona con agentes.

### Fase 0 — Congelar y limpiar (1-2 días)

- Mergear #73 (baja 584→252 errores) o al menos su `overrides` de
  `onnxruntime-web`.
- Cerrar los 11 PRs de Dependabot; pausar `dependabot.yml`, `corpus-update.yml`
  (cron semanal), `update-demo.yml`, `release.yml`, `validate-deployment.yml`.
- Borrar: PNGs de raíz, `test-results.json`, los 12 post-mortem de E2E,
  `docs/demo/`, codemods en `scripts/`, `Makefile`, `Dockerfile`, `nginx.conf`,
  `docker-compose.yml`, `.playwright-mcp/`.
- Borrar código muerto listado en §2.3 (islas sin montar, proveedores
  duplicados, `src/context`, `src/stores/theme.ts`, `wiki.css`, `test.astro`,
  `document/[...slug].astro`).

### Fase 1 — Upgrade de plataforma en sitio (3-5 días)

- Borrar `src/pages/api/**`, `src/lib/api/`, `APIAdapter.astro`,
  `pages/admin/quality.astro` + `QualityMetrics.tsx` y los servicios de
  `lib/admin` que solo ellos usan (`quality-*`, `query-analyzer`). Conservar
  `corpus-service`, `embeddings-service`, `admin-data-service` para
  `CorpusManager`, llamados directo sin `fetch`.
- `astro@5`, `@astrojs/react@5`, `react@19`, `@tailwindcss/vite` en lugar de
  `@astrojs/tailwind`; paletas `legal`, `document`, `hierarchy.1-7` a `@theme`
  en `global.css`; quitar `manualChunks` rotos; `vitest@4`; Node 22 con
  `.nvmrc`; `engines` ≥22.
- `ClientTranslations.astro` y `T.astro` fuera de `BaseLayout`; el singleton de
  `src/i18n/index.ts` se queda.
- Compatibilidad de datos como contrato escrito: nombres de DB y stores,
  `version`, parámetros PBKDF2/AES-GCM y claves `lexmx_*` no cambian.
- Build verde y deploy. Nada cambia para el usuario.

### Fase 2 — Capa Inceptor y ratchet (2-3 días)

- Copiar `.claude/agents/`, `.claude/checklists/`, `scripts/{doctor,ship,
  monday,new-issue}.sh`, `check-ts-pragmas.mjs`, `forbidden-imports.test.ts`,
  `ci.yml` (con actionlint), `deploy-failure-issue.yml`, `claude.yml`.
  Reescribir `CLAUDE.md` con las convenciones de Inceptor.
- Instalar vía registry: `ErrorBoundary`, `HydrationCanary`, `FeedbackFAB`,
  `report-issue`, `disposer`, `use-client-preference`, `href`, `flags`.
  `getUrl()` → `withBase()`.
- **Ratchet**: `tsconfig.strict.json` con la config de Inceptor
  (`noUncheckedIndexedAccess`) cuyo `include` empieza vacío y crece por
  módulo saneado; script en CI que falla si el conteo de errores de `tsc`
  global o de warnings `no-explicit-any` sube respecto a un baseline
  versionado. `npm run check` queda verde desde aquí y solo puede mejorar.

### Fase 3 — Saneamiento del núcleo (3-5 semanas)

~13.4k LOC de `lib/` con ~210 errores de tipos, ~70 `any` y casi sin tests.
Orden por dependencia; cada módulo entra al `include` estricto con tests
nuevos y sin `any`:

1. `lib/security` y `lib/storage` (contrato de datos como tests). Hallazgo al
   sanear `security`: la sal de PBKDF2 es una constante fija, no 16 bytes
   aleatorios como decía el contrato. Se documentó el comportamiento real y
   queda como issue propio: migrar a sal aleatoria por usuario re-cifrando
   las llaves guardadas en el siguiente desbloqueo, nunca en silencio.
2. `lib/llm`: una implementación por proveedor; prompts a `lib/llm/prompts/`
   (por claridad, no por peso).
3. `lib/embeddings`: transformers.js por `import()` diferido; borrar los 3
   adaptadores de 35 líneas; `maximumFileSizeToCacheInBytes` en Workbox.
4. `lib/rag`, `lib/legal`, `lib/corpus`.
5. `lib/ingestion`: escribir tests unitarios reales del pipeline (los 6 casos
   rojos de `url-ingestion-integration.test.ts` se retiraron en la Fase 1
   porque asumían el fetch previo a `cors-aware-fetch`).

### Fase 4 — Chat y configuración sobre primitivas Inceptor (1-2 semanas)

- `/chat` con `ChatThread`, `PromptInput`, `StreamingText`, `CitationList`,
  `AIOutputLabel`, `AIFeedback` y `react-markdown`; estado en Nano Stores;
  `useTranslation` envuelto en `useSyncExternalStore`.
- `/setup` con `WizardIsland` + `Form` (react-hook-form + zod) en lugar de
  `ProviderSetup` (869 LOC, 23 errores) y los 4 componentes de `providers/`.
- Segunda regla en `lighthouse-budgets.json` para `/chat`; medir con
  `npm run lighthouse` en local.

### Fase 5 — Resto de UI (1-2 semanas)

- Wiki: 4 de 5 islas son contenido estático → `.astro` con `Accordion`/`Tabs`;
  `LegalGlossary` sigue siendo isla.
- `document/[id]` (conservar el hack de `404.astro` para `/document/*` hasta
  tener `getStaticPaths` completo) y `requests/*` sobre `DetailsPage*`,
  `DataTable`, `Form`.
- `/admin/corpus`: reescritura de `CorpusManager` sobre `DataTable`.
- `CaseManager` + `CaseChat` + `CaseTimeline` (2 423 LOC, sin capa de
  storage): reescritura con `DataTable`, `Timeline`, `Splitter`; migrar
  `localStorage['lexmx_cases']` a IndexedDB con lectura del formato viejo.
- Sustituir `public/sw.js` por `@vite-pwa/astro`: el SW nuevo debe borrar los
  caches `lexmx-*` y fijar `manifest.id` explícito para no reinstalar la PWA.

### Fase 6 — Corpus real (abierta, independiente del framework)

- Fuente y licencia por documento (DOF, Diputados) y proceso de actualización;
  `corpus-update.yml` existe pero nunca se validó.
- Embeddings reales generados en build o distribuidos por release.
- Tauri desktop para el caso "corpus completo + modelo local".

Total a paridad: del orden de 2 a 3 meses, sin contar el corpus.

### Si se elige C (repo nuevo) de todos modos

Añadir a lo anterior: (1) construir bajo `/lexmx-next/` y cortar solo al
terminar la Fase 5, o hacer el doble renombre y publicar stubs de redirección
para `/casos`, `/wiki`, `/requests/*`, `/document/*`, `/about`, `/legal`,
`/privacy`, `/offline`; (2) actualizar los enlaces hardcodeados a GitHub en
`AboutContent.tsx:179-198` y `MobileMenu.tsx:211`; (3) el mismo contrato de
datos y limpieza de SW de la Fase 5, porque el origen es el mismo.

## 6. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Relajar el ratchet "para avanzar" | Baseline versionado en el repo; subirlo requiere PR y centinela lo rechaza |
| Bundle de `/chat` fuera de presupuesto y fuera del precache | Import diferido de transformers.js; `maximumFileSizeToCacheInBytes` explícito; regla de budget para `/chat` |
| Cambiar nombres/versiones de IndexedDB o parámetros de cifrado | Contrato de datos de la Fase 1 convertido en tests en la Fase 3 |
| SW viejo (`lexmx-v2`) y manifest sin `id` | Limpieza de caches `lexmx-*` en el SW nuevo; `manifest.id` fijo |
| Base UI en `1.0.0-rc.0` | Allowlist de axe ya existe en `tests/visual/a11y.spec.ts`; no mezclar con Radix |
| Sanear mucho y seguir sin corpus | Fase 6 se planea en paralelo desde la Fase 3; el chat muestra cuándo responde sin fuentes |
| Cinco módulos sin tests | Escribirlos es parte del alcance de la Fase 3, no un extra |

Retirado respecto a la revisión 1: "View Transitions activas en Inceptor". Su
`global.css` usa `@view-transition { navigation: auto }`, que es
cross-document: la página se recarga completa y los listeners no sobreviven.
La disciplina `createDisposer()` sigue siendo buena práctica, no una
mitigación de ese riesgo.

## 7. Qué se borra (lista explícita)

`src/pages/api/**`, `src/lib/api/**`, `APIAdapter.astro`,
`src/lib/admin/{quality-test-suite,quality-test-service,quality-results-service,query-analyzer}.ts`,
`src/pages/admin/quality.astro`, `src/islands/admin/QualityMetrics.tsx`,
`src/islands/ModerationPanel.tsx`, `src/islands/NotificationCenter.tsx`,
`src/islands/admin/EmbeddingsManager.tsx`,
`src/lib/llm/providers/{openai,claude,gemini,ollama}.ts`,
`webllm-provider.old.ts`, `webllm-mock.ts`, `src/context/`,
`src/stores/theme.ts`, `src/i18n/translations/**`, `ClientTranslations.astro`,
`T.astro`, `src/styles/wiki.css`, `src/pages/test.astro`,
`document/[...slug].astro`, `Makefile`, `Dockerfile`, `nginx.conf`,
`docker-compose.yml`, `scripts/fix-*`, `migrate-tests*`, `update-test-*`,
`docs/demo/**`, `update-demo.yml`, `release.yml`, `validate-deployment.yml`,
`quality.yml`.

Se conserva aunque parezca admin: `lib/admin/{corpus-service,embeddings-service,admin-data-service}.ts`
(los usa `CorpusManager`) y el hack de `404.astro` para `/document/*`.

## 8. Validación adversarial (qué cambió entre la revisión 1 y la 2)

Un agente revisor con acceso a ambos repos intentó tumbar el plan. Hallazgos
aceptados y corregidos arriba:

1. **`lib/admin` no está muerto** (bloqueante): corre en el navegador vía
   `APIAdapter` en cada página. Reclasificado; LOC corregidas de 5.7k a 2 992.
2. **El cutover "apuntar el subpath" no existe en Pages** (bloqueante): el
   subpath lo dicta el nombre del repo. Motivó cambiar la recomendación a A+.
3. **Migración de datos no considerada** (mayor): mismo origen, 4 bases
   IndexedDB y ~15 claves `lexmx_*`; añadido contrato de datos y limpieza de SW.
4. **"Portar con sus tests" era vacío** (mayor): 5 de 8 módulos sin tests; los
   tests rojos son justo los de ingestion. Fase de núcleo re-estimada de 1-2 a
   3-5 semanas.
5. **Opción A subestimada** (mayor): React 19 sin rupturas, Astro 5 bloqueado
   solo por 13 archivos, Tailwind 4 trivial. Tabla de opciones reescrita.
6. **"View Transitions activas" era falso** (mayor): retirado.
7. **Lighthouse no está en CI**, `systemPrompts` pesa 4.4 KB y no 75, LOC de
   `llm`/`ingestion`/CaseManager sobreestimadas, 3 rutas rotas en
   `manualChunks` y no 2: corregidos.

Hallazgos no aceptados: ninguno. Diferencia de conteo de tests (481/504 aquí
vs 491/514 en la corrida del revisor) atribuida a entorno; se reporta la
corrida propia.

## 8b. Estado de ejecución (bitácora)

Rama `claude/lex-inceptor-migration-analysis-qmg92a`. Cada fase se cierra con
`npm run check` verde.

| Fase | Estado | Evidencia |
|---|---|---|
| 0 Congelar y limpiar | ✅ | Commit "Fase 0": PR #73 fusionado en la rama, basura y código muerto fuera, Dependabot y cron pausados |
| 1 Upgrade en sitio | ✅ | Astro 5.18, React 19, Tailwind 4, Vitest 4, Node 22; capa API y quality borradas; `docs/DATA-COMPATIBILITY.md` |
| 2 Capa Inceptor y ratchet | ✅ | Agentes, checklists, scripts, ErrorBoundary/HydrationCanary/FeedbackFAB, `ratchet.mjs`, `tsconfig.strict.json`, `ci.yml`, CLAUDE.md nuevo |
| 3 Saneamiento del núcleo | ✅ | Ola 1 (security, storage, legal, corpus, embeddings, utils) y ola 2 (llm, rag, admin, ingestion, document-requests, document-viewer, offline, notifications, pwa, config, dev, i18n, infraestructura de tests) en estricto con tests reales. Los 32 errores de `tsc` que quedan viven en islas y componentes que reescriben las Fases 4 y 5 |
| 4 Chat y configuración | ✅ | Kit UI de Inceptor instalado; `/chat` sobre ChatThread/PromptInput/CitationList/AIOutputLabel/AIFeedback con modos Pregunta/Investiga, `grounded` y enlaces oficiales; `/setup` como wizard Stepper + Form + zod; `useTranslation` sobre `useSyncExternalStore`; humo en Chromium. Pendiente: presupuesto Lighthouse para `/chat` |
| 5 Resto de UI | ✅ | Wiki estático (4 islas → Astro), SW Workbox vía `@vite-pwa/astro` con `manifest.id` fijo y limpieza de caches `lexmx-*`, expedientes en IndexedDB (`LexMX_Cases`, migración desde `lexmx_cases`) con `CaseWorkspace` sobre el kit; `document/[id]` generado desde el manifiesto del corpus en build; `requests/*` local-first (cola publicada + votos/comentarios locales, alta como issue de GitHub); presupuestos Lighthouse (`/*` y `/chat`); `CorpusManager` sobre TanStack Table con orden, búsqueda y filtros |
| 6 Corpus real | 🔄 | Importador desde LegalIA (`src/pipeline/legalia.ts`, `scripts/corpus/*`) probado con la LFT real; `corpus-update.yml` publica el release `corpus-latest` y `deploy.yml` lo consume; embeddings por documento (layout 2.1) y `CorpusInstaller` en el cliente: instala por shard, reanuda, omite la red si la versión ya está en IndexedDB y reporta progreso en `$corpusInstall`; oleada 1 ampliada a 39 leyes federales (`DEFAULT_SLUGS`) importadas sin fallos con el parser corregido |
| 7 Modo grounded y evaluación | 🔄 | Chat muestra `grounded` y fuentes con enlace oficial; benchmark de recuperación (`evals/`, 43 casos) sobre las 39 leyes: documento recall@5 = 0.98, artículo recall@5 = 0.81, recall@10 = 0.93 tras (a) indexar solo artículos (los títulos/capítulos desplazaban artículos reales) y (b) penalizar transitorios ×0.92; reglas compartidas en `src/lib/rag/ranking.ts` y el eval; `evals/baseline.json` sube a 0.813. Corregido: el motor buscaba en un índice en memoria vacío cuando el corpus real estaba instalado (siempre `grounded=false`); ahora consulta el vector store con el prefijo `query:` de e5 |
| 8-9 | ⏳ | |
| 11.2 Jurisdicción | 🔄 | `src/jurisdictions/` (contrato + módulo México: entidades, jerarquía, fuentes, citas) en estricto con tests; falta cablear `LegalDocument.jurisdiction` y los demás países |
| 11.4 C Producto local-first | 🔄 | Chat con cita verificable y modo grounded, modos Pregunta/Investiga, filtro jurisdiccional, expedientes en IndexedDB, calculadora laboral MX (finiquito/liquidación) en `/herramientas`, Biblioteca (`/biblioteca`: instalado, tamaño, fecha, actualizar/borrar), novedades desde la última visita en la portada (fechas de reforma del corpus), plantillas por jurisdicción en `/plantillas` (contrato individual de trabajo, carta poder, solicitud de acceso a la información; campos → escrito anclado a artículos, exportación Markdown/Word (.docx)/PDF por impresión, todo en el navegador), comparación de documentos en `/comparar` (diff por línea y palabra, unificado o lado a lado, carga TXT/PDF/DOCX, copia como diff unificado), OCR en el dispositivo con Tesseract.js (`/herramientas` y automático en el extractor de PDF cuando una página no trae capa de texto) y dictado por voz en el chat (SpeechRecognition del navegador, opt-in y etiquetado). Falta: transcripción local con Whisper |
| 11.4 E Canales | 🔄 | Servidor MCP local `scripts/mcp/server.ts` (`search_corpus`, `get_article`, `list_documents` sobre stdio, sin dependencias) probado contra el corpus de 14 leyes; PWA con Workbox; LexMX Escritorio (Tauri 2, `src-tauri/`, `desktop.yml`); complemento de Word (`public/office/manifest.xml` + `/office/taskpane`: el mismo chat como panel de tareas con «Insertar última respuesta» vía Office.js, con o sin citas; sin servidor). Falta: móvil (Tauri 2 Android/iOS) |
| 11.4 G Confianza | 🔄 | `/seguridad`, marco de privacidad por país en cada módulo, aviso en cada respuesta, `docs/CONTRIBUTING-JURISDICTIONS.md`; `docs/SECURITY-PROGRAM.md` (mapa de controles a ISO 27001 Anexo A y alineación con ISO 42001, con lo que ya es código y lo pendiente) y `docs/COMMUNITY.md` (despachos aliados y clínicas/estudiantes: qué reciben, qué aportan, reglas). Falta: auditoría externa, benchmark comunitario con más corpus |
| 11.9 Supabase | 🔄 | `supabase/` (6 migraciones con RLS, 4 Edge Functions, `supabase.yml`, test de invariantes); cliente guardado `src/lib/supabase.ts`, `$session`/`$guardUser`, `route-guard.tsx`, `/cuenta` con alta e inicio de sesión (modo local si no hay variables); pestañas Organizaciones (crear, integrantes, roles por allowlist, invitaciones con token hasheado + Edge Function `accept-invite`), Plan y consumo (suscripción y `usage` del mes, solo lectura, cuotas por plan) y Monitoreo (expedientes vigilados por adaptador, leyes seguidas, notificaciones) sobre `src/lib/server/*` con tests contra un cliente falso. Falta: portal de pago del proveedor, adaptadores reales de tribunales corriendo en pg_cron |

Métricas del ratchet: 584 → 234 (PR #73) → 171 (Fase 1) → 169 (Fase 2) → 123
errores de `tsc` tras la ola 1 → 32 tras la ola 2 → **0** tras las Fases 4-5;
`any` 282 → 256 → 20 → **0**; tests 502 → 410 reales tras borrar rutas API y
casos obsoletos → 557 tras la ola 2 → 600+ (todos verdes).

## 9. Estado del arte comercial y complemento al plan

Se revisaron las páginas públicas, planes, fichas de tiendas de apps y
documentación de seguridad de **12 plataformas comerciales mexicanas** de IA
legal, **2 plataformas regionales de LATAM** con entrada anunciada a México,
**3 editoriales jurídicas incumbentes** con asistente de IA, y **6 proyectos
open source o de datos abiertos** relevantes (consulta: 2026-09-13). Las
plataformas comerciales no se nombran: el objetivo es fijar el listón de
capacidades que un usuario ya da por hecho, no comparar marcas. Los proyectos
abiertos sí se nombran, porque la intención es reutilizarlos con atribución.
No se encontraron reseñas independientes con sustancia; lo que sigue es lo que
las propias plataformas publican.

### 9.1 Qué ofrece hoy el mercado

Patrón común: SaaS en la nube con suscripción mensual medida en tokens o
consultas, y dos segmentos claramente separados:

| Segmento | Qué hace | Modelo de acceso |
|---|---|---|
| **Público general** | Preguntas en lenguaje llano sobre trabajo, renta, familia, consumo y deudas; cada respuesta cita artículo y ley con enlace al documento oficial; notas de voz; subir contratos o recibos para que los explique; canalización a un abogado cuando el caso lo amerita | Nivel gratuito con cupo mensual de preguntas y documentos; suscripción de cientos de pesos al mes para uso ilimitado; apps iOS y Android |
| **Abogados y despachos** | Investigación con jurisprudencia y tesis (registro digital, época, instancia); lectura de expedientes completos con OCR; redacción de escritos y cálculos desde una conversación; complemento para Word; biblioteca de leyes; control de cambios entre versiones de un documento, comparado en el navegador sin subirlo; extracción de datos de decenas de documentos a una tabla; conexión con sistemas de tribunales; cuentas de organización con facturación única y consumo por usuario | De cientos a un par de miles de pesos al mes según cupo de tokens y módulos; precio reducido para estudiantes y académicos |

Corpus declarado por las plataformas líderes: legislación federal y de los 32
estados, Semanario Judicial de la Federación (tesis y jurisprudencia SCJN con
registro digital, época e instancia), DOF revisado varias veces al día,
tribunales administrativos y autoridades fiscales; reformas recientes
(laboral 2019, judicial 2024) integradas; legislación derogada excluida de
resultados; decenas de miles de documentos.

Infraestructura declarada: modelo de un solo proveedor, alojado en nube de
Estados Unidos; documentos del usuario almacenados en la nube del proveedor;
cifrado en reposo, MFA, bitácora de auditoría; certificaciones SOC 2 / ISO
27001 "en curso"; residencia de datos en México solo para contratos
enterprise.

Otras señales: iniciativas de benchmark legal mexicano anotado por la
comunidad, anunciadas pero sin datos publicados todavía; programas de
"design partners" con despachos; encuestas de adopción en LATAM.

**Bandas de precio observadas** (suscripción individual, MXN al mes): desde
$79-$170 en las plataformas de consumo con uso ilimitado, $399-$499 en el
plan de entrada para abogados, $999 en el intermedio con complemento de Word,
$1 999 en el superior con agentes y módulos de documentos; planes corporativos
a medida. Dos jugadores ofrecen nivel gratuito con cupo. Los incumbentes
editoriales no publican precio.

**Capacidades que ya son piso** (aparecen en la mayoría): búsqueda de
jurisprudencia SCJN con cita al registro; legislación federal y estatal;
redacción de escritos y contratos; análisis de documentos subidos; enlace a la
fuente oficial. **Diferenciadores que solo tienen uno o dos**: predicción de
sentencias, comparación de documentos sin subirlos, extracción tabular,
captura automática de acuerdos de tribunales (OAJ/CJF y boletines estatales),
gestión completa del despacho (expedientes, finanzas, portal de clientes),
multi-modelo (el usuario elige entre varios LLM), certificación ISO 42001.

**Lo que nadie ofrece**: procesamiento local sin que el documento salga del
equipo, corpus abierto reutilizable, código abierto, o modelo local. Todas las
plataformas revisadas son SaaS en nube; dos declaran explícitamente que los
documentos del usuario se almacenan en nube de terceros fuera de México.

**Ecosistema abierto que sí existe y conviene reutilizar**:

| Proyecto | Qué es | Por qué importa para LexMX |
|---|---|---|
| **LegalIA** (INGEOTEC, UNAM; Apache-2.0) | Monorepo Python con clientes para la API JSON de SIDOF (DOF) y para la API **SCOW** de `legislacion.scjn.gob.mx`, reconstrucción del texto vigente de cada ley a partir de sus reformas, conversión a Markdown/Akoma Ntoso, embeddings de leyes federales | Resuelve la mitad de la Fase 6: la API SCOW devuelve por ley `materia` y `vigencia` (VIGENTE, ABROGADO, DEROGADO, SIN EFECTO…), historial de reformas con exposición de motivos, y versión por artículo con fecha. Es la fuente correcta para "vigencia como dato" |
| **Dataset de leyes federales en Hugging Face** (justicedao) | 884 k filas, 169 MB, parquet, un registro por artículo con `law_id`, `article_number`, título y texto | Semilla inmediata para el corpus federal mientras se monta el pipeline propio; verificar licencia antes de redistribuir |
| **Repositorio SCJN de descarga en formatos abiertos** | CSV y API JSON de tesis y jurisprudencia del SJF con filtros por época, instancia, materia y tipo | Fuente de jurisprudencia; enlace de verificación en `sjf2.scjn.gob.mx/detalle/tesis/{registro}` |
| **Justicio** (España, MIT, ~150 estrellas) | Asistente RAG sobre el BOE: ingesta diaria, chunks de ~1 200 caracteres, embeddings Sentence-BERT en español afinados, Qdrant, FastAPI, y un **framework de evaluación** publicado | Arquitectura de referencia para un RAG legal abierto en español y, sobre todo, para la Fase 9 de evaluación |
| **Servidores MCP sobre datos legales abiertos** (Brasil, Indonesia, EUR-Lex) | Patrón: un servidor MCP sin llaves sobre APIs públicas de legislación y jurisprudencia | Canal de distribución adicional: "LexMX como fuente" para cualquier agente; Inceptor ya trae un `mcp-server/` como plantilla |
| Asistentes locales genéricos (doc-haus, legal-document-chat) | Chat con documentos propios sobre Ollama, 100 % offline, sin corpus jurídico | Confirman la demanda del nicho local-first, y que nadie lo ha hecho con corpus mexicano |

### 9.2 Qué tienen ellos que nosotros no

| Capacidad | Mercado | LexMX hoy | Brecha |
|---|---|---|---|
| Corpus real y actualizado | Federal + 32 estados + SJF + DOF diario | 3 docs de muestra, solo federal | **La brecha que define todo lo demás** |
| Jurisprudencia | Tesis con registro, época, instancia, enlace a sjf2.scjn.gob.mx | Ninguna; `source-validator.ts` ya conoce el patrón de URL de sjf2 | Alta |
| Cita verificable a un clic | Artículo + ley + enlace al documento oficial | Cita desde chunks mock, sin enlace a fuente | Alta, y barata de cerrar una vez haya corpus |
| Vigencia | Derogadas excluidas; reformas integradas | `lib/legal/version-manager.ts` existe pero sin datos | Media |
| Dos modos de uso | Lenguaje llano para público vs técnico para abogados | Un chat genérico | Media; `systemPrompts.specializations` ya da la base |
| Documentos del usuario | Expedientes completos, OCR, comparación en navegador, extracción tabular | Ingestion solo para admin; `CaseManager` en localStorage | Alta |
| Redacción y cálculos | El asistente redacta escritos y calcula (finiquitos, indemnizaciones) | Nada | Alta |
| Canales | Web, iOS, Android, complemento de Word, notas de voz | Web (PWA al 40 %) | Media; Tauri y PWA cubren móvil |
| Abogado humano | Canalización por materia y estado | Nada | No aplica a un sitio estático |
| Equipos y facturación | Organizaciones, consumo por usuario | Nada | No aplica sin backend |
| Confianza institucional | Página de seguridad detallada, MFA, audit log, certificaciones en curso | Página de privacidad; la arquitectura client-side no está demostrada ni documentada | Media; distinta naturaleza |
| Evaluación | Benchmarks comunitarios anunciados, aún sin datos | `quality-test-suite` con datos mock | Media; oportunidad de llegar antes |
| Academia | Precio reducido para estudiantes, alianzas con despachos | Nada | Baja |

### 9.3 Dónde LexMX puede ganar (no copiar)

Todo lo que apareció en la búsqueda es SaaS en la nube: los expedientes se
suben a servidores de terceros fuera de México, el modelo lo elige el
proveedor, el corpus es cerrado y el precio es una suscripción mensual. No
encontré ninguna plataforma local-first ni de código abierto. Ahí está la
cuña:

1. **El expediente nunca sale de la máquina.** RAG, embeddings y, con WebLLM o
   Tauri, la inferencia corren en el dispositivo. Para secreto profesional,
   datos de menores, asuntos penales o despachos sin política de nube esto no
   es una preferencia sino un requisito. En el mercado, la residencia de datos
   en México es un extra enterprise.
2. **Corpus y evaluación abiertos.** Publicar el pipeline de corpus y los
   shards versionados (federal, SJF, DOF) como datos abiertos reutilizables,
   y publicar resultados de evaluación. Los benchmarks comunitarios todavía
   no existen; LexMX puede tener uno corriendo primero y en público.
3. **Trae tu propio modelo.** Multi-proveedor, incluido local con Ollama y
   WebLLM. El mercado ofrece un modelo fijo.
4. **Gratis para estudiantes de verdad**, no con descuento: mismo corpus,
   mismo código.

Lo que no hay que perseguir desde un sitio estático: canalización a abogados,
cuentas de organización con facturación, conexiones a tribunales. Un
complemento de Word sí es viable (un add-in de Office es una página web más
un manifiesto; puede vivir en el mismo deploy), pero después de tener corpus.

### 9.4 Complemento al plan

Las fases 0-5 de §5 no cambian. La Fase 6 deja de ser "abierta" y se
convierte en el producto; se añaden las capacidades del mercado que sí
encajan con la arquitectura, en el orden en que dependen unas de otras.

#### Fase 6 — Corpus real, concreto (4-8 semanas, en paralelo desde la Fase 3)

Fuentes con acceso abierto verificado:

| Fuente | Acceso | Uso |
|---|---|---|
| Leyes federales, texto vigente y vigencia | API SCOW de `legislacion.scjn.gob.mx` vía el cliente `scjn` de LegalIA (materia, vigencia, historial de reformas, versión por artículo); `diputados.gob.mx/LeyesBiblio` como respaldo (ya en `document-fetcher.ts`) | Corpus federal completo (~300 leyes) con `vigente` y `fecha_ultima_reforma` de origen, no inferidos |
| Jurisprudencia y tesis | Repositorio SCJN con descarga en formatos abiertos (CSV y API JSON, 1-100 documentos por consulta, filtros por época, instancia, materia, tipo); detalle público en `sjf2.scjn.gob.mx/detalle/tesis/{registro}` | Colección de tesis con registro digital, época, instancia, materia; enlace de verificación |
| DOF | SIDOF datos abiertos y API de alertas (`sidof.segob.gob.mx`) | Detección diaria de reformas; disparador de re-ingesta |
| Legislación estatal | Congresos estatales y `ordenjuridico.gob.mx`; heterogénea | Por oleadas: CDMX, Edomex, Jalisco, Nuevo León primero |

Diseño:

- **Pipeline en GitHub Actions** (`corpus-update.yml` ya existe, nunca
  validado): descarga con los clientes `dofjson` y `scjn` de LegalIA (Python,
  en un job aparte) o con un port mínimo a TypeScript de sus llamadas; parseo
  con `lib/ingestion`, chunking con `contextual-chunker`, embeddings en build, y publicación de **shards
  versionados por materia y jurisdicción** en GitHub Releases (o un bucket),
  no en `public/`: decenas de miles de documentos no caben en un sitio de
  Pages ni en IndexedDB de golpe.
- **Carga diferida en el cliente**: el usuario elige materias y estados; el
  cliente descarga solo esos shards y los cachea en `lexmx_vectors`. Pantalla
  de "corpus instalado" con tamaño, fecha de última reforma y botón de
  actualizar.
- **Vigencia como dato**: cada documento lleva `vigente`,
  `fecha_ultima_reforma`, `abrogada_por`; el buscador excluye derogadas por
  defecto y lo muestra cuando el usuario las pide.
- **Licencias**: revisar términos de uso del repositorio SCJN y de SIDOF antes
  de redistribuir shards; las leyes federales y las tesis son documentos
  oficiales públicos, pero el empaquetado debe citar origen.

#### Fase 7 — Cita verificable y dos modos (1-2 semanas, con la Fase 4 de chat)

- `CitationList` de Inceptor con enlace directo a la fuente oficial: página
  del PDF de diputados para artículos, `sjf2.scjn.gob.mx/detalle/tesis/{registro}`
  para tesis. Es la función más visible del mercado y la más barata una vez
  hay corpus.
- **Modo grounded**: la respuesta solo puede citar fragmentos recuperados; un
  validador post-respuesta marca cualquier cita que no exista en el corpus y
  la muestra como "no verificada". `AIOutputLabel` con `confidence: 'low'`
  cuando no hubo recuperación.
- **Modo Pregunta / Modo Investiga**: dos presets de prompt y de UI (lenguaje
  llano con "qué significa para ti" vs técnico con registro, época e
  instancia) sobre `systemPrompts.specializations`, que ya existe.
- Estado "sin fuentes": el chat dice explícitamente cuándo responde sin
  corpus, en vez del fallback silencioso a mock de hoy.

#### Fase 8 — Herramientas sobre documentos del usuario (2-4 semanas)

- **Control de cambios en navegador**: `pdfjs` y `mammoth` ya extraen texto;
  añadir un diff (por ejemplo `diff` de npm) y una vista lado a lado con
  explicación del impacto legal por cambio. En LexMX es la única forma de
  hacerlo, y coincide con la promesa de privacidad.
- **Revisión tabular**: extracción de campos de N documentos a una `DataTable`
  de Inceptor con exportación (`download-trigger`), con esquema definido por
  el usuario (partes, fechas, montos, cláusulas).
- **Calculadoras laborales deterministas** (finiquito, indemnización
  constitucional, prima de antigüedad, vacaciones, aguinaldo: LFT arts. 48,
  50, 76, 80, 87, 162) como funciones puras con tests, expuestas como
  herramientas al modelo. Más barato y más confiable que dejar que el LLM
  calcule.
- `CaseManager` reescrito (Fase 5) pasa a ser el contenedor de todo esto:
  expediente = documentos + comparaciones + tablas + notas, en IndexedDB.

#### Fase 9 — Evaluación abierta y confianza (2-3 semanas)

- Reemplazar `quality-test-suite` (mock) por un **conjunto de evaluación
  propio** de preguntas con respuesta y cita esperada, por materia, versionado
  en el repo; correrlo en CI contra el corpus con recuperación real y
  publicar precisión de cita y tasa de "no verificada". Adherirse a los
  benchmarks comunitarios en cuanto publiquen datos.
- Página `/seguridad` propia que demuestre, no solo afirme, la arquitectura:
  qué sale de la máquina y a dónde (solo la llamada al proveedor elegido, o
  nada con WebLLM), cómo se cifran las llaves, cómo borrar todo. La ventaja
  estructural está del lado de LexMX.
- **LexMX Escritorio** con Tauri (script de Inceptor): corpus completo y
  modelo local en disco; el producto para despachos que no pueden usar nube.

#### Después, si hay tracción

Complemento de Word (página web + manifiesto, mismo deploy), Tauri Android,
apps en tiendas. Nunca: canalización a abogados, facturación de equipos,
conexiones a tribunales, salvo que aparezca un backend y un modelo de negocio
que los justifique.

### 9.5 Riesgos específicos de esta parte

| Riesgo | Mitigación |
|---|---|
| Redistribuir tesis y leyes sin revisar términos | Revisión de términos de SCJN y SIDOF antes de la Fase 6; citar origen en cada shard |
| Corpus estatal inabarcable | Oleadas por estado y materia; publicar cobertura explícita |
| Shards demasiado grandes para el cliente | Cuantizar embeddings, shard por materia; medir en un equipo de gama media |
| Construir herramientas antes que corpus | Fase 7 y 8 dependen de la 6; no adelantar UI sobre mock |
| Competir en features con empresas financiadas | No competir en amplitud; competir en local-first, apertura y costo cero |

## 10. Cobertura frente al mercado y alcance geográfico

Respuesta corta: **no, el plan no da "todo lo de la competencia"**, y no
debería intentarlo. Cubre el piso del mercado con cinco huecos concretos, deja
fuera a propósito lo que exige backend, y es **solo México**. Detalle:

### 10.1 Matriz de cobertura

| Capacidad del mercado | Fase | Cobertura | Nota |
|---|---|---|---|
| Legislación federal vigente con vigencia | 6 | ✅ | vía SCOW/LegalIA |
| Jurisprudencia SCJN con registro | 6 | ✅ | repositorio abierto |
| DOF con detección de reformas | 6 | ✅ | SIDOF |
| Legislación de los 32 estados | 6 | ⚠️ parcial | 4 estados en la primera oleada; sin API común, es cola larga de meses. Vigencia estatal no la da ninguna fuente abierta |
| Fiscal: SAT, RMF, criterios normativos, TFJA | — | ❌ | añadir como oleada de la Fase 6; la fuente fiscal es la más pedida por despachos mixtos |
| Sentencias CJF y tribunales estatales | — | ❌ | fuera; solo tesis |
| Cita verificable a un clic | 7 | ✅ | |
| Derogadas excluidas | 6 | ✅ federal | |
| Modo público / modo abogado | 7 | ✅ | |
| Filtro jurisdiccional por estado | 6 | ✅ implícito | shards por estado; hacerlo explícito en la UI |
| Análisis de documentos subidos | 8 | ⚠️ | solo PDF con capa de texto y Word. **Sin OCR**: añadir Tesseract.js en navegador para escaneos |
| Comparación de documentos sin subir | 8 | ✅ | |
| Extracción tabular | 8 | ✅ | |
| **Redacción de escritos y contratos** | — | ❌ | **Es piso del mercado y no está en el plan.** Añadir Fase 8b: plantillas por tipo (demanda, contestación, contrato, amparo) + generación anclada al corpus + exportación |
| Exportar a Word/PDF | — | ❌ | trivial con `docx` en cliente; sin esto la redacción no sirve |
| Calculadoras | 8 | ⚠️ | solo laborales; fiscales (ISR, IVA, recargos) no |
| Notas de voz / transcripción | — | ❌ | Web Speech API o Whisper vía transformers.js, local; encaja con la cuña |
| Alertas de reformas sobre leyes que sigo | — | ❌ | sin servidor no hay push; sí "novedades desde tu última visita" al abrir |
| Captura automática de acuerdos de tribunales y boletines | — | ❌ web / ⚠️ Escritorio | requiere polling por expediente; viable solo en la versión Tauri |
| Gestión completa de despacho (finanzas, portal de clientes) | — | ❌ | fuera de alcance; `CaseManager` da expedientes, no un ERP |
| Predicción de sentencias | — | ❌ a propósito | necesita corpus de sentencias y plantea problemas éticos; no perseguir |
| Complemento de Word | después | ⏳ | viable desde el mismo deploy |
| Apps iOS/Android | después | ⏳ | Tauri Android en Inceptor; iOS no cubierto |
| Canalización a abogados, equipos, facturación | — | ❌ a propósito | exige backend y modelo de negocio |
| Seguridad demostrable | 9 | ✅ | la ventaja estructural |
| Evaluación pública | 9 | ✅ | nadie la tiene |
| Multi-modelo, BYOK, local | ya | ✅ | diferenciador existente |

Con las cinco adiciones (fiscal, OCR, redacción + exportación, voz, novedades
al abrir) el plan cubre el piso completo. Lo excluido queda excluido por
arquitectura, no por olvido.

### 10.2 Lo que falta y no es una feature

- **Calidad del modelo local.** Los modelos por defecto de WebLLM en LexMX son
  Llama 3.2 de 1B y 3B y Phi 3.5 mini: débiles en razonamiento jurídico en
  español. La cuña local-first vale si la recuperación es tan buena que un
  modelo pequeño responde bien con las citas correctas, o si el usuario trae
  su llave. Medirlo en la Fase 9 con el conjunto de evaluación es obligatorio;
  si el modelo local no alcanza, la promesa es "tus documentos no salen, tu
  pregunta sí va a tu proveedor", que sigue siendo mejor que el mercado pero
  hay que decirlo así. Los embeddings ya son `multilingual-e5-small`, correcto
  para español.
- **Validación con usuarios.** Nadie ha hablado con un despacho. El mercado
  usa programas de "design partners"; LexMX necesita 3-5 despachos o
  estudiantes de derecho que prueben el chat con corpus real antes de la
  Fase 8.
- **Marco legal propio.** Aviso de privacidad LFPDPPP, términos de uso,
  disclaimer de "no es asesoría" en cada respuesta, revisión de marca
  "LexMX" ante el IMPI, y licencia de redistribución del corpus. Todas las
  plataformas revisadas tienen términos y privacidad publicados.
- **Sostenibilidad del corpus.** Minutos de Actions, tamaño de shards en
  Releases y quién revisa cuando SCOW o SIDOF cambian de formato. Aliado
  natural: el grupo de la UNAM que mantiene LegalIA.
- **Métricas sin rastreo.** LexMX promete cero analítica; sin ninguna señal no
  se puede priorizar. Inceptor trae analítica opcional por flag; decidir un
  mínimo agregado y anónimo, o aceptar priorizar a ciegas.
- **iOS.** Ni PWA instalable con modelos grandes ni Tauri iOS están en el
  plan.

### 10.3 México o LATAM

**El plan es solo México.** Fuentes (SCJN, DOF, diputados), jerarquía
normativa, formato de citas, prompts, calculadoras (LFT) y el nombre son
mexicanos. La hoja de ruta antigua de LexMX prometía "expansión LATAM 2026";
este plan no la incluye, y la recomendación es no incluirla hasta que el
corpus mexicano sea real y evaluado. Un competidor regional con capital ya
opera en siete países; competir en cobertura geográfica es la peor batalla
posible para un proyecto abierto.

Lo que sí conviene hacer ahora, porque es barato y evita un rediseño:

- **Jurisdicción como dimensión de primer nivel**: shards, prompts,
  formato de cita, calculadoras y diccionarios indexados por
  `{país, entidad}`; `document-loader.ts` ya tiene el campo `jurisdiction`.
- Nada de constantes mexicanas fuera de un módulo `jurisdictions/mx/`.

Si más adelante hay tracción, los países con datos abiertos que hacen viable
el mismo pipeline son Chile (Ley Chile de la BCN tiene API pública),
Argentina (InfoLEG y SAIJ), Colombia (SUIN-Juriscol) y Perú (SPIJ). Cada uno
sería un `jurisdictions/<país>/` nuevo más un diccionario, no una reescritura.

## 11. Programa LexMX LATAM: paridad total más diferenciadores

### 11.0 Decisión y supuestos

Decisión del equipo: el objetivo del proyecto es tener **todo lo que ofrece
cualquier competidor** (§9 y §10), **más todo lo que solo LexMX puede
ofrecer** (local-first, corpus y evaluación abiertos, trae tu modelo,
código abierto), **para toda Latinoamérica**. Las reservas de §10 quedan
registradas; lo que sigue es el plan para cumplir esa decisión.

Supuestos explícitos:

1. **Se acepta un servidor opcional.** Cuentas de equipo, facturación,
   canalización a abogados, monitoreo de tribunales y notificaciones push no
   existen sin backend. **Decisión: el backend es Supabase** (Postgres con
   RLS, Auth, Storage, Edge Functions, Realtime, pg_cron, pgvector),
   siguiendo las recetas ya validadas de Inceptor (`docs/recipes/
   auth-supabase.md` y `supabase-migrations-ci.md`). Es autoalojable con
   `docker compose`, así que la promesa de código abierto se mantiene. Ver
   §11.9. El núcleo local no depende de él: sin servidor, LexMX sigue siendo
   el producto local-first completo.
2. **La paridad se mide por capacidad, no por implementación.** "Predicción
   de sentencias" se cumple como analítica de criterios por órgano con
   compuerta ética, no como oráculo.
3. **Es un programa, no un proyecto.** Se organiza en siete líneas de
   trabajo y tres horizontes; cada horizonte entrega un producto usable.
4. **Portugués es un idioma de primer nivel** desde el diseño (Brasil es la
   mitad del mercado LATAM), aunque se implemente en el horizonte 3.
5. **Los tamaños son en personas-mes** y suponen agentes de código
   (prometeo/forja/centinela) como multiplicador, no como sustituto de
   revisión humana en lo jurídico.

### 11.1 Arquitectura de dos niveles

| Nivel | Qué es | Dónde corre | Qué vive ahí |
|---|---|---|---|
| **Núcleo local** | El LexMX actual, saneado (Fases 0-5) y ampliado (Fases 6-9 y §10) | Navegador (PWA), Escritorio (Tauri), Android/iOS (Tauri) | Corpus por jurisdicción en el dispositivo, RAG, embeddings, chat, citas, documentos, OCR, comparación, tabular, redacción y exportación, calculadoras, voz, expedientes, novedades al abrir, MCP local |
| **Servidor opcional** | Proyecto Supabase (hospedado por Supabase u autoalojado con `docker compose`); también ofrecido como "LexMX Servidor" hospedado como modelo de sostenimiento | Región de Supabase más cercana (São Paulo para el cono sur; para México verificar disponibilidad de región o autoalojar); residencia de datos por país | Identidad (OAuth, MFA), organizaciones y asientos, consumo y facturación, bitácora de auditoría, canalización a abogados, monitoreo de tribunales y boletines, push y correo, bot de WhatsApp, complemento de Word con estado compartido, API pública |

Regla de oro: **ninguna consulta ni documento pasa por el servidor salvo que
el usuario active una función que lo requiera**, y cada una lo dice. El
servidor almacena metadatos de cuenta y suscripciones de monitoreo, no
expedientes, salvo que la organización lo elija explícitamente. Así la
promesa de privacidad sobrevive a la paridad.

### 11.2 Jurisdicción como dimensión de primer nivel

Cada país es un módulo `src/jurisdictions/<cc>/` con el mismo contrato:

```
jurisdictions/mx/
  sources.ts        # adaptadores: legislación, jurisprudencia, gaceta, fiscal
  hierarchy.ts      # pirámide normativa y reglas de precedencia
  citation.ts       # formato y parser de citas ("Artículo 123 constitucional", "Tesis 1a./J. 15/2019")
  calculators/      # laboral, fiscal, plazos procesales
  prompts.{es,pt}.ts
  dictionary.{es,pt}.ts
  eval/             # preguntas con respuesta y cita esperada
  legal.ts          # aviso de privacidad aplicable, disclaimer, autoridad de datos
  entities.ts       # estados / provincias / regiones para el filtro jurisdiccional
```

Shards de corpus indexados por `{país, entidad, materia, versión}`; el
cliente instala solo lo que elige. `document-loader.ts` ya tiene el campo
`jurisdiction`; se convierte en obligatorio. Nada mexicano fuera de
`jurisdictions/mx/`.

### 11.3 Mapa de fuentes abiertas por país (verificado 2026-09-13)

| País | Legislación | Jurisprudencia | Gaceta / reformas | Acceso | Nota |
|---|---|---|---|---|---|
| **México** | API SCOW (SCJN) vía LegalIA; LeyesBiblio | Repositorio SCJN CSV/JSON; sjf2 | SIDOF datos abiertos y alertas | Abierto, sin llave | Vigencia por artículo de origen |
| **Chile** | Ley Chile (BCN): XML público sin registro, todos los códigos; datos enlazados W3C | 29 000+ sentencias de la Corte Suprema enlazadas a normas; API REST de dictámenes de Contraloría (50 000+) | Diario Oficial vía BCN | Abierto | Existe un proyecto open source con 55 herramientas MCP para Chile: reutilizar |
| **Argentina** | InfoLEG y SAIJ (900 000+ documentos); dataset en datos.jus.gob.ar **CC-BY 4.0**; APIs REST JSON de terceros para leyes y reformas | SAIJ (fallos CSJN y tribunales) | Boletín Oficial vía InfoLEG | Abierto con licencia explícita | La mejor licencia de la región |
| **Colombia** | SUIN-Juriscol (normas desde 1864) con **OData** en datos.gov.co; descarga en Word | Corte Constitucional y Consejo de Estado en SUIN; relatoría | Diario Oficial | Abierto | Vigencia y afectaciones normativas incluidas |
| **Perú** | SPIJ: parte libre, parte con licencia de pago; datasets de normas y jurisprudencia en datosabiertos.gob.pe desde 2023 | Tribunal Constitucional y vinculantes en SPIJ | El Peruano | Parcial | Revisar qué queda fuera de la parte libre |
| **Brasil** (pt) | LexML del Senado: API SRU en XML, acervo en datos abiertos | API pública DataJud (CNJ) para metadatos de procesos; STF/STJ datos abiertos | Diário Oficial da União | Abierto, DataJud con llave pública | Un servidor MCP abierto sobre 8 APIs brasileñas ya existe: reutilizar |
| **Uruguay** | IMPO: bases completas en **JSON** de uso libre desde 2018 | Base de jurisprudencia del Poder Judicial (por verificar acceso programático) | Diario Oficial (IMPO) | Abierto | |
| **Ecuador** | Registro Oficial; portal datosabiertos.gob.ec | Corte Constitucional (portal) | Registro Oficial | Por verificar | Sin API confirmada |
| **Costa Rica** | SCIJ (PGR) | Nexus PJ | La Gaceta | Por verificar | Lista comunitaria de APIs abiertas del país |
| **Panamá** | Gaceta Oficial; ANTAI datos abiertos | Órgano Judicial | Gaceta | Por verificar | |
| Resto (GT, HN, SV, NI, DO, BO, PY, VE) | Por relevar | Por relevar | | | Oleada final; relevamiento de 1 semana por país antes de comprometer |

### 11.4 Líneas de trabajo

**A. Plataforma y calidad** (Fases 0-5 de §5, sin cambios). 3-4 personas-mes.

**B. Corpus multi-jurisdicción.** Pipeline genérico en GitHub Actions con
adaptadores por país; shards versionados en Releases o bucket; vigencia,
materia y entidad como datos; detección de reformas; evaluación de
cobertura publicada por país. Oleadas: MX → CL, AR, CO, PE → BR → UY, EC,
CR, PA → resto. 2 personas-mes por país en la primera oleada, 1 después;
más 2 de pipeline común. Estados/provincias: cola larga permanente con
cobertura publicada.

**C. Producto local-first.** Chat con cita verificable y modo grounded;
modos Pregunta e Investiga; filtro jurisdiccional explícito; Biblioteca
(corpus instalado, tamaño, fecha, actualizar); documentos con OCR
(Tesseract.js); comparación en navegador; extracción tabular; **redacción
con plantillas por país** (demanda, contestación, contrato, recurso) anclada
al corpus y **exportación a Word/PDF**; calculadoras por país (laboral,
fiscal, plazos); notas de voz y transcripción local (Whisper vía
transformers.js); novedades desde la última visita; expedientes en IndexedDB
con documentos, comparaciones, tablas y notas; historial y búsqueda.
6-8 personas-mes.

**D. Servidor opcional sobre Supabase.** Identidad (Supabase Auth con OAuth
Google/Microsoft/Apple y MFA TOTP); organizaciones, asientos y roles en
Postgres con RLS; consumo y facturación (Stripe y un proveedor local por
país vía Edge Functions con webhooks); bitácora de auditoría inmutable por
triggers a tabla append-only; canalización a abogados con directorio
verificado por materia y entidad; monitoreo de tribunales y boletines por
expediente (adaptadores por país corriendo como Edge Functions programadas
con pg_cron o como jobs de GitHub Actions que escriben en Postgres);
notificaciones push (Web Push) y correo; bot de WhatsApp (webhook de Meta
Cloud API en una Edge Function); residencia de datos por región de
Supabase o autoalojado; consola de administración como isla del mismo
sitio. Sin servidor propio que mantener: el frontend habla con Supabase
con la sesión del usuario y RLS aísla; la service key no sale de las Edge
Functions. 4-6 personas-mes (antes 6-9).

**E. Canales.** PWA instalable; Escritorio con Tauri (corpus completo y
modelo local en disco); Android e iOS con Tauri 2; complemento de Word
(página web más manifiesto, con estado compartido vía servidor cuando hay
organización); servidor MCP "LexMX como fuente" local y hospedado; API
pública documentada (OpenAPI, ya en el arquetipo de Inceptor).
3-4 personas-mes.

**F. Inteligencia.** Enrutador multi-modelo por complejidad y costo (ya
existe, sanear); catálogo de modelos locales por idioma y tamaño de equipo;
embeddings afinados en español y portugués jurídico (punto de partida: el
framework de evaluación de Justicio); agentes con herramientas
(calculadoras, búsqueda, comparación) para "investiga, redacta y calcula";
**analítica de criterios**: distribución de sentido de resolución por órgano
y materia sobre corpus de sentencias abiertas, con compuerta ética
(`docs/ETHICS.md`, análisis de partes interesadas obligatorio, nunca
"probabilidad de ganar" sobre un juez nombrado); benchmark abierto LATAM por
país con leaderboard público. 4-6 personas-mes.

**G. Confianza, legal y comunidad.** Página de seguridad que demuestra la
arquitectura; para el servidor, camino a ISO 27001 y alineación con ISO
42001; privacidad por país (LFPDPPP en MX, LGPD en BR, Ley 19.628 en CL, Ley
1581 en CO, Ley 29733 en PE, Ley 25.326 en AR, Ley 18.331 en UY); términos y
disclaimer en cada respuesta; marca por país; programa de despachos aliados
y de estudiantes; benchmark comunitario; guía de contribución por
jurisdicción. 2-3 personas-mes más asesoría legal externa.

### 11.5 Matriz de paridad

| Capacidad (de §9 y §10) | Línea | Nivel |
|---|---|---|
| Corpus federal/nacional, subnacional, jurisprudencia, gaceta, fiscal | B | local |
| Vigencia, derogadas excluidas, filtro jurisdiccional | B, C | local |
| Cita verificable, modo grounded, dos modos | C | local |
| Documentos subidos con OCR, comparación, tabular | C | local |
| Redacción de escritos y contratos, exportación | C | local |
| Calculadoras laborales, fiscales y de plazos | C | local |
| Voz y transcripción | C | local |
| Biblioteca y novedades | B, C | local |
| Expedientes y gestión de casos | C | local (+ compartido vía D) |
| Alertas de reformas y monitoreo de tribunales y boletines | D | servidor |
| Canalización a abogados y directorio | D | servidor |
| Organizaciones, asientos, facturación, consumo por usuario | D | servidor |
| MFA, bitácora de auditoría, residencia de datos | D | servidor |
| WhatsApp | D | servidor |
| Complemento de Word y Outlook | E (+D) | ambos |
| Apps iOS y Android, Escritorio | E | local |
| Servidor MCP y API pública | E | ambos |
| Multi-modelo, BYOK, modelo local | F | local |
| Agentes que investigan, redactan y calculan | F | local |
| Analítica de criterios (paridad con "predicción") | F | local, con compuerta ética |
| Benchmark abierto y evaluación pública | F, G | público |
| Seguridad demostrable, certificaciones, privacidad por país | G | ambos |
| Programa de estudiantes y despachos aliados | G | comunidad |
| **Diferenciadores propios**: local-first, corpus abierto, código abierto, trae tu modelo, evaluación pública, MCP | B, C, E, F | local |

Nada de §9 queda fuera. Lo único que cambia de forma es "predicción de
sentencias", que se entrega como analítica con compuerta ética.

### 11.6 Horizontes, criterios de salida y tamaño

| Horizonte | Alcance | Criterio de salida | Tamaño |
|---|---|---|---|
| **H1 · 0-6 meses · México completo y paridad local** | A completa; B para MX (federal, SJF, DOF, fiscal, 4-8 estados); C completa para MX; E: PWA, Escritorio, MCP local; F: enrutador y catálogo de modelos, evaluación MX; G: seguridad, privacidad MX, términos, 3-5 despachos piloto | Un despacho mexicano usa LexMX a diario sin nube; evaluación pública de precisión de cita; `check` verde | 12-16 personas-mes |
| **H2 · 6-12 meses · Servidor y cono sur** | D completo sobre Supabase con adaptadores MX; E: Word, Android, iOS; B y C para CL, AR, CO, PE; F: embeddings es-jurídico, agentes; G: privacidad de 4 países, ISO 27001 en marcha | Organizaciones pagando la versión hospedada o autoalojando; 5 países con corpus evaluado | 14-18 personas-mes |
| **H3 · 12-24 meses · Brasil, resto y analítica** | B y C para BR (pt), UY, EC, CR, PA, resto; D con monitoreo de tribunales por país; F: analítica de criterios, benchmark LATAM con leaderboard; G: marca y programas por país | Cobertura publicada por país; benchmark LATAM con al menos tres participantes externos | 14-20 personas-mes |

Total del programa: **40-54 personas-mes**. Con una persona y agentes, tres
a cuatro años; con un equipo de tres o cuatro, 12-18 meses. Los horizontes
existen para que cada uno sea un producto completo por sí mismo si el
siguiente no llega.

### 11.7 Riesgos del alcance ampliado

| Riesgo | Mitigación |
|---|---|
| El servidor diluye la promesa de privacidad | Núcleo local intacto; Supabase opcional y autoalojable; RLS por usuario y organización; documentos solo con cifrado en cliente antes de subir; cada función que lo usa lo declara en la UI |
| Dependencia de un proveedor (Supabase) | Todo es Postgres estándar y funciones Deno; el `docker compose` oficial de Supabase permite autoalojar sin cambios de código |
| Paridad como meta lleva a construir de todo y terminar nada | Horizontes con criterio de salida; H1 no incluye servidor ni segundo país |
| Mantener N pipelines de corpus | Contrato de adaptador único, monitor de cobertura por país, aliados locales (los proyectos abiertos de Chile y Brasil ya existen) |
| Fuentes parcialmente cerradas (Perú) o sin API (Ecuador, Panamá, resto) | Relevamiento de una semana por país antes de comprometer fecha; cobertura publicada, no prometida |
| Analítica de criterios usada como predicción | Compuerta ética obligatoria, sin nombres de jueces, con tamaño de muestra y advertencia en cada gráfica |
| Portugués y variantes del español jurídico | Diccionarios y prompts por país desde el diseño; evaluación por idioma |
| Modelo local insuficiente en algún idioma | Catálogo por idioma; BYOK como respaldo declarado |
| Capital: competidores financiados cierran el hueco local-first con una edición on-premise | Llegar antes y abierto; el corpus y el benchmark abiertos son el foso, no las features |
| Marco legal en 10+ países | Asesoría externa por país en G; términos y privacidad por jurisdicción en el módulo |

### 11.8 Cómo gestionarlo

- El orden no cambia: **México primero, local primero, servidor después**.
  Paridad y LATAM son el destino del programa, no del primer release.
- Cada línea de trabajo tiene un dueño y una épica por horizonte en GitHub;
  prometeo descompone por épica, forja implementa por issue, centinela
  valida; el ratchet de §5 aplica a todo el programa.
- Cada país entra con un relevamiento de fuentes de una semana, un módulo
  `jurisdictions/<cc>/` con evaluación propia, y un aliado local (despacho,
  facultad o proyecto abierto) antes de anunciar cobertura.
- Se publica un tablero de cobertura por país y capacidad; lo que no está
  verde no se promete.

### 11.9 Backend en Supabase: diseño

Decisión del equipo: Supabase. Encaja con un sitio estático en GitHub Pages
porque el navegador habla directo con Supabase usando la sesión del usuario
y la *anon key* pública; no hay servidor propio que desplegar ni mantener.
Inceptor ya documenta el patrón (`docs/recipes/auth-supabase.md`,
`supabase-migrations-ci.md`), validado en otro producto del mismo autor.

#### Qué pieza de Supabase cubre qué capacidad

| Capacidad (línea D) | Pieza de Supabase | Notas |
|---|---|---|
| Identidad, OAuth Google/Microsoft/Apple, MFA | **Auth** (MFA TOTP nativo) | Sesión en un Nano Store `$session`, adaptada a `GuardUser` una sola vez para `route-guard.tsx` |
| Organizaciones, asientos, roles, invitaciones | **Postgres + RLS** | Tablas `orgs`, `org_members(role)`, `invites`; políticas por `auth.uid()` y pertenencia; roles en `app_metadata` como allowlist |
| Consumo por usuario y facturación | **Edge Functions + Stripe** (más un proveedor local por país: OXXO/SPEI en MX, Mercado Pago en AR/CL/CO/PE/UY, Pix en BR) | Webhooks a una Edge Function que actualiza `subscriptions` y `usage`; el frontend solo lee su propio consumo vía RLS |
| Bitácora de auditoría inmutable | **Triggers** a una tabla append-only sin política de `update`/`delete` | Equivale al audit log que el mercado anuncia |
| Canalización a abogados y directorio verificado | **Postgres + RLS + Storage** (cédulas o credenciales, cifradas) | Verificación manual en la consola; el usuario final solo ve el resultado del emparejamiento |
| Monitoreo de tribunales y boletines por expediente | **pg_cron + Edge Functions** para fuentes con API; **GitHub Actions** como worker para scraping largo, escribiendo en Postgres | Adaptadores por país; resultados en `court_events` con RLS por expediente |
| Alertas de reformas sobre leyes seguidas | **pg_cron** sobre la tabla de reformas que ya produce el pipeline de corpus | La suscripción es del usuario; el corpus sigue siendo abierto |
| Push y correo | **Realtime** para sesiones abiertas; **Web Push** desde una Edge Function; correo con el proveedor SMTP de Supabase o Resend | El service worker de `@vite-pwa/astro` recibe el push |
| Bot de WhatsApp | **Edge Function** como webhook de Meta Cloud API | Solo para cuentas que lo activan; la conversación se responde con el mismo RAG, ejecutado en la función con la llave del usuario u organización |
| Complemento de Word con estado compartido | **Postgres** para historial y plantillas de organización | El add-in es la misma página web; sin organización funciona solo en local |
| API pública y MCP hospedado | **Edge Functions** (Deno, TypeScript, mismo código de búsqueda) sobre **pgvector** con los mismos shards del corpus abierto | Opcional: quien no quiera nube usa el MCP local |
| Distribución de shards de corpus | **Storage** con CDN como alternativa a GitHub Releases | Los shards siguen siendo públicos y versionados |
| Residencia de datos | **Región del proyecto** (São Paulo para el cono sur) o **autoalojado** con el `docker compose` oficial | Para México, verificar disponibilidad de región al iniciar H2; si no existe, autoalojar en un proveedor con centro de datos en México para los clientes que lo exijan |

#### Reglas que protegen la promesa local-first

1. **La service key nunca sale de las Edge Functions.** El frontend usa solo
   la anon key; RLS es la única frontera (receta de Inceptor).
2. **Ningún expediente ni consulta llega a Supabase por defecto.** Solo
   metadatos de cuenta, organización, suscripciones y eventos de monitoreo.
3. **Si una organización elige guardar documentos compartidos en Storage,
   se cifran en el cliente** con `lib/security` (AES-GCM, PBKDF2) antes de
   subir; Supabase guarda bytes que no puede leer. La llave vive en la
   organización, no en Supabase.
4. **Cada función que use el servidor lo dice en la UI** con
   `AIOutputLabel` o un aviso equivalente: "esta acción usa LexMX Servidor".
5. **Todo es Postgres estándar y funciones Deno.** El `docker compose`
   oficial de Supabase permite autoalojar sin cambiar código; es lo que hace
   creíble "código abierto" también para el servidor.

#### Estructura en el repo

```
supabase/
  config.toml
  migrations/
    0001_orgs_members.sql       # tablas + RLS
    0002_subscriptions_usage.sql
    0003_audit_log.sql          # append-only + triggers
    0004_lawyers_directory.sql
    0005_court_events.sql
    0006_corpus_vectors.sql     # pgvector, opcional
  functions/
    stripe-webhook/
    payments-<país>/
    whatsapp-webhook/
    court-monitor-<país>/
    web-push/
    search/                     # API pública y MCP hospedado
.github/workflows/supabase.yml  # migraciones por CI (receta de Inceptor)
src/lib/supabase.ts             # cliente guardado: null si faltan env
src/stores/auth.ts              # $session, $authReady
src/schemas/*.ts                # Zod compartido entre frontend y funciones
```

`PUBLIC_SUPABASE_URL` y `PUBLIC_SUPABASE_ANON_KEY` entran al build como
*Actions Variables* (son públicas); `SUPABASE_ACCESS_TOKEN` y
`SUPABASE_DB_PASSWORD` como *Secrets* para el workflow de migraciones.
Sin esas variables el build sigue pasando y la UI muestra "servidor no
configurado", que es exactamente el modo local-first.

#### Costo y tamaño

Plan gratuito de Supabase para desarrollo y pilotos; plan Pro (del orden de
25 USD al mes por proyecto) cuando haya organizaciones. Un proyecto por
región cuando la residencia lo exija. La línea D baja de 6-9 a **4-6
personas-mes** porque desaparecen el servidor propio, su despliegue, su
auth y su ORM.

#### Lo que Supabase no resuelve

- **Scraping largo de tribunales sin API**: las Edge Functions tienen límite
  de tiempo; esos adaptadores corren en GitHub Actions o en un contenedor
  pequeño y escriben en Postgres.
- **Región en México**: no confirmada al escribir esto; verificar en H2.
- **Inferencia de LLM del lado servidor** (WhatsApp, MCP hospedado): la
  función llama al proveedor con la llave de la organización; no hay modelo
  local en el servidor. Coherente con "trae tu propio modelo".
