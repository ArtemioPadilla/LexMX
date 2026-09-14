-- 0004 · Directorio verificado de abogados y canalización (plan § 11.9).
-- La credencial (cédula profesional u homóloga por país) se sube cifrada en
-- el cliente a un bucket privado; la verificación la hace un operador desde
-- la consola (columna `verified_at`, solo service role). El público ve
-- únicamente perfiles verificados.

create table if not exists public.lawyer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  jurisdiction text not null default 'mx',
  entity_code text,                              -- ISO 3166-2, p. ej. MX-JAL
  areas text[] not null default '{}',            -- LegalArea del cliente
  headline text not null default '' check (char_length(headline) <= 160),
  bio text not null default '' check (char_length(bio) <= 2000),
  languages text[] not null default '{es}',
  contact_email text,
  credential_path text,                          -- objeto cifrado en Storage
  verified_at timestamptz,
  verified_by text,
  accepting_clients boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lawyer_profiles_lookup_idx
  on public.lawyer_profiles (jurisdiction, entity_code) where verified_at is not null;
alter table public.lawyer_profiles enable row level security;
create policy "lawyer_profiles: public read verified" on public.lawyer_profiles
  for select using (verified_at is not null or auth.uid() = user_id);
create policy "lawyer_profiles: own insert" on public.lawyer_profiles
  for insert with check (auth.uid() = user_id and verified_at is null);
create policy "lawyer_profiles: own update" on public.lawyer_profiles
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id and verified_at is not distinct from (select p.verified_at from public.lawyer_profiles p where p.user_id = auth.uid()));
create policy "lawyer_profiles: own delete" on public.lawyer_profiles
  for delete using (auth.uid() = user_id);
drop trigger if exists lawyer_profiles_touch on public.lawyer_profiles;
create trigger lawyer_profiles_touch before update on public.lawyer_profiles
  for each row execute function public.touch_updated_at();

-- Solicitudes de canalización: el usuario describe (sin subir el expediente)
-- y el sistema propone abogados; el usuario decide a quién contactar.
create type public.referral_status as enum ('open', 'matched', 'closed');

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  jurisdiction text not null default 'mx',
  entity_code text,
  area text not null,
  summary text not null check (char_length(summary) between 10 and 1000),
  status public.referral_status not null default 'open',
  lawyer_id uuid references public.lawyer_profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.referrals enable row level security;
create policy "referrals: own or matched lawyer read" on public.referrals
  for select using (auth.uid() = user_id or auth.uid() = lawyer_id);
create policy "referrals: own insert" on public.referrals
  for insert with check (auth.uid() = user_id);
create policy "referrals: own update" on public.referrals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop trigger if exists referrals_touch on public.referrals;
create trigger referrals_touch before update on public.referrals
  for each row execute function public.touch_updated_at();

-- Bucket privado para credenciales cifradas en cliente.
insert into storage.buckets (id, name, public, file_size_limit)
values ('credentials', 'credentials', false, 10485760)
on conflict (id) do nothing;
create policy "credentials: own objects" on storage.objects
  for all using (bucket_id = 'credentials' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'credentials' and (storage.foldername(name))[1] = auth.uid()::text);
