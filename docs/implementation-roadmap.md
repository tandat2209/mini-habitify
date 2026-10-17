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

- Vercel and hosted Supabase are configured; first GitHub CI run passed. See [deployment.md](deployment.md).
- Configure a sender domain/custom SMTP and verify hosted confirmation/recovery plus signed-in acceptance checks.
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

## 2026-10-15 — First hosted deployment

- Deployed `a3f8110` to https://mini-habitify.vercel.app with the hosted Supabase project in Singapore. Applied all nine migrations through the authenticated CLI and verified remote migration history.
- Configured the three Production app variables, exact Site URL, and `/auth/callback` redirect. The redeployment with the verified origin is Ready and assigned to the production domain.
- GitHub CI passed formatting/lint, 48 unit tests, the production audit, 22 database tests, migration replay, build/type checking, and 11 browser flows against its disposable local stack. Hosted schema inspection confirms RLS on all eight tables; anonymous reads return no private data and five themes are public. Live login/signup and unauthenticated dashboard redirects were checked.
- Hosted authenticated flows and real email delivery remain unverified. The user has no sender domain yet; custom SMTP/templates are a follow-up. Email confirmation was not disabled and no local records were copied to the hosted database.

## 2026-10-15 — PWA foundation (local)

- Added install manifest, standalone/iPhone metadata, app/maskable/Apple icons, production service-worker registration, install guidance, and safe-area support. Kept the existing mobile experience after the user confirmed the fit issue had cleared.
- Only the public offline fallback is cached. Offline screens disclose that activities require a connection; private content and authentication responses are not cached, and mutations are not queued.
- Verification: 48 unit tests, lint, type checking, formatting, production build, and whitespace checks passed. The 11 existing Chromium flows passed, and the new PWA flow passed in Chromium and iPhone-sized WebKit: manifest/icon dimensions, installation guidance, worker control/update headers, real saved tracker persistence, offline fallback, no private Cache Storage entries, online recovery, and no horizontal overflow. The iPhone WebKit screenshot and app icon were inspected.
- CI is configured to install WebKit and run the added iPhone PWA project, but this changed CI configuration has not yet run on GitHub. Physical iPhone Home Screen installation and standalone/keyboard behavior still need a device check. PWA implementation is ready for publication; hosted PWA deployment and physical-device verification remain pending.

## 2026-10-15 — OAuth MCP foundation (local)

- Added `/mcp` with stateless Streamable HTTP, protected-resource discovery, six generic tools, shared tracker mutations, optional versioned details, request bounds, and a persistent per-connection rate limiter. Added consent with optional tracking writes, login continuation, and Connected apps with immediate revocation and server-address guidance.
- Added an additive migration for connection permissions/rate limits, restrictive OAuth RLS, and the custom access-token hook. First-party login and tracker calculations remain unchanged. OAuth JWTs are bound to the approved resource and grant, with a separate resource-session identity to block account APIs; `openid` requests are refused to prevent identity-token issuance. Supported scope is `email`. See [setup and security limitations](mcp.md).
- Verification: 59 unit tests, 22 existing real-database tests, all 10 migrations with legacy compatibility and OAuth RLS/rate-limit assertions, lint, formatting, type checking, production build, and production dependency audit passed. All 17 browser tests passed against the production build (Chromium plus iPhone WebKit PWA). The four MCP flows were then rerun after the final wording/keyboard/security-test additions and passed: real DCR/PKCE/consent, access and refresh tokens, generic refresh isolation, no identity token, account API denial, create/check-in/web persistence, retry IDs, read-only/direct-API/ownership boundaries, grant rotation/revocation, template version history, forged tokens, body-size bounds, login continuation, mobile keyboard/decline, and refusal of fresh/existing-grant OpenID escalation. Mobile screenshots were inspected.
- Local Supabase was restarted with OAuth and the hook enabled while preserving its data. No hosted migration, OAuth setting, deployment, commit, or push was performed for this feature. Hosted activation requires the documented migration/deployment/hook/signing-key/OAuth sequence and an actual assistant compatibility check. Clients that require OpenID/UserInfo remain unsupported; a physical-device consent flow is unverified. These OAuth account-boundary tests must remain release gates when upgrading Supabase.

## 2026-10-15 — Hosted MCP schema rollout repair

- Production commit `178de36` deployed before its database migration, causing `/settings/connections` to return 500 when querying the missing `mcp_connections` table. Reproduced the signed-in failure and confirmed remote history stopped at `202610150002`.
- Reviewed a linked dry run showing only `202610150003_mcp_oauth.sql`, then applied that additive migration to hosted project `xaqehhirrjyhkcigpfve`. No database reset or existing tracking-data mutation was performed. Reloaded the signed-in production page and verified the server address and empty connections view render successfully.
- Hosted OAuth and the custom access-token hook are still not enabled. The page correctly displays the pending OAuth setup message; public assistant connections remain unavailable until that setup and a hosted OAuth security/compatibility check are completed.
- Release sequencing: additive database migrations must be applied and verified before pushing/promoting application code that requires them, because pushing main triggers Vercel automatically. CI checks a disposable database and does not migrate production.

