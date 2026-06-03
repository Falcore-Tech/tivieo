# Design System

All design values are tokens defined in `app/globals.css`. **Never hardcode colors** — consume tokens.

## Color scales (oklch)
Five semantic scales, each `50 → 950`, defined as CSS custom properties and exposed to Tailwind via
`@theme inline` (so `bg-primary-600`, `text-neutral-500`, `border-error-300`, etc. all work):

- `primary` — violet brand (CTAs, active states, accents).
- `neutral` — cool gray (text, surfaces, borders).
- `success` — emerald (confirmations, "ready" status).
- `warning` — amber (caution, "uploading").
- `error` — red (destructive, failures).

## Semantic tokens
shadcn semantic tokens are remapped onto the scales above for light and `.dark`:
`background, foreground, card, popover, primary, secondary, muted, accent, destructive, border,
input, ring, sidebar*, chart-*`. Components should prefer semantic tokens
(`bg-background`, `text-muted-foreground`, `bg-primary text-primary-foreground`) and reach for raw
scale steps only when a semantic token doesn't fit.

## Radius
`--radius: 0.7rem`, with `--radius-sm … --radius-4xl` derived from it. Use `rounded-md/lg/xl/2xl`.

## Typography
- Sans: Geist (`--font-sans`). Mono: Geist Mono (`--font-mono`).
- `font-heading` aliases the sans family for headings.

## Rules
- No decorative ambient glow.
- New colors → add a token/scale step, then reference it; do not inline oklch/hex in components.
