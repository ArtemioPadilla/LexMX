# LexMX → Inceptor: análisis de migración

Fecha: 2026-09-13. Alcance: estado real de LexMX hoy, qué ofrece Inceptor como
destino, y una recomendación con plan por fases. No se modificó código de
producto para este análisis; todos los números se midieron en este entorno
(Node 22) sobre `main` de ambos repos.

## 1. Veredicto en tres líneas

- **LexMX sí funciona en producción** (https://artemiop.com/LexMX/ responde 200 y
  el build local pasa), pero está en deuda técnica seria: 584 errores de tipos,
  CI en rojo desde julio, 25 vulnerabilidades de npm, y el RAG corre sobre un
  corpus de juguete con fallback silencioso a datos mock.
- **Migrar a Inceptor conviene**, pero no como "actualizar en sitio" ni como
  "copiar todo LexMX dentro de Inceptor". La ruta con mejor relación
  esfuerzo/riesgo es **repo nuevo desde el template + portar módulo por módulo
  con compuerta de calidad** (patrón *strangler*). Así la deuda no cruza.
- El mayor riesgo del producto **no es el framework, es el contenido**: 3
  documentos de muestra y 14 vectores. La migración no lo arregla; hay que
  planear el corpus real como fase propia.

## 2. Estado real de LexMX (medido)

### 2.1 Salud del repo

