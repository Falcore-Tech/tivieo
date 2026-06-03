# Recording Pipeline

Entirely client-side, under `app/record/`. Built on libraries; the canvas compositor is the only
bespoke piece.

## Stages
1. **Acquire streams** — `_hooks/use-media-streams.ts`
   - `navigator.mediaDevices.getDisplayMedia({ video, audio })` → screen (+ optional system audio).
   - `navigator.mediaDevices.getUserMedia({ video, audio })` → webcam + mic.
   - Enumerate devices for pickers; handle permission denial gracefully.

2. **Composite (PiP)** — `_hooks/use-canvas-compositor.ts`
   - Each `requestAnimationFrame`: draw the screen frame to a `<canvas>` sized to the screen track,
     then draw the webcam cropped to a circle in a draggable corner bubble.
   - Expose `canvas.captureStream(30)` as the composited video track.

3. **Mix audio** — `_lib/compose-audio.ts`
   - `AudioContext` connects system-audio source + mic source into one
     `MediaStreamAudioDestinationNode`. Falls back to mic-only when system audio is absent.

4. **Record** — `_hooks/use-recorder.ts` (thin **RecordRTC** wrapper)
   - Combine composited video track + mixed audio track into one `MediaStream`.
   - `RecordRTC(stream, { type: 'video', mimeType: 'video/webm;codecs=vp9' })` with fallbacks.
   - start / pause / resume / stop. On stop, `getSeekableBlob()` fixes webm duration metadata for the
     player scrubber. Also grab a poster frame from the canvas.

5. **Upload + mint link** — `_lib/upload.ts` + `_actions.ts`
   - `tus-js-client` resumable upload of the Blob to `recordings/<user_id>/<uuid>.webm` (small files
     may use `supabase.storage.upload`); poster to `thumbnails`.
   - `createRecording()` server action computes the slug, inserts the row, returns `/v/<slug>`.

## Components
`recorder-studio` orchestrates: `device-picker` → `pip-preview` (live canvas) → `recording-controls`
(countdown, start/stop/pause) → `save-dialog` (title → upload progress → shareable link).