## 2026-10-16 — MCP OAuth gateway (local)

- Added an application OAuth issuer with public dynamic registration, exact callbacks, S256 PKCE, canonical resource validation, opaque access/refresh tokens, token-family revocation on refresh reuse, and a revocation endpoint. Uses maintained `@node-oauth/oauth2-server` protocol handling. Discovery advertises tracking scopes rather than Supabase identity scopes.
- Reused native Supabase consent, resource-isolated upstream grants, signed user JWTs, shared tracker mutations, and existing RLS. Upstream credentials are AES-256-GCM encrypted in a private schema; assistant tokens are stored only as hashes. The gateway PostgreSQL role cannot access tracking tables. No service-role key or user-data bypass was added.
- Consent shows the actual downstream callback/scopes and checks browser/request binding. A same-origin POST and full navigation avoid consuming callbacks during framework rerenders. OAuth paths bypass PWA navigation fallback. Legacy native email-only clients remain compatible.
- Applied the additive local migration without resetting tracking data. Added isolated migration assertions for API-user storage denial, restricted-role privileges, disconnect deletion, and grant rotation. Added a local-only credential setup script and CI setup step; no credentials are committed.
- Verification: 63 unit tests, 22 database security tests, all 11 migrations with legacy compatibility and gateway/RLS boundaries, formatting, lint, type checking, production build, and whitespace checks passed. All 21 browser tests passed against the production build, including iPhone WebKit PWA, the four new gateway flows, and all existing direct OAuth/tracking/template/appearance/recovery tests. Gateway tests cover real upstream refresh, encrypted/hashed storage, account API rejection, read-only/ownership boundaries, persistence, code replay/PKCE, client/resource/scope checks, refresh-family revocation, disconnect, malformed/forged requests, and cross-origin consent denial. Desktop/mobile consent screenshots were inspected; mobile has no horizontal overflow. Production dependency audit reported zero vulnerabilities.
- Hosted migration `202610160001` was applied and verified before publication; all 11 local/remote versions match. The restricted role remains without login credentials. Gateway activation still requires its database login, encryption key, deployment, and actual ChatGPT/Cursor reconnect verification. CI configuration is updated but has not run remotely. CIMD, confidential clients, OIDC/UserInfo/enterprise identity linking, and encryption-key rotation tooling are not implemented. See [gateway rollout](mcp.md#gateway-deployment).

## 2026-10-16 — Hosted database TLS compatibility

- The first hosted pooler probe rejected its certificate chain with Node’s default roots. Added the public Supabase Root 2021 CA from the dashboard, explicit certificate/hostname validation, and removal of URL SSL overrides before passing options to `pg`. Local loopback connections remain unchanged. No TLS verification was disabled.
- Provisioned the restricted hosted gateway login through the authenticated management CLI and verified a real TLS connection: OAuth-schema usage succeeds, tracker SELECT and log INSERT privileges are false. The generated URL/key are temporarily held outside the repository with owner-only permissions until Vercel secret setup completes; no credential values were printed.
- Verification for the TLS fix: 65 unit tests, type checking, lint, production build, formatting, and a real restricted hosted TLS connection passed. A focused browser rerun was stopped because local Supabase Auth stopped responding (health request timed out after 15 seconds and signups stalled before gateway execution). The earlier full 21-browser suite and published gateway CI passed; this blocked rerun is not a new browser pass.

## 2026-10-16 — Hosted gateway activation

- Saved the restricted database URL and encryption key as Production-only Vercel Secrets and redeployed `a1459b4`. Deployment `BZE4F5SmyhRhTo2fGGa9fgTCbRnU` is Ready and assigned to https://mini-habitify.vercel.app.
- Live resource and AS discovery return 200, use the application issuer, and advertise only tracking scopes. Public client registration returns 201. With explicit user approval, exercised browser consent for a temporary read-only client, code exchange (200), MCP tools discovery (200), code replay rejection (400), write-scope escalation rejection (400), refresh (200), and old-token invalidation (401). No identity token was issued; no tracking records were read or changed.
- Disconnected the temporary app in Connected apps; its access and refresh tokens then returned 401 and 400. Existing native Cursor access was preserved. Temporary credential/code/token files were removed after verification; deployment secrets are stored in Vercel, not source control.
- GitHub CI for `a1459b4` passed, including its full browser suite. This clears the release check that was blocked by the local Auth outage. Actual ChatGPT linking and a new Cursor gateway connection still require client-side acceptance; recreate failed/cached ChatGPT links and remove old static Supabase overrides when migrating Cursor.

## Agent management — 2026-10-16

- Added MCP template create/get/update/archive, partial tracker updates (including archive/restore and template attachment/removal), and partial historical check-in corrections. Existing tracker/template listing and template-aware creation/recording remain; `record_checkin` aliases `record_check_in`.
- Reused generic persisted template versions and ownership rules. Added textarea and bounded integer rating fields across database validation, shared Zod schemas, builder, and check-in controls. Field upserts preserve unrelated definitions, explicit removal creates a new version, and expected-version checks reject stale writes. Historical data continues using its recorded schema.
- Safe template archival preserves versions/logs and existing associations while blocking new associations and schema edits. Archived options are hidden from the library; an existing tracker retains its selected association.
- Added a separate template-management consent flag, default false for existing connections. Fresh explicit write consent includes templates. Older connections retain their existing tracking access and must reconnect to grant template writes. Account/appearance access remains outside this change.
- Verification: 69 unit tests, 23 real-database security/persistence tests, 13-migration replay with legacy preservation and OAuth consent boundaries, type checking, lint, and production build passed. The local gateway DDIA workflow passed, including template creation, weekly habit creation, structured check-in, partial updates, stale-write denial, historical-schema correction, safe archival, and refresh persistence. Mobile rating/textarea creation, keyboard navigation, bounds, and saved-template reopening passed; screenshot inspected. All 23 production browser tests passed across the app/PWA suite and the OAuth/MCP rerun after aligning the test origin. An initial parallel development run timed out during dashboard loading; the sequential rerun passed. The first production OAuth run correctly rejected a port/resource mismatch; rebuilding with the configured test origin cleared it. Final OAuth/MCP regressions passed 9/9 in 17.4 seconds; the full DDIA workflow took 2.9 seconds after replacing a retryable serialization error with an explicit version conflict.
- Hosted rollout: applied additive migrations `202610160002` and `202610160003` before the requested main-branch push; all 13 local/remote migration versions match. No reset, seed, or tracking-record mutation was performed. Remaining acceptance: verify the resulting deployment, refresh the plugin tool catalog, reconnect older clients for template-write consent, and run the natural-language DDIA acceptance prompt in actual ChatGPT. Local explicit tool-call tests do not prove hosted ChatGPT tool selection.


## 2026-10-16 — OAuth write-scope discovery correction

- A real ChatGPT connection requested only `tracking:read`, hiding the optional write checkbox. Reproduced the root cause with an unauthenticated MCP request: the `WWW-Authenticate` challenge requested only read despite discovery advertising both tracking scopes.
- Align the gateway challenge with the existing supported scope list. Request both read/write capabilities initially; the management checkbox remains explicit opt-in, and explicit read-only requests/grants are not upgraded.
- Verification: the new challenge regression failed before the fix, then passed; the real OAuth read-only/PKCE flow also passed. Type checking and lint passed. Existing in-flight/cached read-only client requests need a fresh connection after rollout.

## 2026-10-17 — Consolidated settings navigation

- One Settings button in the dashboard header groups Templates, Appearance, and Agent connections. Removed the repeated appearance controls and the separate connections sidebar entry; existing editors, preference persistence, and connection management remain in use.
- Verification: 69 unit tests, type checking, lint, formatting, production build, and 13 browser flows passed. Browser coverage includes desktop/mobile Settings navigation, keyboard opening and Escape/focus restoration, the connections destination, and existing template, appearance, tracking, history, and recovery flows.

## 2026-10-17 — Compact tracker details button

- Moved Add/Edit details into the tracker footer action group with Check in. Actions wrap together while history stays separate, preventing the details button from occupying the narrow icon column in Compact layout.
- Verification: the mobile text-overflow regression failed before the fix and passed afterward; all four affected template/tracking browser flows, type checking, lint, formatting, and whitespace checks passed. Neumorphism Compact card screenshots were inspected at 390px and 1280px.

## 2026-10-17 — Themed page canvas and mobile overscroll

- HTML/body backgrounds now use the app's theme tokens, and browser `theme-color` follows preview/save/cancel. Authentication restores Paper; the manifest's initial launch color remains Paper until the personalized app renders.
- Disabled document overscroll bounce/chaining with CSS while retaining normal scrolling and unrestricted browser zoom.
- Verification: the canvas regression failed before the fix; both Chromium and iPhone WebKit passed the new preview/cancel/save/refresh/navigation/logout test. All seven production browser checks passed across PWA offline/install behavior, appearance/custom colors, Settings, and the new canvas flows. All 69 unit tests, type checking, lint, formatting, production build, and whitespace checks passed. The iPhone WebKit screenshot was inspected. Physical iPhone status-bar tint and native gesture acceptance remain unverified by emulation.
