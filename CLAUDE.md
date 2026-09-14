# LexMX — Claude Code Context

## Repository purpose

LexMX es un asistente legal mexicano con IA: RAG sobre legislación y
jurisprudencia con citas verificables, **corriendo en el dispositivo del
usuario** (local-first, trae tu propio modelo). Sitio estático en GitHub Pages
bajo `/LexMX/`, con un servidor opcional en Supabase para funciones de equipo.

Every feature ships as: GitHub issue → Claude triages → PR → merge → deploy.
The FeedbackFAB lets real users file issues with diagnostics pre-filled.

**Plan maestro**: `docs/INCEPTOR-MIGRATION-ANALYSIS.md` (fases 0-9 y programa
LATAM). **Contrato de datos del cliente**: `docs/DATA-COMPATIBILITY.md` (nombres
de IndexedDB, claves `lexmx_*`, parámetros de cifrado: no cambian sin
migración).

## Stack (installed)

| Package | Role |
|---|---|
| `astro` ^5.18 | islands architecture, `output: 'static'`, base `/LexMX` via `ASTRO_BASE` |
| `@astrojs/react` ^5 + `react` ^19 | React islands only |
| `tailwindcss` ^4 via `@tailwindcss/vite` | tokens in `src/styles/global.css` `@theme` (NOT `@astrojs/tailwind`) |
| `@xenova/transformers` | embeddings in the browser (`Xenova/multilingual-e5-small`), **dynamic import only** |
| `@mlc-ai/web-llm` | local inference, dynamic import only |
| `pdfjs-dist`, `mammoth` | document text extraction |
| `react-markdown` + `remark-gfm` | chat rendering |
| `nanostores` | cross-island state (never React Context across islands) |
| `vitest` ^4 (jsdom) | unit tests in `src/**/__tests__` and colocated `*.test.ts` |
| `@playwright/test` | e2e in `tests/` (not in CI yet) |
| `typescript` ^5.6 strict | `tsconfig.strict.json` adds Inceptor strictness for cleaned modules |

## File organization

