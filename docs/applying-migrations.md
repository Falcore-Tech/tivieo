# Applying Migrations

**Do not use the Supabase CLI.** Apply migration SQL through the Supabase **Management API**,
authenticated with the `ACCESS_TOKEN` env var (a Supabase personal access token, `sbp_…`) in
`.env.local`.

## Why the API (and not the keys)

The `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` go through PostgREST and
**cannot run DDL** (`ALTER TABLE`, `CREATE TRIGGER`, `CREATE FUNCTION`, …). Only the Management API
endpoint below, with `ACCESS_TOKEN`, runs arbitrary SQL.

## Endpoint

```
POST https://api.supabase.com/v1/projects/<ref>/database/query
Authorization: Bearer $ACCESS_TOKEN
Content-Type: application/json

{ "query": "<sql>" }
```

- **Project ref:** `ewmitykmynlvlstnabjy` (derivable from `NEXT_PUBLIC_SUPABASE_URL`).
- **Success:** a `[]` (or rows) response. Errors come back as a JSON `{ "message": … }`.

## One-liner

Build the JSON payload safely from the migration file with `jq -Rs` (handles quoting/newlines):

```bash
set -a; source .env.local; set +a
REF=$(echo "$NEXT_PUBLIC_SUPABASE_URL" | sed -E 's#https://([^.]+)\..*#\1#')

curl -s -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(jq -Rs '{query: .}' supabase/migrations/0008_chapters.sql)"
```

## Verify

Query `information_schema` / `pg_trigger` the same way to confirm columns/triggers landed, e.g.:

```bash
curl -s -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d "$(jq -Rn --arg q "select column_name from information_schema.columns where table_name='recordings';" '{query:$q}')"
```

Migration SQL lives in `supabase/migrations/`. The same Vault-secret one-time steps documented in
each migration's header still apply (run them through this endpoint too).
