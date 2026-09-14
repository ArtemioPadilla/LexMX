# Programa de seguridad de LexMX Servidor (plan § 11.4 G)

LexMX es local-first: sin servidor no hay cuentas ni datos en la nube, y
`/seguridad` documenta las garantías del cliente. Este documento cubre la
parte opcional, **LexMX Servidor** (Supabase), y traza el camino a
**ISO/IEC 27001** (seguridad de la información) y la alineación con
**ISO/IEC 42001** (sistemas de gestión de IA). No es una certificación:
es el mapa de controles que ya existen, los que faltan y quién los opera.

## Alcance

| Dentro | Fuera |
|---|---|
| Proyecto Supabase de LexMX Servidor: Postgres, Auth, Edge Functions, Storage | El dispositivo del usuario y su navegador |
| Pipeline de corpus (`corpus-update.yml`) y despliegue (`deploy.yml`) | Proveedores de modelos que el usuario configura con su propia llave (BYOK) |
| Este repositorio y sus flujos de CI | Tribunales y fuentes oficiales consultadas por los adaptadores |

## Principios que ya son código

| Principio | Dónde se prueba |
|---|---|
| RLS en toda tabla pública | `src/test/supabase-schema.test.ts` (falla si una tabla no la activa o no tiene política) |
| La service key nunca sale de las Edge Functions | `supabase/functions/_shared/client.ts`; el cliente solo recibe la anon key |
| Bitácora de auditoría inmutable | `0003_audit_log.sql` revoca insert/update/delete; triggers en `org_members`, `invites`, `subscriptions` |
| Facturación y consumo solo por webhook | Sin políticas de escritura para `subscriptions`/`usage`; `record_usage` revocada a `authenticated` |
| Nada de contenido de consultas o expedientes en el servidor | Test que rechaza columnas `query_text`, `document_text`, etc. fuera de las tablas de corpus |
| Roles como allowlist explícito, deny by default | `src/lib/route-guard.tsx`, `canManage()` en `src/lib/server/orgs.ts` |
| Invitaciones con token hasheado y correo verificado | `accept-invite` compara SHA-256, vigencia y correo de la sesión |

## Mapa a ISO/IEC 27001:2022 (Anexo A)

| Control | Estado | Evidencia / pendiente |
|---|---|---|
| A.5.1 Políticas | 🔄 | Este documento + `docs/PRINCIPLES.md`; falta aprobación formal y revisión anual |
| A.5.15 Control de acceso | ✅ | RLS + roles `org_role`; MFA TOTP disponible en Supabase Auth (activar por organización) |
| A.5.23 Servicios en la nube | 🔄 | Supabase (SOC 2 Tipo II, ISO 27001 del proveedor); falta registro formal de proveedores y revisión de su SOC 2 |
| A.5.28 Evidencia | ✅ | `audit_log` append-only con actor, org, acción, objetivo |
| A.5.34 Privacidad y PII | ✅ | Solo perfil mínimo (`profiles`), correo en `invites` con caducidad 7 días; marcos por país en `src/jurisdictions/*/privacy` |
| A.8.2 Accesos privilegiados | 🔄 | Service key solo en secretos de funciones; falta rotación programada y registro de quién tiene acceso al proyecto Supabase |
| A.8.8 Vulnerabilidades técnicas | 🔄 | Dependabot; falta SLA de parcheo y escaneo de contenedores/funciones |
| A.8.9 Gestión de configuración | ✅ | Migraciones versionadas en `supabase/migrations`, despliegue por `supabase.yml` |
| A.8.12 Prevención de fuga | ✅ | Ninguna consulta ni documento del usuario se persiste; `search` solo recibe el embedding |
| A.8.15 Registro | 🔄 | Logs de Edge Functions en Supabase; falta retención definida y alertas |
| A.8.16 Monitoreo | 🔄 | `web-push` y `pg_cron`; falta monitoreo de errores y latencia con umbrales |
| A.8.24 Criptografía | ✅ | TLS en tránsito, cifrado en reposo del proveedor; en cliente AES-GCM con PBKDF2 y sal por instalación (`docs/DATA-COMPATIBILITY.md`) |
| A.8.25 Ciclo de desarrollo seguro | ✅ | `npm run check` como compuerta, ratchet de calidad, revisión por PR |
| A.5.24–5.27 Incidentes | 🔄 | Canal en `/seguridad#reportar`; falta runbook y plazos de respuesta |
| A.5.29–5.30 Continuidad | 🔄 | Backups diarios del proveedor; falta prueba de restauración documentada |

## Alineación con ISO/IEC 42001 (gestión de IA)

| Requisito | Cómo se cubre |
|---|---|
| Política de IA y roles | `docs/PRINCIPLES.md` y `docs/ETHICS.md` (Fogg, checklist de 8 puntos, análisis de partes interesadas para PRs `risk:high`) |
| Evaluación de impacto | Compuerta ética obligatoria para analítica de criterios; nunca "probabilidad de ganar" sobre un juez nombrado |
| Datos y procedencia | Corpus solo de fuentes oficiales con fecha de reforma; `evals/` mide recuperación por artículo y publica resultados |
| Transparencia | `AIOutputLabel` en cada respuesta, `grounded` visible, aviso legal en cada turno, fuentes con enlace oficial |
| Supervisión humana | Orientación, no asesoría; canalización a abogados verificados (línea D) |
| Monitoreo del desempeño | Benchmark `npm run eval:retrieval` con línea base que solo puede subir; retroalimentación `AIFeedback` |
| Terceros | Proveedores de modelos elegidos por el usuario (BYOK) o modelo local; sin envío por defecto |

## Ruta

1. **Ahora**: mantener verdes los tests de invariantes; activar MFA obligatorio para `owner`/`admin`; rotar la service key al menos cada 90 días.
2. **Antes de cobrar**: runbook de incidentes con plazos, prueba de restauración de backup, registro de proveedores, retención de logs.
3. **Auditoría**: declaración de aplicabilidad (SoA) a partir de la tabla anterior, análisis de riesgos, auditoría interna y luego externa.

Cambios a las reglas de datos del servidor se documentan en el mismo PR en
`/seguridad` y en `supabase/README.md`.
