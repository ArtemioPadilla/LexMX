-- 0005 · Monitoreo de tribunales, boletines y reformas (plan § 11.9).
-- El usuario registra QUÉ vigilar (expediente, ley); los adaptadores por país
-- (pg_cron + Edge Functions, o GitHub Actions para scraping largo) escriben
-- eventos con la service key. RLS limita la lectura al dueño del seguimiento.

create table if not exists public.watched_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  org_id uuid references public.orgs(id) on delete cascade,
  jurisdiction text not null default 'mx',
  court text not null,                           -- id del adaptador: 'mx-pjf', 'mx-cdmx-tsj'…
  expediente text not null,
  label text not null default '',
  active boolean not null default true,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, court, expediente)
);
alter table public.watched_cases enable row level security;
create policy "watched_cases: own or org read" on public.watched_cases
  for select using (auth.uid() = user_id or (org_id is not null and public.is_org_member(org_id)));
create policy "watched_cases: own write" on public.watched_cases
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.court_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.watched_cases(id) on delete cascade,
  occurred_at timestamptz not null,
  kind text not null,                            -- 'acuerdo', 'sentencia', 'notificacion', 'lista'…
  summary text not null,
  source_url text,
  content_hash text not null,                    -- dedupe por adaptador
  seen_at timestamptz,
  created_at timestamptz not null default now(),
  unique (case_id, content_hash)
);
create index if not exists court_events_case_idx on public.court_events (case_id, occurred_at desc);
alter table public.court_events enable row level security;
create policy "court_events: via case" on public.court_events
  for select using (exists (
    select 1 from public.watched_cases c
    where c.id = case_id and (c.user_id = auth.uid() or (c.org_id is not null and public.is_org_member(c.org_id)))
  ));
create policy "court_events: mark seen" on public.court_events
  for update using (exists (select 1 from public.watched_cases c where c.id = case_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.watched_cases c where c.id = case_id and c.user_id = auth.uid()));

-- Reformas sobre leyes seguidas. La tabla `reforms` la alimenta el pipeline
-- de corpus (corpus-update.yml) a partir de las fechas de reforma de cada ley.
create table if not exists public.reforms (
  id uuid primary key default gen_random_uuid(),
  jurisdiction text not null default 'mx',
  doc_id text not null,                          -- id del documento en el corpus (slug)
  published_at date not null,
  gazette_url text,
  summary text not null default '',
  created_at timestamptz not null default now(),
  unique (jurisdiction, doc_id, published_at)
);
alter table public.reforms enable row level security;
create policy "reforms: public read" on public.reforms for select using (true);

create table if not exists public.law_watches (
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  jurisdiction text not null default 'mx',
  doc_id text not null,
  notify_push boolean not null default true,
  notify_email boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, jurisdiction, doc_id)
);
alter table public.law_watches enable row level security;
create policy "law_watches: own" on public.law_watches
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Suscripciones Web Push (el service worker de @vite-pwa/astro las recibe).
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
create policy "push_subscriptions: own" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Notificaciones pendientes/entregadas (fan-out desde pg_cron a la Edge Function web-push).
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,                            -- 'court_event' | 'reform'
  title text not null,
  body text not null,
  url text,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  delivered_at timestamptz
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
create policy "notifications: own read" on public.notifications
  for select using (auth.uid() = user_id);
create policy "notifications: own mark read" on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Fan-out: nueva reforma → notificación a quien sigue esa ley.
create or replace function public.notify_reform()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, kind, title, body, url)
  select w.user_id, 'reform',
         'Reforma publicada: ' || new.doc_id,
         coalesce(nullif(new.summary, ''), 'Se publicó una reforma el ' || to_char(new.published_at, 'DD/MM/YYYY') || '.'),
         new.gazette_url
  from public.law_watches w
  where w.jurisdiction = new.jurisdiction and w.doc_id = new.doc_id;
  return null;
end;
$$;
drop trigger if exists reforms_notify on public.reforms;
create trigger reforms_notify after insert on public.reforms
  for each row execute function public.notify_reform();

-- Fan-out: nuevo evento de tribunal → notificación al dueño del seguimiento.
create or replace function public.notify_court_event()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, kind, title, body, url)
  select c.user_id, 'court_event',
         'Movimiento en ' || coalesce(nullif(c.label, ''), c.expediente),
         new.kind || ': ' || left(new.summary, 280),
         new.source_url
  from public.watched_cases c
  where c.id = new.case_id and c.active;
  return null;
end;
$$;
drop trigger if exists court_events_notify on public.court_events;
create trigger court_events_notify after insert on public.court_events
  for each row execute function public.notify_court_event();
