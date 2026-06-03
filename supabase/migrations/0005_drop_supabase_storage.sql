-- 0005: clean cut to Cloudflare R2.
--
-- Video + thumbnail files now live in Cloudflare R2 (two buckets: a private
-- "videos" bucket served via presigned GET URLs, and a public "thumbnails"
-- bucket served via the r2.dev URL). The `recordings.storage_path` /
-- `thumbnail_path` columns now hold bare R2 object keys (`<user_id>/<uuid>.webm`
-- and `.jpg`) instead of Supabase Storage paths.
--
-- This migration removes all Supabase Storage usage and wipes existing rows so
-- we start fresh on R2 — there is no migration of old files (clean cut).

-- 1. Clear app data that references old Supabase-Storage keys.
--    recording_aliases FK-cascades from recordings, but be explicit.
delete from public.recording_aliases;
delete from public.recordings;

-- 2. Drop the storage.objects RLS policies created in 0001.
drop policy if exists "users manage own recording objects" on storage.objects;
drop policy if exists "users manage own thumbnail objects" on storage.objects;
drop policy if exists "public reads thumbnails" on storage.objects;

-- 3. Delete all objects in both buckets, then the buckets themselves.
delete from storage.objects where bucket_id in ('recordings', 'thumbnails');
delete from storage.buckets where id in ('recordings', 'thumbnails');
