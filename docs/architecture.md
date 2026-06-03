# Architecture

## Stack
Next.js 16 App Router · React 19 · Tailwind v4 · TypeScript · Supabase (Auth + Postgres + Storage).

## Data flow
```
/record (client)
  getDisplayMedia(screen+audio) ┐
  getUserMedia(cam+mic)         ┘→ canvas compositor (PiP) → captureStream
                                  + AudioContext mix → combined MediaStream
                                  → RecordRTC → webm Blob (+ poster frame)
                                          │
              tus-js-client resumable     ▼
                              Supabase Storage: recordings/ (private), thumbnails/ (public)
                                          │ createRecording() server action
                                          ▼
                              Postgres recordings row (slug, owner, paths, visibility…)

/v/[slug] (server) → fetch row by slug → signed URL (private bucket) → <VideoPlayer> (Vidstack)
/dashboard (server) → list owner rows → cards (rename / visibility / delete server actions)
```

## Routes
| Route | Type | Purpose |
|---|---|---|
| `/` | server | Landing + CTA. |
| `/login` | client form | Supabase auth (magic link / password). |
| `/auth/confirm` | route handler | Email OTP/code exchange. |
| `/auth/signout` | route handler | Sign out + redirect. |
| `/record` | auth-gated | Recording studio (client). |
| `/dashboard` | auth-gated, server | User's recordings library. |
| `/v/[slug]` | public, server | Share page + player. |

## Auth gating
The root `proxy.ts` (Next.js 16's replacement for `middleware.ts`) runs `updateSession()` (from
`lib/supabase/proxy.ts`), which refreshes the session and redirects unauthenticated users away from
`/record` and `/dashboard`.

## Why client-side compositing
Merging a webcam bubble over the screen into a single recorded track requires drawing both onto a
canvas per frame and recording `canvas.captureStream()`. No maintained package does this end-to-end,
so the compositor is our only bespoke glue; everything else (recording, playback, upload) uses
libraries. See `recording-pipeline.md`.

## Known caveats
- Output is **webm** (VP9/Opus). Safari webm playback is limited — MP4 transcode is a future task.
- System-audio capture via `getDisplayMedia` is browser/OS dependent; we fall back to mic-only.
- Large uploads use resumable TUS to survive flaky networks.
