-- Tivieo chapters: AI-generated (and owner-editable) named, timestamped video
-- segments. Builds on 0003 (transcripts) + 0004 (transcribe triggers).
--
-- chapters         jsonb array of { "start": <seconds>, "title": <string> }
-- chapters_status  generation state machine; mirrors transcript_status.
--
-- Generation pipeline: the transcribe edge function, after it finishes
-- transcribing, sets chapters_status = 'pending'. That UPDATE crosses the
-- generate_chapters_on_pend trigger below, which POSTs to the generate-chapters
-- edge function (it reads the stored transcript and writes chapters). Manual
-- "Regenerate" (regenerateChapters server action) re-pends the same way.
--
-- One-time prerequisite (NOT in this migration, to keep the secret out of git):
-- store the shared webhook secret in Supabase Vault under the name below, and
-- set the SAME value as the generate-chapters function's CHAPTERS_WEBHOOK_SECRET:
--
--   select vault.create_secret('<random-secret>', 'chapters_webhook_secret');

create extension if not exists supabase_vault;
create extension if not exists pg_net;

alter table public.recordings
  add column if not exists chapters jsonb null;

alter table public.recordings
  add column if not exists chapters_status text not null default 'none'
    check (chapters_status in ('none', 'pending', 'processing', 'ready', 'error'));

-- Fires an async HTTP POST to the generate-chapters function with the row as the
-- webhook payload. pg_net queues the request, so the UPDATE never blocks.
create or replace function public.trigger_generate_chapters()
returns trigger
language plpgsql
security definer
set search_path = ''
as $func$
begin
  perform net.http_post(
    url := 'https://ewmitykmynlvlstnabjy.supabase.co/functions/v1/generate-chapters',
    body := jsonb_build_object('type', 'UPDATE', 'table', 'recordings', 'record', to_jsonb(NEW)),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'chapters_webhook_secret')
    ),
    timeout_milliseconds := 8000
  );
  return NEW;
end;
$func$;

-- chapters_status is set to 'pending' by the transcribe function (after a
-- transcript exists) and by the regenerateChapters server action. The
-- generate-chapters function's own 'processing'/'ready'/'error' updates never
-- set 'pending', so they never re-fire this trigger.
drop trigger if exists generate_chapters_on_pend on public.recordings;
create trigger generate_chapters_on_pend
after update of chapters_status on public.recordings
for each row
when (new.chapters_status = 'pending' and old.chapters_status is distinct from 'pending')
execute function public.trigger_generate_chapters();
