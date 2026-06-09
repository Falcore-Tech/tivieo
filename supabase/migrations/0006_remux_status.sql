-- Tivieo seekability: MediaRecorder webm ships with no Cues seek index, so
-- browsers can only seek within buffered data. A background job remuxes each
-- upload with `ffmpeg -c copy` (lossless, no re-encode) to add the index. This
-- column is the job's state machine, claimed/advanced by the /api/remux worker.
--
--   remux_status: pending | processing | ready | error
alter table public.recordings
  add column if not exists remux_status   text     not null default 'pending',
  add column if not exists remux_attempts smallint not null default 0;

-- Existing rows were already remuxed via scripts/remux-add-cues.ts.
update public.recordings set remux_status = 'ready';

-- Worker claim lookup: find the oldest pending/error job to process.
create index if not exists recordings_remux_status_idx
  on public.recordings (remux_status, created_at)
  where remux_status in ('pending', 'error');
