# Design System

All design values are tokens defined in `app/globals.css`. **Never hardcode colors** — consume tokens.

## Theme
**Tokyo Night accents on a neutral-black grey ramp** (applied via the `shadcn-themes` skill,
`tailwind-v4` format). The colored scales (primary/success/warning/error) and the purple/cyan chart
accents follow the Tokyo Night palette, but the `neutral` scale and all neutral surfaces are **pure
greys (chroma 0)** — a black tint, not Tokyo Night's blue/indigo cast. Light mode is a clean
light-grey/dark-ink reading view; dark mode is a near-black grey. The scale-based system was preserved:
semantic tokens map onto the scales, with literal oklch used only for surfaces the ladder can't hit
(dark `card`/`popover`, the light muted surface).

## Color scales (oklch)
Five semantic scales, each `50 → 950`, defined as CSS custom properties and exposed to Tailwind via
`@theme inline` (so `bg-primary-600`, `text-neutral-500`, `border-error-300`, etc. all work):

- `primary` — Tokyo Night blue (CTAs, active states, rings). Light `#2e7de9`, dark `#7aa2f7`.
- `neutral` — pure grey, black tint (text, surfaces, borders). Light bg/ink, near-black dark surfaces.
- `success` — Tokyo green (confirmations, "ready" status). `#9ece6a`.
- `warning` — Tokyo yellow/gold (caution, "uploading"). `#e0af68`.
- `error` — Tokyo red/pink (destructive, failures). `#f7768e` dark / `#f52a65` light.

Tokyo Night's signature **purple `#bb9af7`** and **cyan `#7dcfff`** surface through `chart-4` and `chart-5`.
Semantic `accent` is kept as a subtle hover surface (not vivid purple) so menu/hover states stay usable.

## Semantic tokens
shadcn semantic tokens are remapped onto the scales above for light and `.dark`:
`background, foreground, card, popover, primary, secondary, muted, accent, destructive, border,
input, ring, sidebar*, chart-*`. Components should prefer semantic tokens
(`bg-background`, `text-muted-foreground`, `bg-primary text-primary-foreground`) and reach for raw
scale steps only when a semantic token doesn't fit.

## Special surfaces
- `--video-surface` (→ `bg-video-surface`) — near-black letterbox behind the `<video>` element, theme-independent (maps to `neutral-950`). Used by the watch player and the embed page so the dark surface stays consistent in light and dark mode.

## Layout width
- `--container-page: 1760px` (→ `max-w-page`) — the standard page width token, defined in the `@theme inline` block so Tailwind also generates `w-page` etc. It is the single source of truth for the wide layout; no component hardcodes `1760px`.
- **Wide shell, narrow content:** the shared `SiteHeader` and the content-heavy page shells (`/v` watch page, the library, library loading skeleton, landing features) use `max-w-page` with `px-4 sm:px-6 lg:px-8` so they align to the same edge across the site.
- **Forms stay readable:** single-column forms keep their own narrow widths inside the wide header — login (`max-w-sm`), edit recording (`max-w-3xl`), record studio (`max-w-5xl`). Widening these to the full page width hurts a single column, so only the header/shell widens around them. The landing hero likewise keeps its inner `max-w-3xl`/`max-w-xl` text constraints for readability.

## Radius
`--radius: 0.5rem` (Tokyo Night roundness), with `--radius-sm … --radius-4xl` derived from it.
Use `rounded-md/lg/xl/2xl`.

## Typography
- Sans: Geist (`--font-sans`). Mono: Geist Mono (`--font-mono`).
- `font-heading` aliases the sans family for headings.

## Rules
- No decorative ambient glow.
- New colors → add a token/scale step, then reference it; do not inline oklch/hex in components.