- `src/pages/` — Astro routes (`chat`, `setup`, `casos`, `wiki`, `biblioteca`, `herramientas`, `cuenta`, `seguridad`, `document/[id]` generated from the corpus manifest, `requests/*`, `admin/*`)
- `src/components/layout/BaseLayout.astro` — the single layout (mounts `HydrationCanary` + `FeedbackFAB`)
- `src/components/` — Astro/React presentational components; `common/` holds Inceptor pieces (FeedbackFAB)
- `src/islands/` — React islands hydrated with `client:*` (+ `ErrorBoundary`, `HydrationCanary`)
- `src/lib/` — `llm/` (providers, prompt-builder), `rag/`, `embeddings/`, `storage/`, `security/`, `legal/`, `corpus/`, `ingestion/`, `admin/`, plus Inceptor utilities (`href`, `flags`, `disposer`, `report-issue`, `site-meta`, `use-client-preference`)
- `src/jurisdictions/` — jurisdiction as a first-class module: `types.ts` contract, `mx/` (reference, with `calculators.ts`), `cl ar co pe br uy ec cr pa`, `_shared/citation.ts` factory; nothing country-specific lives outside its module (`docs/CONTRIBUTING-JURISDICTIONS.md`)
- `src/stores/` — Nano Stores shared across islands (`corpus`, `chat`, `cases`, `jurisdiction`, `auth`, `pwa`)
- `src/lib/case-management/` — IndexedDB store for expedientes; `src/schemas/` — zod schemas shared by forms
- `src-tauri/` — LexMX Escritorio (Tauri 2) packaging the same `dist/`
- `src/i18n/` — `useTranslation()` singleton + `locales/{es,en}.json`
- `src/styles/global.css` — Tailwind v4 import, `@theme` tokens (legal, document, hierarchy palettes), dark variant by class
- `src/test/` — vitest setup (`setupTests.ts`), mocks, `forbidden-imports.test.ts`
- `.claude/agents/` — `prometeo`, `forja`, `centinela`; `.claude/checklists/` — ethics, governance, forbidden imports
- `scripts/` — `doctor.sh`, `ship.sh`, `monday.sh`, `new-issue.sh`, `ratchet.mjs`, `check-ts-pragmas.mjs`, `corpus/` (LegalIA import + per-document embeddings), `eval/retrieval.ts`, `mcp/server.ts` (local MCP server over the corpus), `smoke/` (Chromium smoke tests against `dist/`)
- `supabase/` — optional server (plan § 11.9): `migrations/` (RLS on every table), `functions/` (Deno Edge Functions), `README.md`; invariants tested in `src/test/supabase-schema.test.ts`
- `evals/` — retrieval golden set per corpus (`mx-federal/retrieval.jsonl`) and results
- `public/office/manifest.xml` + `src/pages/office/taskpane.astro` — Word add-in (same chat as a task pane, Office.js only talks to the document)
- `docs/SECURITY-PROGRAM.md` (ISO 27001/42001 control map for the optional server), `docs/COMMUNITY.md` (allied firms and student clinics)

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | dev server on 4321 |
| `npm run build` | production build (set `ASTRO_BASE=/LexMX` for Pages parity) |
| `npm run check` | **the gate**: ratchet + strict tsc + tests + lint + pragmas, then build |
| `npm run ratchet` / `ratchet:update` | compare / rewrite `quality-baseline.json` (tsc errors, `any` warnings) |
| `npm run type-check:strict` | `tsc` on the cleaned modules listed in `tsconfig.strict.json` |
| `npm run test` | vitest |
| `npm run lint` | eslint |
| `npm run corpus:import` / `corpus:embeddings` | build the federal corpus and its per-document embedding shards (what `corpus-update.yml` runs) |
| `npm run eval:retrieval` | retrieval benchmark (recall@k / MRR by article) against a built corpus; fails under `evals/baseline.json` |
| `npm run mcp` | local MCP server (`search_corpus`, `get_article`, `list_documents`) |
| `npm run lighthouse` | build, stage `dist/` under `.lighthouse-root/LexMX/` (Pages base path) and run Lighthouse CI with the budgets and a11y assertions in `lighthouserc.json` |
| `npm run desktop:dev` / `desktop:build` | Tauri 2 desktop app |
| `npm run mobile:android:*` / `mobile:ios:*` | Tauri 2 mobile (`docs/MOBILE.md`; needs the platform SDKs) |
| `npm run doctor` / `ship` / `monday` / `new-issue` | Inceptor workflow scripts |

## Quality ratchet (read before touching code)

- `quality-baseline.json` holds the current counts of `tsc` errors and
  `no-explicit-any` warnings. **They may only go down.** CI fails if they grow.
  If an increase is deliberate, run `npm run ratchet:update` in the same PR so
  the diff shows it.
- When you clean a module (tests pass, no `any`, no tsc errors), add its path
  to `tsconfig.strict.json` `include`. The list only grows.
- `@ts-ignore` is banned; `@ts-expect-error -- reason` and `@ts-nocheck -- reason`
  need the reason (`scripts/check-ts-pragmas.mjs`).
- Banned imports live in `.claude/checklists/forbidden-imports.json` and are
  enforced by `src/test/forbidden-imports.test.ts`.

## Workflow: Claude Code orchestration + sub-agents

There is no native `/goal` loop; the main session orchestrates:

1. **prometeo** decomposes an issue or phase of `docs/INCEPTOR-MIGRATION-ANALYSIS.md` into an ordered plan.
2. **forja** implements one issue on a feature branch with atomic commits.
3. **centinela** runs `npm run check` and returns APPROVED or REJECTED (`RETRY_FORJA`, `NEEDS_HUMAN`, `BLOCKED_UPSTREAM`).
4. On APPROVED, push and open a PR that closes the issue.

Conventions: branches `phase-N/issue-NNN-slug`, Conventional Commits with issue
ref, PR title = issue title, body `Closes #N`.

