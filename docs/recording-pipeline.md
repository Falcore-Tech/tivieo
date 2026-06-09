# Recording Pipeline

Entirely client-side, under `app/record/`. Built on libraries; the canvas compositor is the only
bespoke piece.

## Stages
1. **Acquire streams** — `_hooks/use-media-streams.ts`
   - `navigator.mediaDevices.getDisplayMedia({ video, audio })` → screen (+ optional system audio).
   - `navigator.mediaDevices.getUserMedia({ video, audio })` → webcam + mic.
   - Enumerate devices for pickers; handle permission denial gracefully.

2. **Composite (PiP)** — `_hooks/use-canvas-compositor.ts`
   - Each paint: draw the screen frame to a fixed **1920×1080** `<canvas>` (`drawCover` scales any
     source to fit; the canvas is never resized — resizing ends the captured track on Firefox),
     then draw the webcam cropped to a circle in a draggable corner bubble.
   - **Painting is driven by two sources sharing one `lastDraw` clock:** `requestAnimationFrame`
     (smooth, vsync-aligned) paints while the window is focused; an inline Blob-URL **Web Worker
     timer** (~30fps, not background-throttled) paints only when rAF has gone stale. The worker keys
     off staleness (`now - lastDraw >= targetInterval`), **not** `document.hidden` — Chrome
     throttles/pauses rAF both on tab-switch/minimize (`document.hidden` true) **and** when another
     application window occludes the browser (`document.hidden` stays false). Keying off staleness
     covers both, so the capture never freezes when the user moves to another window/page.
   - Expose `canvas.captureStream(30)` as the composited video track.

3. **Mix audio** — `_lib/compose-audio.ts`
   - `AudioContext` connects system-audio source + mic source into one
     `MediaStreamAudioDestinationNode`. Falls back to mic-only when system audio is absent.

4. **Record** — `_hooks/use-recorder.ts` (thin native **MediaRecorder** wrapper)
   - Combine composited video track + mixed audio track into one `MediaStream`.
   - `new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9,opus', videoBitsPerSecond,
     audioBitsPerSecond })` with codec fallbacks (vp9 → vp8 → default).
   - **Quality:** 1080p30 at **8 Mbps** video + **128 kbps** audio (~61 MB/min) — crisp screen text +
     webcam. Storage is Cloudflare R2 (no per-file cap), so quality is the only constraint; lower the
     `VIDEO_BITS_PER_SECOND` constant to trade quality for size.
   - `recorder.start(1000)` flushes a chunk every second (`ondataavailable`) so a crash never loses
     the take. start / pause / resume / stop. On stop, `fix-webm-duration` patches webm duration
     metadata for the player scrubber. Also grab a poster frame from the canvas.

5. **Upload + mint link** — `_lib/upload.ts` + `_actions.ts`
   - `createUploadTarget()` server action authenticates the user, derives the R2 key
     `<user_id>/<uuid>.webm`, and returns a **presigned PUT URL** for the private `tivieo-videos`
     bucket.
   - The client `axios.put`s the webm Blob straight to R2 with `Content-Type: video/webm` (must match
     the signed type) and `onUploadProgress` driving the dialog bar — no tus, no proxy through Next.
   - `createRecording()` server action uploads the small poster JPEG server-side to the public
     `tivieo-thumbnails` bucket (`putThumbnail`), computes the slug, inserts the row (storing the bare
     R2 keys in `storage_path`/`thumbnail_path`), returns `/v/<slug>`. See `docs/r2-storage.md`.
   - On success the dialog fires a fire-and-forget `POST /api/remux { recordingId }` to start the
     remux below; the cron sweep is the safety net if that request never lands.

6. **Make seekable (background remux)** — `app/api/remux/` + `recordings.remux_status`
   - MediaRecorder webm has **no Cues seek index**, so browsers can only seek within buffered data
     (seeks past the buffer clamp to the buffered end and "snap back"). `fix-webm-duration` writes the
     duration but **not** the index.
   - A **server-side worker** (`app/api/remux/route.ts`, Node runtime) runs the **`ffmpeg-static`**
     binary with `-c copy` to rewrite the container **with a Cues index** — lossless, no re-encode —
     then overwrites the same R2 key in place (`putVideo`). The remux logic is in `_lib/remux.ts`
     (presign GET → ffmpeg to a real temp file, not a pipe, so the muxer can seek back to write Cues →
     `putVideo`). `next.config.ts` `outputFileTracingIncludes` bundles the binary into that route.
   - `remux_status` (`pending → processing → ready/error`, + `remux_attempts`) is the job's state
     machine. The worker **atomically claims** a row (`pending/error → processing` guarded by a status
     filter) so concurrent runs never double-process. `POST` handles the per-recording owner kick
     (session-authed); `GET` handles the **Vercel cron** sweep (`vercel.json`, every 5 min, authed by
     the `Authorization: Bearer $CRON_SECRET` header Vercel sends). Up to `MAX_ATTEMPTS` retries.
   - Watch page shows a subtle **"Optimizing for smooth seeking…"** chip (`RemuxNotice`) that polls
     until `ready`; playback works throughout, only full seeking waits.
   - Backfill existing rows once with `bun --env-file=.env.local scripts/remux-add-cues.ts`
     (re-uploads in place + sets `remux_status='ready'`; `--dry` to preview).

## Components
`recorder-studio` orchestrates: `device-picker` → `pip-preview` (live canvas) → `recording-controls`
(countdown, start/stop/pause) → `save-dialog` (title → upload progress → shareable link).
