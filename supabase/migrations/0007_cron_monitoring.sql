-- 0007 · Programación del monitoreo (plan § 11.9, línea D).
-- pg_cron llama a la Edge Function `court-monitor` cada hora y a `web-push`
-- cada 5 minutos a través de pg_net. Las URLs y el secreto se leen de
-- `vault` (Supabase Vault) para no dejarlos en texto plano en la migración:
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1', 'functions_url');
--   select vault.create_secret('<CRON_SECRET>', 'cron_secret');
-- Sin esos secretos las tareas se registran pero no hacen nada (retornan).

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.call_edge_function(p_name text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'functions_url' limit 1;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1;
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := v_url || '/' || p_name,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;
revoke execute on function public.call_edge_function(text) from public, anon, authenticated;

-- Idempotent: unschedule before scheduling so re-running the migration is safe.
do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname in ('lexmx-court-monitor', 'lexmx-web-push');
exception when others then
  null;
end;
$$;

select cron.schedule('lexmx-court-monitor', '15 * * * *', $$select public.call_edge_function('court-monitor')$$);
select cron.schedule('lexmx-web-push', '*/5 * * * *', $$select public.call_edge_function('web-push')$$);

-- `court_events` needs the conflict target the monitor upserts on.
create unique index if not exists court_events_case_hash_idx on public.court_events (case_id, content_hash);
