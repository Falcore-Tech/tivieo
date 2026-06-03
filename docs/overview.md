# Tivieo — Overview

Tivieo is a Tella.tv-style recorder. A signed-in user records their **screen with a webcam bubble**
(picture-in-picture) directly in the browser. When recording stops, the video is uploaded to Supabase
Storage and a unique, title-derived link is minted (e.g. `/v/my-demo-walkthrough-a8kf`). Anyone with
the link watches the recording in a polished player. Users manage their recordings from a dashboard.

## Core user flows
1. **Auth** — sign in / sign up at `/login` (Supabase Auth).
2. **Record** — `/record`: pick camera/mic, see a live PiP preview, record, stop, title, save.
3. **Share** — saving returns a `/v/[slug]` link; open it to play the video.
4. **Manage** — `/dashboard`: list, rename, change visibility, delete recordings.

## Documentation map
- `architecture.md` — system shape, routes, data flow.
- `design-system.md` — color tokens, typography, spacing.
- `coding-conventions.md` — file layout, naming, patterns.
- `component-registry.md` — components and their purpose.
- `recording-pipeline.md` — how capture → composite → record → upload works.
- `supabase-schema.md` — tables, buckets, RLS, env vars.

Keep these in sync with the code on every meaningful change.