| Métrica | Valor | Fuente |
|---|---|---|
| Último commit en `main` | 2026-07-15 (`5f629a2`) | git log |
| Commits totales | 25 | git rev-list |
| `npm run build` | ✅ 27 páginas, 48 s | local |
| `tsc --noEmit` | ❌ 526 errores; `astro check` reporta 584 | local |
| `vitest run` | 481 ✅ / 14 ❌ / 9 skipped (504) | local (2 de los 14 son por vars AWS del entorno) |
| `eslint` | 0 errores / 495 warnings (casi todos `no-explicit-any`) | local |
| `npm audit` | 25 vulns (3 critical, 15 high) | local |
| CI en `main` | ❌ `ci.yml`, `quality.yml`, `validate-deployment.yml` fallan en type-check; `deploy.yml` ✅ | GitHub Actions |
| PRs abiertos | 12 (11 de Dependabot desde 2025-08, más #73) | GitHub |
| Issues abiertos | 0 | GitHub |
| Sitio en vivo | ✅ `/`, `/chat/` responden 200 vía redirect a artemiop.com | curl |

El PR #73 (`fix/typescript-errors`) baja los errores de tipos de 584 a 252 y
documenta que el intento de subir Astro 4→7 rompe con `NoAdapterInstalled`:
las 13 rutas en `src/pages/api/**` declaran `prerender = false` en un sitio
`output: 'static'` sin adapter. Ese es el bloqueo concreto para cualquier
upgrade de Astro, y esas rutas no existen en producción de todas formas.

### 2.2 Tamaño y forma

| | LexMX | Inceptor |
|---|---|---|
| LOC `src/` (sin tests) | ~58.8k | ~25.5k |
| Astro / React / Tailwind | 4.16 / 18.3 / 3.4 | 5.18 / 19.2 / 4.3 |
| TypeScript / Node | 5.9 / ≥20 | 6.0 / ≥22 |
| Librería UI | ninguna: 33 componentes a mano (~9k LOC) | Base UI + shadcn: 91 archivos en `ui/` |
| Islas React | 23 archivos, 11.6k LOC | 52 |
| Tests | 30 vitest + 42 Playwright (integración+e2e) | 158 vitest + 7 Playwright (visual, a11y, teclado) |
| JS en `dist/` | 9.2 MB; chunk mayor 5.4 MB (transformers.js importado estático) | presupuesto Lighthouse: 150 KB script / ruta |

### 2.3 Qué está vivo, qué está muerto

**Vivo y con valor real** (lo que hay que portar):

- `lib/llm/` (8.5k LOC): registry de 10 proveedores (mock, WebLLM, OpenAI,
  Anthropic, Gemini, Ollama, OpenAI-compatible, Bedrock, Azure, Vertex),
  `provider-manager`, `intelligent-selector`, `prompt-builder`.
- `lib/rag/` (2.9k): `engine`, `contextual-chunker`, `hybrid-search`,
  `vector-search`.
- `lib/storage/` (1.4k) y `lib/security/` (750): IndexedDB vector store,
  metadata store, cifrado AES-GCM + PBKDF2 con WebCrypto.
- `lib/legal/` (1.4k), `lib/corpus/`, `lib/ingestion/` (3k, parser real con
  pdfjs y mammoth), `lib/utils/cors-*`.
- Islas: `ChatInterface` (735), `ProviderSetup` (869), `CaseManager` (1405,
  incluye `CaseChat` y `CaseTimeline`), `DocumentViewer*`, `DocumentRequest*`,
  las 5 islas del wiki.
- Diccionarios i18n: `src/i18n/locales/{es,en}.json`, 1 234 claves cada uno.

**Muerto, duplicado o no desplegable** (no se porta):

- 13 rutas `src/pages/api/**` con `prerender = false` y los ~5.7k LOC de
  `lib/admin/` que las respaldan. Nunca corren en GitHub Pages.
- Islas sin montar en ninguna página: `ModerationPanel`, `NotificationCenter`,
  `admin/EmbeddingsManager` (~1 455 LOC).
- Proveedores LLM duplicados: `openai.ts`+`openai-provider.ts`,
  `claude.ts`+`claude-provider.ts`, `gemini.ts`+`gemini-provider.ts`,
  `ollama.ts`+`ollama-provider.ts`, más `webllm-provider.old.ts` (import
  estático de web-llm, 431 LOC).
- `src/context/I18nProvider.tsx` y `src/stores/theme.ts`: cero importadores.
  Segundo sistema i18n (`src/i18n/translations/`, `ClientTranslations.astro`,
  `T.astro`) casi vestigial.
- `astro.config.mjs` `manualChunks` referencia 6 paquetes no instalados
  (`pdf-parse`, `idb`, `i18next`, `react-i18next`, `chart.js`,
  `react-chartjs-2`) y 2 rutas equivocadas.
- Basura en raíz: 9 capturas PNG, `test-results.json` (904 KB y no es JSON),
  12 markdowns post-mortem de E2E que describen archivos que ya no existen,
  `docs/demo/` con 7.7 MB de GIF/MP4 regenerados por `update-demo.yml`,
  ~24 codemods de una sola vez en `scripts/`.

### 2.4 El punto incómodo: el RAG es demo

- `public/legal-corpus/`: 3 JSON de ~2 KB (Constitución, CCF, LFT), un solo
  chunk cada uno.
- `public/embeddings/`: 14 vectores de 384 dimensiones.
- `rag/engine.ts` intenta embeddings reales al inicializar y, si falla, cae a
  mock; `embedding-manager.ts` hace lo mismo con `console.warn`. Con corpus
  vacío el engine responde con `mockDocuments` hardcodeados (líneas 638-697).
- El chat sí funciona si el usuario configura un proveedor (BYOK) o WebLLM,
  pero las "citas" salen de ese índice mínimo.

Conclusión: "no puedo asegurar que sirva" es correcto a medias. La app carga,
el chat conversa, pero el valor prometido (RAG sobre el corpus mexicano) no
está respaldado por datos.

## 3. Qué da Inceptor y qué no

### 3.1 Lo que resuelve directamente

- **Subpath de GitHub Pages**: `ASTRO_BASE` en `astro.config.mjs` + `withBase()`
  en `src/lib/href.ts`, con el deploy ya cableado. Equivale al `getUrl()` de
  LexMX (25 archivos lo usan): reemplazo mecánico.
- **Compuertas de calidad que LexMX nunca tuvo verdes**: `npm run check` corre
  en paralelo `astro check`, `tsc`, vitest, eslint y el chequeo de pragmas, y
  luego build. Playwright visual light/dark, axe WCAG AA, recorrido de teclado.
  CI de Inceptor está verde hoy (últimos 5 runs).
- **Capa de proceso**: agentes `prometeo` / `forja` / `centinela`, `doctor`,
  `ship`, `monday`, triage de issues con Claude (`claude.yml` con modelo de
  amenazas de prompt injection), `FeedbackFAB` + `ErrorBoundary` +
  `HydrationCanary` que pre-llenan issues. Esto es lo que hace viable
  "retomar" el proyecto en modo issue → PR con agentes.
- **Primitivas de IA** (`src/components/ui/ai/`): `ChatMessage`/`ChatThread`
  con auto-scroll, `PromptInput` (Enter envía, Stop mientras streamea),
  `StreamingText`, `ThinkingIndicator`, `CitationRef`/`CitationList`,
  `AIOutputLabel` (disclosure exigido por `docs/ETHICS.md`), `AIFeedback`.
  `CitationList` + `AIOutputLabel` + el panel dividido de `AppLayoutIsland`
  son exactamente la UI que un RAG legal necesita.
- **Shell de aplicación**: `AppLayoutIsland` (nav lateral, acciones, split
  panel), `WizardIsland` (para reemplazar `ProviderSetup`), `DetailsPage*`,
  `DataTable` con TanStack (para `CaseManager`, corpus, solicitudes).
- **PWA** con `@vite-pwa/astro`, stores `$online`/`$installPrompt`,
  `OfflineBanner`, `UpdateToast`.
- **Tauri desktop y Android** en un script (`add-tauri.mjs`). Para un
  asistente legal offline con modelos locales esto es relevante: el corpus y
  el modelo WebLLM pueden vivir en disco en vez de IndexedDB.
- Disciplina documentada: sin Context entre islas, `createDisposer()`,
  `useClientPreference`, `route-guard` deny-by-default.

### 3.2 Lo que NO trae y hay que construir

1. **No hay ruta brownfield.** `scripts/init.mjs` se niega a correr sobre un
   directorio existente y además genera un proyecto recortado (sin PWA, sin
   i18n, sin Playwright/Lighthouse). `SETUP.md` documenta el fork completo con
   `gh repo create --template`. No existe doc de "adoptar Inceptor en una app
   existente". La vía de cherry-pick es `registry.json` (shadcn) y el
   `mcp-server/`.
2. **i18n para islas no existe.** El sistema de Inceptor es compile-time y
   tipado (`es: typeof en`) pero solo lo usan 3 páginas `.astro`; cero islas
   traducen. LexMX necesita `useTranslation()` en ~30 componentes. Hay que
   construir un store Nano + carga diferida del diccionario. Además los
   `systemPrompts` de LexMX viven dentro de los JSON de locale (75 KB que hoy
   se mandan a cada cliente): deben salir a `lib/llm/prompts/`.
3. **Sin renderizado de Markdown en el chat.** `ChatMessage` solo hace
   `whitespace-pre-wrap`. LexMX usa `react-markdown` + `remark-gfm`; se lleva.
4. **IndexedDB solo como caché de TanStack Query.** No hay abstracción de
   object stores ni almacenamiento de vectores. Se portan los de LexMX.
5. **El backend de IA asumido es servidor BYOK** (`docs/recipes/ai-byok.md`),
   lo contrario de la inferencia en navegador de LexMX. No es un conflicto,
   pero los recipes no aplican tal cual.
6. **Presupuesto de 150 KB de script vs 5.4 MB de transformers.js**, y
   precaching de Workbox vs modelos de varios GB de WebLLM. Hay que importar
   transformers.js de forma diferida (hoy es estático en
   `transformers-provider.ts:3`), excluir modelos de `globPatterns`, y
   definir presupuesto por ruta para `/chat`.
7. **TS 6 + `noUncheckedIndexedAccess`** generarán errores nuevos al portar
   código que ya trae 584. Por eso no se porta "tal cual".

## 4. Opciones comparadas

| Opción | Qué implica | Pros | Contras |
|---|---|---|---|
| **A. Rescatar en sitio** | Mergear #73, cerrar 252 errores, borrar rutas API, subir Astro 5, React 19, TW 4 | Sin repo nuevo, historial intacto | Sigues sin librería UI, sin gates, sin proceso de agentes; arrastras 58k LOC de los cuales ~10k son muertos; TW3→4 y React 19 se hacen igual |
| **B. Copiar LexMX dentro de un fork de Inceptor** | Fork template, volcar `src/` de LexMX encima | Rápido de arrancar | `npm run check` queda rojo desde el día 1 (584+ errores, imports estáticos pesados, `any` masivo); el gate se vuelve decorativo y se termina desactivando |
| **C. Repo nuevo + strangler (recomendada)** | Fork template, podar vitrina, portar módulo por módulo con `check` verde como compuerta | Cada módulo entra limpio; el código muerto se queda atrás; se rediseña UI sobre Base UI en vez de portar 9k LOC a mano | Más disciplina; hay que mantener LexMX viejo en vivo hasta el cutover |

Recomendación: **C**, con `main` de LexMX congelado (solo deploy) hasta que el
nuevo alcance a paridad de `/chat` y `/setup`.

## 5. Plan por fases (para prometeo/forja/centinela)

Cada fase termina con `npm run check` verde y deploy a Pages bajo
`ASTRO_BASE=/LexMX` (o al subpath que se decida). Los tamaños son estimados
para una persona con agentes; tómalos como orden de magnitud.

### Fase 0 — Congelar y limpiar LexMX (1-2 días)

- Mergear #73 (o al menos su parte de `overrides` de `onnxruntime-web`).
- Cerrar los 11 PRs de Dependabot: no aplican a lo que se va a portar.
- Quitar del repo: PNGs de raíz, `test-results.json`, los 12 post-mortem de
  E2E, `docs/demo/` y `update-demo.yml`, codemods en `scripts/`.
- Poner `README` con aviso "en migración a `<repo nuevo>`".

### Fase 1 — Esqueleto Inceptor (2-3 días)

- `gh repo create lexmx-next --template ArtemioPadilla/inceptor` (no usar
  `init.mjs`: pierde PWA, i18n y Playwright).
- Re-brand: `site-meta.ts`, `site.config.mjs`, `PUBLIC_REPO_SLUG`,
  `robots.txt`, manifest PWA, `ASTRO_BASE`.
- Podar vitrina: `pages/gallery`, `blocks`, `showcase`, `demos`, `blog`,
  `docs` (contenido MDX de Inceptor), y los tests que los cubren
  (`route-parity`, gallery, search). Conservar `ui/`, `islands/` de
  infraestructura, `lib/`, layouts, workflows.
- Tokens de diseño: llevar las paletas `legal`, `document`, `hierarchy.1-7` de
  `tailwind.config.mjs` a `@theme` en `global.css`.
- Decidir ruta i18n: `/` español (default) y `/en/`, invirtiendo el default de
  Inceptor. Crear `src/i18n/{es,en}.ts` tipados a partir de los JSON de LexMX
  (sin `systemPrompts`) y un store Nano `$locale` + hook `useT()` para islas
  con `import()` diferido del diccionario.

### Fase 2 — Núcleo sin UI (1-2 semanas)

Portar en este orden, cada uno con sus tests y sin `any` nuevo:

1. `lib/security/` (WebCrypto) y `lib/storage/` (IndexedDB).
2. `lib/llm/`: registry + **una** implementación por proveedor (borrar los
   pares duplicados, `.old`, `webllm-mock`); `prompt-builder` leyendo prompts
   desde `lib/llm/prompts/{es,en}.ts`.
3. `lib/embeddings/` con `transformers-provider` cargado por `import()`
   diferido; quitar los 3 adaptadores de 35 líneas hechos para tests.
4. `lib/rag/` y `lib/legal/`, `lib/corpus/`.
5. `lib/ingestion/` (parser, chunker, fetcher, cors-*). Dejar el pipeline de
   admin para la fase 4.
6. Configurar Workbox: excluir `*.onnx`, `*.wasm`, `*.bin` del precache;
   `runtimeCaching` CacheFirst para modelos con `rangeRequests`.

### Fase 3 — Chat y configuración (1 semana)

- `/chat` reescrito sobre `ChatThread` + `PromptInput` + `StreamingText` +
  `CitationList` + `AIOutputLabel` + `AIFeedback`, con `react-markdown` para
  el cuerpo. Estado compartido por Nano Stores. Envuelto en `ErrorBoundary`.
- `/setup` sobre `WizardIsland` + `Form` (react-hook-form + zod) reemplazando
  las 869 líneas de `ProviderSetup` y los 4 componentes de `providers/`.
- Presupuesto Lighthouse por ruta para `/chat`.
- Cutover: apuntar el dominio/subpath al repo nuevo. LexMX viejo se archiva.

### Fase 4 — Resto de funcionalidad (1-2 semanas)

- Wiki: las 5 islas son contenido casi estático → páginas `.astro` +
  `Accordion`/`Tabs`; solo `LegalGlossary` amerita isla (búsqueda).
- `document/[id]` y `requests/*` sobre `DetailsPage*` + `DataTable` + `Form`.
- `CaseManager` (1.4k LOC): última, porque es la más grande y la menos
  validada; `DataTable` + `Timeline` + `Splitter` de Inceptor cubren la UI.
- Admin: solo `corpus` e `ingestion` como islas client-side; nada de rutas
  API.

### Fase 5 — Corpus real (abierta, independiente del framework)

- Definir fuente y licencia por documento (DOF, Diputados) y el proceso de
  actualización (`corpus-update.yml` existe pero depende de red y nunca se
  validó).
- Generar embeddings reales en build o pre-generados y distribuidos por
  release; hoy hay 14 vectores.
- Considerar Tauri desktop para el caso "corpus completo + modelo local".

## 6. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Portar archivos con `any` y errores de tipo "para avanzar" | `check-ts-pragmas` y `tsc` estricto son gate; centinela rechaza |
| Bundle de `/chat` explota el presupuesto | Import diferido de transformers.js y web-llm; presupuesto por ruta; medir con `npm run lighthouse` |
| SW precachea modelos o rompe descargas grandes | `globPatterns` sin binarios, `runtimeCaching` con range requests, probar offline en Playwright |
| Islas con listeners pierden cleanup con View Transitions (activas en Inceptor) | `createDisposer()` obligatorio; `HydrationCanary` detecta mismatches |
| Base UI en `1.0.0-rc.0` | Ya hay allowlist de axe en `tests/visual/a11y.spec.ts`; no mezclar con Radix |
| Dos repos vivos durante semanas | Congelar LexMX en Fase 0; cutover al final de Fase 3, no antes |
| Migrar mucho y seguir sin corpus | Fase 5 se planea en paralelo desde Fase 2; el chat nuevo debe mostrar claramente cuándo responde sin fuentes |

## 7. Qué NO migrar (lista explícita)

`src/pages/api/**`, `src/lib/admin/**`, `src/islands/ModerationPanel.tsx`,
`src/islands/NotificationCenter.tsx`, `src/islands/admin/EmbeddingsManager.tsx`,
`src/lib/llm/providers/{openai,claude,gemini,ollama}.ts` (duplicados),
`webllm-provider.old.ts`, `webllm-mock.ts`, `src/context/`, `src/stores/theme.ts`,
`src/i18n/translations/**`, `ClientTranslations.astro`, `T.astro`,
`src/styles/wiki.css`, `src/pages/test.astro`, `document/[...slug].astro`
(duplica `[id]`), `Makefile`, `Dockerfile`/`nginx.conf`/`docker-compose.yml`
(no aplican a Pages), `scripts/fix-*`, `migrate-tests*`, `update-test-*`,
`docs/demo/**`, `update-demo.yml`, `release.yml` (rehacer cuando haya releases).
