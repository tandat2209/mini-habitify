# mini-habitify implementation roadmap

Product requirements: [product-brief.md](product-brief.md).

## Implemented locally

- Foundation: Next.js App Router, strict TypeScript, Tailwind, shadcn/ui, Supabase browser/server clients, auth session proxy, and environment example.
- Authentication: signup, login, logout, protected dashboard, persistent authenticated sessions, email-based password recovery, expired/reused-link handling, and session sign-out after a successful password reset.
- Database: profiles, trackers, tracker_logs, shared read-only themes, user_preferences, dashboard_widgets; nine reproducible migrations; RLS, ownership constraints, indexes, date/timezone validation, and atomic appearance/widget saves.
- Core tracking: four tracker types, creation/editing/archiving, check-ins, log editing/deletion, weekday schedules, targets, daily/weekly/monthly periods, shared pure tracker engine.
- Main experience: Today, all trackers, archive, tracker detail/history dialogs and shareable pages, calendar month navigation, date filtering, daily trend charts, progress ring, activity graph, recent activity, and loading/error/empty states.
- Activity templates: private reusable definitions, immutable versions, visual field building/reordering, live preview, advanced JSON import, optional structured details, and original-version historical editing.
- Customization: five themes, two layouts, Calm/Developer/Playful presentations, live preview, persistent preferences, and visibility and ordering for summary/activity/recent widgets, and ready-made Calm/Developer/Playful presets.

## Verification evidence — 2026-10-13

- `npm test`: 20 domain/validation tests passed.
- `npm run typecheck` and `npm run lint`: passed.
- `npm run test:security`: 11 real database tests passed, using ordinary authenticated and anonymous contexts.
- The initial three migrations replayed successfully from a fresh local database.
- `npm run build`: production build passed with Webpack.
- Playwright: three critical flows passed on both development and production servers, including logout/login restoration, all tracker types, entry editing, customization, mobile navigation, and archive history.
- Visual inspection: desktop Paper, developer Terminal, playful Pastel, and mobile screens inspected/captured using real persisted test data. Improved activity density and removed a CSS class collision from the progress ring.

## Release work remaining

- Fresh setup instructions and GitHub CI are prepared; first hosted CI execution remains unverified. See [deployment.md](deployment.md).
- Configure and verify hosted Supabase/Vercel deployment and hosted email confirmation.
- Resolve or reassess the development-tool `braces` advisory reported by npm audit; no compatible patched version was reported during setup.
- Broader cross-browser/manual product testing before calling this a production release.

The initial app is committed locally as `be38ba2`; subsequent feature work is not yet committed. Local setup is documented in [../README.md](../README.md).

## 2026-10-14 — Experience, history, and recovery follow-up

- Presets now apply a coherent theme, layout, and widget arrangement. Developer leads with the graph and compact tracker rows. Playful leads with a seven-day journey, larger cards, and hides recent activity by default. Calm retains the editorial dashboard.
- Users can independently show/hide all three widgets and reorder them with accessible up/down controls. One invoker RPC validates and saves the whole configuration atomically. Existing data is preserved.
- Tracker history has a protected URL, previous/next month controls, inclusive date filters, entry pagination, a daily trend chart, and a readable chart-data table. Trends use engine aggregation and exclude future dates and dates before tracker creation.
- Account recovery is implemented through Supabase reset emails, token-hash verification (with PKCE callback compatibility), new-password validation, and global sign-out after reset. Local emails are tested through Mailpit; hosted template configuration remains a deployment step.
- Database fixtures use the current user-timezone date instead of a hardcoded day.
- Verification: 30 unit tests, 12 real database tests, type checking, linting, formatting, and the production build passed. All six browser flows passed against the production build, including another-user history denial, reused-link rejection, and password recovery through a real local email.
- Visual inspection: Developer and Playful dashboard presets plus desktop/mobile history. Mobile history has no document overflow; date filters stack vertically on narrow screens.

## 2026-10-14 — Template-aware activity tracking, Phase 1

