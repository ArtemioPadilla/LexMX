# LexMX → Inceptor: análisis de migración

Fecha: 2026-09-13, revisión 3: validación adversarial (§8) y comparación con el estado del arte comercial (§9). Alcance:
estado real de LexMX hoy, qué ofrece Inceptor, opciones comparadas y un plan
por fases. No se modificó código de producto; todos los números se midieron en
este entorno (Node 22, `npm ci` limpio) sobre `main` de ambos repos.

## 1. Veredicto en cinco líneas

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

1. `lib/security` y `lib/storage` (contrato de datos como tests).
2. `lib/llm`: una implementación por proveedor; prompts a `lib/llm/prompts/`
   (por claridad, no por peso).
3. `lib/embeddings`: transformers.js por `import()` diferido; borrar los 3
   adaptadores de 35 líneas; `maximumFileSizeToCacheInBytes` en Workbox.
4. `lib/rag`, `lib/legal`, `lib/corpus`.
5. `lib/ingestion`: reescribir o borrar `url-ingestion-integration.test.ts`
   (los 12 tests rojos).

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

## 9. Estado del arte comercial y complemento al plan

Se revisaron las páginas públicas, fichas de tiendas de apps y documentación
de seguridad de varias plataformas comerciales de IA legal orientadas al
mercado mexicano (consulta: 2026-09-13). No se nombra a ninguna: el objetivo es
fijar el listón de capacidades que un usuario ya da por hecho, no comparar
marcas. No se encontraron reseñas independientes con sustancia; lo que sigue
es lo que las propias plataformas publican.

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
| Leyes federales | `diputados.gob.mx/LeyesBiblio` (PDF/DOC con fecha de última reforma; ya en `document-fetcher.ts`) | Corpus federal completo (~300 leyes) |
| Jurisprudencia y tesis | Repositorio SCJN con descarga en formatos abiertos (CSV y API JSON, 1-100 documentos por consulta, filtros por época, instancia, materia, tipo); detalle público en `sjf2.scjn.gob.mx/detalle/tesis/{registro}` | Colección de tesis con registro digital, época, instancia, materia; enlace de verificación |
| DOF | SIDOF datos abiertos y API de alertas (`sidof.segob.gob.mx`) | Detección diaria de reformas; disparador de re-ingesta |
| Legislación estatal | Congresos estatales y `ordenjuridico.gob.mx`; heterogénea | Por oleadas: CDMX, Edomex, Jalisco, Nuevo León primero |

Diseño:

- **Pipeline en GitHub Actions** (`corpus-update.yml` ya existe, nunca
  validado): descarga, parseo con `lib/ingestion`, chunking con
  `contextual-chunker`, embeddings en build, y publicación de **shards
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
