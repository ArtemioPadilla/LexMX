# LexMX Servidor (Supabase)

Servidor **opcional** para funciones de equipo (plan § 11.9 de
`docs/INCEPTOR-MIGRATION-ANALYSIS.md`). Sin él, LexMX funciona completo en
modo local-first: el sitio estático nunca depende de estas piezas.

## Qué hay aquí

| Ruta | Qué es |
|---|---|
| `config.toml` | Config del CLI para `supabase start` (dev local) |
| `migrations/0001_orgs_members.sql` | Perfiles, organizaciones, asientos, roles (allowlist), invitaciones; helpers `is_org_member`, `is_org_admin` |
| `migrations/0002_subscriptions_usage.sql` | Suscripciones y consumo agregado; solo lectura propia, escritura por Edge Functions |
| `migrations/0003_audit_log.sql` | Bitácora append-only con triggers; sin políticas de update/delete |
| `migrations/0004_lawyers_directory.sql` | Directorio verificado de abogados, canalización, bucket privado `credentials` |
| `migrations/0005_court_events.sql` | Expedientes vigilados, eventos de tribunal, reformas, seguimiento de leyes, Web Push, notificaciones con fan-out |
| `migrations/0006_corpus_vectors.sql` | Corpus abierto en pgvector (384-d, mismo modelo que el cliente) y `match_chunks` |
| `functions/search` | API pública de búsqueda semántica (base del MCP hospedado) |
| `functions/web-push` | Entrega notificaciones pendientes a las suscripciones push |
| `functions/stripe-webhook` | Único escritor de `subscriptions` |
| `functions/whatsapp-webhook` | Webhook de Meta Cloud API (handshake + respuesta) |

## Reglas que protegen la promesa local-first

1. La **service key** solo existe en las Edge Functions (`_shared/client.ts`).
   El navegador usa la anon key; **RLS es la única frontera**.
2. **Ningún expediente ni consulta** llega a Supabase por defecto. Aquí solo
   viven metadatos de cuenta, organización, suscripciones y monitoreo.
3. Documentos compartidos por una organización se **cifran en el cliente**
   (`src/lib/security`) antes de subirse; Supabase guarda bytes ilegibles.
4. Toda función que use el servidor **lo dice en la UI** ("esta acción usa
   LexMX Servidor").
5. Todo es Postgres estándar y Deno: el `docker compose` oficial de Supabase
   permite autoalojar sin cambiar código.

## Configurar (una vez)

```bash
# Frontend (Actions → Variables; son públicas)
gh variable set PUBLIC_SUPABASE_URL --body "https://<ref>.supabase.co"
gh variable set PUBLIC_SUPABASE_ANON_KEY --body "sb_publishable_…"
gh variable set SUPABASE_PROJECT_REF --body "<ref>"

# Migraciones por CI (Actions → Secrets)
gh secret set SUPABASE_ACCESS_TOKEN   # supabase.com → Account → Access Tokens (sbp_…)
gh secret set SUPABASE_DB_PASSWORD    # Project Settings → Database
```

Secrets de las funciones (Dashboard → Edge Functions → Secrets):
`HF_TOKEN` (search con `q`), `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT`
y `CRON_SECRET` (web-push), `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`,
`WHATSAPP_VERIFY_TOKEN`/`WHATSAPP_ACCESS_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID`.

## Desarrollo local

```bash
supabase start          # Postgres + Auth + Storage + Functions en Docker
supabase db reset       # aplica migrations/ desde cero
supabase functions serve search --env-file supabase/.env.local
```

`src/test/supabase-schema.test.ts` valida invariantes de las migraciones
(RLS en toda tabla pública, bitácora sin update/delete, numeración).
