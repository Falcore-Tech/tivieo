# Supabase Schema & Setup

## Environment variables (`.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable (anon) key>
```
```
SUPABASE_SERVICE_ROLE_KEY=<service role key>
```
`@supabase/ssr` uses the **publishable** key naming. The **service role** key is server-only and is
used by `lib/supabase/admin.ts` to mint signed playback URLs for the private `recordings` bucket —
only after the request has been authorized by an RLS-gated row fetch. Never expose it to the client.

## Storage buckets
- `recordings` — **private**. Objects keyed `<user_id>/<uuid>.webm`. Played via short-lived signed URLs created server-side.
- `thumbnails` — **public**. Poster frames keyed `<user_id>/<uuid>.jpg`.

## Table: `recordings`
| column | type | notes |
|---|---|---|
| `id` | uuid PK `gen_random_uuid()` | |
| `user_id` | uuid → `auth.users` | owner |
| `title` | text | editable |
| `slug` | text unique | `slugify(title)-<nanoid(6)>` |
| `storage_path` | text | path in `recordings` bucket |
| `thumbnail_path` | text null | path in `thumbnails` bucket |
| `duration_seconds` | numeric null | |
| `size_bytes` | bigint null | |
| `visibility` | text default `'unlisted'` | `public` \| `unlisted` \| `private` |
| `status` | text default `'ready'` | `uploading` \| `ready` \| `error` |
| `created_at` | timestamptz default `now()` | |
| `updated_at` | timestamptz default `now()` | set on every edit (0002) |
| `deleted_at` | timestamptz null | soft-delete / Trash (0002) |
| `view_count` | bigint default `0` | incremented by RPC (0002) |
| `collection_id` | uuid → `collections` null | folder, `on delete set null` (0002) |
| `tags` | text[] default `'{}'` | GIN-indexed (0002) |
| `share_password_hash` | text null | `salt:scryptHash`; verified server-side (0002) |
| `expires_at` | timestamptz null | public reads stop after this (0002) |
| `transcript_status` | text default `'none'` | `none` \| `pending` \| `processing` \| `ready` \| `error` (0003) |
| `transcript_lang` | text null | Deepgram-detected language code (0003) |
| `transcript_text` | text null | full transcript; FTS-indexed (0003) |
| `transcript_segments` | jsonb null | array of `{ start, end, text, speaker? }` (0003) |

## Table: `collections` (0002)
Folders. `id` uuid PK, `user_id` uuid → `auth.users`, `name` text, `created_at` timestamptz.

## Table: `recording_aliases` (0002)
Old-slug history so renamed share links keep resolving. `old_slug` text PK, `recording_id` uuid →
`recordings on delete cascade`. The watch page falls back to this and 308-redirects to the live slug.

## RPC: `increment_recording_view(p_slug text)` (0002)
`security definer`; increments `view_count` only for non-deleted, non-expired, shared rows. Called
from the watch page via a client beacon with a per-viewer cookie de-dupe.

## RLS (row level security)
- Owners: full CRUD where `auth.uid() = user_id`.
- Anyone may `SELECT` a shared row where `visibility IN ('public','unlisted')` **and** `deleted_at is null`
  **and** (`expires_at is null` or `expires_at > now()`) (0002 tightened this).
- `collections`: owner-only. `recording_aliases`: public `SELECT` (for redirects); writes go through the
  admin client in server actions.
- Storage: authenticated users may insert/select/delete objects under their own `<user_id>/` prefix
  in both buckets; `thumbnails` also allows public read.

## Transcription (0003)
On insert, a recording is created with `transcript_status = 'pending'`. A Supabase **Database Webhook**
on `INSERT` into `public.recordings` invokes the `transcribe` edge function
(`supabase/functions/transcribe/`), which mints a signed URL for the private webm and sends it to
**Deepgram** (`nova-3`, `utterances`, `detect_language`). It writes `transcript_text` + per-utterance
`transcript_segments` and flips the row to `ready` (or `error`). The watch page renders a `<track>`
caption file from `/v/[slug]/captions` (built from the segments, same-origin) plus an interactive,
searchable transcript panel. Full setup + secrets are in `docs/transcription.md`.

## Migrations
SQL lives in `supabase/migrations/` (`0001_init_recordings.sql`, `0002_qol.sql`, `0003_transcripts.sql`).
Apply via the Supabase SQL editor, `supabase db push`, or the Supabase MCP. `0001` is applied; apply
`0002` before using folders, tags, trash, view counts, vanity-slug redirects, or password/expiry links;
apply `0003` before using transcription.
