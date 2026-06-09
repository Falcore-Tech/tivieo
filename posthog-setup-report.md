<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into Tivieo. Here's what was set up:

**Client-side initialization** — `instrumentation-client.ts` was created at the project root. This is the recommended approach for Next.js 15.3+ App Router projects. It initializes PostHog with the EU host, a `/ingest` reverse proxy (so events flow through your own domain, bypassing ad-blockers), exception capture enabled, and debug mode in development.

**Server-side client** — `lib/posthog-server.ts` provides a singleton `getPostHogClient()` for server actions and API routes, using `posthog-node` with immediate flushing (`flushAt: 1, flushInterval: 0`).

**Reverse proxy** — `next.config.ts` now rewrites `/ingest/*`, `/ingest/static/*`, and `/ingest/array/*` to the EU PostHog ingestion endpoints, so all events route through `tivieo.vercel.app` rather than directly to PostHog.

**User identification** — `auth-form.tsx` calls `posthog.identify(userId, { email })` on both successful sign-in and sign-up, linking all subsequent events to the authenticated Supabase user ID. The server action also captures `recording_created` with the same `distinctId`.

**Error tracking** — `captureException` calls were added to the sign-in/sign-up error paths and to upload failures in `save-dialog.tsx`.

## Events instrumented

| Event | Description | File |
|---|---|---|
| `user_signed_in` | User authenticates with email + password | `app/login/_components/auth-form.tsx` |
| `user_signed_up` | User creates a new account | `app/login/_components/auth-form.tsx` |
| `recording_started` | Recording session begins after countdown | `app/record/_components/recorder-studio.tsx` |
| `recording_completed` | User stops recording; valid blob produced | `app/record/_components/recorder-studio.tsx` |
| `recording_saved` | Recording uploaded + persisted in Supabase | `app/record/_components/save-dialog.tsx` |
| `recording_link_copied` | Shareable link copied from post-save dialog | `app/record/_components/save-dialog.tsx` |
| `recording_shared` | Link/embed shared from watch-page share dialog | `app/v/[slug]/_components/share-dialog.tsx` |
| `recording_downloaded` | User downloads the raw webm | `app/_components/use-recording-actions.ts` |
| `recording_deleted` | Recording moved to trash | `app/_components/use-recording-actions.ts` |
| `recording_visibility_changed` | Visibility toggled (public/unlisted/private) | `app/_components/use-recording-actions.ts` |
| `recording_viewed` | Non-owner loads the watch page | `app/v/[slug]/_components/view-beacon.tsx` |
| `recording_created` | Server confirms DB insert after upload | `app/record/_actions.ts` |

## Next steps

### Dashboard setup (manual)

A personal API key (`phx_...`) is needed to auto-create dashboards via the API. To create one, visit https://eu.posthog.com/settings/user-api-keys, then build the **"Analytics basics (wizard)"** dashboard with these five insights:

1. **Recording funnel** — Funnel: `recording_started` → `recording_completed` → `recording_saved` (core conversion)
2. **Recordings over time** — Trend: `recording_created` count per day
3. **Recording views over time** — Trend: `recording_viewed` count per day
4. **Share method breakdown** — Bar chart: `recording_shared` broken down by `method` property
5. **User growth** — Trend comparing `user_signed_up` vs `user_signed_in` over time

All events and properties are live and flowing to **Project 198006** at https://eu.posthog.com/project/198006.

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-nextjs-app-router/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
