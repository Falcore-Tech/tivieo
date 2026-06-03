-- Tivieo QOL: editing, organization, lifecycle, analytics, and sharing.
-- Builds on 0001_init_recordings.sql (recordings table + buckets must already exist).

-- 1. New recordings columns.
alter table public.recordings
  add column if not exists updated_at          timestamptz not null default now(),
  add column if not exists deleted_at          timestamptz,
  add column if not exists view_count          bigint not null default 0,
  add column if not exists collection_id       uuid,
  add column if not exists tags                text[] not null default '{}',
  add column if not exists share_password_hash text,
  add column if not exists expires_at          timestamptz;

create index if not exists recordings_tags_gin_idx
  on public.recordings using gin (tags);
create index if not exists recordings_collection_idx
  on public.recordings (collection_id);

-- 2. Collections (folders).
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists collections_user_idx
  on public.collections (user_id, created_at desc);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'recordings_collection_fk'
  ) then
    alter table public.recordings
      add constraint recordings_collection_fk
      foreign key (collection_id)
      references public.collections (id) on delete set null;
  end if;
end $$;

-- 3. Slug history, so renamed share links keep resolving.
create table if not exists public.recording_aliases (
  old_slug text primary key,
  recording_id uuid not null references public.recordings (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- 4. Bounded view-count increment (security definer; only counts shared, live rows).
create or replace function public.increment_recording_view(p_slug text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.recordings
  set view_count = view_count + 1
  where slug = p_slug
    and deleted_at is null
    and visibility in ('public', 'unlisted')
    and (expires_at is null or expires_at > now());
$$;

-- 5. RLS: public reads exclude soft-deleted and expired recordings.
drop policy if exists "anyone reads shared recordings" on public.recordings;
create policy "anyone reads shared recordings"
  on public.recordings
  for select
  using (
    visibility in ('public', 'unlisted')
    and deleted_at is null
    and (expires_at is null or expires_at > now())
  );

-- 6. RLS for collections (owner-only) and aliases (public read for redirects).
alter table public.collections enable row level security;
drop policy if exists "owners manage own collections" on public.collections;
create policy "owners manage own collections"
  on public.collections
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.recording_aliases enable row level security;
drop policy if exists "anyone reads aliases" on public.recording_aliases;
create policy "anyone reads aliases"
  on public.recording_aliases
  for select
  using (true);
