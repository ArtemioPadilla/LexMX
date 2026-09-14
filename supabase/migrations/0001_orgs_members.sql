-- 0001 · Identidad, organizaciones, asientos, roles e invitaciones (plan § 11.9).
-- Reglas: RLS en toda tabla pública; los roles son un allowlist explícito;
-- nada de expedientes ni consultas del usuario vive aquí.

create extension if not exists pgcrypto;

-- Perfil público mínimo. Se crea por trigger al registrarse.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  jurisdiction text not null default 'mx',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles: own read" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles: own update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Organizaciones (despachos, áreas jurídicas, equipos).
create type public.org_role as enum ('owner', 'admin', 'member', 'viewer');

create table if not exists public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$'),
  jurisdiction text not null default 'mx',
  created_by uuid not null references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.orgs enable row level security;

create table if not exists public.org_members (
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.org_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
alter table public.org_members enable row level security;

-- Helpers SECURITY DEFINER para que las políticas no se recursen.
create or replace function public.is_org_member(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.org_members m
    where m.org_id = p_org and m.user_id = auth.uid()
  );
$$;

create or replace function public.org_role_of(p_org uuid)
returns public.org_role language sql stable security definer set search_path = public as $$
  select m.role from public.org_members m
  where m.org_id = p_org and m.user_id = auth.uid();
$$;

create or replace function public.is_org_admin(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.org_role_of(p_org) in ('owner', 'admin');
$$;

-- Al crear una org, quien la crea es owner.
create or replace function public.handle_new_org()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.org_members (org_id, user_id, role) values (new.id, new.created_by, 'owner');
  return new;
end;
$$;
drop trigger if exists on_org_created on public.orgs;
create trigger on_org_created
  after insert on public.orgs
  for each row execute function public.handle_new_org();

create policy "orgs: members read" on public.orgs
  for select using (public.is_org_member(id));
create policy "orgs: authenticated create" on public.orgs
  for insert with check (auth.uid() = created_by);
create policy "orgs: admins update" on public.orgs
  for update using (public.is_org_admin(id)) with check (public.is_org_admin(id));
create policy "orgs: owner delete" on public.orgs
  for delete using (public.org_role_of(id) = 'owner');

create policy "org_members: members read" on public.org_members
  for select using (public.is_org_member(org_id));
create policy "org_members: admins manage" on public.org_members
  for all using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

-- Invitaciones por correo; se aceptan desde una Edge Function que valida el token.
create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  email text not null check (position('@' in email) > 1),
  role public.org_role not null default 'member' check (role <> 'owner'),
  token_hash text not null unique,
  invited_by uuid not null references auth.users(id) default auth.uid(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.invites enable row level security;
create policy "invites: admins manage" on public.invites
  for all using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

-- updated_at genérico.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
