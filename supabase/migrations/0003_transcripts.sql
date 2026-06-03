-- Tivieo transcription: store speech-to-text results per recording.
-- Builds on 0002_qol.sql. Transcription itself runs in the `transcribe`
-- edge function (Deepgram), triggered by a Database Webhook on INSERT.

-- 1. Transcript columns.
--    transcript_status: none | pending | processing | ready | error
--    transcript_segments: jsonb array of { start, end, text, speaker? }
alter table public.recordings
  add column if not exists transcript_status   text not null default 'none',
  add column if not exists transcript_lang     text,
  add column if not exists transcript_text     text,
  add column if not exists transcript_segments jsonb,
  add column if not exists transcript_summary  text,
  add column if not exists transcript_topics   text[];

-- 2. Full-text search over transcripts (owner library search, watch-page find).
create index if not exists recordings_transcript_fts_idx
  on public.recordings
  using gin (to_tsvector('simple', coalesce(transcript_text, '')));