## Critical warnings

1. ❌ **NEVER install `@astrojs/tailwind`**: Tailwind v4 goes through `@tailwindcss/vite`.
2. ❌ **NEVER use React Context for state shared between islands**: use Nano Stores.
3. ❌ **NEVER import `@xenova/transformers` or `@mlc-ai/web-llm` statically** in code that a page loads eagerly; use `import()` inside the provider that needs it. The `/chat` script budget depends on it.
4. ❌ **NEVER change IndexedDB names/versions, `lexmx_*` keys or the AES-GCM/PBKDF2 parameters** without a migration (see `docs/DATA-COMPATIBILITY.md`).
5. ❌ **NEVER send a user document or query to a server by default.** Anything that leaves the device is opt-in and says so in the UI.
6. ❌ **NEVER add server-rendered routes** (`prerender = false`): the site is static. Server features go to Supabase (plan § 11.9).
7. ❌ **NEVER mix Radix and Base UI**; prefer Base UI. `framer-motion` is banned (use `motion/react`).

## Auth gating rules (plan § 11.9)

`src/lib/route-guard.tsx` is the **only** gating module: `<RouteGuard>`,
`hasRole()`, `hasFlag()`. Identity comes from `$guardUser` in
`src/stores/auth.ts`, adapted once from the Supabase session (roles in
`app_metadata`, set server-side). Hard rules:

- Permission checks are explicit allowlists / `=== true`, never `!== false`
  (an absent field passes `!== false` and silently grants access).
- Deny by default: no user, unknown role or missing flag ⇒ blocked.
- Never derive identity from props defaults, query params or placeholder ids.
- `src/lib/supabase.ts` is null when `PUBLIC_SUPABASE_*` are missing: every
  server feature must render its "servidor no configurado" state and say in
  the UI that it uses LexMX Servidor (`account.usesServer`).

## Island lifecycle discipline

Islands that attach listeners, intervals or observers must clean up on unmount.
Use `createDisposer()` from `src/lib/disposer.ts` and return `d.dispose` from
`useEffect`. For browser-only values (theme, locale) use `useClientPreference`
from `src/lib/use-client-preference.ts` to avoid hydration mismatches.

## Inceptor reporting

`src/islands/ErrorBoundary.tsx` captures runtime errors and builds a pre-filled
GitHub issue (stack, component path, URL, UA) via `src/lib/report-issue.ts`.
`HydrationCanary` stores hydration-mismatch URLs in `sessionStorage`; the
`FeedbackFAB` reads that key. `PUBLIC_REPO_SLUG` selects the target repo.

## Legal domain notes

- Jerarquía normativa: Constitución (1) → tratados (2) → leyes y códigos federales (3) → reglamentos (4) → NOM (5) → leyes estatales (6) → formatos administrativos (7). Palette `hierarchy-1..7` in `global.css` mirrors it.
- Citas: "Artículo 123 constitucional", "Artículo 47 de la Ley Federal del Trabajo", "Tesis 1a./J. 15/2019" (registro digital, época, instancia).
- Toda respuesta lleva disclaimer: orientación, no asesoría legal; cita la fuente oficial.
- Jurisdiction is a first-class dimension: `getJurisdiction(code)` from `src/jurisdictions` gives hierarchy, entities, sources, citation parser/formatter and the privacy framework. Nothing Mexico-specific outside `src/jurisdictions/mx/` (plan § 11.2).
- Corpus install: the RAG engine installs the published corpus shard by shard through `CorpusInstaller` (skips the network when `lexmx_vectors` already holds the served version). Progress lives in `$corpusInstall`; read it, never re-fetch the corpus from islands.
- `/seguridad` documents the architecture guarantees; when a data-contract or server rule changes, update that page in the same PR.

## Quality bar

- Every PR passes `npm run check`.
- New UI goes on the page it belongs to; new islands are wrapped in `ErrorBoundary`.
- Accessibility: keyboard reachable, visible focus, `aria-live` for async status.
