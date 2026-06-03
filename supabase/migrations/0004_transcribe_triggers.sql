-- Tivieo transcription triggers (the "database webhook" that invokes the
-- `transcribe` edge function). Builds on 0003.
--
-- One-time prerequisite (NOT in this migration, to keep the secret out of git):
-- store the shared webhook secret in Supabase Vault under the name below, and
-- set the SAME value as the edge function's TRANSCRIBE_WEBHOOK_SECRET secret:
--
--   select vault.create_secret('<random-secret>', 'transcribe_webhook_secret');
--
-- The trigger function reads it from Vault at call time and sends it as the
-- `x-webhook-secret` header; the edge function rejects any request without it.

create extension if not exists supabase_vault;
create extension if not exists pg_net;

-- Fires an async HTTP POST to the transcribe function with the new row as the
-- webhook payload. pg_net queues the request, so the INSERT/UPDATE never blocks.
create or replace function public.trigger_transcribe()
returns trigger
language plpgsql
security definer
set search_path = ''
as $func$
begin
  perform net.http_post(
    url := 'https://ewmitykmynlvlstnabjy.supabase.co/functions/v1/transcribe',
    body := jsonb_build_object('type', 'INSERT', 'table', 'recordings', 'record', to_jsonb(NEW)),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'transcribe_webhook_secret')
    ),
    timeout_milliseconds := 8000
  );
  return NEW;
end;
$func$;

-- New recordings (createRecording inserts with transcript_status = 'pending').
drop trigger if exists transcribe_on_insert on public.recordings;
create trigger transcribe_on_insert
after insert on public.recordings
for each row
when (new.transcript_status = 'pending')
execute function public.trigger_transcribe();

-- Manual (re)transcription: requestTranscription() sets status back to 'pending';
-- this re-invokes the function. The function's own 'processing'/'ready'/'error'
-- updates don't set 'pending', so they never re-fire this trigger.
drop trigger if exists transcribe_on_repend on public.recordings;
create trigger transcribe_on_repend
after update of transcript_status on public.recordings
for each row
when (new.transcript_status = 'pending' and old.transcript_status is distinct from 'pending')
execute function public.trigger_transcribe();
