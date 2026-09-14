-- 0003 · Bitácora de auditoría inmutable (plan § 11.9).
-- Append-only: sin políticas de update/delete y con permisos revocados; los
-- triggers escriben con SECURITY DEFINER. Los administradores de una
-- organización leen la bitácora de su organización; cada usuario la suya.

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid,                                   -- auth.uid() o null (sistema)
  org_id uuid,
  action text not null,                         -- p. ej. 'org_members.insert'
  target text,                                  -- clave del registro afectado
  detail jsonb not null default '{}'::jsonb     -- nunca contenido de consultas
);
create index if not exists audit_log_org_at_idx on public.audit_log (org_id, at desc);
create index if not exists audit_log_actor_at_idx on public.audit_log (actor, at desc);
alter table public.audit_log enable row level security;
create policy "audit_log: org admins read" on public.audit_log
  for select using (
    (org_id is not null and public.is_org_admin(org_id))
    or (org_id is null and actor = auth.uid())
  );
revoke insert, update, delete, truncate on public.audit_log from public, anon, authenticated;

create or replace function public.audit_row_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_target text;
  v_row jsonb;
begin
  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_org := nullif(v_row ->> 'org_id', '')::uuid;
  v_target := coalesce(v_row ->> 'id', concat_ws(':', v_row ->> 'org_id', v_row ->> 'user_id'));
  insert into public.audit_log (actor, org_id, action, target, detail)
  values (
    auth.uid(), v_org, tg_table_name || '.' || lower(tg_op), v_target,
    jsonb_build_object('role', v_row -> 'role', 'status', v_row -> 'status', 'plan', v_row -> 'plan')
  );
  return null;
end;
$$;

drop trigger if exists audit_org_members on public.org_members;
create trigger audit_org_members after insert or update or delete on public.org_members
  for each row execute function public.audit_row_change();
drop trigger if exists audit_invites on public.invites;
create trigger audit_invites after insert or update or delete on public.invites
  for each row execute function public.audit_row_change();
drop trigger if exists audit_subscriptions on public.subscriptions;
create trigger audit_subscriptions after insert or update or delete on public.subscriptions
  for each row execute function public.audit_row_change();
