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
   presigns a 30-min R2 GET URL for the private webm (via `aws4fetch`) and sends it to Deepgram `/v1/listen`
   (`model=nova-3`, `utterances`, `detect_language`, `keyterm=Faez`, `topics=true`).
   - **Name boosting:** `keyterm=Faez` (nova-3 keyterm prompting) boosts recognition of the owner's
     name so it's transcribed correctly at the source — no post-processing replacement.
   - **English-only topics:** `topics` only works on English audio. If the call fails (e.g.
     non-English), the function retries **transcript-only** so transcription never breaks — topics
     are simply left null.
   - **Summary (OpenAI):** Deepgram's extractive `summarize` is dropped. The first-person video
     description is generated from the transcript text by OpenAI (`gpt-5.4-mini`) in
     `summarizeTranscript()`, narrated as the owner ("In this video, I walk through…"), capped at
     **one paragraph / ≤50 words** (`SUMMARY_SYSTEM_PROMPT` + `max_completion_tokens: 120`). If
     `OPENAI_API_KEY` is unset, the transcript is empty, or the call fails, the summary is left null
     — a summarizer outage never breaks transcription.
4. It writes `transcript_text`, `transcript_segments` (`{start,end,text,speaker?,words?}` —
   each utterance keeps its Deepgram `words[]` of `{word,start,end,punctuated_word?,speaker?}`
   for word-accurate caption timing), `transcript_summary`, `transcript_topics`, and flips
   `transcript_status` to `ready` (or `error` on failure).
5. The watch page (`/v/[slug]`) renders:
   - a `<track>` caption file from `/v/[slug]/captions/route.ts`. The route converts segments to
     WebVTT same-origin (no CORS) with **Deepgram's own `@deepgram/captions` `webvtt()`**, passing
     `lineLength = 10` so every cue is **at most 10 words** (long utterances are split on real
     per-word timestamps — no 3-line subtitles). Recordings transcribed before word timings were
     stored have no `words[]`, so the route falls back to splitting the utterance text into ≤10-word
     cues with interpolated timestamps; **re-transcribe** them (Retry button / `requestTranscription`)
     to get exact word timing.
   - `RecordingSummary` — the AI summary (description) + topic chips, shown in the sidebar's **Summary** tab; owner-editable inline (`updateSummary`),
   - `TranscriptPanel` — searchable transcript with clickable timestamps that seek the player
     (shared video ref via `VideoProvider` / `useVideoRef`), shown in the sidebar's **Transcript** tab.

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
   supabase secrets set OPENAI_API_KEY=<key>
   supabase secrets set TRANSCRIBE_WEBHOOK_SECRET=<random>
   -- in SQL: select vault.create_secret('<same random>', 'transcribe_webhook_secret');
   # R2 — so the function can presign the private webm for Deepgram (see docs/r2-storage.md):
   supabase secrets set R2_ACCOUNT_ID=<id> R2_ACCESS_KEY_ID=<id> R2_SECRET_ACCESS_KEY=<secret> R2_VIDEOS_BUCKET=tivieo-videos
   ```
   (`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.)
   The webhook trigger is created by migration `0004` — no dashboard step needed.

## Notes
- Cost ≈ a few cents per recording (Deepgram nova-3 + topics ~$0.004–0.01/min, plus a fraction of a
  cent for the OpenAI `gpt-5.4-mini` summary, ~$0.003/video).
- `transcript_text` is GIN/FTS-indexed (`0003`) for future transcript search in the library.
- The function URL in `0004` hardcodes the project ref — adjust it per environment.
