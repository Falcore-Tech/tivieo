# Component Registry

Update this when adding/removing components to avoid duplication.

## Shared primitives — `components/ui/`
shadcn (radix): `button`, `input`, `label`, `select`, `card`, `badge`, `dialog`, `dropdown-menu`,
`tooltip`, `sonner` (toaster), `checkbox`, `tabs`, `popover`, `switch`, `textarea`, `skeleton`.

## Shared — `components/`
- `site-header.tsx` — top nav (logo, theme toggle, auth state). Props: `containerClassName` (widen to match a wide page), `actions` (right-side slot), `minimal` (hide app nav for clean viewer pages), `title` (show a recording title beside the logo).
- `theme-provider.tsx` — `next-themes` wrapper (class strategy).
- `theme-toggle.tsx` — light/dark toggle button.
- `keyboard-shortcuts.tsx` — global shortcuts (`n` record, `/` search, `?` help) + help dialog.

## Route features
### `app/_components/` (home library, rendered at `/` for authed users)
- `library.tsx` — server: fetches recordings + collections, builds thumbnail URLs + storage total.
- `library-shell.tsx` — client orchestrator: scope/search/sort/view/tags/selection/pagination state.
- `library-toolbar.tsx` — search, sort, grid/list toggle, select-mode toggle.
- `collections-sidebar.tsx` — All / folders (create/rename/delete) / Trash, with counts.
- `tag-filter.tsx` — tag chips that filter the current scope.
- `selection-bar.tsx` — bulk visibility / move-to-folder / trash / restore / delete-forever.
- `recording-card.tsx` — grid card: copy link, inline visibility, download, edit, tags, views.
- `recording-row.tsx` — list-view row variant.
- `visibility-menu.tsx` — shared inline visibility picker.
- `storage-meter.tsx` — used vs quota bar. `empty-state.tsx` — empty / no-results.
- `grid-skeleton.tsx` — Suspense fallback. `landing.tsx` — logged-out hero.
- `use-recording-actions.ts` — copy/visibility/trash/restore/destroy/download for a single item.
- `use-stored-view.ts` — grid/list persisted via `useSyncExternalStore`.
- `share-link.ts`, `visibility.ts` — shared helpers.

### `app/edit/[slug]/_components/`
- `edit-form.tsx` — title, vanity slug, visibility, folder, tags.
- `thumbnail-picker.tsx` — upload an image or capture a frame from the recording.
- `share-protection.tsx` — set/remove password and expiry.

### `app/record/_components/`
- `recorder-studio.tsx` — orchestrates the recording flow (client).
- `device-picker.tsx` — choose camera + microphone.
- `pip-preview.tsx` — live composited canvas preview with draggable webcam bubble.
- `recording-controls.tsx` — countdown + start/pause/resume/stop.
- `save-dialog.tsx` — title input → duration-fixed upload → shareable link.

### `app/v/[slug]/_components/`
The watch page is a near-full-width two-column layout (`max-w-[1760px]`): big video on the left, a sticky right sidebar holding the title, meta, owner visibility, and a Summary/Transcript tab group. It uses a clean minimal `SiteHeader` (logo + title + `WatchActions`).
- `video-context.tsx` — `VideoProvider` / `useVideoRef`; shares the `<video>` ref so the transcript can seek the player.
- `video-player.tsx` — native `<video>` (letterbox via `bg-video-surface`) with a segmented playback-speed control (`aria-pressed`) and a captions `<track>`. The custom `SeekBar` renders **chapter markers** (ticks at chapter boundaries) with a hover tooltip showing the chapter title; a brief **chapter title overlay** (top-left) appears when the active chapter changes. Shared with `app/embed/[slug]`.
- `editable-title.tsx` — click-to-edit `<h1>` (owner only); saves via `updateTitle`. Read-only `<h1>` for viewers.
- `recording-summary.tsx` — the description (AI summary): click-to-edit for the owner (`updateSummary`), with a Show more/less clamp and topic chips. No "AI summary" label (the tab provides context).
- `transcript-panel.tsx` — searchable transcript (aria-labelled, with a result count); clickable timestamps seek the player, active line highlights on playback; skeleton loading state.
- `chapters-panel.tsx` — chapters list **stacked under the description in the Summary tab** (Tella-style merge): clickable `timestamp + title` rows that seek the player; the active chapter expands into a highlighted card showing its `description`; owner Generate/Regenerate (`regenerateChapters`) + Edit behind a `…` dropdown on the header; auto-refreshes while generating.
- `chapter-editor.tsx` — owner-only inline editor: per-row title input + "set start to current playhead" (reads the shared video ref), add/delete rows, saves the whole array via `saveChapters`.
- `share-bar.tsx` — owner-only visibility `Select` (returns null for viewers).
- `watch-actions.tsx` — header split-button: "Share" opens the dialog, the attached link icon copies the link.
- `share-dialog.tsx` — link / embed iframe / QR tabs + social share.
- `password-gate.tsx` — password entry for protected recordings.
- `view-beacon.tsx` — fires the view-count RPC once per viewer.

`app/v/[slug]/captions/route.ts` — serves the WebVTT caption file (same-origin) from `transcript_segments`, re-checking visibility/expiry/password.

### `app/embed/[slug]/` — minimal full-bleed player for iframe embeds (public/unlisted only).

### `app/login/_components/`
- `auth-form.tsx` — email auth form.
