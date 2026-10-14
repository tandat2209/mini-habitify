# mini-habitify implementation roadmap

Product requirements: [product-brief.md](product-brief.md).

## Implemented locally

- Foundation: Next.js App Router, strict TypeScript, Tailwind, shadcn/ui, Supabase browser/server clients, auth session proxy, and environment example.
- Authentication: signup, login, logout, protected dashboard, persistent authenticated sessions.
- Database: profiles, trackers, tracker_logs, shared read-only themes, user_preferences, dashboard_widgets; three reproducible migrations; RLS, ownership constraints, indexes, date/timezone validation, and atomic appearance/widget saves.
- Core tracking: four tracker types, creation/editing/archiving, check-ins, log editing/deletion, weekday schedules, targets, daily/weekly/monthly periods, shared pure tracker engine.
- Main experience: Today, all trackers, archive, tracker detail/history dialogs, calendar, progress ring, activity graph, recent activity, and loading/error/empty states.
- Customization: four themes, two layouts, Calm/Developer/Playful presentations, live preview, persistent preferences, and activity widget visibility.

## Verification evidence — 2026-10-13

- `npm test`: 20 domain/validation tests passed.
- `npm run typecheck` and `npm run lint`: passed.
- `npm run test:security`: 11 real database tests passed, using ordinary authenticated and anonymous contexts.
- Three migrations replayed successfully from a fresh local database.
- `npm run build`: production build passed with Webpack.
- Playwright: three critical flows passed on both development and production servers, including logout/login restoration, all tracker types, entry editing, customization, mobile navigation, and archive history.
- Visual inspection: desktop Paper, developer Terminal, playful Pastel, and mobile screens inspected/captured using real persisted test data. Improved activity density and removed a CSS class collision from the progress ring.

## Release work remaining

- Configure and verify hosted Supabase/Vercel deployment and hosted email confirmation.
- Resolve or reassess the development-tool `braces` advisory reported by npm audit; no compatible patched version was reported during setup.
- Broader cross-browser/manual product testing before calling this a production release.

Source is initialized as a Git repository; no commit or push has been made. Local setup is documented in [../README.md](../README.md).
