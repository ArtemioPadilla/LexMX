# LexMX Escritorio (Tauri 2)

Empaqueta el mismo sitio estático como aplicación de escritorio (plan § 11.4 E:
"corpus completo y modelo local en disco"). No hay código de servidor; el
binario solo sirve `dist/` construido con `ASTRO_BASE=/`.

```bash
# requisitos: Rust estable + dependencias de sistema de Tauri 2
npm run desktop:dev      # ventana con el dev server de Astro
npm run desktop:build    # instaladores en src-tauri/target/release/bundle
```

`.github/workflows/desktop.yml` construye macOS, Windows y Linux al publicar
un tag `desktop-v*` y adjunta los instaladores al release. Los permisos
(`capabilities/default.json`) se limitan a abrir enlaces oficiales en el
navegador del sistema.
