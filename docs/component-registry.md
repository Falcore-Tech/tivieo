# Component Registry

Update this when adding/removing components to avoid duplication.

## Shared primitives — `components/ui/`
shadcn (radix): `button`, `input`, `label`, `select`, `card`, `badge`, `dialog`, `dropdown-menu`,
`tooltip`, `sonner` (toaster).

## Shared — `components/`
- `site-header.tsx` — top nav (logo, dashboard/record links, auth state + sign out).

## Route features
### `app/record/_components/`
- `recorder-studio.tsx` — orchestrates the recording flow (client).
- `device-picker.tsx` — choose camera + microphone.
- `pip-preview.tsx` — live composited canvas preview with draggable webcam bubble.
- `recording-controls.tsx` — countdown + start/pause/resume/stop.
- `save-dialog.tsx` — title input → upload progress → shareable link.

### `app/dashboard/_components/`
- `recording-card.tsx` — thumbnail, title, date, link, actions menu.
- `rename-dialog.tsx` — rename a recording.
- `empty-state.tsx` — first-run CTA → `/record`.

### `app/v/[slug]/_components/`
- `video-player.tsx` — `@vidstack/react` player wrapper.
- `share-bar.tsx` — copy link + visibility badge/toggle (owner only).

### `app/login/_components/`
- `auth-form.tsx` — email auth form.
