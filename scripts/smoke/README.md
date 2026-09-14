# Smoke tests en Chromium contra el sitio construido

Complementan a `npm run check`: abren páginas reales en Chromium headless
(el `@playwright/test` del repo) y verifican que las islas hidraten sin
errores, que el service worker registre y sirva offline, etc.

```bash
ASTRO_BASE=/LexMX npm run build
npx astro preview --host 127.0.0.1 --port 4321 &   # sirve dist/ bajo /LexMX/
node scripts/smoke/chat.mjs /tmp/chat.png
node scripts/smoke/setup.mjs /tmp/setup.png
node scripts/smoke/wiki.mjs /tmp/wiki.png
node scripts/smoke/sw.mjs
node scripts/smoke/cases.mjs /tmp/cases.png
fuser -k -n tcp 4321   # o kill $(lsof -t -i:4321)
```

Los scripts usan el Chromium preinstalado (`/opt/pw-browsers/...`); ajusta
`executablePath` si tu instalación difiere. Cada uno imprime un JSON con lo
que comprobó y guarda una captura cuando se le pasa una ruta.
