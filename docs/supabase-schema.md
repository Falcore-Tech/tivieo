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
used by `lib/supabase/admin.ts` for RLS-bypassing DB reads (slug→row lookups, aliases, view counts).
Never expose it to the client.

## File storage (Cloudflare R2 — not Supabase)
Video + thumbnail **files** live in Cloudflare R2, not Supabase Storage. `storage_path` /
`thumbnail_path` below hold **bare R2 object keys** (`<user_id>/<uuid>.webm` / `.jpg`), not Supabase
paths. Private videos play via presigned GET URLs; thumbnails via the public `r2.dev` URL. See
`docs/r2-storage.md`. (Migration `0005` dropped the old Supabase `recordings`/`thumbnails` buckets.)

## Table: `recordings`
| column | type | notes |
|---|---|---|
| `id` | uuid PK `gen_random_uuid()` | |
| `user_id` | uuid → `auth.users` | owner |
| `title` | text | editable |
| `slug` | text unique | `slugify(title)-<nanoid(6)>` |
| `storage_path` | text | R2 object key in `tivieo-videos` (`<user_id>/<uuid>.webm`) |
| `thumbnail_path` | text null | R2 object key in `tivieo-thumbnails` (`<user_id>/<uuid>.jpg`) |
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
| `remux_status` | text default `'pending'` | `pending` \| `processing` \| `ready` \| `error` — webm Cues-index job, run by `/api/remux` (0006) |
| `remux_attempts` | smallint default `0` | retry counter for the remux worker (0006) |
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
- File access control is enforced at the **app layer** (R2 has no RLS): video keys are only handed out
  as presigned GET URLs after the watch-page visibility check; thumbnails are public by bucket.

## Transcription (0003)
On insert, a recording is created with `transcript_status = 'pending'`. A Supabase **Database Webhook**
on `INSERT` into `public.recordings` invokes the `transcribe` edge function
(`supabase/functions/transcribe/`), which presigns an R2 GET URL for the private webm and sends it to
**Deepgram** (`nova-3`, `utterances`, `detect_language`). It writes `transcript_text` + per-utterance
`transcript_segments` and flips the row to `ready` (or `error`). The watch page renders a `<track>`
caption file from `/v/[slug]/captions` (built from the segments, same-origin) plus an interactive,
searchable transcript panel. Full setup + secrets are in `docs/transcription.md`.

## Migrations
SQL lives in `supabase/migrations/` (`0001_init_recordings.sql` … `0006_remux_status.sql`).
Apply via the Supabase SQL editor, `supabase db push`, or the Supabase MCP. `0001` is applied; apply
`0002` before using folders, tags, trash, view counts, vanity-slug redirects, or password/expiry links;
apply `0003`/`0004` before using transcription; apply `0006` before using the seekability remux job
(`/api/remux`). It adds `remux_status`/`remux_attempts` and marks all existing rows `ready` (they were
backfilled by `scripts/remux-add-cues.ts`).