- Reused trackers/check-ins and added private reusable activity templates, immutable field versions, nullable tracker associations, JSONB details, and recorded version references.
- Added generic text, number, date, select, multi-select, and string-list fields with server and direct-database validation. Empty details preserve immediate progress recording; required fields apply to submitted content.
- Added JSON template import/version publication, tracker template selection, optional details on check-in, and historical display/editing against the recorded schema. Template changes/removal preserve historical content. No activity-specific logic was introduced.
- Preserved the legacy RPC signature and metric engine. New migrations were applied without resetting local data. The disposable migration test replays all seven migrations and verifies a pre-upgrade log's original columns, legacy retries, and edits.
- Verification: 39 unit tests, 18 real database tests, type checking, linting, formatting, and production build passed. Seven production browser flows passed, covering optional/required details, all six inputs, reusable templates, version publication, current-version new entries, original-version edits, removal, refresh persistence, mobile history, keyboard focus, existing tracking/customization, ownership denial, and email recovery. Exact option-value and whitespace-only content regressions are covered.
- Phase 2 subjects and grouping remain deferred. Phase 3 visual template building, nested objects, analytics, and AI features remain deferred. Hosted deployment remains unverified and was not performed.

## 2026-10-15 — Neumorphism theme

- Added a fifth selectable theme with soft raised cards/buttons, inset form controls, gray surfaces, pink accents, visible focus, and reduced-motion support. It uses the existing live preview, cancellation, persistence, layouts, and experience selection.
- Applied the additive theme-catalog migration without resetting existing data. All eight migrations replay successfully in the disposable migration test.
- Verification: 40 unit tests, 19 real database tests, type checking, linting, formatting, and production build passed. All eight production browser flows passed. The new browser flow verifies preview cancellation, persistence after refresh, unchanged check-in values, mobile history, inset form controls, keyboard focus, reduced motion, and no mobile overflow. Desktop and mobile screenshots were visually inspected.

## 2026-10-15 — Adjustable primary colors

- Added a color picker, hex input, five quick colors, live preview/cancel, and reset to theme defaults in Appearance. Custom accents work across all five themes and persist alongside layout/widgets.
- Added contrast-aware button text, accent ink, focus, progress/chart colors, and consistent colors in portalled dialogs and full history pages.
- Applied the nullable preference migration without resetting data. All nine migrations replay in the isolated test database; older appearance RPCs remain compatible.
- Verification: 45 unit tests, 22 real database tests, type checking, linting, formatting, and production build passed. All nine production browser flows passed. The new browser flow covers invalid drafts, cancellation, save/refresh, dialog/full-history consistency, reset persistence, mobile color controls, and unchanged check-ins. Blue Neumorphism desktop/mobile screenshots were inspected.

## 2026-10-15 — Visual activity template builder

- Replaced JSON-first authoring with labelled fields, six input types, editable choices, required toggles, and add/remove/reorder controls. Stable field keys are generated automatically and retained during edits.
- Added a live form preview, separate mobile Build/Preview views, and shared-schema validation with actionable errors. Preview values are never saved as check-ins. JSON import/copy remains available under Advanced JSON.
- Reused immutable template publication and existing tracker associations. Historical entries remain readable and editable against their original fields. No migration or dependency was needed; subjects remain deferred.
- Verification: 48 unit tests, 22 real database tests, type checking, linting, formatting, and production build passed. All ten browser flows passed across the final suite and focused rerun. Coverage includes all field types, invalid/duplicate choices, stable keys, reordering, preview isolation, real persistence, historical editing, mobile view switching, keyboard navigation, and visible header/save controls. Desktop/mobile screenshots were inspected. The updated production preview runs on port 3011; no deployment was performed.

## 2026-10-15 — Themed dropdown controls

- Replaced all 13 user-facing native selects with one shared Radix-based control across tracker forms, Appearance, template building, previews, and historical check-in details. Menus follow all five themes and custom accents, including inside dialog portals; mobile uses the same touch-friendly control.
- Preserved empty choices, exact user-defined option values, tracker defaults, disabled tracker-type edits, validation, and existing persistence. No dependency, schema, server mutation, or tracker-engine change was needed.
- Verification: 48 unit tests, type checking, linting, formatting, production build, and diff whitespace checks passed. All 11 browser flows passed across the sequential suite and focused rerun, covering keyboard selection, Escape/focus restoration, saved goal/icon/accent choices after refresh, disabled controls, mobile menus, templates/details/history, theme persistence, and account recovery. Desktop/mobile menu screenshots were inspected. A parallel run encountered dashboard-loading timeouts; sequential execution cleared those timeouts. The updated local preview runs on port 3011.
