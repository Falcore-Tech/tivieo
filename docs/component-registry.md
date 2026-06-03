# Component Registry

Update this when adding/removing components to avoid duplication.

## Shared primitives — `components/ui/`
shadcn (radix): `button`, `input`, `label`, `select`, `card`, `badge`, `dialog`, `dropdown-menu`,
`tooltip`, `sonner` (toaster), `checkbox`, `tabs`, `popover`, `switch`, `textarea`.

## Shared — `components/`
- `site-header.tsx` — top nav (logo, Library/record links, theme toggle, auth state + sign out).
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
- `video-player.tsx` — native `<video>` with a playback-speed control.
- `share-bar.tsx` — copy link + visibility + Share button.
- `share-dialog.tsx` — link / embed iframe / QR tabs + social share.
- `password-gate.tsx` — password entry for protected recordings.
- `view-beacon.tsx` — fires the view-count RPC once per viewer.

### `app/embed/[slug]/` — minimal full-bleed player for iframe embeds (public/unlisted only).

### `app/login/_components/`
- `auth-form.tsx` — email auth form.
