# Transcription, Summary & Topics

Every recording is automatically transcribed, summarized, and tagged with topics by
[Deepgram](https://deepgram.com), then shown on the watch page as captions, an AI summary,
topic chips, and an interactive searchable transcript.

## Flow

1. `createRecording()` (`app/record/_actions.ts`) inserts the row with `transcript_status = 'pending'`.
2. The `transcribe_on_insert` trigger on `public.recordings` (a database webhook implemented with
   `pg_net`, see `0004`) fires an **async** HTTP POST to the `transcribe` edge function
   (`supabase/functions/transcribe/index.ts`) with the new row as the payload and an
   `x-webhook-secret` header read from **Supabase Vault**.
3. The function checks the secret, returns `202` immediately, then transcribes in the background
   (`EdgeRuntime.waitUntil`) so a long Deepgram call never trips the trigger's HTTP timeout. It
   mints a 30-min signed URL for the private webm and sends it to Deepgram `/v1/listen`
   (`model=nova-3`, `utterances`, `detect_language`, `summarize=v2`, `topics=true`).
   - **English-only intelligence:** `summarize`/`topics` only work on English audio. If the call
     fails (e.g. non-English), the function retries **transcript-only** so transcription never
     breaks — summary/topics are simply left null.
4. It writes `transcript_text`, `transcript_segments` (`{start,end,text,speaker?}`),
   `transcript_summary`, `transcript_topics`, and flips `transcript_status` to `ready`
   (or `error` on failure).
5. The watch page (`/v/[slug]`) renders:
   - a `<track>` caption file from `/v/[slug]/captions/route.ts` (WebVTT built from segments, same-origin so no CORS),
   - `TranscriptInsights` — AI summary + topic chips,
   - `TranscriptPanel` — searchable transcript with clickable timestamps that seek the player
     (shared video ref via `VideoProvider` / `useVideoRef`).

## Manual (re)transcription

Older recordings (created before this feature) sit at `transcript_status = 'none'`, and a run can
fail (`error`). For the **owner**, `TranscriptPanel` shows a **Transcribe** / **Retry** button that
calls the `requestTranscription(slug)` server action (`app/v/[slug]/_actions.ts`). That action sets
the row back to `pending`, which the `transcribe_on_repend` UPDATE trigger picks up and re-invokes
the function. While `pending`/`processing`, the panel polls `router.refresh()` every 4s so the
result appears without a manual reload. The function's own `processing`/`ready`/`error` updates
never set `pending`, so they don't re-fire the trigger (no loop).

## State machine
`none → pending → processing → ready` (or `→ error`). New rows start at `pending`; pre-existing rows
start at `none`. The UI keys off this: spinner while in progress, owner button on `none`/`error`.

## Setup (already provisioned on the Tivieo project)

This is wired up live on project `ewmitykmynlvlstnabjy`. To reproduce on a fresh project:

1. **Migrations** — apply `0003_transcripts.sql` (columns + FTS) and `0004_transcribe_triggers.sql`
   (pg_net + trigger function + triggers).
2. **Edge function** — `supabase functions deploy transcribe --no-verify-jwt` (auth is the secret
   header, not a JWT; also set in `supabase/config.toml`).
3. **Secrets** — set the edge function secrets and the matching Vault secret (same value):
   ```
   supabase secrets set DEEPGRAM_API_KEY=<key>
   supabase secrets set TRANSCRIBE_WEBHOOK_SECRET=<random>
   -- in SQL: select vault.create_secret('<same random>', 'transcribe_webhook_secret');
   ```
   (`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.)
   The webhook trigger is created by migration `0004` — no dashboard step needed.

## Notes
- Cost ≈ a few cents per recording (Deepgram nova-3 + audio intelligence, ~$0.004–0.01/min).
- `transcript_text` is GIN/FTS-indexed (`0003`) for future transcript search in the library.
- The function URL in `0004` hardcodes the project ref — adjust it per environment.
