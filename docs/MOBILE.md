# LexMX en Android e iOS (Tauri 2) — plan § 11.4 E

La app móvil es el mismo `dist/` que sirve GitHub Pages y que empaqueta
LexMX Escritorio, envuelto por Tauri 2 (`src-tauri/`). No hay código nativo
propio: el corpus, los vectores y los modelos viven en el almacenamiento del
WebView (IndexedDB y Cache Storage), igual que en el navegador.

## Qué ya está listo

- `src-tauri/tauri.conf.json` construye el frontend con `ASTRO_BASE=/`
  (sin subruta), que es lo que el WebView móvil espera.
- El service worker de `@vite-pwa/astro` precachea la app y cachea el
  corpus por shard, así que la app funciona sin red tras la primera
  instalación del corpus.
- La CSP del escritorio permite `wasm-unsafe-eval` (transformers.js /
  web-llm) y `blob:` para workers; sirve tal cual en móvil.
- Dictado, OCR y transcripción usan APIs web (MediaRecorder, Web Audio,
  Web Workers) disponibles en los WebViews de Android 10+ e iOS 16+.

## Requisitos locales

| Plataforma | Necesitas |
|---|---|
| Android | Android Studio con SDK + NDK, `JAVA_HOME`, `ANDROID_HOME`, `NDK_HOME`; Rust con targets `aarch64-linux-android`, `armv7-linux-androideabi`, `i686-linux-android`, `x86_64-linux-android` |
| iOS | macOS con Xcode y CocoaPods; Rust con targets `aarch64-apple-ios`, `aarch64-apple-ios-sim`, `x86_64-apple-ios` |

La guía oficial de prerrequisitos por sistema está en
<https://v2.tauri.app/start/prerequisites/#configure-for-mobile-targets>.

## Comandos

```bash
npm run mobile:android:init   # una vez: genera src-tauri/gen/android
npm run mobile:android:dev    # dev con recarga sobre un emulador o dispositivo
npm run mobile:android:build  # .apk / .aab firmables

npm run mobile:ios:init       # una vez, en macOS: genera src-tauri/gen/ios
npm run mobile:ios:dev
npm run mobile:ios:build
```

`src-tauri/gen/` es generado y se versiona (Tauri lo espera así); revísalo
en el PR que lo cree. Los iconos se generan con
`npx @tauri-apps/cli icon public/icon-512.png`.

## Decisiones

- **Sin servidor propio en el teléfono.** Las funciones de equipo siguen en
  LexMX Servidor (Supabase) con la misma sesión; sin cuenta, todo es local.
- **Modelos locales grandes solo bajo demanda.** En móvil el chat usa por
  defecto el proveedor configurado por el usuario (BYOK); web-llm queda como
  opción explícita porque los pesos pesan cientos de MB.
- **Whisper `tiny` por defecto** en transcripción (40 MB); `base` y
  `small` son opciones.
- **Una sola base de datos.** Los nombres de IndexedDB y las claves
  `lexmx_*` son el contrato de `docs/DATA-COMPATIBILITY.md`; el WebView
  móvil respeta las mismas reglas de migración.

## Distribución

- Android: `.aab` firmado hacia Google Play (o `.apk` directo).
- iOS: TestFlight → App Store; requiere cuenta de desarrollador de Apple.
- Ambas tiendas piden política de privacidad: `/seguridad` y
  `docs/SECURITY-PROGRAM.md` son la base.

## CI

`desktop.yml` cubre macOS, Linux y Windows. Un `mobile.yml` puede
reutilizar `tauri-apps/tauri-action` con `--target android` en
`ubuntu-latest` (SDK vía `android-actions/setup-android`) y `--target ios`
en `macos-latest`; queda pendiente hasta que exista la firma de tienda en
secretos del repositorio.
