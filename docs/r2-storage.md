# R2 Storage

Video + thumbnail files live in **Cloudflare R2** (S3-compatible). Supabase keeps
Auth + Postgres + the transcribe edge function; only file storage is on R2.

## Two-bucket model

R2's free public `r2.dev` URL makes an **entire bucket** public, so videos and
thumbnails are split across two buckets:

| Bucket | Visibility | Serves | Access |
|---|---|---|---|
| `tivieo-videos` | **private** | the `.webm` recordings | presigned GET URLs (2h TTL) |
| `tivieo-thumbnails` | **public** (`r2.dev`) | the `.jpg` posters | stable public URL |

Keeping videos private means a recording is only watchable through a short-lived
signed URL minted server-side after the visibility/ownership check. The public
thumbnails bucket is world-readable by design (stable URLs for `<img>` cards and
OG/social previews) — **never put anything sensitive in it.**

Object key scheme (held bare in `recordings.storage_path` / `thumbnail_path`):
- video: `<user_id>/<uuid>.webm`
- thumbnail: `<user_id>/<uuid>.jpg`

## Access layer

`lib/r2/index.ts` (server-only) wraps `@aws-sdk/client-s3` +
`@aws-sdk/s3-request-presigner`:
- `presignPutUrl(key, contentType)` — browser uploads the webm directly (PUT).
- `presignGetUrl(key, ttl, { downloadFilename? })` — private playback / download.
- `publicThumbnailUrl(key)` — `${R2_THUMBNAILS_PUBLIC_URL}/${key}`.
- `putThumbnail(key, bytes)` — server-side thumbnail PUT to the public bucket.
- `deleteObjects("videos"|"thumbnails", keys[])` — permanent delete.

The transcribe edge function (Deno) re-signs an R2 GET URL with `aws4fetch`
(`signQuery: true`, `X-Amz-Expires`) and hands it to Deepgram as a remote URL.

## Setup (already provisioned; reproduce with wrangler)

```bash
# 1. Buckets
wrangler r2 bucket create tivieo-videos        # private
wrangler r2 bucket create tivieo-thumbnails     # public

# 2. Public access for thumbnails → copy the printed pub-*.r2.dev URL
wrangler r2 bucket dev-url enable tivieo-thumbnails

# 3. CORS on the videos bucket (browser PUT + <video> range GET + edit-picker
#    canvas capture). Rules file uses the R2 API shape (a `rules` array):
wrangler r2 bucket cors set tivieo-videos --file docs/r2-videos-cors.json
```

`docs/r2-videos-cors.json`:
```json
{
  "rules": [
    {
      "allowed": {
        "origins": ["http://localhost:3000", "https://YOUR_PROD_DOMAIN"],
        "methods": ["GET", "PUT", "HEAD"],
        "headers": ["content-type"]
      },
      "exposeHeaders": ["ETag"],
      "maxAgeSeconds": 3600
    }
  ]
}
```

When deploying to production, **add the prod origin** to `allowed.origins` and
re-run the `cors set` command, or presigned PUT/scrub from the live site fails.

## S3 API token

Create from Cloudflare dashboard → R2 → Manage R2 API Tokens → an **S3** token
with **Object Read & Write** on both buckets. It yields an Access Key ID +
Secret. Those plus the account id and bucket names go in env vars.

## Env vars (server-only — never `NEXT_PUBLIC_`)

| Var | Value |
|---|---|
| `R2_ACCOUNT_ID` | Cloudflare account id |
| `R2_ACCESS_KEY_ID` | S3 API token access key id |
| `R2_SECRET_ACCESS_KEY` | S3 API token secret |
| `R2_VIDEOS_BUCKET` | `tivieo-videos` |
| `R2_THUMBNAILS_BUCKET` | `tivieo-thumbnails` |
| `R2_THUMBNAILS_PUBLIC_URL` | the `pub-*.r2.dev` URL (no trailing slash) |

The Next.js app reads these from `.env.local`. The transcribe edge function
needs the first four as **Supabase function secrets**
(`supabase secrets set R2_ACCOUNT_ID=… R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=…
R2_VIDEOS_BUCKET=…`), then `supabase functions deploy transcribe`.

## Gotchas

- **Presigned PUT 403 `SignatureDoesNotMatch`** → the PUT `Content-Type` header
  must exactly equal the signed `ContentType` (`video/webm`).
- **Tainted canvas / `toBlob` throws in the edit thumbnail picker** → the videos
  bucket CORS is missing `GET`/`HEAD` for the page origin (the `<video>` uses
  `crossOrigin="anonymous"` to allow frame capture).
- **`r2.dev` propagation** → a freshly public bucket can 404 for a minute before
  serving; not a code bug.
- **`storage_path` is a bare key** (no bucket prefix). The edge function builds
  the URL as `https://<account>.r2.cloudflarestorage.com/<bucket>/<key>` — don't
  double-prefix.
