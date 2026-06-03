# Project: Tivieo

## Overview
- **Type**: Next.js website (Tella.tv-style screen + webcam recorder)
- **Stack**: Next.js 16 (App Router), React 19, Tailwind v4, TypeScript, Supabase
- **Package Manager**: bun (run the shadcn CLI via `npx` only; see Learnings)
- **Started**: 2026-06-03

## Architecture Decisions
- **Storage + DB**: Supabase Storage (video + thumbnail files) + Supabase Postgres (`recordings` table maps slug → file). Auth via Supabase Auth.
- **Recording**: client-side. Screen (`getDisplayMedia`) + webcam (`getUserMedia`) are composited into one video track on a `<canvas>` (PiP webcam bubble), audio is mixed via `AudioContext`, and the combined stream is recorded with the **native `MediaRecorder`** (chunk accumulation via `ondataavailable`).
- **Recording quality**: fixed **1080p** canvas (`OUTPUT_WIDTH/HEIGHT = 1920×1080` in `use-canvas-compositor.ts`), **30fps**, **VP9** codec (falls back VP8 → default), **explicit bitrate** `videoBitsPerSecond = 1 Mbps` + `audioBitsPerSecond = 128 kbps` in `use-recorder.ts` so file size is predictable (~8.5 MB/min) rather than browser-default. Sized so a **5-min take ≈ 42MB**, under Supabase free-tier's 50MB per-file cap. Beyond ~5 min a storage backend (Cloudflare R2 or Supabase Pro) is still needed — bump the bitrate back up once storage is no longer the constraint.
- **Player**: native styled `<video controls>` (`app/v/[slug]/_components/video-player.tsx`). Reliable for browser-recorded webm.
- **Upload**: resumable via `tus-js-client` to Supabase Storage; signed URLs for private playback.
- **Links**: title-derived slug — `slugify(title)-<nanoid(6)>`. Slug edits preserve old links via the `recording_aliases` table (308 redirect on the watch page).
- See `/docs` for full detail.

## Preferences & Rules
- Use **bun** for package management, **axios** for client HTTP, **shadcn + CVA** for primitives.
- Colors/spacing only via design tokens in `app/globals.css` — never hardcode hex/oklch in components.
- Locality of behavior: per-route `_components`/`_hooks`/`_lib`/`_actions.ts`. Only truly shared code in root `lib/` and `components/`.
- No decorative ambient glow. Componentize aggressively — keep pages short.
- Do not run `next build` unless explicitly asked. Verify via `bun dev`.

## Patterns & Conventions
- Route folders own their feature code (e.g. `app/record/_hooks/use-recorder.ts`).
- Supabase clients live in `lib/supabase/{client,server,admin,proxy}.ts`. The admin (service-role) client bypasses RLS and is server-only; only use it after an ownership/visibility check (signed URLs, public thumbnail URLs).
- Server Actions in `_actions.ts` per route; mutations revalidate affected paths.

## Learnings & Corrections
- Prefer maintained libraries over from-scratch builds; hand-write only the small glue no library covers (the PiP canvas compositor). For this project the recording/playback primitives ended up being the **native** `MediaRecorder` + `<video>`, after RecordRTC (0-byte recordings) and `@vidstack/react` (stalled on tokenized/`Infinity`-duration webm) both failed for our recorded-webm case.
- ❌ `bunx shadcn` crashes on bun 1.1.12 ("Export named 'aborted' not found in module 'util'") → ✅ run shadcn via `npx shadcn@latest`; it still installs deps with bun (detects `bun.lockb`). `init -b <x>` selects the primitive library (`radix`|`base`), NOT the base color.
- ❌ Next.js 16 deprecates `middleware.ts` → ✅ use root `proxy.ts` exporting a function named `proxy`. Never keep both files — Next errors if both exist.
- Lint (react-hooks): don't assign `ref.current` during render (init refs in an effect); don't call `setState` synchronously in an effect (derive the value instead).
- ❌ Side effect inside a `setState` updater → React StrictMode double-invokes updaters in dev, so it runs twice (leaked timers, duplicate recorder instances). ✅ Run side effects outside updaters; make timer start idempotent (clear before re-creating).
- ❌ Resizing the `<canvas>` after `captureStream()` ends the track on Firefox (empty recording) → ✅ use a constant `OUTPUT_WIDTH/HEIGHT` canvas that is never resized.
- ❌ Backgrounded tabs pause `requestAnimationFrame` and clamp `setInterval` to ~1fps, so the captured canvas froze while screen-sharing another window → ✅ compositor paints via rAF when visible and via an inline Blob-URL **Web Worker timer** (~30fps, not throttled) when `document.hidden`.
- Caveat: MediaRecorder webm reports `duration = Infinity` (no duration metadata), so a native seek bar is imperfect until buffered. Patch duration at record time with `fix-webm-duration` before upload.

## Dependencies & Tooling
- Recording: native `MediaRecorder` (`app/record/_hooks/use-recorder.ts`). `recordrtc` + `@types/recordrtc` and `@vidstack/react` + `vidstack` remain in `package.json` but are unused (safe to remove).
- `tus-js-client` — resumable uploads. `@supabase/supabase-js`, `@supabase/ssr` — auth/DB/storage.
- `next-themes` — dark-mode toggle. `nanoid` — slug suffix. `axios` — HTTP. `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react` — UI.

## Component Registry
See `docs/component-registry.md`.

## API & Data Layer
See `docs/supabase-schema.md`.

## Current State
- Core app built: home (dashboard for authed users, landing for logged-out), auth (`/login`, `/auth/confirm`, `/auth/signout`), recorder studio (`/record`), upload + link minting, watch page (`/v/[slug]`), library with per-recording management.
- DB: migration `0001` (recordings table + buckets) is applied. `0002` (QOL columns + collections/aliases tables + view-count RPC) must be applied via the Supabase SQL editor.
