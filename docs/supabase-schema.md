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

## RLS (row level security)
- Owners: full CRUD where `auth.uid() = user_id`.
- Anyone may `SELECT` a row by slug where `visibility IN ('public','unlisted')` (link sharing).
- Storage: authenticated users may insert/select/delete objects under their own `<user_id>/` prefix
  in both buckets; `thumbnails` also allows public read.

## Migration
SQL lives in `supabase/migrations/`. Apply via the Supabase SQL editor, `supabase db push`, or the
Supabase MCP. Buckets can be created in the dashboard or via the storage API in the same migration.
