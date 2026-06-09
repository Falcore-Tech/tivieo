-- Tivieo remux trigger (the "database webhook" that invokes the /api/remux
-- worker on Vercel). Builds on 0006. Mirrors the transcribe trigger (0004).
--
-- One-time prerequisites (NOT in this migration, to keep the secret out of git):
--   1. Store the shared webhook secret in Supabase Vault:
--        select vault.create_secret('<random-secret>', 'remux_webhook_secret');
--   2. Set the SAME value as the Vercel env var REMUX_WEBHOOK_SECRET.
--   3. Point the url below at the production deployment if it isn't tivieo.vercel.app.
--
-- The trigger reads the secret from Vault at call time and sends it as the
-- x-webhook-secret header; the route rejects any request without it.

create extension if not exists supabase_vault;
create extension if not exists pg_net;

-- Fires an async HTTP POST to the remux worker with the new row as the webhook
-- payload. pg_net queues the request, so the INSERT/UPDATE never blocks.
create or replace function public.trigger_remux()
returns trigger
language plpgsql
security definer
set search_path = ''
as $func$
begin
  perform net.http_post(
    url := 'https://tivieo.vercel.app/api/remux',
    body := jsonb_build_object('type', 'INSERT', 'table', 'recordings', 'record', to_jsonb(NEW)),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'remux_webhook_secret')
    ),
    timeout_milliseconds := 8000
  );
  return NEW;
end;
$func$;

-- New recordings (createRecording inserts with remux_status = 'pending' default).
drop trigger if exists remux_on_insert on public.recordings;
create trigger remux_on_insert
after insert on public.recordings
for each row
when (new.remux_status = 'pending')
execute function public.trigger_remux();

-- Manual retry: setting remux_status back to 'pending' re-invokes the worker.
-- The worker's own 'processing'/'ready'/'error' updates never set 'pending', so
-- they don't re-fire this trigger.
drop trigger if exists remux_on_repend on public.recordings;
create trigger remux_on_repend
after update of remux_status on public.recordings
for each row
when (new.remux_status = 'pending' and old.remux_status is distinct from 'pending')
execute function public.trigger_remux();
