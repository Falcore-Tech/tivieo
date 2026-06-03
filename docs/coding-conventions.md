# Coding Conventions

## File layout — locality of behavior
Feature code is co-located with its route using underscore-prefixed folders:
```
app/<route>/
  page.tsx
  _components/   # feature UI
  _hooks/        # feature hooks
  _lib/          # feature pure logic / helpers
  _types.ts      # feature types
  _actions.ts    # server actions for this route
```
Only **truly shared** code lives at the root:
```
components/ui/   # shadcn primitives
lib/             # cn(), slugify(), supabase clients
```

## Primitives
Built with shadcn + `class-variance-authority`. Use `cn()` (`lib/utils.ts`) to merge classes. Don't
re-implement a primitive that already exists in `components/ui`.

## Conventions
- Prefer expressive names over comments.
- Keep pages short — compose from `_components`.
- HTTP from the client uses **axios**; most reads/writes go through Supabase client or server actions.
- Server Components by default; add `"use client"` only where interactivity/browser APIs are needed
  (the whole recorder is client-side).
- Mutations live in `_actions.ts` server actions and `revalidatePath` affected routes.
- Tokens only for styling (see `design-system.md`).

## Tooling notes
- Install deps with **bun** (`bun add ...`).
- Run the shadcn CLI via `npx shadcn@latest ...` (bun 1.1.12 crashes on it); it still uses bun to
  install component deps.
- Don't run `next build` unless explicitly requested; verify with `bun dev`.
