-- Tivieo: recordings table, storage buckets, and RLS policies.

create extension if not exists "pgcrypto";

create table if not exists public.recordings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  slug text not null unique,
  storage_path text not null,
  thumbnail_path text,
  duration_seconds numeric,
  size_bytes bigint,
  visibility text not null default 'unlisted'
    check (visibility in ('public', 'unlisted', 'private')),
  status text not null default 'ready'
    check (status in ('uploading', 'ready', 'error')),
  created_at timestamptz not null default now()
);

create index if not exists recordings_user_id_created_at_idx
  on public.recordings (user_id, created_at desc);

alter table public.recordings enable row level security;

-- Owners: full access to their own rows.
drop policy if exists "owners manage own recordings" on public.recordings;
create policy "owners manage own recordings"
  on public.recordings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Anyone can read a shared (public/unlisted) recording by slug.
drop policy if exists "anyone reads shared recordings" on public.recordings;
create policy "anyone reads shared recordings"
  on public.recordings
  for select
  using (visibility in ('public', 'unlisted'));

-- Storage buckets.
insert into storage.buckets (id, name, public)
values ('recordings', 'recordings', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('thumbnails', 'thumbnails', true)
on conflict (id) do nothing;

-- Storage policies: users own objects under their own <user_id>/ prefix.
drop policy if exists "users manage own recording objects" on storage.objects;
create policy "users manage own recording objects"
  on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'recordings'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'recordings'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users manage own thumbnail objects" on storage.objects;
create policy "users manage own thumbnail objects"
  on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'thumbnails'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'thumbnails'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "public reads thumbnails" on storage.objects;
create policy "public reads thumbnails"
  on storage.objects
  for select
  to public
  using (bucket_id = 'thumbnails');
