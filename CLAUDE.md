# Project: Tivieo

## Overview
- **Type**: Next.js website (Tella.tv-style screen + webcam recorder)
- **Stack**: Next.js 16 (App Router), React 19, Tailwind v4, TypeScript, Supabase
- **Package Manager**: bun (the shadcn CLI is run via `npx` only because bun 1.1.12 has a runtime bug with it; all project deps are installed with bun)
- **Started**: 2026-06-03

## Architecture Decisions
- **Storage + DB**: Supabase Storage (video + thumbnail files) + Supabase Postgres (`recordings` table maps slug → file). Auth via Supabase Auth.
- **Recording**: client-side. Screen (`getDisplayMedia`) + webcam (`getUserMedia`) are composited into one video track on a `<canvas>` (PiP webcam bubble), audio is mixed via `AudioContext`, and the combined stream is recorded with **RecordRTC** (not hand-written MediaRecorder).
- **Player**: `@vidstack/react` (no hand-built player).
- **Upload**: resumable via `tus-js-client` to Supabase Storage; signed URLs for private playback.
- **Links**: title-derived slug — `slugify(title)-<nanoid(6)>`.
- See `/docs` for full detail.

## Preferences & Rules
- Use **bun** for package management, **axios** for client HTTP, **shadcn + CVA** for primitives.
- Colors/spacing only via design tokens in `app/globals.css` — never hardcode hex/oklch in components.
- Locality of behavior: per-route `_components`/`_hooks`/`_lib`/`_actions.ts`. Only truly shared code in root `lib/` and `components/`.
- No decorative ambient glow. Componentize aggressively — keep pages short.
- Do not run `next build` unless explicitly asked. Verify via `bun dev`.

## Patterns & Conventions
- Route folders own their feature code (e.g. `app/record/_hooks/use-recorder.ts`).
- Supabase clients live in `lib/supabase/{client,server,proxy}.ts`.
- Server Actions in `_actions.ts` per route; mutations revalidate affected paths.

## Learnings & Corrections
- ❌ Hand-rolling a MediaRecorder/canvas recording pipeline → ✅ Use maintained libraries (RecordRTC, Vidstack) and only write the small PiP canvas glue that no library covers.
- ❌ `bunx shadcn` (crashes on bun 1.1.12: "Export named 'aborted' not found in module 'util'") → ✅ run shadcn via `npx shadcn@latest`; it still installs deps with bun (detects `bun.lockb`).
- shadcn `init -b <x>` selects the primitive library (`radix`|`base`), NOT the base color.
- ❌ `@vidstack/react` `latest` tag is the stale 0.6.15 (React 18 only, no `MediaProvider`/layouts) → ✅ install the modern API from the `next` tag: `bun add @vidstack/react@next vidstack@next` (1.15.3, React 19). Styles import from `@vidstack/react/player/styles/...`.
- ❌ Next.js 16 deprecates `middleware.ts` → ✅ use root `proxy.ts` exporting a function named `proxy`. Never keep both files — Next errors if both exist.
- Lint (react-hooks): don't assign `ref.current` during render (init refs in an effect); don't call `setState` synchronously in an effect (derive the value instead).
- ❌ Calling a side effect (e.g. `beginRecording()`) **inside a `setState` updater** → React StrictMode (on in dev) double-invokes updaters, so it ran twice: two `setInterval` timers leaked (only one tracked, so Stop/Pause couldn't clear the other) and two RecordRTC instances were created → recording "wouldn't stop". ✅ Run side effects outside updaters (use a local counter in the interval callback); make timer start idempotent (clear before re-creating).
- ❌ RecordRTC repeatedly failed (stop callback not firing; then **0-byte recordings**). After confirming the stored file was `size: 0`, dropped RecordRTC from the recording path. ✅ `use-recorder.ts` now uses the **native `MediaRecorder`** directly with `start(1000)` timeslice + `ondataavailable` chunk accumulation, building the blob from chunks on `stop()` (with a timeout safety-net). Native API = reliable, transparent stop; still "not from scratch" (it's the primitive RecordRTC wraps). RecordRTC stays installed but unused; remove later if it stays unused.
- ❌ Empty/`0×0` canvas recording root cause was actually the canvas being **resized after `captureStream()`** (ends the track on Firefox) — fixed by a constant `OUTPUT_WIDTH/HEIGHT` canvas that's never resized.
- ❌ Recording **laggy only when the tab is backgrounded**: hidden tabs pause `requestAnimationFrame` and clamp `setInterval` to ~1fps, so the canvas (and thus `captureStream`) painted ~1fps while backgrounded. ✅ Compositor now paints via **rAF when visible** and a **Web Worker timer (~30fps, not throttled for hidden tabs) when `document.hidden`**, both calling a `renderRef`. The worker is an inline Blob-URL worker. This keeps backgrounded recordings smooth (the screen/webcam MediaStream `<video>` elements keep delivering frames when hidden; only timers were the problem).
- `use-recorder.ts` + `recorder-studio.tsx` + `use-canvas-compositor.ts` currently have `console.log` diagnostics — remove once confirmed working end-to-end. (User on **Firefox**; test cross-browser.)
- ❌ Vidstack player stuck on the loading spinner for the recorded webm (signed URL serves fine: `206`/ranges/CORS verified) — it stalls resolving a provider for a tokenized URL with no extension and/or on the `Infinity` duration MediaRecorder webm reports. ✅ Replaced with a native styled `<video controls>` in `video-player.tsx` (reliable for browser-recorded webm). `@vidstack/react`/`vidstack` now unused.
- Caveat: MediaRecorder webm has no duration metadata (`duration` = `Infinity`), so the native seek bar can be imperfect until buffered. If it matters, patch duration at record time (e.g. `fix-webm-duration`).

## Dependencies & Tooling
- Recording uses the **native `MediaRecorder`** API (see `app/record/_hooks/use-recorder.ts`). `recordrtc` + `@types/recordrtc` are installed but no longer used.
- `@vidstack/react` (pulls `vidstack`) — video player.
- `tus-js-client` — resumable uploads.
- `@supabase/supabase-js`, `@supabase/ssr` — auth/DB/storage.
- `nanoid` — slug suffix. `axios` — HTTP. `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react` — UI.

## Component Registry
See `docs/component-registry.md`.

## API & Data Layer
See `docs/supabase-schema.md`.

## Current State
- Full app built: landing, auth (`/login`, `/auth/confirm`, `/auth/signout`), recorder studio (`/record`), upload + link minting, share page + Vidstack player (`/v/[slug]`), dashboard (rename/visibility/delete).
- Passes `bunx tsc --noEmit` and `bun run lint`. Dev server boots clean; all routes compile and gate correctly.
- **Pending (needs the user):** apply `supabase/migrations/0001_init_recordings.sql` to the Supabase project and create the `recordings` (private) + `thumbnails` (public) buckets. Could not be applied from here — the logged-in Supabase CLI account lacks privileges for the configured project, and direct Postgres is IPv6-only/unreachable on this host. Apply via the Supabase SQL editor or an account with access.
- Not yet exercised end-to-end (record → upload → playback) because the schema isn't applied yet.
