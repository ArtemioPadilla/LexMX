-- 0002 · Suscripciones y consumo (plan § 11.9, línea D).
-- El frontend solo LEE su propia suscripción y consumo. Toda escritura llega
-- por Edge Functions (webhooks de Stripe / proveedor local) con la service
-- key, que nunca sale de esas funciones: no hay política de insert/update
-- para usuarios autenticados.

create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'canceled', 'paused');
create type public.payment_provider as enum ('stripe', 'mercadopago', 'oxxo', 'spei', 'pix', 'manual');

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  -- Exactamente uno de los dos: suscripción personal o de organización.
  user_id uuid references auth.users(id) on delete cascade,
  org_id uuid references public.orgs(id) on delete cascade,
  plan text not null check (plan in ('free', 'pro', 'team', 'enterprise')),
  status public.subscription_status not null default 'trialing',
  seats integer not null default 1 check (seats >= 1),
  provider public.payment_provider not null default 'manual',
  external_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((user_id is null) <> (org_id is null))
);
create unique index if not exists subscriptions_user_idx on public.subscriptions (user_id) where user_id is not null;
create unique index if not exists subscriptions_org_idx on public.subscriptions (org_id) where org_id is not null;
alter table public.subscriptions enable row level security;
create policy "subscriptions: own read" on public.subscriptions
  for select using (auth.uid() = user_id or (org_id is not null and public.is_org_member(org_id)));

drop trigger if exists subscriptions_touch on public.subscriptions;
create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function public.touch_updated_at();

-- Consumo por periodo (mes natural). Contadores agregados, nunca el contenido
-- de las consultas.
create table if not exists public.usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  org_id uuid references public.orgs(id) on delete cascade,
  period date not null,                      -- primer día del mes
  queries integer not null default 0 check (queries >= 0),
  documents integer not null default 0 check (documents >= 0),
  tokens_in bigint not null default 0 check (tokens_in >= 0),
  tokens_out bigint not null default 0 check (tokens_out >= 0),
  updated_at timestamptz not null default now(),
  check ((user_id is null) <> (org_id is null)),
  unique (user_id, period),
  unique (org_id, period)
);
alter table public.usage enable row level security;
create policy "usage: own read" on public.usage
  for select using (auth.uid() = user_id or (org_id is not null and public.is_org_member(org_id)));

-- Incremento atómico llamado desde Edge Functions (service role) al terminar
-- una acción con servidor. Los clientes locales no reportan consumo.
create or replace function public.record_usage(
  p_user uuid, p_org uuid, p_queries int default 0, p_documents int default 0,
  p_tokens_in bigint default 0, p_tokens_out bigint default 0)
returns void language plpgsql security definer set search_path = public as $$
declare
  p date := date_trunc('month', now())::date;
begin
  if p_org is not null then
    insert into public.usage (org_id, period, queries, documents, tokens_in, tokens_out)
    values (p_org, p, p_queries, p_documents, p_tokens_in, p_tokens_out)
    on conflict (org_id, period) do update set
      queries = public.usage.queries + excluded.queries,
      documents = public.usage.documents + excluded.documents,
      tokens_in = public.usage.tokens_in + excluded.tokens_in,
      tokens_out = public.usage.tokens_out + excluded.tokens_out,
      updated_at = now();
  else
    insert into public.usage (user_id, period, queries, documents, tokens_in, tokens_out)
    values (p_user, p, p_queries, p_documents, p_tokens_in, p_tokens_out)
    on conflict (user_id, period) do update set
      queries = public.usage.queries + excluded.queries,
      documents = public.usage.documents + excluded.documents,
      tokens_in = public.usage.tokens_in + excluded.tokens_in,
      tokens_out = public.usage.tokens_out + excluded.tokens_out,
      updated_at = now();
  end if;
end;
$$;
revoke execute on function public.record_usage(uuid, uuid, int, int, bigint, bigint) from public, anon, authenticated;
